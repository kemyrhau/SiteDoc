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
  /** Gjør punktene dragbare (TILLEGG RETUR 1). Starter dra av punkt-indeksen. */
  onPunktNed?: (index: number, e: React.PointerEvent<HTMLDivElement>) => void;
}

export function MaalingOverlay({ punkter, segmenter, fyll = false, onPunktNed }: MaalingOverlayProps) {
  if (punkter.length === 0) return null;
  const punktStreng = punkter.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {fyll && punkter.length >= 3 ? (
          // Lukket, skravert polygon (areal).
          <polygon
            points={punktStreng}
            fill="rgba(30,64,175,0.18)"
            stroke="#1e40af"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          punkter.length >= 2 && (
            <polyline
              points={punktStreng}
              fill="none"
              stroke="#1e40af"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
      </svg>

      {/* Punkt-prikker — dragbare når onPunktNed er gitt (TILLEGG RETUR 1) */}
      {punkter.map((p, i) => (
        <div
          key={i}
          onPointerDown={onPunktNed ? (e) => onPunktNed(i, e) : undefined}
          className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sitedoc-primary shadow ${
            onPunktNed ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing" : ""
          }`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}

      {/* Segment-etiketter (lengde + kilde) */}
      {segmenter.map((s, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-sitedoc-primary px-1.5 py-0.5 text-[11px] font-semibold text-white shadow"
          style={{ left: `${s.midx}%`, top: `${s.midy}%` }}
        >
          {s.tekst}
        </div>
      ))}
    </div>
  );
}
