"use client";

import type { ReactNode } from "react";

interface SekundaertPanelProps {
  tittel: string;
  children: ReactNode;
}

export function SekundaertPanel({ tittel, children }: SekundaertPanelProps) {
  return (
    <aside className="flex w-[280px] flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{tittel}</h2>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </aside>
  );
}
