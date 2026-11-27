"use client";
/* eslint-disable i18next/no-literal-string -- utviklerverktøy som aldri bygges inn i prod (ordre 2026-11-27 pkt 5) */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Tegneverktøy over SiteDoc (TILLEGG 4, Kenneth 2026-11-27: «markere rett i sitedoc
 * slik at jeg kan ta skjermbilde. markeringer lagres ikke»).
 * Figurene ligger KUN i React-state: ingen fil, localStorage, server eller fetch.
 * Tømmes ved Tøm, reload og stibytte. Overlegget følger viewporten, ikke siden.
 */

export type Verktøy = "pil" | "linje" | "rektangel" | "ellipse" | "frihånd";
export const VERKTØY: { id: Verktøy; navn: string; tegn: string }[] = [
  { id: "pil", navn: "Pil", tegn: "↗" },
  { id: "linje", navn: "Linje", tegn: "／" },
  { id: "rektangel", navn: "Rektangel", tegn: "▭" },
  { id: "ellipse", navn: "Ellipse", tegn: "◯" },
  { id: "frihånd", navn: "Frihånd", tegn: "✎" },
];
export const FARGER = [
  { id: "rød", navn: "Rød", hex: "#dc2626" },
  { id: "gul", navn: "Gul", hex: "#eab308" },
  { id: "blå", navn: "Blå", hex: "#2563eb" },
  { id: "svart", navn: "Svart", hex: "#111827" },
] as const;
export type Farge = (typeof FARGER)[number]["hex"];

type Punkt = [number, number];
export interface Figur {
  verktøy: Verktøy;
  farge: Farge;
  punkter: Punkt[];
}

const STREK = 3;

/** Tegne-state for panelet. Tømmes når stien endres (navigering til ny side). */
export function useTegning() {
  const [figurer, setFigurer] = useState<Figur[]>([]);
  const sti = usePathname();
  useEffect(() => {
    setFigurer([]);
  }, [sti]);
  const leggTil = useCallback((f: Figur) => setFigurer((a) => [...a, f]), []);
  const angre = useCallback(() => setFigurer((a) => a.slice(0, -1)), []);
  const tøm = useCallback(() => setFigurer([]), []);
  return { figurer, leggTil, angre, tøm };
}

function pilId(farge: string) {
  return `testpanel-pil-${farge.slice(1)}`;
}

function FigurSvg({ f }: { f: Figur }) {
  const [a, b] = [f.punkter[0]!, f.punkter[f.punkter.length - 1]!];
  const felles = { stroke: f.farge, strokeWidth: STREK, fill: "none" } as const;
  switch (f.verktøy) {
    case "pil":
    case "linje":
      return (
        <line
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          strokeLinecap="round"
          markerEnd={f.verktøy === "pil" ? `url(#${pilId(f.farge)})` : undefined}
          {...felles}
        />
      );
    case "rektangel":
      return (
        <rect
          x={Math.min(a[0], b[0])}
          y={Math.min(a[1], b[1])}
          width={Math.abs(b[0] - a[0])}
          height={Math.abs(b[1] - a[1])}
          {...felles}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={(a[0] + b[0]) / 2}
          cy={(a[1] + b[1]) / 2}
          rx={Math.abs(b[0] - a[0]) / 2}
          ry={Math.abs(b[1] - a[1]) / 2}
          {...felles}
        />
      );
    case "frihånd":
      return (
        <polyline
          points={f.punkter.map((p) => p.join(",")).join(" ")}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...felles}
        />
      );
  }
}

/** For liten til å være en figur (et klikk uten å dra), uansett verktøy. */
function erTom(f: Figur): boolean {
  const xs = f.punkter.map((p) => p[0]);
  const ys = f.punkter.map((p) => p[1]);
  return Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2;
}

export function TegneLag({
  på,
  verktøy,
  farge,
  figurer,
  onFigur,
  onAv,
}: {
  på: boolean;
  verktøy: Verktøy;
  farge: Farge;
  figurer: Figur[];
  onFigur: (f: Figur) => void;
  onAv: () => void;
}) {
  const [utkast, setUtkast] = useState<Figur | null>(null);

  // Esc slår Tegn av; tegningen står til den tømmes.
  useEffect(() => {
    if (!på) return;
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAv();
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [på, onAv]);

  useEffect(() => {
    if (!på) setUtkast(null);
  }, [på]);

  if (!på && figurer.length === 0) return null;

  const punkt = (e: ReactPointerEvent): Punkt => [e.clientX, e.clientY];
  // Hendelser stoppes her så de aldri når SiteDoc (heller ikke document-lyttere).
  const stopp = (e: ReactPointerEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <svg
      data-testid="testpanel-tegning"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9998,
        pointerEvents: på ? "auto" : "none",
        cursor: på ? "crosshair" : undefined,
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        if (!på) return;
        stopp(e);
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        const p = punkt(e);
        setUtkast({ verktøy, farge, punkter: verktøy === "frihånd" ? [p] : [p, p] });
      }}
      onPointerMove={(e) => {
        if (!på || !utkast) return;
        stopp(e);
        const p = punkt(e);
        setUtkast((u) =>
          u ? { ...u, punkter: u.verktøy === "frihånd" ? [...u.punkter, p] : [u.punkter[0]!, p] } : u,
        );
      }}
      onPointerUp={(e) => {
        if (!på || !utkast) return;
        stopp(e);
        if (!erTom(utkast)) onFigur(utkast);
        setUtkast(null);
      }}
      onClick={(e) => {
        if (på) stopp(e);
      }}
    >
      <defs>
        {FARGER.map((f) => (
          <marker
            key={f.id}
            id={pilId(f.hex)}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={f.hex} />
          </marker>
        ))}
      </defs>
      {figurer.map((f, i) => (
        <FigurSvg key={i} f={f} />
      ))}
      {utkast && <FigurSvg f={utkast} />}
    </svg>
  );
}
