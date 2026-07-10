/**
 * Generisk katalog-import for Timer-modulen (lønnsarter, aktiviteter, tillegg).
 *
 * Bakgrunn: A.Markussen har en SmartDok-katalog med firmaegne koder som må inn i
 * SiteDoc uten å ødelegge eksisterende (delvis seedede) rader. Verktøyet er
 * bevisst GENERISK — kundedata leveres som `katalog`-input (se
 * fixtures/a-markussen.json), aldri hardkodet. Lønnsart-koder er per firma
 * (timer.md § Eksport-kode ved migrering) og skal aldri ligge i en delt seed.
 *
 * Match-rekkefølge per rad:
 *   1) på `kode` innen org (idempotens — rader importert før hoppes over)
 *   2) ellers på eksakt `navn` innen org (fester kode på eksisterende kodeløs rad)
 *   3) ellers på `matchNavn`-alias innen org (når prod-navnet avviker fra
 *      katalog-navnet, f.eks. prod «Innleid arbeidskraft» → SmartDok
 *      «Timer innleid arbeidskraft») — hindrer at en matchende rad blir duplisert
 *   4) ellers opprett
 *
 * Garantier:
 *   - Aldri slett. Umatchede seedede rader kan settes `aktiv=false`
 *     (`deaktiverUmatchede` per tabell) — refererte rader (RESTRICT-FK) berøres
 *     kun med UPDATE, aldri DELETE.
 *   - Aldri erstatt en referert rad. Match → in-place UPDATE av samme id.
 *   - Idempotent. Ny kjøring med samme katalog = alle rader «hoppOver».
 *
 * Kritisk rekkefølge i transaksjonen (lønnsart-standard):
 *   1) nullstill `erStandardvalg` på alle rader i org
 *   2) opprett/oppdater/deaktiver alle rader
 *   3) sett `erStandardvalg=true` på raden med `kode === standardKode`
 *
 * `dryRun` bygger og returnerer planen uten å skrive noe.
 */

import { prismaTimer } from "@sitedoc/db-timer";

// ---------------------------------------------------------------------------
//  Input-typer
// ---------------------------------------------------------------------------

export interface KatalogLonnsart {
  kode: string;
  navn: string;
  type: string;
  tvungenKommentar?: boolean;
  matchNavn?: string[];
}

export interface KatalogAktivitet {
  kode: string;
  navn: string;
  matchNavn?: string[];
  internkostnad?: number;
  prisMotKunde?: number;
}

export interface KatalogTillegg {
  kode: string;
  navn: string;
  type: string;
  tvungenKommentar?: boolean;
  matchNavn?: string[];
}

export interface Katalog {
  lonnsarter: KatalogLonnsart[];
  aktiviteter: KatalogAktivitet[];
  tillegg: KatalogTillegg[];
  /** Lønnsart-kode som skal settes som standardvalg (settes sist). */
  standardKode?: string;
}

export interface ImporterOpsjoner {
  dryRun: boolean;
  deaktiverUmatchede: { lonnsarter: boolean; aktiviteter: boolean; tillegg: boolean };
  standardKode?: string;
}

export type Tabell = "lonnsart" | "aktivitet" | "tillegg";
export type Handling = "opprett" | "oppdater" | "deaktiver" | "hoppOver";

export interface RadPlan {
  tabell: Tabell;
  kode: string | null;
  navn: string;
  handling: Handling;
  begrunnelse: string;
}

export interface ImporterResultat {
  dryRun: boolean;
  plan: RadPlan[];
  oppsummering: {
    opprettet: number;
    oppdatert: number;
    deaktivert: number;
    hoppetOver: number;
    nullstiltStandardvalg: number;
    standardKodeSatt: string | null;
  };
}

// ---------------------------------------------------------------------------
//  Intern normalisert form
// ---------------------------------------------------------------------------

interface EksisterendeRad {
  id: string;
  kode: string | null;
  navn: string;
  aktiv: boolean;
  tvungenKommentar: boolean | null; // null for aktivitet (feltet finnes ikke)
  seedNivaa: number | null;
}

interface FixtureRad {
  kode: string;
  navn: string;
  type?: string;
  tvungenKommentar?: boolean;
  matchNavn?: string[];
  internkostnad?: number;
  prisMotKunde?: number;
}

/** En konkret skrive-operasjon utledet av planleggingen. */
type Operasjon =
  | { art: "opprett"; tabell: Tabell; fixture: FixtureRad }
  | { art: "oppdater"; tabell: Tabell; id: string; data: Record<string, unknown> }
  | { art: "deaktiver"; tabell: Tabell; id: string };

interface TabellPlan {
  plan: RadPlan[];
  operasjoner: Operasjon[];
  matchedeIder: Set<string>;
}

// ---------------------------------------------------------------------------
//  Planlegging (ren funksjon — ingen DB-skriving)
// ---------------------------------------------------------------------------

