/**
 * Nota Import Service — akkumulering og avviksrapport
 *
 * Importerer A-nota/Sluttnota til FtdNotaPeriod + FtdNotaPost.
 * Matcher nota-poster mot budsjett (FtdSpecPost) via postnr.
 * Beregner forrige-verdier og kjører akkumuleringskontroll.
 */
import type { PrismaClient } from "@sitedoc/db";

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

export interface AvvikRad {
  postnr: string;
  felt: "mengdeTotal" | "verdiTotal" | "enhetspris";
  forventet: number;
  faktisk: number;
  differanse: number;
}

export type Scenario = 1 | 2 | 3;

export interface ScenarioResultat {
  scenario: Scenario;
  forrigePeriodeId: string | null;
  forrigePeriodeNr: number | null;
  /** Ved scenario 3: manglende periodeNr-er mellom forrige og gjeldende */
  manglendeNr: number[];
  /** Retroaktiv import: påfølgende perioder som bør reimporteres */
  påfølgendeNr: number[];
}

export interface ImportResultat {
  periodeId: string;
  scenario: Scenario;
  antallPoster: number;
  antallNyePoster: number;
  antallOppdaterteBudsjett: number;
  avvik: AvvikRad[];
  totalVerdiDenne: number;
  totalVerdiTotal: number;
  gapFlagg: boolean;
  /** Retroaktiv: påfølgende perioder som bør reimporteres */
  påfølgendeNr: number[];
}

export interface ImportInput {
  projectId: string;
  kontraktId: string;
  documentId: string;
  periodeNr: number;
  erSluttnota: boolean;
  userId: string;
  gapGodkjent?: boolean;
}

// ---------------------------------------------------------------------------
// Scenario-bestemmelse
// ---------------------------------------------------------------------------

export async function bestemScenario(
  prisma: PrismaClient,
  kontraktId: string,
  periodeNr: number,
  erSluttnota: boolean,
): Promise<ScenarioResultat> {
  // Hent alle eksisterende perioder for kontrakten, sortert synkende
  const eksisterende = await prisma.ftdNotaPeriod.findMany({
    where: { kontraktId },
    orderBy: { periodeNr: "desc" },
    select: { id: true, periodeNr: true, erSluttnota: true },
  });

  // Filtrer bort sluttnota fra forrige-søk (sluttnota er alltid "etter" alle A-notas)
  const ordinære = eksisterende.filter((p) => !p.erSluttnota);

  if (ordinære.length === 0) {
    return { scenario: 1, forrigePeriodeId: null, forrigePeriodeNr: null, manglendeNr: [], påfølgendeNr: [] };
  }

  const siste = ordinære[0]!; // Høyeste periodeNr

  // Finn påfølgende perioder (for retroaktiv import-varsling)
  const påfølgendeNr = ordinære
    .filter((p) => p.periodeNr > periodeNr)
    .map((p) => p.periodeNr)
    .sort((a, b) => a - b);
  // Inkluder sluttnota hvis den finnes
  const harSluttnota = eksisterende.some((p) => p.erSluttnota);

  if (erSluttnota) {
    return { scenario: 2, forrigePeriodeId: siste.id, forrigePeriodeNr: siste.periodeNr, manglendeNr: [], påfølgendeNr: [] };
  }

  if (siste.periodeNr === periodeNr - 1) {
    return { scenario: 2, forrigePeriodeId: siste.id, forrigePeriodeNr: siste.periodeNr, manglendeNr: [], påfølgendeNr };
  }

  if (siste.periodeNr < periodeNr - 1) {
    const manglendeNr: number[] = [];
    for (let n = siste.periodeNr + 1; n < periodeNr; n++) {
      manglendeNr.push(n);
    }
    return { scenario: 3, forrigePeriodeId: siste.id, forrigePeriodeNr: siste.periodeNr, manglendeNr, påfølgendeNr };
  }

  // periodeNr <= siste.periodeNr: retroaktiv import
  const under = ordinære.find((p) => p.periodeNr < periodeNr);
  if (!under) {
    return { scenario: 1, forrigePeriodeId: null, forrigePeriodeNr: null, manglendeNr: [], påfølgendeNr };
  }

  if (under.periodeNr === periodeNr - 1) {
    return { scenario: 2, forrigePeriodeId: under.id, forrigePeriodeNr: under.periodeNr, manglendeNr: [], påfølgendeNr };
  }

  const manglendeNr: number[] = [];
  for (let n = under.periodeNr + 1; n < periodeNr; n++) {
    if (!ordinære.some((p) => p.periodeNr === n)) {
      manglendeNr.push(n);
    }
  }
  return { scenario: 3, forrigePeriodeId: under.id, forrigePeriodeNr: under.periodeNr, manglendeNr, påfølgendeNr };
}

