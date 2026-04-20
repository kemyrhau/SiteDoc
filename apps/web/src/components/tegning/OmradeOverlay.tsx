"use client";

import { useState } from "react";

interface Omrade {
  id: string;
  navn: string;
  type: string;
  polygon: { x: number; y: number }[];
  farge: string;
}

interface OmradeOverlayProps {
  omrader: Omrade[];
  onClick?: (omrade: Omrade) => void;
  synlig: boolean;
}

export function OmradeOverlay({ omrader, onClick, synlig }: OmradeOverlayProps) {
  const [hoverOmrade, setHoverOmrade] = useState<string | null>(null);

  if (!synlig || omrader.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 5 }}
    >
      {omrader.map((omrade) => {
        if (omrade.polygon.length < 3) return null;
        const points = omrade.polygon.map((p) => `${p.x},${p.y}`).join(" ");
        const erHover = hoverOmrade === omrade.id;
        return (
          <g key={omrade.id}>
            <polygon
              points={points}
              fill={omrade.farge}
              fillOpacity={erHover ? 0.35 : 0.15}
              stroke={omrade.farge}
              strokeWidth={erHover ? 0.4 : 0.2}
              strokeLinejoin="round"
              className="pointer-events-auto cursor-pointer transition-all"
              onMouseEnter={() => setHoverOmrade(omrade.id)}
              onMouseLeave={() => setHoverOmrade(null)}
              onClick={(e) => { e.stopPropagation(); onClick?.(omrade); }}
            />
            {/* Etikett i sentroid */}
            {omrade.polygon.length >= 3 && (
              <text
                x={omrade.polygon.reduce((s, p) => s + p.x, 0) / omrade.polygon.length}
                y={omrade.polygon.reduce((s, p) => s + p.y, 0) / omrade.polygon.length}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="1.5"
                fontWeight="600"
                fill={omrade.farge}
                fillOpacity={0.8}
                className="pointer-events-none select-none"
              >
                {omrade.navn}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