function planleggTabell(
  tabell: Tabell,
  eksisterende: EksisterendeRad[],
  fixtureRader: FixtureRad[],
  deaktiverUmatchede: boolean,
): TabellPlan {
  const plan: RadPlan[] = [];
  const operasjoner: Operasjon[] = [];
  const matchedeIder = new Set<string>();

  const perKode = new Map<string, EksisterendeRad>();
  const perNavn = new Map<string, EksisterendeRad>();
  for (const rad of eksisterende) {
    if (rad.kode) perKode.set(rad.kode, rad);
    perNavn.set(rad.navn, rad);
  }

  for (const fx of fixtureRader) {
    // 1) match på kode
    let treff = perKode.get(fx.kode);
    let matchType = "kode";
    // 2) match på eksakt navn
    if (!treff) {
      treff = perNavn.get(fx.navn);
      matchType = "navn";
    }
    // 3) match på matchNavn-alias
    if (!treff && fx.matchNavn) {
      for (const alias of fx.matchNavn) {
        const kandidat = perNavn.get(alias);
        if (kandidat && !matchedeIder.has(kandidat.id)) {
          treff = kandidat;
          matchType = `alias «${alias}»`;
          break;
        }
      }
    }

    if (treff && !matchedeIder.has(treff.id)) {
      matchedeIder.add(treff.id);

      const data: Record<string, unknown> = {};
      const endringer: string[] = [];
      if (treff.kode !== fx.kode) {
        data.kode = fx.kode;
        endringer.push(`kode ${treff.kode ?? "(tom)"}→${fx.kode}`);
      }
      if (treff.navn !== fx.navn) {
        data.navn = fx.navn;
        endringer.push(`navn «${treff.navn}»→«${fx.navn}»`);
      }
      if (
        fx.tvungenKommentar !== undefined &&
        treff.tvungenKommentar !== null &&
        treff.tvungenKommentar !== fx.tvungenKommentar
      ) {
        data.tvungenKommentar = fx.tvungenKommentar;
        endringer.push(`tvungenKommentar→${fx.tvungenKommentar}`);
      }

      if (endringer.length === 0) {
        plan.push({
          tabell,
          kode: fx.kode,
          navn: fx.navn,
          handling: "hoppOver",
          begrunnelse: `Matchet på ${matchType}, allerede à jour`,
        });
      } else {
        operasjoner.push({ art: "oppdater", tabell, id: treff.id, data });
        plan.push({
          tabell,
          kode: fx.kode,
          navn: fx.navn,
          handling: "oppdater",
          begrunnelse: `Matchet på ${matchType}: ${endringer.join(", ")}`,
        });
      }
    } else {
      operasjoner.push({ art: "opprett", tabell, fixture: fx });
      plan.push({
        tabell,
        kode: fx.kode,
        navn: fx.navn,
        handling: "opprett",
        begrunnelse: "Ingen match i org → opprettes",
      });
    }
  }

  // Umatchede seedede rader → deaktiver (kun aktive, kun seedede — manuelle
  // rader med seedNivaa=null berøres aldri automatisk).
  if (deaktiverUmatchede) {
    for (const rad of eksisterende) {
      if (!matchedeIder.has(rad.id) && rad.aktiv && rad.seedNivaa !== null) {
        operasjoner.push({ art: "deaktiver", tabell, id: rad.id });
        plan.push({
          tabell,
          kode: rad.kode,
          navn: rad.navn,
          handling: "deaktiver",
          begrunnelse: "Ikke i katalog (seedet rad) → aktiv=false (soft-delete)",
        });
      }
    }
  }

  return { plan, operasjoner, matchedeIder };
}

// ---------------------------------------------------------------------------
//  Hovedfunksjon
// ---------------------------------------------------------------------------

