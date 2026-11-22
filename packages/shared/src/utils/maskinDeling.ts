import { maskinKreverTimerad } from "./maskinKobling";

/** En maskin på jobben som deles i «Del opp» (O15 pkt 1, plan § 4.16 «s2.ja»). */
export type DelbarMaskin = {
  id: string;
  timer: number;
  utleieEnhet: string | null | undefined;
  /** Maskinen er koblet til en timerad (`sheetTimerId`). Uten kobling blir den i A (R7). */
  koblet: boolean;
};

export type MaskinDelingForslag = { id: string; timerA: number; timerB: number };

const rund = (n: number) => Math.round(n * 100) / 100;

/**
 * Forslaget i «Del opp»: maskinene med fører fyller del A i rekkefølge — A = min(maskintimer,
 * ledig arbeid i A) — og resten går til B (Kenneth 2026-11-22: Volvo 4,5 t, A 3 t → A 3,0 · B 1,5).
 * Samme regel som «maskin høyst jobbens arbeidstimer» (`beregnJobbMaskinBrudd`): summen av
 * førermaskinene i en del er høyst delens arbeid. Døgnmaskin (uten fører) og maskin uten
 * timerad blir i A med alle timene (R7). Forslaget kan rettes; vakten kjøres på det som sendes.
 */
export function foreslaMaskinDeling(maskiner: readonly DelbarMaskin[], arbeidA: number): MaskinDelingForslag[] {
  // En førermaskin uten timerad blir i A med alle timene (R7) og tar plass i A før de koblede
  // fordeles — ellers foreslås en deling vakten selv avviser (lokal dev 2026-11-23: Volvo 5 t
  // koblet + 0,5 t uten kobling, A 3 t → A 3 + 0,5 > 3).
  const fastIA = maskiner.reduce((s, m) => (!m.koblet && maskinKreverTimerad(m.utleieEnhet) ? s + m.timer : s), 0);
  let ledigA = Math.max(0, arbeidA - fastIA);
  return maskiner.map((m) => {
    if (!m.koblet || !maskinKreverTimerad(m.utleieEnhet)) return { id: m.id, timerA: rund(m.timer), timerB: 0 };
    const timerA = rund(Math.min(m.timer, ledigA));
    ledigA = Math.max(0, ledigA - timerA);
    return { id: m.id, timerA, timerB: rund(m.timer - timerA) };
  });
}

/** A + B er maskinens timer (vinduet deler, retter ikke — O15 beslutning a). */
export function erGyldigMaskinDeling(timer: number, d: { timerA: number; timerB: number }): boolean {
  return d.timerA >= 0 && d.timerB >= 0 && Math.abs(d.timerA + d.timerB - timer) < 0.005;
}
