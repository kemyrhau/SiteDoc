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

export interface SeedResultat {
  antall: number;
  hoppet: boolean;
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
  const finnes = await prismaTimer.lonnsart.count({
    where: { organizationId, seedNivaa: 1 },
  });
  if (finnes > 0) return { antall: 0, hoppet: true };

  const data = LONNSART_NIVAA_1.map((rad, idx) => ({
    organizationId,
    type: rad.type,
    navn: rad.navn,
    rekkefolge: idx,
    seedNivaa: 1,
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
  const finnes = await prismaTimer.aktivitet.count({
    where: { organizationId, seedNivaa: 2 },
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
  const finnes = await prismaTimer.tillegg.count({
    where: { organizationId, seedNivaa: 2 },
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
//  Samlet entry-point — kalles fra timer.onboarding.aktiverNivaa1-mutation
// ============================================================================

export interface SeedTimerOptions {
  /** Hvis true: importer også Nivå 2-pakken sammen med Nivå 1 */
  inkluderNivaa2?: boolean;
}

export interface SeedTimerResultat {
  lonnsartNivaa1: SeedResultat;
  lonnsartNivaa2: SeedResultat | null;
  aktiviteter: SeedResultat;
  tillegg: SeedResultat;
  expenseCategories: SeedResultat;
}

export async function seedTimerForOrganization(
  organizationId: string,
  options: SeedTimerOptions = {},
): Promise<SeedTimerResultat> {
  const lonnsartNivaa1 = await seedLonnsartNivaa1(organizationId);
  const aktiviteter = await seedAktiviteter(organizationId);
  const tillegg = await seedTillegg(organizationId);
  const expenseCategories = await seedExpenseCategories(organizationId);

  const lonnsartNivaa2 = options.inkluderNivaa2
    ? await seedLonnsartNivaa2(organizationId)
    : null;

  return {
    lonnsartNivaa1,
    lonnsartNivaa2,
    aktiviteter,
    tillegg,
    expenseCategories,
  };
}