export async function importerKatalog(
  organizationId: string,
  katalog: Katalog,
  opsjoner: ImporterOpsjoner,
): Promise<ImporterResultat> {
  const standardKode = opsjoner.standardKode ?? katalog.standardKode ?? null;

  // Last eksisterende rader
  const [lonnsarter, aktiviteter, tillegg] = await Promise.all([
    prismaTimer.lonnsart.findMany({
      where: { organizationId },
      select: { id: true, kode: true, navn: true, aktiv: true, tvungenKommentar: true, seedNivaa: true, erStandardvalg: true },
    }),
    prismaTimer.aktivitet.findMany({
      where: { organizationId },
      select: { id: true, kode: true, navn: true, aktiv: true, seedNivaa: true },
    }),
    prismaTimer.tillegg.findMany({
      where: { organizationId },
      select: { id: true, kode: true, navn: true, aktiv: true, tvungenKommentar: true, seedNivaa: true },
    }),
  ]);

  const lonnsartPlan = planleggTabell(
    "lonnsart",
    lonnsarter.map((r) => ({ id: r.id, kode: r.kode, navn: r.navn, aktiv: r.aktiv, tvungenKommentar: r.tvungenKommentar, seedNivaa: r.seedNivaa })),
    katalog.lonnsarter,
    opsjoner.deaktiverUmatchede.lonnsarter,
  );
  const aktivitetPlan = planleggTabell(
    "aktivitet",
    aktiviteter.map((r) => ({ id: r.id, kode: r.kode, navn: r.navn, aktiv: r.aktiv, tvungenKommentar: null, seedNivaa: r.seedNivaa })),
    katalog.aktiviteter,
    opsjoner.deaktiverUmatchede.aktiviteter,
  );
  const tilleggPlan = planleggTabell(
    "tillegg",
    tillegg.map((r) => ({ id: r.id, kode: r.kode, navn: r.navn, aktiv: r.aktiv, tvungenKommentar: r.tvungenKommentar, seedNivaa: r.seedNivaa })),
    katalog.tillegg,
    opsjoner.deaktiverUmatchede.tillegg,
  );

  const plan = [...lonnsartPlan.plan, ...aktivitetPlan.plan, ...tilleggPlan.plan];
  const operasjoner = [...lonnsartPlan.operasjoner, ...aktivitetPlan.operasjoner, ...tilleggPlan.operasjoner];

  // Standardvalg: hvor mange aktive erStandardvalg må nullstilles?
  const nullstiltStandardvalg = lonnsarter.filter((r) => r.erStandardvalg).length;
  const standardKodeSatt =
    standardKode !== null && katalog.lonnsarter.some((l) => l.kode === standardKode) ? standardKode : null;

  const oppsummering = {
    opprettet: plan.filter((p) => p.handling === "opprett").length,
    oppdatert: plan.filter((p) => p.handling === "oppdater").length,
    deaktivert: plan.filter((p) => p.handling === "deaktiver").length,
    hoppetOver: plan.filter((p) => p.handling === "hoppOver").length,
    nullstiltStandardvalg,
    standardKodeSatt,
  };

  if (opsjoner.dryRun) {
    // eslint-disable-next-line no-console
    console.log(`[importerKatalog] DRY-RUN org=${organizationId}:`, JSON.stringify(oppsummering));
    return { dryRun: true, plan, oppsummering };
  }

  await prismaTimer.$transaction(async (tx) => {
    // Steg 1 — nullstill alle standardvalg i org (fjerner bl.a. feilplassert km-stjerne)
    if (nullstiltStandardvalg > 0) {
      await tx.lonnsart.updateMany({
        where: { organizationId, erStandardvalg: true },
        data: { erStandardvalg: false },
      });
      // eslint-disable-next-line no-console
      console.log(`[importerKatalog] nullstilte erStandardvalg på ${nullstiltStandardvalg} rad(er)`);
    }

    // Steg 2 — opprett/oppdater/deaktiver
    for (const op of operasjoner) {
      if (op.art === "opprett") {
        const fx = op.fixture;
        if (op.tabell === "lonnsart") {
          await tx.lonnsart.create({
            data: {
              organizationId,
              kode: fx.kode,
              navn: fx.navn,
              type: fx.type ?? "ordinaer",
              tvungenKommentar: fx.tvungenKommentar ?? false,
            },
          });
        } else if (op.tabell === "aktivitet") {
          await tx.aktivitet.create({
            data: {
              organizationId,
              kode: fx.kode,
              navn: fx.navn,
              internkostnad: fx.internkostnad ?? null,
              prisMotKunde: fx.prisMotKunde ?? null,
            },
          });
        } else {
          await tx.tillegg.create({
            data: {
              organizationId,
              kode: fx.kode,
              navn: fx.navn,
              type: fx.type ?? "avhuking",
              tvungenKommentar: fx.tvungenKommentar ?? false,
            },
          });
        }
        // eslint-disable-next-line no-console
        console.log(`[importerKatalog] opprettet ${op.tabell} ${fx.kode} «${fx.navn}»`);
      } else if (op.art === "oppdater") {
        if (op.tabell === "lonnsart") await tx.lonnsart.update({ where: { id: op.id }, data: op.data });
        else if (op.tabell === "aktivitet") await tx.aktivitet.update({ where: { id: op.id }, data: op.data });
        else await tx.tillegg.update({ where: { id: op.id }, data: op.data });
        // eslint-disable-next-line no-console
        console.log(`[importerKatalog] oppdaterte ${op.tabell} id=${op.id}:`, JSON.stringify(op.data));
      } else {
        if (op.tabell === "lonnsart") await tx.lonnsart.update({ where: { id: op.id }, data: { aktiv: false } });
        else if (op.tabell === "aktivitet") await tx.aktivitet.update({ where: { id: op.id }, data: { aktiv: false } });
        else await tx.tillegg.update({ where: { id: op.id }, data: { aktiv: false } });
        // eslint-disable-next-line no-console
        console.log(`[importerKatalog] deaktiverte ${op.tabell} id=${op.id}`);
      }
    }

    // Steg 3 — sett standardvalg til slutt
    if (standardKodeSatt) {
      await tx.lonnsart.updateMany({
        where: { organizationId, kode: standardKodeSatt },
        data: { erStandardvalg: true },
      });
      // eslint-disable-next-line no-console
      console.log(`[importerKatalog] satte erStandardvalg på kode=${standardKodeSatt}`);
    }
  });

  return { dryRun: false, plan, oppsummering };
}
