/**
 * Hold X og venstreklikk på et objekt i 3d-visning: objektet skjules direkte,
 * uten egenskapskort, og havner i samme liste som øyeknappen bruker
 * (Kenneth 2026-11-25, ordre 3D-SKJUL-SNARVEI).
 *
 * Målt 2026-11-25: X er ikke i bruk — @thatopen/components 3.3.3 og camera-controls 3.1.2
 * har ingen tastelyttere; egne globale lyttere er Cmd/Ctrl+K (søk) og Escape.
 */

type Lyttemaal = Pick<Window, "addEventListener" | "removeEventListener">;

/** Tastetrykk i skrivefelt skal aldri skjule noe. */
export function erSkrivefelt(maal: EventTarget | null | undefined): boolean {
  if (!maal || typeof maal !== "object") return false;
  const el = maal as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

function erX(e: KeyboardEvent): boolean {
  return e.code === "KeyX" || e.key === "x" || e.key === "X";
}

export interface SkjulSnarvei {
  /** Står X nede nå (utenfor skrivefelt, uten Cmd/Ctrl/Alt)? */
  erAktiv(): boolean;
  stopp(): void;
}

/** Følger X med keydown/keyup; `blur` nullstiller slik at X ikke «henger». */
export function lyttEtterSkjulSnarvei(maal: Lyttemaal): SkjulSnarvei {
  let nede = false;
  const ned = (e: Event) => {
    const k = e as KeyboardEvent;
    if (!erX(k)) return;
    if (k.metaKey || k.ctrlKey || k.altKey || erSkrivefelt(k.target)) return;
    nede = true;
  };
  const opp = (e: Event) => {
    if (erX(e as KeyboardEvent)) nede = false;
  };
  const nullstill = () => {
    nede = false;
  };
  maal.addEventListener("keydown", ned);
  maal.addEventListener("keyup", opp);
  maal.addEventListener("blur", nullstill);
  return {
    erAktiv: () => nede,
    stopp: () => {
      nede = false;
      maal.removeEventListener("keydown", ned);
      maal.removeEventListener("keyup", opp);
      maal.removeEventListener("blur", nullstill);
    },
  };
}

/** Snarveien gjelder bare 3d-visning: tegning-3d har verken øyeknapp eller liste over skjulte objekter. */
export function snarveiGjelderSiden(pathname: string | null | undefined): boolean {
  return !!pathname && pathname.endsWith("/3d-visning");
}
