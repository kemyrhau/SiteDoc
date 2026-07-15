"use client";

import { OppsettSidemeny } from "@/components/layout/OppsettSidemeny";

export default function OppsettLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <OppsettSidemeny />

      {/* Hovedinnhold */}
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
