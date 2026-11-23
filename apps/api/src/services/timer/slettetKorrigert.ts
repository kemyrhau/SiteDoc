// ============================================================================
//  SL2 — leseren bak siden «Slettet og korrigert» (plan web-timeføring § 4.18
//  del B og del D; vedtak-timer-web.md § Slettet og korrigert punkt 1–3).
//
//  Kenneth 2026-11-23: «s1 nei -> det hører ikke til i attesteringen som da blir
//  griset til. skal være egen visning», «s2 ja», «B76: ja · B77: nei · B78: ja»,
//  lesningene L1 og L2 «Ja, begge».
//
//  Hendelsene på siden:
//  - Slettet: postene i `sheet_rad_historikk` med `hendelse: "slettet"` (SL1). Arbeiderens
//    slettinger spores bare på en returnert dag, så hver slik post er en sletting på returnert
//    dag (L1); attestantens sletting har samme markør (SV5).
//  - Korrigert: linjer en annen enn eieren har korrigert — samme kilde og regel som merket
//    «Korrigert av» (`hentKorrigeringerForSedler`, B73). Arbeiderens egne rettinger er ikke med
//    (B77 nei): de spores ikke.
//  - Ikke med: gjenåpninger, rettinger uten markør på en linje som ikke lenger finnes, og poster
//    uten innhold (slettet før SL1, del C «Det som alt er slettet, kommer ikke tilbake»).
//
//  Leseren filtrerer ikke på tilgang selv: kalleren gir sedlene (firma, periode, eventuelt
//  bare egne) og omfanget pr. linje (`iOmfang`) og navneskjulet (`synlig`).
// ============================================================================

import type { Context } from "../../trpc/context";
import {
  HISTORIKK_HENDELSE_SLETTET,
  hentByggeplassNavn,
  hentKorrigeringerForSedler,
  hentUnderprosjektNavn,
  hentUtstyrOppslag,
  type KorrigertFelt,
  type RadType,
} from "./kortLeser";

export type SkLinjetype = "timer" | "reise" | "maskin" | "tillegg" | "vare" | "utlegg";

export interface SkHendelse {
  /** Historikkpostens id (slettet) eller «radtype:rad-id» (korrigert). */
  id: string;
  type: "slettet" | "korrigert";
  linjetype: SkLinjetype;
  // Innholdet i linja (null når linjetypen ikke har feltet).
  fraTid: string | null;
  tilTid: string | null;
  timer: number | null;
  /** Lønnsart, maskin, tillegg, utleggskategori eller vare. */
  navn: string | null;
  aktivitet: string | null;
  antall: number | null;
  enhet: string | null;
  belop: number | null;
  kommentar: string | null;
  /** Korrigert: feltene før → etter (samme form som «Korrigert av»). Slettet: tom. */
  felter: KorrigertFelt[];
  // Kortet linja hørte til.
  projectId: string | null;
  prosjekt: string | null;
  byggeplass: string | null;
  underprosjekt: string | null;
  /** Hvem som slettet eller korrigerte. Navnet, aldri e-post; null = ukjent. */
  avNavn: string | null;
  /** Den som gjorde det er eieren av dagen (bare mulig for slettet: på returnert dag). */
  avEier: boolean;
  ved: Date;
  /** Dagen var returnert da linja ble slettet (arbeiderens sletting spores bare da, L1). */
  dagenVarReturnert: boolean;
}

export interface SkDag {
  sedelId: string;
  /** ISO-dato YYYY-MM-DD. */
  dato: string;
  /** Dagens status nå («draft» | «sent» | «returned» | «accepted»). */
  status: string;
  ansatt: { id: string; navn: string | null };
  hendelser: SkHendelse[];
  /** Tallet i merket «N slettet» (L2: bare slettede linjer). Klienten teller ikke selv. */
  antallSlettet: number;
}

type Klienter = Pick<Context, "prisma" | "prismaTimer" | "prismaMaskin" | "prismaVarelager">;

type Snap = Record<string, unknown>;

const RADTYPER = new Set(["timer", "maskin", "tillegg", "utlegg", "vare"]);

/** Feltene en slettet linje må ha for å kunne vises uten raden (del D SL2 test 4). */
const PAAKREVD: Record<string, readonly string[]> = {
  timer: ["lonnsartId", "timer"],
  maskin: ["vehicleId", "timer"],
  tillegg: ["tilleggId", "antall"],
  utlegg: ["expenseCategoryId"],
  vare: ["vareId", "antall"],
};

