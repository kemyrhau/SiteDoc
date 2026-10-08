"use client";

/**
 * Presentasjonell overlay for måleverktøyet i tegningsvisningen.
 *
 * Punkter og segment-etiketter oppgis i PROSENT (0–100) av vist bilde — samme
 * koordinatrom som tegningsmarkørene. Selve linja tegnes i en SVG med
 * `viewBox="0 0 100 100"` og `preserveAspectRatio="none"`, som avbilder
 * prosent → posisjon lineært; `vector-effect="non-scaling-stroke"` holder
 * strektykkelsen konstant uansett zoom/format. Prikker og etiketter posisjoneres
 * som absolutte divs (skarpe, ikke forvrengt av ikke-uniform skalering).
 */
export interface MaalingSegment {
  /** Midtpunkt for etikett, i prosent. */
  midx: number;
  midy: number;
  /** Ferdig formatert lengde, f.eks. «2,87 m». */
  tekst: string;
}

interface MaalingOverlayProps {
  punkter: { x: number; y: number }[];
  segmenter: MaalingSegment[];
  /** Areal-verktøy: tegn et lukket, skravert polygon i stedet for en åpen linje. */
  fyll?: boolean;
  /** true = aktiv (valgt) måling: blå + dragbar. false = inaktiv: dempet grå (RETUR 2). */
  aktiv?: boolean;
  /** Gjør punktene dragbare (TILLEGG RETUR 1). Starter dra av punkt-indeksen. */
  onPunktNed?: (index: number, e: React.PointerEvent<HTMLDivElement>) => void;
  /** Klikk på linja/flaten velger målingen (RETUR 2). Kun for inaktive målinger. */
  onVelg?: () => void;
}

export function MaalingOverlay({ punkter, segmenter, fyll = false, aktiv = true, onPunktNed, onVelg }: MaalingOverlayProps) {
  if (punkter.length === 0) return null;
  const punktStreng = punkter.map((p) => `${p.x},${p.y}`).join(" ");
  // Aktiv = sitedoc-primary (#1e40af); inaktiv = slate-500 (#64748b).
  const strek = aktiv ? "#1e40af" : "#64748b";
  const fyllFarge = aktiv ? "rgba(30,64,175,0.15)" : "rgba(100,116,139,0.12)";
  const velgProps = onVelg
    ? { onClick: onVelg, style: { pointerEvents: "stroke" as const, cursor: "pointer" } }
    : {};

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {fyll && punkter.length >= 3 ? (
          // Lukket, skravert polygon (areal) — halvgjennomsiktig så tegningen synes.
          <polygon
            points={punktStreng}
            fill={fyllFarge}
            stroke={strek}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            {...(onVelg ? { onClick: onVelg, style: { pointerEvents: "auto" as const, cursor: "pointer" } } : {})}
          />
        ) : (
          punkter.length >= 2 && (
            <polyline
              points={punktStreng}
              fill="none"
              stroke={strek}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              {...velgProps}
            />
          )
        )}
      </svg>

      {/* Punkt-prikker — dragbare når onPunktNed er gitt (TILLEGG RETUR 1) */}
      {punkter.map((p, i) => (
        <div
          key={i}
          onPointerDown={onPunktNed ? (e) => onPunktNed(i, e) : undefined}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
            aktiv ? "h-2.5 w-2.5 bg-sitedoc-primary" : "h-2 w-2 bg-slate-500"
          } ${onPunktNed ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing" : ""}`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}

      {/* Etiketter — aktiv: blå segment-/areal-etiketter; inaktiv: dempet resultat. */}
      {segmenter.map((s, i) => (
        <div
          key={i}
          onClick={onVelg}
          className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow ${
            aktiv ? "bg-sitedoc-primary" : "bg-slate-500"
          } ${onVelg ? "pointer-events-auto cursor-pointer" : ""}`}
          style={{ left: `${s.midx}%`, top: `${s.midy}%` }}
        >
          {s.tekst}
        </div>
      ))}
    </div>
  );
}
