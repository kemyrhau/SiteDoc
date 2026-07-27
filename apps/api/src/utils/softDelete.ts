// F0 Soft-delete — api-side re-eksport av den delte guard-kilden (@sitedoc/shared).
//
// Alle findMany/findFirst/count/aggregate/groupBy mot Checklist/Task — INKL. HMS-lister
// (domain="hms" bruker samme tabeller) og nestede relasjons-`_count` — sprer `IKKE_SLETTET`
// inn i where, så soft-slettede rader aldri lekker inn i lister/tellinger.
// Papirkurv-visningen bruker inversen `KUN_SLETTET`. Logikken bor i shared (testbar,
// Prisma-agnostisk); denne fila holder importstien stabil for api-kallstedene.

export { IKKE_SLETTET, KUN_SLETTET, PAPIRKURV_DAGER, dagerIgjen } from "@sitedoc/shared";
