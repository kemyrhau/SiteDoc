/**
 * F1a (relay 2026-10-29): beslutningsregel for varselet «Ingen dokumenter inneholder ordet …».
 * Sant bare når lista har treff og ALLE er rent semantiske (`metode === "semantisk"`) — ingen chunk
 * inneholder søkeordet, treffene er vektornaboer. Leksikalsk fallback har ingen `metode` og gir aldri varsel.
 */
export function ingenOrdtreff(treff: ReadonlyArray<{ metode?: string }> | undefined): boolean {
  if (!treff || treff.length === 0) return false;
  return treff.every((t) => t.metode === "semantisk");
}
