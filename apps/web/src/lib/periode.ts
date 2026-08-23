/**
 * Periode-filter-logikk — LØFTET til @sitedoc/shared (2026-08-23) så web og mobil deler én kilde
 * (hurtigvalg-settet + grensematematikken kan ikke drifte mellom flatene). Denne filen re-eksporterer
 * for bakoverkompat; eksisterende `@/lib/periode`-importer (tegningssiden, PeriodeFilter, Bilder) er
 * uendret. Nye importer kan gå rett på `@sitedoc/shared`.
 */
export {
  HURTIGVALG_STANDARD,
  PERIODE_NOEKKEL,
  grenserForHurtigvalg,
  effektiveGrenser,
  innenforPeriode,
  erUgyldigIntervall,
  type Periode,
  type PeriodeHurtigvalg,
} from "@sitedoc/shared";
