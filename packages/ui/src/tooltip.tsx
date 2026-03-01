import type { ReactNode } from "react";

interface TooltipProps {
  tekst: string;
  children: ReactNode;
  side?: "right" | "bottom";
}

export function Tooltip({ tekst, children, side = "right" }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${
          side === "right"
            ? "left-full top-1/2 ml-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2"
        }`}
      >
        {tekst}
      </span>
    </div>
  );
}
