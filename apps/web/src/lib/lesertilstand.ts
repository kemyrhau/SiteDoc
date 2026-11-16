/**
 * Tilstanden dokumentleseren (`/dokumenter/[id]/les`) viser når et dokument ikke har
 * leser-blokker (DL-1, 2026-11-10). Før stod leseren «ikke klar» for alltid uansett
 * årsak; nå skilles det mellom at blokkene kommer, at filtypen aldri får blokker, og
 * at klargjøringen stoppet.
 *
 * - `innhold`: blokker finnes (i valgt eller annet språk) → vanlig leser.
 * - `klargjores`: prosessering pågår, eller et PDF/DOCX-dokument er ferdig uten blokker
 *   for under `KLARGJORING_GRENSE_MS` siden (blokkene lages etter at søket er klart).
 * - `kanIkkeVises`: filtypen får aldri leser-blokker (`sokbar`), eller SiteDoc kan ikke
 *   lese filen i det hele tatt (`unsupported` → `sokbar: false`).
 * - `feilet`: prosesseringen feilet, eller PDF/DOCX står uten blokker etter grensen.
 *
 * DL-2 (2026-11-11): blokkuttrekket ga 0 blokker (`INGEN_LESERBLOKKER`-markøren) →
 * `kanIkkeVises` med én gang; `sokbar` følger om dokumentet har søk-chunks.
 */
import { INGEN_LESERBLOKKER } from "@sitedoc/shared";

export type Lesertilstand =
  | { type: "innhold" }
  | { type: "klargjores" }
  | { type: "kanIkkeVises"; sokbar: boolean }
  | { type: "feilet"; feilmelding: string | null };

/** Filtyper som får leser-blokker (`ftd-prosessering.ts`: PDF og DOCX). */
const BLOKK_FILTYPER = [".pdf", ".docx"];

/** Hvor lenge et ferdig PDF/DOCX uten blokker regnes som «klargjøres». */
export const KLARGJORING_GRENSE_MS = 10 * 60 * 1000;

/** Polle-intervall mens leseren venter på blokker. */
export const KLARGJORING_POLL_MS = 5000;

export function filtypeFraNavn(filnavn: string | null | undefined): string {
  const m = /\.[^./\\]+$/.exec(filnavn ?? "");
  return m ? m[0].toLowerCase() : "";
}

export function beregnLesertilstand(input: {
  antallBlokker: number;
  antallSprak: number;
  processingState: string;
  processingError: string | null;
  /** Antall søk-chunks — avgjør `sokbar` når blokkuttrekket ga 0 blokker. */
  antallChunks: number;
  filnavn: string | null;
  updatedAt: Date | string;
  /** Tidspunkt brukeren trykket «Prosesser på nytt» her (dekker race mot serveren). */
  reprosessertVed?: number | null;
  na: number;
}): Lesertilstand {
  if (input.antallBlokker > 0 || input.antallSprak > 0) return { type: "innhold" };

  const blokkFiltype = BLOKK_FILTYPER.includes(filtypeFraNavn(input.filnavn));

  switch (input.processingState) {
    case "unsupported":
      return { type: "kanIkkeVises", sokbar: false };
    case "failed":
      return { type: "feilet", feilmelding: input.processingError };
    case "pending":
    case "processing":
      return { type: "klargjores" };
  }

  if (!blokkFiltype) return { type: "kanIkkeVises", sokbar: true };
  if (input.processingError === INGEN_LESERBLOKKER) {
    return { type: "kanIkkeVises", sokbar: input.antallChunks > 0 };
  }

  const sist = Math.max(new Date(input.updatedAt).getTime(), input.reprosessertVed ?? 0);
  if (input.na - sist < KLARGJORING_GRENSE_MS) return { type: "klargjores" };
  return { type: "feilet", feilmelding: input.processingError };
}