// ---------------------------------------------------------------------------
// Akkumuleringskontroll
// ---------------------------------------------------------------------------

const TOLERANSE = 0.02; // ±2 øre

interface NotaPostData {
  postnr: string;
  mengdeDenne: number;
  mengdeTotal: number;
  verdiDenne: number;
  verdiTotal: number;
  prosentFerdig: number;
  enhetspris: number;
}

interface ForrigePostData {
  mengdeTotal: number;
  verdiTotal: number;
  mengdeDenne: number;
  verdiDenne: number;
}

function kontrollerAkkumulering(
  notaPost: NotaPostData,
  forrigePost: ForrigePostData | null,
): AvvikRad[] {
  if (!forrigePost) return [];

  const avvik: AvvikRad[] = [];

  // Mengde: forventet total = forrige total + denne
  const forventetMengdeTotal = forrigePost.mengdeTotal + notaPost.mengdeDenne;
  if (notaPost.mengdeTotal !== 0 && Math.abs(notaPost.mengdeTotal - forventetMengdeTotal) > TOLERANSE) {
    avvik.push({
      postnr: notaPost.postnr,
      felt: "mengdeTotal",
      forventet: forventetMengdeTotal,
      faktisk: notaPost.mengdeTotal,
      differanse: notaPost.mengdeTotal - forventetMengdeTotal,
    });
  }

  // Verdi: forventet total = forrige total + denne
  const forventetVerdiTotal = forrigePost.verdiTotal + notaPost.verdiDenne;
  if (notaPost.verdiTotal !== 0 && Math.abs(notaPost.verdiTotal - forventetVerdiTotal) > TOLERANSE) {
    avvik.push({
      postnr: notaPost.postnr,
      felt: "verdiTotal",
      forventet: forventetVerdiTotal,
      faktisk: notaPost.verdiTotal,
      differanse: notaPost.verdiTotal - forventetVerdiTotal,
    });
  }

  // Enhetspris: beregn fra verdi/mengde og sammenlign med forrige
  if (notaPost.mengdeDenne > 0 && forrigePost.mengdeDenne > 0) {
    const prisNy = notaPost.verdiDenne / notaPost.mengdeDenne;
    const prisForrige = forrigePost.verdiDenne / forrigePost.mengdeDenne;
    if (Math.abs(prisNy - prisForrige) > 2 && prisForrige > 0) {
      avvik.push({
        postnr: notaPost.postnr,
        felt: "enhetspris",
        forventet: prisForrige,
        faktisk: prisNy,
        differanse: prisNy - prisForrige,
      });
    }
  }

  return avvik;
}

// ---------------------------------------------------------------------------
// Hovedfunksjon: importerNotaTilPeriode
// ---------------------------------------------------------------------------

