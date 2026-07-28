/**
 * Delt mobil-feilformatering.
 *
 * Serverfeil (tRPC/Zod) skal ALDRI vises rå til bruker. Input-validering på
 * serveren (Zod) kommer tilbake som en JSON-streng i `message` (f.eks.
 * `[{"code":"too_small",...}]`) — den er ubrukelig for en feltarbeider.
 * Denne oversetter kjente maskin-feilformer til en lesbar fallback; alt annet
 * (menneskelig-formede `TRPCError`-meldinger) går gjennom uendret.
 *
 * Dette er den delte mobil-feilformateringen (eid av del6b fase 2, opprett-
 * veien). Andre kallere — og P2s validerings-feilrendering — bør konvergere på
 * denne fremfor å duplisere. C/P2 er *preventivt* (deaktiverer handlinger
 * serveren ville avvist); denne *formaterer* den sjeldne feilen som slipper
 * gjennom. Ortogonale — ikke dupliser.
 */
export function formaterServerFeil(
  feil: { message?: string } | null | undefined,
  fallback: string,
): string {
  const melding = feil?.message?.trim();
  if (!melding) return fallback;
  // Rå Zod/JSON (array eller objekt) → menneskelig fallback.
  if (melding.startsWith("[") || melding.startsWith("{")) return fallback;
  // Zod-kodefragmenter som kan lekke inn i en ellers tekstlig melding.
  if (/"code":\s*"(too_small|too_big|invalid_type|invalid_string|custom)"/.test(melding)) {
    return fallback;
  }
  return melding;
}
