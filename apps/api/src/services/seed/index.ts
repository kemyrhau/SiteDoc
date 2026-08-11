/**
 * Seed-mekanisme for Timer-modul + andre firma-relaterte kataloger.
 *
 * Brukes når et nytt firma (Organization) opprettes, eller når firma-admin
 * aktiverer Timer-modulen via /dashbord/firma/timer/onboarding.
 *
 * To onboarding-modus per timer.md § Onboarding:
 *   - A) «Nytt firma»: auto-importer Nivå 1 (16 lønnsarter), tilby Nivå 2 valgfritt
 *   - B) «Migrerer»: tom katalog, bruker importerer fra eksisterende system
 *
 * Idempotens: hver seed-funksjon sjekker eksisterende rader for samme
 * organisasjon × seedNivaa. Re-kjøring legger ikke til duplikater og kaster
 * ikke feil — returnerer { antall: 0, hoppet: true } hvis allerede seedet.
 */

import { prismaTimer } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { generateProjectNumber } from "@sitedoc/shared";

export interface SeedResultat {
  antall: number;
  hoppet: boolean;
}

// ============================================================================
//  Policy-respekt (steg 2, modul-onboarding 2026-08-11)
//
//  «Aldri onboardet» og «har bevisst egen katalog» ser identiske ut i data.
//  OrganizationSeedPolicy (kjerne-db) registrerer avviket eksplisitt: en
//  datatype med policy='egen_katalog' skal ALDRI få grunnpakke seedet.
//
//  🔴 Rekkefølge er ufravikelig: policy-sjekken kalles FØR rad-tellingen i hver
//  guard. En datatype med egen_katalog skal aldri nå tellingen i det hele tatt —
//  «finnes rader?» er en idempotens-hopp-guard, ALDRI en tilstandsdetektor for
//  «er dette bevisst tomt?». Blander man dem, gjeninnfører man driften der en
//  tømming (0 rader) ville trigget re-seed av en kunde som valgte bort pakken.
//
//  Fravær av rad = 'standard' (default) → seed som normalt. Kun avvik registreres.
//  datatype-verdiene matcher backfill-scriptet: 'lonnsart' | 'aktivitet' | 'tillegg'.
// ============================================================================

async function harEgenKatalogPolicy(
  organizationId: string,
  datatype: string,
): Promise<boolean> {
  const rad = await prisma.organizationSeedPolicy.findUnique({
    where: { organizationId_datatype: { organizationId, datatype } },
    select: { policy: true },
  });
  return rad?.policy === "egen_katalog";
}

// ============================================================================
//  Nivå 1 — Norsk lovpålagt grunnpakke (16 lønnsarter)
//  Per timer.md § Lønnsart-katalog Nivå 1
// ============================================================================

const LONNSART_NIVAA_1 = [
  { type: "ordinaer",   navn: "Fastlønn (månedslønn)" },
  { type: "ordinaer",   navn: "Timelønn" },
  { type: "ordinaer",   navn: "Overtid 50%" },
  { type: "ordinaer",   navn: "Overtid 100%" },
  { type: "fravaer",    navn: "Sykemelding 1–16 dager (fastlønn)" },
  { type: "fravaer",    navn: "Sykemelding 1–16 dager (timelønn)" },
  { type: "fravaer",    navn: "Sykemelding fra dag 17" },
  { type: "fravaer",    navn: "Egenmelding inntil 3 dager" },
  { type: "fravaer",    navn: "Barns sykdom" },
  { type: "fravaer",    navn: "Ferie m/lønn" },
  { type: "fravaer",    navn: "Ferie u/lønn" },
  { type: "fravaer",    navn: "Permittering m/lønn" },
  { type: "fravaer",    navn: "Permittering u/lønn" },
  { type: "fravaer",    navn: "Bevegelig helligdag" },
  { type: "feriepenger", navn: "Feriepenger 12%" },
  { type: "feriepenger", navn: "Feriepenger ved avslutning (inneværende år)" },
];