/** Ren regel: posten er en sletting med innhold som kan vises. */
export function erSlettingMedInnhold(radType: string, snapshot: unknown): boolean {
  if (!RADTYPER.has(radType) || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const snap = snapshot as Snap;
  if (snap.hendelse !== HISTORIKK_HENDELSE_SLETTET) return false;
  return (PAAKREVD[radType] ?? []).every((f) => Object.prototype.hasOwnProperty.call(snap, f) && snap[f] !== null && snap[f] !== undefined);
}

const tall = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
};
const tekst = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const unike = (ider: Iterable<string | null | undefined>): string[] =>
  Array.from(new Set(Array.from(ider).filter((id): id is string => typeof id === "string" && id !== "")));

export interface SkSedel {
  id: string;
  userId: string;
  organizationId: string;
  dato: Date;
  status: string;
  timer: ReadonlyArray<Snap & { id: string }>;
  tillegg: ReadonlyArray<Snap & { id: string }>;
  maskiner: ReadonlyArray<Snap & { id: string }>;
}

export interface SkValg {
  organizationId: string;
  /** Linja er innenfor brukerens omfang (prosjektlederen: sine prosjekter; null = uten prosjekt). */
  iOmfang: (projectId: string | null) => boolean;
  /** Navneskjulet fra attesteringen: prosjektets navn vises bare når true. */
  synlig: (projectId: string | null) => boolean;
}

/** Sedlene i perioden, med de levende radene (uten «erstattet», som attesteringen). */
export async function hentSkSedler(
  k: Pick<Klienter, "prismaTimer">,
  where: { organizationId: string; fra: Date; til: Date; userId?: string },
): Promise<SkSedel[]> {
  const levende = { attestertStatus: { not: "erstattet" } };
  const sedler = await k.prismaTimer.dailySheet.findMany({
    where: {
      organizationId: where.organizationId,
      dato: { gte: where.fra, lte: where.til },
      ...(where.userId ? { userId: where.userId } : {}),
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      dato: true,
      status: true,
      // `attestertStatus` er null på rader som aldri er attestert — `not` alene slipper dem ikke gjennom.
      timer: { where: { OR: [levende, { attestertStatus: null }] } },
      tillegg: { where: { OR: [levende, { attestertStatus: null }] } },
      maskiner: { where: { OR: [levende, { attestertStatus: null }] } },
    },
    orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
  });
  return sedler as unknown as SkSedel[];
}

/**
 * Hendelsene pr. dag. Dager uten hendelser i omfanget er ikke med. Rekkefølge: dato, så ansatt;
 * innen dagen tidspunktet hendelsen skjedde.
 */