export async function importerNotaTilPeriode(
  prisma: PrismaClient,
  input: ImportInput,
): Promise<ImportResultat | { kreverGapGodkjenning: true; manglendeNr: number[] }> {
  const { projectId, kontraktId, documentId, periodeNr, erSluttnota, userId, gapGodkjent } = input;

  // ─── STEG 1: Validering ───
  const dokument = await prisma.ftdDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: { id: true, filename: true },
  });

  await prisma.ftdKontrakt.findUniqueOrThrow({
    where: { id: kontraktId },
  });

  // ─── STEG 2: Bestem scenario ───
  const scenarioResultat = await bestemScenario(prisma, kontraktId, periodeNr, erSluttnota);
  let effektivtScenario = scenarioResultat.scenario;

  if (effektivtScenario === 3 && !gapGodkjent) {
    return { kreverGapGodkjenning: true, manglendeNr: scenarioResultat.manglendeNr };
  }

  // Gap godkjent → importer som scenario 1 (alle verdier fra kilde, ingen akkumulering)
  if (effektivtScenario === 3) {
    effektivtScenario = 1;
  }

  // ─── STEG 3: Hent budsjett-poster (master) ───
  // Finn budsjett-dokumentet for kontrakten (nyeste anbudsgrunnlag)
  const budsjettDok = await prisma.ftdDocument.findFirst({
    where: {
      kontraktId,
      docType: "anbudsgrunnlag",
    },
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });

  const budsjettPoster = budsjettDok
    ? await prisma.ftdSpecPost.findMany({
        where: { documentId: budsjettDok.id },
        select: { id: true, postnr: true, mengdeAnbud: true, enhetspris: true, sumAnbud: true },
      })
    : [];

  const budsjettMap = new Map<string, (typeof budsjettPoster)[number]>();
  for (const bp of budsjettPoster) {
    if (bp.postnr) budsjettMap.set(bp.postnr, bp);
  }

  // ─── STEG 4: Hent nota-poster fra kildedokumentet ───
  const notaPoster = await prisma.ftdSpecPost.findMany({
    where: { documentId },
    select: {
      postnr: true, beskrivelse: true, enhet: true,
      mengdeAnbud: true, mengdeDenne: true, mengdeTotal: true,
      enhetspris: true, sumAnbud: true,
      verdiDenne: true, verdiTotal: true, prosentFerdig: true,
    },
  });

  // ─── STEG 5: Hent forrige notas FtdNotaPost (kun scenario 2) ───
  let forrigeMap = new Map<string, ForrigePostData>();

  if (effektivtScenario === 2 && scenarioResultat.forrigePeriodeId) {
    const forrigePoster = await prisma.ftdNotaPost.findMany({
      where: { periodId: scenarioResultat.forrigePeriodeId },
      include: { specPost: { select: { postnr: true } } },
    });
    for (const fp of forrigePoster) {
      if (fp.specPost.postnr) {
        forrigeMap.set(fp.specPost.postnr, {
          mengdeTotal: Number(fp.mengdeTotal ?? 0),
          verdiTotal: Number(fp.verdiTotal ?? 0),
          mengdeDenne: Number(fp.mengdeDenne ?? 0),
          verdiDenne: Number(fp.verdiDenne ?? 0),
        });
      }
    }
  }

  // ─── STEG 6: Opprett FtdNotaPeriod ───
  // Slett eventuell eksisterende periode med samme kontraktId + periodeNr
  await prisma.ftdNotaPeriod.deleteMany({
    where: { kontraktId, periodeNr: erSluttnota ? 9999 : periodeNr },
  });

  const periode = await prisma.ftdNotaPeriod.create({
    data: {
      projectId,
      kontraktId,
      documentId,
      periodeNr: erSluttnota ? 9999 : periodeNr,
      erSluttnota,
      gapFlagg: scenarioResultat.scenario === 3,
      type: "a_nota",
      kildeFilnavn: dokument.filename,
      importertAv: userId,
    },
  });

  // ─── STEG 7: Bygg FtdNotaPost-array og samle avvik ───
  const alleAvvik: AvvikRad[] = [];
  const notaPostData: Array<{
    periodId: string;
    specPostId: string;
    mengdeDenne: number | null;
    mengdeTotal: number | null;
    mengdeForrige: number | null;
    verdiDenne: number | null;
    verdiTotal: number | null;
    verdiForrige: number | null;
    prosentFerdig: number | null;
    enhetspris: number | null;
    mengdeAnbud: number | null;
    sumAnbud: number | null;
  }> = [];

  let antallNyePoster = 0;
  const nyeSpecPoster: Array<{
    projectId: string;
    documentId: string;
    postnr: string;
    beskrivelse: string | null;
    enhet: string | null;
    ikkeIBudsjett: boolean;
  }> = [];

  // Samle nye poster som trenger FtdSpecPost
  for (const np of notaPoster) {
    if (!np.postnr) continue;
    if (!budsjettMap.has(np.postnr)) {
      nyeSpecPoster.push({
        projectId,
        documentId: budsjettDok?.id ?? documentId,
        postnr: np.postnr,
        beskrivelse: np.beskrivelse,
        enhet: np.enhet,
        ikkeIBudsjett: true,
      });
    }
  }

  // Batch-opprett nye FtdSpecPost
  if (nyeSpecPoster.length > 0) {
    await prisma.ftdSpecPost.createMany({
      data: nyeSpecPoster,
      skipDuplicates: true,
    });
    antallNyePoster = nyeSpecPoster.length;

    // Hent de nyopprettede postene og legg til i budsjettMap
    const nyePoster = await prisma.ftdSpecPost.findMany({
      where: {
        projectId,
        postnr: { in: nyeSpecPoster.map((p) => p.postnr) },
        ikkeIBudsjett: true,
      },
      select: { id: true, postnr: true, mengdeAnbud: true, enhetspris: true, sumAnbud: true },
    });
    for (const p of nyePoster) {
      if (p.postnr) budsjettMap.set(p.postnr, p);
    }
  }

  // Bygg FtdNotaPost-objekter
  for (const np of notaPoster) {
    if (!np.postnr) continue;

    const bp = budsjettMap.get(np.postnr);
    if (!bp) continue; // Skal ikke skje etter batch-opprett over

    const mengdeDenne = Number(np.mengdeDenne ?? 0);
    const mengdeTotal = Number(np.mengdeTotal ?? 0);
    const verdiDenne = Number(np.verdiDenne ?? 0);
    const verdiTotal = Number(np.verdiTotal ?? 0);
    const prosentFerdig = Number(np.prosentFerdig ?? 0);
    const enhetsprisVal = Number(np.enhetspris ?? 0);

    // Forrige-verdier
    let mengdeForrige: number | null = null;
    let verdiForrige: number | null = null;

    if (effektivtScenario === 2) {
      const forrige = forrigeMap.get(np.postnr);
      mengdeForrige = forrige?.mengdeTotal ?? 0;
      verdiForrige = forrige?.verdiTotal ?? 0;

      // Akkumuleringskontroll
      const postAvvik = kontrollerAkkumulering(
        { postnr: np.postnr, mengdeDenne, mengdeTotal, verdiDenne, verdiTotal, prosentFerdig, enhetspris: enhetsprisVal },
        forrige ?? null,
      );
      alleAvvik.push(...postAvvik);
    }

    notaPostData.push({
      periodId: periode.id,
      specPostId: bp.id,
      mengdeDenne: mengdeDenne || null,
      mengdeTotal: mengdeTotal || null,
      mengdeForrige,
      verdiDenne: verdiDenne || null,
      verdiTotal: verdiTotal || null,
      verdiForrige,
      prosentFerdig: prosentFerdig || null,
      enhetspris: enhetsprisVal || null,
      mengdeAnbud: Number(bp.mengdeAnbud ?? 0) || null,
      sumAnbud: Number(bp.sumAnbud ?? 0) || null,
    });
  }

  // Batch-opprett alle FtdNotaPost
  if (notaPostData.length > 0) {
    await prisma.ftdNotaPost.createMany({ data: notaPostData });
  }

  // ─── STEG 7b: Oppdater budsjett-poster med nota-verdier ───
  // Nota (Excel) har korrekte verdier — oppdater budsjettpost hvis den
  // mangler eller har avvikende mengde/enhetspris/sum.
  let antallOppdaterteBudsjett = 0;
  for (const np of notaPoster) {
    if (!np.postnr) continue;
    const bp = budsjettMap.get(np.postnr);
    if (!bp) continue;

    const notaMengde = np.mengdeAnbud != null ? Number(np.mengdeAnbud) : null;
    const notaPris = np.enhetspris != null ? Number(np.enhetspris) : null;
    const notaSum = np.sumAnbud != null ? Number(np.sumAnbud) : null;

    // Hopp over hvis nota ikke har verdier
    if (notaMengde == null && notaPris == null && notaSum == null) continue;

    const bpMengde = bp.mengdeAnbud != null ? Number(bp.mengdeAnbud) : null;
    const bpPris = bp.enhetspris != null ? Number(bp.enhetspris) : null;
    const bpSum = bp.sumAnbud != null ? Number(bp.sumAnbud) : null;

    // Oppdater hvis budsjett mangler verdier eller har vesentlig avvik
    const manglerMengde = bpMengde == null || bpMengde === 0;
    const manglerPris = bpPris == null || bpPris === 0;
    const manglerSum = bpSum == null || bpSum === 0;
    const prisAvvik = notaPris != null && bpPris != null && bpPris !== 0
      ? Math.abs(bpPris - notaPris) / notaPris
      : 0;

    if (manglerMengde || manglerPris || manglerSum || prisAvvik > 0.5) {
      const oppdatering: Record<string, number> = {};
      if (notaMengde != null && (manglerMengde || prisAvvik > 0.5)) oppdatering.mengdeAnbud = notaMengde;
      if (notaPris != null && (manglerPris || prisAvvik > 0.5)) oppdatering.enhetspris = notaPris;
      if (notaSum != null && (manglerSum || prisAvvik > 0.5)) oppdatering.sumAnbud = notaSum;

      if (Object.keys(oppdatering).length > 0) {
        await prisma.ftdSpecPost.update({
          where: { id: bp.id },
          data: oppdatering,
        });
        antallOppdaterteBudsjett++;
      }
    }
  }
  if (antallOppdaterteBudsjett > 0) {
    console.log(`[nota-import] Oppdaterte ${antallOppdaterteBudsjett} budsjett-poster med nota-verdier for kontrakt ${kontraktId}`);
  }

  // ─── STEG 8: Oppdater periode-totaler ───
  const totalVerdiDenne = notaPostData.reduce((s, p) => s + Number(p.verdiDenne ?? 0), 0);
  const totalVerdiTotal = notaPostData.reduce((s, p) => s + Number(p.verdiTotal ?? 0), 0);
  const totalMengdeDenne = notaPostData.reduce((s, p) => s + Number(p.mengdeDenne ?? 0), 0);

  await prisma.ftdNotaPeriod.update({
    where: { id: periode.id },
    data: {
      totalVerdiDenne: totalVerdiDenne || null,
      totalMengdeDenne: totalMengdeDenne || null,
    },
  });

  return {
    periodeId: periode.id,
    scenario: scenarioResultat.scenario,
    antallPoster: notaPostData.length,
    antallNyePoster,
    antallOppdaterteBudsjett,
    avvik: alleAvvik,
    totalVerdiDenne,
    totalVerdiTotal,
    gapFlagg: scenarioResultat.scenario === 3,
    påfølgendeNr: scenarioResultat.påfølgendeNr,
  };
}
