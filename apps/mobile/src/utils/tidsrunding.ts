/**
 * T.5 (2026-05-16) — Tidsrunding for picker-input på timer- og maskin-rader.
 *
 * Strategi: visuelt ved input — pickeren avrunder til nærmeste
 * `tidsrundingMinutter`. Det brukeren ser er det som lagres. Ingen
 * server-side runding bak ryggen.
 *
 * Speilet i apps/web/src/lib/tidsrunding.ts — hold synkronisert
 * (gjelder `rundTilNarmeste`; `rundTidspunktTilNarmeste` er kun mobil).
 *
 * Bekreft dag (2026-11-13): avrundingen gjelder klokkeslettene Fra og Til, ikke
 * varigheten. Timene regnes fra det rundede spennet minus pausen.
 */
/**
 * ORDRE dobbel pause + avrunding (2026-11-13, Kenneth: «benytt fra til -> rund
 * av til nærmeste 15 minutter -> la den ansatte korrigere»). Bekreft dag runder
 * KLOKKESLETTENE — arbeidsstart og arbeidsslutt hver for seg — til nærmeste
 * `minutter`-grid i lokal tid, og regner timene fra det rundede spennet minus
 * pausen. Da holder invarianten `rad.timer = effektiveTimerFraSpenn(fra, til,
 * pauseFra, pauseMin)` for hver rad. Den gamle avrundingen av VARIGHETEN
 * (`rundTimerTilNarmeste`, F-B 2026-06-24) er fjernet: den flyttet Til opptil
 * ±7,5 min bort fra faktisk slutt uten at klokkeslettet var rundet.
 *
 * Tar og gir epoch-ms. `minutter` null/0 → uendret. Runding som ville krysset
 * midnatt (23:53 → 24:00) klemmes til 23:59 samme dag, som `rundTilNarmeste`.
 * Til kan havne frem i tid (22:53 → 23:00) — godtatt, den ansatte retter i
 * Bekreft dag. KUN mobil auto-flyt — web har ingen Bekreft dag, så denne
 * speiles ikke i web-lib.
 */
export function rundTidspunktTilNarmeste(
  ms: number,
  minutter: number | null,
): number {
  if (!minutter || minutter <= 0) return ms;
  const midnatt = new Date(ms);
  midnatt.setHours(0, 0, 0, 0);
  const nesteMidnatt = new Date(midnatt);
  nesteMidnatt.setHours(24, 0, 0, 0);
  const steg = minutter * 60_000;
  const rundet =
    midnatt.getTime() + Math.round((ms - midnatt.getTime()) / steg) * steg;
  return rundet >= nesteMidnatt.getTime()
    ? nesteMidnatt.getTime() - 60_000
    : rundet;
}

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