export async function lesSlettetOgKorrigert(k: Klienter, sedler: readonly SkSedel[], valg: SkValg): Promise<SkDag[]> {
  if (sedler.length === 0) return [];
  const sedelIder = sedler.map((s) => s.id);
  const eier = new Map(sedler.map((s) => [s.id, s.userId]));

  // 1. Slettet: postene med markøren (SL1), siste pr. linje.
  const poster = await k.prismaTimer.sheetRadHistorikk.findMany({
    where: { sheetId: { in: sedelIder }, snapshot: { path: ["hendelse"], equals: HISTORIKK_HENDELSE_SLETTET } },
    select: { id: true, radType: true, originalRadId: true, sheetId: true, snapshot: true, erstattetAvUserId: true, erstattetVed: true },
    orderBy: { erstattetVed: "desc" },
  });
  const sistePr = new Map<string, (typeof poster)[number]>();
  for (const p of poster) {
    if (!erSlettingMedInnhold(p.radType, p.snapshot)) continue;
    const nokkel = `${p.radType}:${p.originalRadId}`;
    if (!sistePr.has(nokkel)) sistePr.set(nokkel, p);
  }
  const slettet = Array.from(sistePr.values()).filter((p) => valg.iOmfang(tekst((p.snapshot as Snap).projectId)));

  // 2. Korrigert: merket «Korrigert av» (B73), bare linjer i omfanget.
  const korrigeringer = await hentKorrigeringerForSedler(
    { prisma: k.prisma, prismaTimer: k.prismaTimer, prismaMaskin: k.prismaMaskin },
    valg.organizationId,
    sedler.map((s) => ({ id: s.id, userId: s.userId, organizationId: s.organizationId, timer: s.timer, tillegg: s.tillegg, maskiner: s.maskiner })),
  );
  const radOppslag = new Map<string, Snap & { id: string }>();
  for (const s of sedler) {
    for (const r of s.timer) radOppslag.set(`timer:${r.id}`, r);
    for (const r of s.tillegg) radOppslag.set(`tillegg:${r.id}`, r);
    for (const r of s.maskiner) radOppslag.set(`maskin:${r.id}`, r);
  }
  const korrigert: { sedelId: string; radType: RadType; rad: Snap & { id: string }; k: { avNavn: string | null; ved: Date; felter: KorrigertFelt[] } }[] = [];
  for (const [sedelId, pr] of korrigeringer) {
    for (const [nokkel, kor] of pr) {
      const rad = radOppslag.get(nokkel);
      if (!rad || !valg.iOmfang(tekst(rad.projectId))) continue;
      korrigert.push({ sedelId, radType: nokkel.split(":")[0] as RadType, rad, k: kor });
    }
  }

  // 3. Navnene på innholdet (én runde oppslag).
  const alleRader: Snap[] = [...slettet.map((p) => p.snapshot as Snap), ...korrigert.map((x) => x.rad)];
  const felt = (f: string) => unike(alleRader.map((r) => tekst(r[f])));
  const [lonnsart, aktivitet, tillegg, kategori, vare, utstyr, prosjekt, byggeplass, eco, brukere] = await Promise.all([
    felt("lonnsartId").length ? k.prismaTimer.lonnsart.findMany({ where: { id: { in: felt("lonnsartId") } }, select: { id: true, navn: true } }) : [],
    felt("aktivitetId").length ? k.prismaTimer.aktivitet.findMany({ where: { id: { in: felt("aktivitetId") } }, select: { id: true, navn: true } }) : [],
    felt("tilleggId").length ? k.prismaTimer.tillegg.findMany({ where: { id: { in: felt("tilleggId") } }, select: { id: true, navn: true } }) : [],
    felt("expenseCategoryId").length
      ? k.prismaTimer.expenseCategory.findMany({ where: { id: { in: felt("expenseCategoryId") } }, select: { id: true, navn: true } })
      : [],
    felt("vareId").length ? k.prismaVarelager.vare.findMany({ where: { id: { in: felt("vareId") } }, select: { id: true, navn: true, enhet: true } }) : [],
    hentUtstyrOppslag(k.prismaMaskin, felt("vehicleId")),
    felt("projectId").length
      ? k.prisma.project.findMany({ where: { id: { in: felt("projectId") } }, select: { id: true, name: true, projectNumber: true, internalProjectNumber: true } })
      : [],
    hentByggeplassNavn(k.prisma, felt("byggeplassId")),
    hentUnderprosjektNavn(k.prisma, felt("externalCostObjectId"), valg.organizationId),
    k.prisma.user.findMany({
      where: { id: { in: unike([...sedler.map((s) => s.userId), ...slettet.map((p) => p.erstattetAvUserId)]) } },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const navnAv = <T extends { id: string; navn: string }>(liste: readonly T[]) => new Map(liste.map((x) => [x.id, x.navn]));
  const lonnsartNavn = navnAv(lonnsart);
  const aktivitetNavn = navnAv(aktivitet);
  const tilleggNavn = navnAv(tillegg);
  const kategoriNavn = navnAv(kategori);
  const vareOppslag = new Map(vare.map((v) => [v.id, v]));
  const prosjektNavn = new Map(prosjekt.map((p) => [p.id, [p.internalProjectNumber ?? p.projectNumber, p.name].filter(Boolean).join(" ")]));
  const brukerNavn = new Map(brukere.map((b) => [b.id, b.name?.trim() || null]));
  const ansattNavn = new Map(brukere.map((b) => [b.id, b.name?.trim() || b.email || null]));

  // Prosjektnavn i «før → etter» følger navneskjulet (et prosjekt utenfor omfanget vises ikke).
  const skjulProsjekt = (felter: KorrigertFelt[]): KorrigertFelt[] =>
    felter.map((f) =>
      f.felt !== "projectId"
        ? f
        : {
            ...f,
            foerTekst: typeof f.foer === "string" && !valg.synlig(f.foer) ? null : f.foerTekst,
            etterTekst: typeof f.etter === "string" && !valg.synlig(f.etter) ? null : f.etterTekst,
          },
    );

  const innhold = (radType: string, r: Snap) => {
    const projectId = tekst(r.projectId);
    const synlig = valg.synlig(projectId);
    const vareId = tekst(r.vareId);
    const linjetype: SkLinjetype = radType === "timer" && r.erReise === true ? "reise" : (radType as SkLinjetype);
    const navn =
      radType === "timer"
        ? (lonnsartNavn.get(tekst(r.lonnsartId) ?? "") ?? null)
        : radType === "maskin"
          ? (utstyr.navn.get(tekst(r.vehicleId) ?? "") ?? null)
          : radType === "tillegg"
            ? (tilleggNavn.get(tekst(r.tilleggId) ?? "") ?? null)
            : radType === "utlegg"
              ? (kategoriNavn.get(tekst(r.expenseCategoryId) ?? "") ?? null)
              : // Varen: navnet lagret i sporet (SL1), ellers katalogen.
                (tekst(r.varenavn) ?? (vareId ? (vareOppslag.get(vareId)?.navn ?? null) : null));
    return {
      linjetype,
      fraTid: tekst(r.fraTid),
      tilTid: tekst(r.tilTid),
      timer: radType === "timer" || radType === "maskin" ? tall(r.timer) : null,
      navn,
      aktivitet: radType === "timer" ? (aktivitetNavn.get(tekst(r.aktivitetId) ?? "") ?? null) : null,
      antall: radType === "tillegg" || radType === "vare" ? tall(r.antall) : radType === "maskin" ? tall(r.mengde) : null,
      enhet: radType === "vare" ? (tekst(r.enhet) ?? (vareId ? (vareOppslag.get(vareId)?.enhet ?? null) : null)) : radType === "maskin" ? tekst(r.enhet) : null,
      belop: radType === "utlegg" ? tall(r.belop) : null,
      kommentar: radType === "utlegg" || radType === "tillegg" || radType === "vare" ? tekst(r.kommentar) : tekst(r.beskrivelse),
      projectId,
      prosjekt: projectId && synlig ? (prosjektNavn.get(projectId) ?? null) : null,
      byggeplass: synlig ? (byggeplass.get(tekst(r.byggeplassId) ?? "") ?? null) : null,
      underprosjekt: synlig ? (eco.get(tekst(r.externalCostObjectId) ?? "")?.navn ?? null) : null,
    };
  };

  const prDag = new Map<string, SkHendelse[]>(sedler.map((s) => [s.id, []]));
  for (const p of slettet) {
    const avEier = p.erstattetAvUserId !== null && p.erstattetAvUserId === eier.get(p.sheetId);
    prDag.get(p.sheetId)?.push({
      id: p.id,
      type: "slettet",
      ...innhold(p.radType, p.snapshot as Snap),
      felter: [],
      avNavn: p.erstattetAvUserId ? (brukerNavn.get(p.erstattetAvUserId) ?? null) : null,
      avEier,
      ved: p.erstattetVed,
      dagenVarReturnert: avEier,
    });
  }
  for (const x of korrigert) {
    prDag.get(x.sedelId)?.push({
      id: `${x.radType}:${x.rad.id}`,
      type: "korrigert",
      ...innhold(x.radType, x.rad),
      felter: skjulProsjekt(x.k.felter),
      avNavn: x.k.avNavn,
      avEier: false,
      ved: x.k.ved,
      dagenVarReturnert: false,
    });
  }

  const ut: SkDag[] = [];
  for (const s of sedler) {
    const hendelser = (prDag.get(s.id) ?? []).sort((a, b) => a.ved.getTime() - b.ved.getTime());
    if (hendelser.length === 0) continue;
    ut.push({
      sedelId: s.id,
      dato: s.dato.toISOString().slice(0, 10),
      status: s.status,
      ansatt: { id: s.userId, navn: ansattNavn.get(s.userId) ?? null },
      hendelser,
      antallSlettet: hendelser.filter((h) => h.type === "slettet").length,
    });
  }
  return ut.sort((a, b) => a.dato.localeCompare(b.dato) || (a.ansatt.navn ?? "").localeCompare(b.ansatt.navn ?? "", "nb"));
}
