/**
 * Klient-effekter for tegning-mutasjonene (invalidering + feiltekst), ekstrahert for test.
 *
 * Bakgrunn (funn på test 2026-09-24): `slett` og `rekonverterPdf` invaliderte kun den viste
 * tegningens detalj (`tegning.hentMedId`), ikke LISTA. TegningerPanel drives av
 * `bygning.hentForProsjekt` (samme query `backfillDimensjoner` invaliderer), så en sletting lot
 * den slettede raden stå — og neste klikk traff `findUniqueOrThrow` på en rad som var borte.
 * `rekonverterPdf` hadde samme hull: den endrer conversionStatus på FLERE tegninger, men bare
 * den ene detaljen ble oppdatert.
 */

import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
  type DrawingDiscipline,
  type DrawingType,
} from "@sitedoc/shared";

/** Minimal strukturell form av trpc `useUtils()` — kun det disse effektene rører. */
export interface TegningUtils {
  bygning: { hentForProsjekt: { invalidate: (input: { projectId: string }) => unknown } };
  tegning: { hentMedId: { invalidate: (input: { id: string }) => unknown } };
}

/** Etter sletting: lista MÅ oppdateres (raden er borte). */
export function invaliderEtterSlett(utils: TegningUtils, projectId: string): void {
  utils.bygning.hentForProsjekt.invalidate({ projectId });
}

/** Etter re-konvertering: både den viste tegningen (banner) OG lista (søsken-status). */
export function invaliderEtterRekonverter(
  utils: TegningUtils,
  projectId: string,
  tegningId: string,
): void {
  utils.tegning.hentMedId.invalidate({ id: tegningId });
  utils.bygning.hentForProsjekt.invalidate({ projectId });
}

/**
 * Etter redigering av tegningsdetaljer: både detaljvisningen OG lista.
 * LISTA er avgjørende — TegningerPanel grupperer på `floor` og drives av
 * `bygning.hentForProsjekt`. Endrer du `floor` uten å invalidere lista, blir raden
 * stående i «Uten etasje» selv om mutasjonen lyktes (Krav 2 i ordren 2026-09-30).
 */
export function invaliderEtterRedigerDetaljer(
  utils: TegningUtils,
  projectId: string,
  tegningId: string,
): void {
  utils.tegning.hentMedId.invalidate({ id: tegningId });
  utils.bygning.hentForProsjekt.invalidate({ projectId });
}

/**
 * Feltene redigeringsflaten eksponerer. Speiler opprettelsesflaten
 * (`byggeplasser/page.tsx`) MINUS `revision` (egen revisjonsflyt) og
 * `scale`/`scaleKilde` (målestokk-kalibrering — egen flate på tegningssiden).
 * `status`/`issuedAt`/`byggeplassId` er utelatt fordi de ikke fylles ved opprettelse.
 */
export interface RedigerTegningFelt {
  name: string;
  drawingNumber: string;
  discipline: string;
  drawingType: string;
  floor: string;
  originator: string;
  description: string;
}

/** Resultatet mates rett inn i `tegning.oppdater`. Kun `id` er påkrevd der. */
export interface RedigerTegningInput {
  id: string;
  name?: string;
  drawingNumber?: string;
  discipline?: DrawingDiscipline;
  drawingType?: DrawingType;
  floor?: string;
  originator?: string;
  description?: string;
}

/**
 * Bygger `oppdater`-inputen fra skjemafeltene. Ren funksjon → funksjonstestbar uten nettleser
 * (verifiserer «mutasjonen kalles med riktige felt» fra ordrens tabell).
 *
 * - `name` trimmes og sendes alltid (skjemaet krever den, min. 1 tegn server-side).
 * - Fritekstfelt (`drawingNumber`, `floor`, `originator`, `description`) sendes som de er —
 *   tom streng er en gyldig verdi og TØMMER feltet. Nettopp det flytter en rad UT av «Uten
 *   etasje» og tilbake igjen.
 * - Enum-feltene (`discipline`, `drawingType`) sendes bare når verdien er en gyldig kode;
 *   tom streng blir `undefined` (Zod-enum avviser «»). Enum kan altså endres, ikke nulles.
 */
export function byggRedigerTegningInput(id: string, felt: RedigerTegningFelt): RedigerTegningInput {
  const gyldigDisiplin = (DRAWING_DISCIPLINES as readonly string[]).includes(felt.discipline)
    ? (felt.discipline as DrawingDiscipline)
    : undefined;
  const gyldigType = (DRAWING_TYPES as readonly string[]).includes(felt.drawingType)
    ? (felt.drawingType as DrawingType)
    : undefined;
  return {
    id,
    name: felt.name.trim(),
    drawingNumber: felt.drawingNumber.trim(),
    discipline: gyldigDisiplin,
    drawingType: gyldigType,
    floor: felt.floor.trim(),
    originator: felt.originator.trim(),
    description: felt.description,
  };
}

/**
 * Slettevaktens BAD_REQUEST bærer en lesbar melding (hva som bruker tegningen + antall) og vises
 * som den er. Alt annet (rå Prisma-tekst o.l.) skjules bak `generisk`. tRPC gir feilkoden på
 * `error.data.code` — samme diskriminator som prosjektoppsett/vareforbruk bruker på UI-siden.
 */
export function slettFeilTekst(
  error: { message?: string; data?: { code?: string } | null },
  generisk: string,
): string {
  return error.data?.code === "BAD_REQUEST" && error.message ? error.message : generisk;
}
