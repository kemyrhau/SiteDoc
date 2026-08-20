// ============================================================================
//  Standard arbeidstid — systemets fallback-vindu (07:00–15:00, pause 30 min).
//
//  ÉN kilde for sikkerhetsnett-verdien som brukes NÅR firmaets egen
//  OrganizationSetting (eller mobilens offline-cache) mangler. Gir dagsnorm
//  7,5 t. Tidligere hardkodet tre steder (server arbeidstid.ts, mobil
//  kalenderKatalog.ts, web ny/page.tsx) — ORDRE 2 STEG 1 (2026-08-20) samler
//  dem her.
//
//  ⚠️ Prisma-@default på OrganizationSetting (standardStartTid m.fl.) FORBLIR
//  en literal — Prisma-schema kan ikke importere en TS-konstant. Den er den
//  fjerde forekomsten og holdes bevisst i synk manuelt (packages/db schema).
//
//  Verdien er RIKTIG (= plattform-default) og skal IKKE endres til et bestemt
//  firmas arbeidstid — firma-avvik bor i OrganizationSetting/ArbeidstidsKalender.
// ============================================================================

/** Systemets fallback-arbeidstid. Gir dagsnorm 7,5 t (15:00 − 07:00 − 30 min). */
export const STANDARD_ARBEIDSTID_FALLBACK = {
  startTid: "07:00",
  sluttTid: "15:00",
  pauseMin: 30,
} as const;
