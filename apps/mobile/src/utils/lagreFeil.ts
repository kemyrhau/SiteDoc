/**
 * Klassifiser en kastet `oppdaterData`-feil: er den PERMANENT (serveren vil ALDRI
 * godta forespørselen) eller TRANSIENT (nett/5xx — en retry kan lykkes)?
 *
 * Bakgrunn (RETUR 75282ec4, gate-punkt b): godkjent-låsen (`vedleggEndret`-vakten)
 * avviser vedlegg-endring på en avsluttet rapport med tRPC `FORBIDDEN`. Lagre-hookens
 * generiske `catch` satte da `lokalt_lagret`, og auto-retry-effekten prøvde i det
 * uendelige fordi forespørselen aldri kan lykkes (`basisRef` avanseres kun ved
 * suksess, så feltet forblir «dirty»). En PERMANENT avvisning skal ikke retries;
 * en TRANSIENT skal (dagens oppførsel bevares).
 *
 * tRPC-klientfeil bærer koden i `e.data.code` og HTTP-status i `e.data.httpStatus`
 * (samme form som `dokumentSpeil.ts` og `timerSync.ts` leser). Permanent = vaktens
 * avvisninger: `FORBIDDEN` (403, godkjent-lås) og `BAD_REQUEST` (400, ugyldig input
 * klienten ikke kan rette via retry). Alt annet — `UNAUTHORIZED` (401, token-rotasjon
 * er passiv), 5xx, nettverksfeil, manglende status — er transient.
 */
export type LagreFeilType = "permanent" | "transient";

export function klassifiserLagreFeil(feil: unknown): LagreFeilType {
  const data = (feil as { data?: { httpStatus?: number; code?: string } } | null)
    ?.data;
  if (data?.code === "FORBIDDEN" || data?.code === "BAD_REQUEST") {
    return "permanent";
  }
  if (data?.httpStatus === 403 || data?.httpStatus === 400) {
    return "permanent";
  }
  return "transient";
}
