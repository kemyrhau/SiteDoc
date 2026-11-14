// ============================================================================
//  Ordre 2026-11-14 (11) B: kjøretid vises i timer og minutter.
//  «45 min» under én time, «1 t 35 min» over, «2 t» på hele timer.
//  ÉN formaterer for alle flater; tekstene kommer fra i18n.
// ============================================================================

type Oversett = (key: string, opts?: Record<string, unknown>) => string;

export function formaterKjoretid(t: Oversett, minutter: number): string {
  const totalt = Math.max(0, Math.round(minutter));
  if (totalt < 60) return t("timer.kjoretid.min", { min: totalt });
  const timer = Math.floor(totalt / 60);
  const min = totalt % 60;
  return min === 0
    ? t("timer.kjoretid.timer", { timer })
    : t("timer.kjoretid.timerMin", { timer, min });
}
