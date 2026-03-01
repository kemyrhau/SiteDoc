import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";

interface SidebarIkonProps {
  ikon: ReactNode;
  label: string;
  aktiv?: boolean;
  onClick?: () => void;
}

export function SidebarIkon({ ikon, label, aktiv = false, onClick }: SidebarIkonProps) {
  return (
    <Tooltip tekst={label}>
      <button
        onClick={onClick}
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
          aktiv
            ? "bg-white/20 text-white"
            : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
        aria-label={label}
        aria-current={aktiv ? "page" : undefined}
      >
        {ikon}
      </button>
    </Tooltip>
  );
}
