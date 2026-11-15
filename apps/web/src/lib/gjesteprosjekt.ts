/**
 * Gjesteprosjekt på web (POST 2026-11-15 (15)). Regelen for hva som ER et gjesteprosjekt
 * (erGjesteprosjekt) og om valgt prosjekt nullstilles ved firmabytte (skalNullstilleProsjekt)
 * bor i `@sitedoc/shared` — samme regel på web og mobil (ordre (19)). Re-eksport her så
 * web-kallere og `__tests__/gjesteprosjekt.test.ts` står urørt.
 */
export { skalNullstilleProsjekt, type ProsjektForNullstilling } from "@sitedoc/shared";
