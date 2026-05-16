/**
 * T.5 (2026-05-16) — Tidsrunding for picker-input på timer- og maskin-rader.
 *
 * Strategi: visuelt ved input — pickeren avrunder til nærmeste
 * `tidsrundingMinutter`. Det brukeren ser er det som lagres. Ingen
 * server-side runding bak ryggen.
 *
 * Speilet i apps/web/src/lib/tidsrunding.ts — hold synkronisert.
 */
export function rundTilNarmeste(
  hhmm: string,
  minutter: number | null,
): string {
  if (!minutter || !hhmm) return hhmm;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return hhmm;
  const t = Number(match[1]);
  const m = Number(match[2]);
  const total = t * 60 + m;
  const rundet = Math.round(total / minutter) * minutter;
  // Clamp til 23:59 for samme dag (23:55 + 15 min runding ville ellers gi 24:00).
  const clamped = Math.min(rundet, 23 * 60 + 59);
  const nyT = Math.floor(clamped / 60);
  const nyM = clamped % 60;
  return `${String(nyT).padStart(2, "0")}:${String(nyM).padStart(2, "0")}`;
}
