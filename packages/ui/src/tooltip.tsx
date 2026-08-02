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
import { createPortal } from "react-dom";
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

const MOTSATT: Record<Side, Side> = {
  right: "left",
  left: "right",
  bottom: "top",
  top: "bottom",
};

// Runde-2 (#10a/R4): tooltip-noden portales til <body> med `position: fixed`, så den ALDRI klippes
// av en scroll-container (`<main overflow-y-auto>`) eller fanges i et lav-z stacking-context (split-
// menyens `z-20`). Transform plasserer boksen relativt til trigger-punktet per løst side.
const TRANSFORM: Record<Side, string> = {
  right: "translateY(-50%)",
  left: "translate(-100%, -50%)",
  bottom: "translateX(-50%)",
  top: "translate(-50%, -100%)",
};

const GAP = 8;

function beregnKoord(rect: DOMRect, s: Side): { left: number; top: number } {
  switch (s) {
    case "right":
      return { left: rect.right + GAP, top: rect.top + rect.height / 2 };
    case "left":
      return { left: rect.left - GAP, top: rect.top + rect.height / 2 };
    case "bottom":
      return { left: rect.left + rect.width / 2, top: rect.bottom + GAP };
    case "top":
      return { left: rect.left + rect.width / 2, top: rect.top - GAP };
  }
}

/**
 * Tooltip v2 — flerlinje hjelpetekst på ord, celler og handlinger.
 *
 * Universell per docs/claude/retningslinjer/tooltip-hjelpetekst-veileder.md § 2:
 * flerlinje (max 280px, bryter), valgfri fet tittel, ~300 ms vis-forsinkelse,
 * tastatur (:focus-visible), touch (tap viser / tap utenfor lukker) og auto-flip
 * ved skjermkant. Tooltip-noden portales til <body> (fixed) — se TRANSFORM-noten — så
 * `aria-describedby`-koblingen (via id) er stabil på tvers av stacking-contexts.
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
  const [montert, setMontert] = useState(false);
  const [løstSide, setLøstSide] = useState<Side>(side);
  const [koord, setKoord] = useState<{ left: number; top: number } | null>(null);

  // createPortal krever document — monter kun på klient (etter hydrering).
  useEffect(() => setMontert(true), []);

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

  // Posisjonering + auto-flip: mål wrapperen + tooltipens størrelse, flip til motsatt side ved
  // skjermkant, og sett fixed-koordinater. Kjøres når den vises + ved scroll/resize (fixed følger
  // ikke wrapperen av seg selv).
  const oppdaterPosisjon = useCallback(() => {
    const w = wrapperRef.current;
    const tip = tooltipRef.current;
    if (!w || typeof window === "undefined") return;
    const wr = w.getBoundingClientRect();
    const tr = tip?.getBoundingClientRect();
    const pad = 8;
    let s = side;
    if (tr) {
      if (side === "right" && wr.right + tr.width + pad > window.innerWidth) s = MOTSATT.right;
      else if (side === "left" && wr.left - tr.width - pad < pad) s = MOTSATT.left;
      else if (side === "bottom" && wr.bottom + tr.height + pad > window.innerHeight) s = MOTSATT.bottom;
      else if (side === "top" && wr.top - tr.height - pad < pad) s = MOTSATT.top;
    }
    setLøstSide(s);
    setKoord(beregnKoord(wr, s));
  }, [side]);

  useLayoutEffect(() => {
    if (!open) {
      setLøstSide(side);
      return;
    }
    oppdaterPosisjon();
  }, [open, side, oppdaterPosisjon]);

  // Fixed-tooltip følger ikke wrapperen ved scroll/resize — reposisjoner mens den er åpen.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const h = () => oppdaterPosisjon();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => {
      window.removeEventListener("scroll", h, true);
      window.removeEventListener("resize", h);
    };
  }, [open, oppdaterPosisjon]);

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

  // Tooltip-noden — portalet til <body> (fixed, høy z) slik at den aldri klippes/overlappes.
  const tooltipNode = (
    <span
      ref={tooltipRef}
      id={id}
      role="tooltip"
      style={{
        position: "fixed",
        left: koord?.left ?? 0,
        top: koord?.top ?? 0,
        transform: TRANSFORM[løstSide],
      }}
      className={`pointer-events-none z-[9999] max-w-[280px] break-words [text-wrap:pretty] rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg transition-opacity duration-100 ${
        open ? "opacity-100" : "invisible opacity-0"
      }`}
    >
      {tittel && <span className="block font-semibold">{tittel}</span>}
      <span className="block whitespace-normal">{tekst}</span>
    </span>
  );

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
      {montert && typeof document !== "undefined"
        ? createPortal(tooltipNode, document.body)
        : null}
    </span>
  );
}
