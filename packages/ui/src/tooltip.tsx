"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

type Side = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  /** Brødtekst (bakoverkompatibel — eneste påkrevde tekst). */
  tekst: string;
  /** Valgfri fet tittel-linje over brødteksten (f.eks. «Send → Mottatt»). */
  tittel?: string;
  children: ReactNode;
  /** Ønsket side. Auto-flippes til motsatt side ved skjermkant. */
  side?: Side;
  /** Forsinkelse før tooltip vises ved hover (ms). Ut = alltid 0. */
  delayMs?: number;
  /** Overstyr wrapper-klassen — f.eks. `relative flex w-full` for full-bredde-triggere. */
  wrapperClassName?: string;
}

// Posisjonering relativt til wrapperen. `side` er den løste (auto-flippede) siden.
const POSISJON: Record<Side, string> = {
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
  top: "left-1/2 bottom-full mb-2 -translate-x-1/2",
};

const MOTSATT: Record<Side, Side> = {
  right: "left",
  left: "right",
  bottom: "top",
  top: "bottom",
};

/**
 * Tooltip v2 — flerlinje hjelpetekst på ord, celler og handlinger.
 *
 * Universell per docs/claude/retningslinjer/tooltip-hjelpetekst-veileder.md § 2:
 * flerlinje (max 280px, bryter), valgfri fet tittel, ~300 ms vis-forsinkelse,
 * tastatur (:focus-visible), touch (tap viser / tap utenfor lukker) og auto-flip
 * ved skjermkant. Tooltip-noden er alltid montert, kun skjult via klasser, slik
 * at `aria-describedby`-koblingen er stabil for skjermlesere.
 */
export function Tooltip({
  tekst,
  tittel,
  children,
  side = "right",
  delayMs = 300,
  wrapperClassName = "relative inline-flex",
}: TooltipProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [løstSide, setLøstSide] = useState<Side>(side);

  const nullstillTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const vis = useCallback(
    (delay: number) => {
      nullstillTimer();
      if (delay <= 0) {
        setOpen(true);
        return;
      }
      timerRef.current = setTimeout(() => setOpen(true), delay);
    },
    [nullstillTimer],
  );

  const skjul = useCallback(() => {
    nullstillTimer();
    setOpen(false);
  }, [nullstillTimer]);

  // Rydd opp ved unmount.
  useEffect(() => nullstillTimer, [nullstillTimer]);

  // Auto-flip: mål tooltipen når den vises, flip til motsatt side ved skjermkant.
  useLayoutEffect(() => {
    if (!open) {
      setLøstSide(side);
      return;
    }
    const el = tooltipRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let s = side;
    if (side === "right" && r.right > window.innerWidth - pad) s = MOTSATT.right;
    else if (side === "left" && r.left < pad) s = MOTSATT.left;
    else if (side === "bottom" && r.bottom > window.innerHeight - pad) s = MOTSATT.bottom;
    else if (side === "top" && r.top < pad) s = MOTSATT.top;
    setLøstSide(s);
  }, [open, side]);

  // Touch-åpnet tooltip: tap utenfor lukker.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const utenfor = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) skjul();
    };
    document.addEventListener("pointerdown", utenfor);
    return () => document.removeEventListener("pointerdown", utenfor);
  }, [open, skjul]);

  // Klon child for å koble aria-describedby + gjøre den tastatur-fokuserbar ved behov.
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ tabIndex?: number; "aria-describedby"?: string }>, {
        "aria-describedby":
          [children.props["aria-describedby"], id].filter(Boolean).join(" ") || undefined,
        tabIndex: children.props.tabIndex ?? 0,
      })
    : children;

  return (
    <span
      ref={wrapperRef}
      className={wrapperClassName}
      onMouseEnter={() => vis(delayMs)}
      onMouseLeave={skjul}
      onFocus={(e) => {
        // Kun tastatur-fokus (:focus-visible) — ikke muse-klikk-fokus.
        if ((e.target as HTMLElement).matches?.(":focus-visible")) vis(0);
      }}
      onBlur={skjul}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          if (open) skjul();
          else vis(0);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") skjul();
      }}
    >
      {trigger}
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-50 max-w-[280px] break-words [text-wrap:pretty] rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg transition-opacity duration-100 ${
          open ? "opacity-100" : "invisible opacity-0"
        } ${POSISJON[løstSide]}`}
      >
        {tittel && <span className="block font-semibold">{tittel}</span>}
        <span className="block whitespace-normal">{tekst}</span>
      </span>
    </span>
  );
}