export async function seedLonnsartNivaa1(organizationId: string): Promise<SeedResultat> {
  // Policy FØR telling: egen_katalog → aldri seed grunnpakke.
  if (await harEgenKatalogPolicy(organizationId, "lonnsart")) {
    return { antall: 0, hoppet: true };
  }
  // Robust idempotens: «finnes rader» for HELE lonnsart-datatypen, ikke bare
  // seedNivaa=1. Et firma med importert katalog (A.Markussen: 44 lønnsarter uten
  // seedNivaa=1) skal ikke få grunnpakken lagt ved siden av importen. Tidligere
  // keyet guarden på seedNivaa=1, som var blind for import-rader.
  const finnes = await prismaTimer.lonnsart.count({
    where: { organizationId },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  const data = LONNSART_NIVAA_1.map((rad, idx) => ({
    organizationId,
    type: rad.type,
    navn: rad.navn,
    rekkefolge: idx,
    seedNivaa: 1,
    // Variant B: «Timelønn» er default auto-valgt lønnsart på ny timer-rad.
    // Firma-admin kan flytte default til en annen lønnsart (f.eks. «Fastlønn»
    // for fastlønnede firma) via lonnsart.settStandard.
    erStandardvalg: rad.navn === "Timelønn",
  }));

  const resultat = await prismaTimer.lonnsart.createMany({ data });
  return { antall: resultat.count, hoppet: false };
}

// ============================================================================
//  Nivå 2 — Bransje-relevant tilleggspakke for anlegg/bygg (25 lønnsarter)
//  Per timer.md § Lønnsart-katalog Nivå 2
// ============================================================================

const LONNSART_NIVAA_2 = [
  { type: "fravaer",  navn: "Velferdspermisjon" },
  { type: "ordinaer", navn: "Reise 7,5–15 km" },
  { type: "ordinaer", navn: "Reise 15–30 km" },
  { type: "ordinaer", navn: "Reise 30–45 km" },
  { type: "ordinaer", navn: "Reise 45–60 km" },
  { type: "ordinaer", navn: "Kilometergodtgjørelse (egen bil)" },
  { type: "ordinaer", navn: "Reise/transport til prosjekter" },
  { type: "diett",    navn: "Diett med overnatting hotell" },
  { type: "diett",    navn: "Diett enkel overnatting" },
  { type: "diett",    navn: "Diett med kokemulighet" },
  { type: "diett",    navn: "Diett uten overnatting" },
  { type: "diett",    navn: "Nattillegg trekkfritt" },
  { type: "diett",    navn: "Losji" },
  { type: "ordinaer", navn: "2. skift tillegg" },
  { type: "ordinaer", navn: "Nattskifttillegg (00–06)" },
  { type: "ordinaer", navn: "Helligdagsskifttillegg" },
  { type: "ordinaer", navn: "Smusstilleg" },
  { type: "ordinaer", navn: "Matpenger overtid (ved 2+ timer)" },
  { type: "ordinaer", navn: "Lærlingelønn (30–75% av fagarbeider)" },
  { type: "ordinaer", navn: "Overtid lærling 50%" },
  { type: "ordinaer", navn: "Overtid lærling 100%" },
  { type: "ordinaer", navn: "Praksistimer" },
  { type: "ordinaer", navn: "Innleid arbeidskraft" },
  { type: "ordinaer", navn: "Fakturerbar tid" },
  { type: "ordinaer", navn: "Timer prosjektleder" },
];

export async function seedLonnsartNivaa2(organizationId: string): Promise<SeedResultat> {
  // Policy FØR telling: egen_katalog for lonnsart dekker HELE datatypen — både
  // grunnpakke (Nivå 1) og bransje-tillegget (Nivå 2).
  if (await harEgenKatalogPolicy(organizationId, "lonnsart")) {
    return { antall: 0, hoppet: true };
  }
  // BEVISST beholdt på seedNivaa=2 (ikke «finnes rader»): Nivå 2 er et additivt
  // lag OVER Nivå 1. Wizarden (aktiverNivaa1 med inkluderNivaa2) seeder Nivå 1
  // først, så Nivå 2 — en «finnes rader»-guard ville sett de 16 Nivå 1-radene og
  // hoppet over Nivå 2, og dermed brukket den kombinerte onboarding-veien.
  // Import-beskyttelsen ligger i policy-sjekken over, ikke i denne tellingen.
  const finnes = await prismaTimer.lonnsart.count({
    where: { organizationId, seedNivaa: 2 },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  // Plasser Nivå 2 etter eksisterende rekkefølge (Nivå 1 = 0..15)
  const startRekkefolge = await prismaTimer.lonnsart.count({
    where: { organizationId },
  });

  const data = LONNSART_NIVAA_2.map((rad, idx) => ({
    organizationId,
    type: rad.type,
    navn: rad.navn,
    rekkefolge: startRekkefolge + idx,
    seedNivaa: 2,
  }));

  const resultat = await prismaTimer.lonnsart.createMany({ data });
  return { antall: resultat.count, hoppet: false };
}

// ============================================================================
//  Aktiviteter — Nivå 2 (anlegg/bygg-pakke, valgfri) — 3 stykk
//  Per timer.md § Aktivitet-katalog
// ============================================================================

const AKTIVITET_NIVAA_2 = [
  "Anleggsarbeid",
  "Maskintimer",
  "Garanti/reklamasjon",
];

export async function seedAktiviteter(organizationId: string): Promise<SeedResultat> {
  // Policy FØR telling: egen_katalog → aldri seed.
  if (await harEgenKatalogPolicy(organizationId, "aktivitet")) {
    return { antall: 0, hoppet: true };
  }
  // Robust idempotens: «finnes rader» for hele aktivitet-datatypen (kun ett nivå
  // finnes). Et firma med importerte/egendefinerte aktiviteter (seedNivaa=null)
  // skal ikke få pakken lagt ved siden av. Tidligere: count(seedNivaa=2).
  const finnes = await prismaTimer.aktivitet.count({
    where: { organizationId },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  const data = AKTIVITET_NIVAA_2.map((navn) => ({
    organizationId,
    navn,
    seedNivaa: 2,
  }));

  const resultat = await prismaTimer.aktivitet.createMany({ data });
  return { antall: resultat.count, hoppet: false };
}

// ============================================================================
//  Tillegg — Nivå 2 (anlegg/bygg-pakke, valgfri) — 3 stykk
//  Per timer.md § Tillegg
// ============================================================================

const TILLEGG_NIVAA_2 = [
  { navn: "Overtidsmat", type: "avhuking" },
  { navn: "Smusstilleg", type: "avhuking" },
  { navn: "Beredskap-vakt", type: "avhuking" },
];

export async function seedTillegg(organizationId: string): Promise<SeedResultat> {
  // Policy FØR telling: egen_katalog → aldri seed.
  if (await harEgenKatalogPolicy(organizationId, "tillegg")) {
    return { antall: 0, hoppet: true };
  }
  // Robust idempotens: «finnes rader» for hele tillegg-datatypen (kun ett nivå
  // finnes). Egendefinerte tillegg (seedNivaa=null) skal ikke få pakken lagt ved
  // siden av. Tidligere: count(seedNivaa=2).
  const finnes = await prismaTimer.tillegg.count({
    where: { organizationId },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  const data = TILLEGG_NIVAA_2.map((rad, idx) => ({
    organizationId,
    navn: rad.navn,
    type: rad.type,
    rekkefolge: idx,
    seedNivaa: 2,
  }));

  const resultat = await prismaTimer.tillegg.createMany({ data });
  return { antall: resultat.count, hoppet: false };
}

// ============================================================================
//  ExpenseCategory — standardkategorier for utlegg
//  Ingen seedNivaa-felt på modellen, så bruker antall-sjekk for idempotens.
// ============================================================================

const EXPENSE_KATEGORIER = ["Drivstoff", "Parkering", "Diett", "Verktøy", "Annet"];

export async function seedExpenseCategories(organizationId: string): Promise<SeedResultat> {
  const finnes = await prismaTimer.expenseCategory.count({
    where: { organizationId },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  const data = EXPENSE_KATEGORIER.map((navn) => ({
    organizationId,
    navn,
  }));

  const resultat = await prismaTimer.expenseCategory.createMany({ data });
  return { antall: resultat.count, hoppet: false };
}

// ============================================================================
//  Interne prosjekter — Fase 2 / T.10 (ikke-prosjekt-tid, Alt C)
//  To firma-eide bærere for internt arbeid + maskinvedlikehold.
//  VILKÅR 3 (Kenneth 2026-06-09): intern-prosjekt-seed enabler INGEN andre
//  prosjektmoduler — KUN timer-flate. Derfor oppretter denne KUN Project-rader:
//    - ingen ProjectMember (firma-ansatte når dem via type="internt"-unntak)
//    - ingen ProjectOrganization (firma-grense passerer via primaryOrganizationId)
//    - ingen ProjectModule (syncProjektModulerPaaAktiver ekskluderer type="internt")
//  Granularitet ellers via Aktivitet (firma-scoped katalog, ingen ny tabell).
// ============================================================================

const INTERNE_PROSJEKT_NAVN = [
  "Internt arbeid",
  "Verksted/maskinvedlikehold",
];

export async function seedInterneProsjekter(
  organizationId: string,
): Promise<SeedResultat> {
  const finnes = await prisma.project.count({
    where: { primaryOrganizationId: organizationId, type: "internt" },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  // Globalt løpenummer for unikt projectNumber (samme kilde som prosjekt.opprett).
  const totalt = await prisma.project.count();

  let antall = 0;
  for (let i = 0; i < INTERNE_PROSJEKT_NAVN.length; i++) {
    await prisma.project.create({
      data: {
        projectNumber: generateProjectNumber(totalt + 1 + i),
        name: INTERNE_PROSJEKT_NAVN[i]!,
        type: "internt",
        primaryOrganizationId: organizationId,
      },
    });
    antall++;
  }

  return { antall, hoppet: false };
}

// ============================================================================
//  Generisk seed-dispatch ved firmamodul-aktivering (steg 3, 2026-08-11)
//
//  ÉN aktiveringsvei: organisasjon.settFirmamodul aktiverer modulen i kjerne-tx
//  og kaller DERETTER denne dispatchen — samme transaksjonsplassering som
//  modul.aktiver bruker for hms-avvik. Men kryss-DB (katalog i modul-db,
//  aktivering i kjerne-db) gjør at seeden IKKE kan ligge i samme tx: aktiver
//  (commit) → seed etterpå. timer.onboarding.aktiverNivaa1 er en tynn inngang
//  oppå den (base-katalog via denne + Nivå 2 på toppen ved inkluderNivaa2),
//  ikke en konkurrerende sti.
//
//  🔴 Feil svelges ALDRI (Blokk 19/24): hver datatype seedes i sin egen
//  try/catch, og feil samles i `feil[]` (datatype + melding) i stedet for at én
//  feilende datatype blokkerer resten. Kalleren logger listen tydelig med
//  organizationId. Modulen er aktivert selv om en seed feiler (aktiv modul +
//  tom katalog = dagens problem) — men feilen er SYNLIG, og steg 5 lar
//  onboarding.status rapportere 'mangler'. En stille catch her ville reprodusert
//  nøyaktig problemet fiksen fjerner.
//
//  Hooks per modul:
//    - timer     → base-katalog (grunnpakke, policy-bevisst fra steg 2) + interne
//                  prosjekter (infrastruktur). expenseCategories eies av utlegg —
//                  kalles herfra, endres ikke.
//    - maskin    → INGEN hook. `kategori`/`type` er string-enums på Equipment-
//                  raden, ikke katalogtabeller — det finnes ingenting å seede.
//                  Egenskap ved datamodellen, ikke en manglende hook.
//    - varelager → INGEN hook. VareKategori er firma-definert uten universell
//                  default (steg-4b-plan Beslutning 8: kategoriene kommer fra
//                  SmartDok-import, ikke en generisk liste). Å seede en gjettet
//                  default ville brutt «katalog kun når regulert» (CLAUDE.md).
//                  Hektes på her den dagen en regulert/universell default finnes
//                  (datatype-navn reservert: 'varekategori').
// ============================================================================

export interface SeedFeil {
  datatype: string;
  melding: string;
}

export interface FirmamodulSeedResultat {
  slug: string;
  feil: SeedFeil[];
}

/** Kjør én datatype-seed, fang feil per datatype (svelger ikke — samler). */
async function kjorSeed(
  datatype: string,
  fn: () => Promise<SeedResultat>,
  feil: SeedFeil[],
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    feil.push({ datatype, melding: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Seed modulens katalog + infrastruktur etter at modulen er aktivert.
 * Idempotent (guardene hopper på policy/finnes-rader). Returnerer feil-liste;
 * kaller ansvarlig for å logge den. Kaster ALDRI.
 */
export async function seedFirmamodulKatalog(
  slug: "timer" | "maskin" | "varelager",
  organizationId: string,
): Promise<FirmamodulSeedResultat> {
  const feil: SeedFeil[] = [];

  if (slug === "timer") {
    await kjorSeed("lonnsart", () => seedLonnsartNivaa1(organizationId), feil);
    await kjorSeed("aktivitet", () => seedAktiviteter(organizationId), feil);
    await kjorSeed("tillegg", () => seedTillegg(organizationId), feil);
    await kjorSeed("utleggskategori", () => seedExpenseCategories(organizationId), feil);
    await kjorSeed("interne_prosjekter", () => seedInterneProsjekter(organizationId), feil);
  }
  // maskin + varelager: ingen hook (se blokk-kommentar over) — bevisst tom.

  return { slug, feil };
}

// ============================================================================
//  seedManglendeKatalog — generisk «seed kun det som mangler»-primitiv
//  (2026-08-10). Første brikke i den firmamodul-oppstartsrutinen som mangler:
//  kun `hms-avvik` seeder automatisk ved aktivering i dag, mens
//  `organisasjon.settFirmamodul` seeder ingenting. Målrettet, idempotent,
//  rører ALDRI eksisterende data — kalles av et sitedoc_admin-driftsverktøy nå,
//  og skal kunne kobles på `settFirmamodul` senere (den generiske veien).
//
//  🔴 SCOPE (fortsatt): KUN expenseCategories i DENNE funksjonen. Å utvide den
//  til alle datatyper + koble den på `settFirmamodul` er dispatch-veien (steg 3),
//  ikke gjort her.
//
//  Lønnsart/aktivitet/tillegg-guardene ER NÅ robuste (steg 2, 2026-08-11):
//  `seedLonnsartNivaa1`/`seedAktiviteter`/`seedTillegg` hopper på «finnes rader»
//  per datatype + respekterer `OrganizationSeedPolicy` (egen_katalog sjekkes FØR
//  tellingen). Et firma med import-katalog (A.Markussen: 44 lønnsarter uten
//  `seedNivaa=1`) får derfor ikke lenger grunnpakken lagt ved siden av importen.
//  `seedLonnsartNivaa2` beholder bevisst seedNivaa=2-guarden — den er et additivt
//  lag i onboarding-wizarden, se dens egen kommentar. Forutsetningen for at
//  dispatch-stien (steg 3) kan dekke alle datatyper er dermed på plass.
// ============================================================================

export interface SeedManglendeDatatype {
  opprettet: number;
  hoppet: boolean;
}

export interface SeedManglendeResultat {
  /** Per datatype. Kun expenseCategories er wiret nå (se blokk-kommentar). */
  expenseCategories: SeedManglendeDatatype;
}

export async function seedManglendeKatalog(
  organizationId: string,
): Promise<SeedManglendeResultat> {
  const ec = await seedExpenseCategories(organizationId);
  return {
    expenseCategories: { opprettet: ec.antall, hoppet: ec.hoppet },
  };
}
