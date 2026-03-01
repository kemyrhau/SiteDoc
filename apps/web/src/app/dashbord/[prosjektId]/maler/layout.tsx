"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { MalerPanel } from "@/components/paneler/MalerPanel";

export default function MalerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Rapportmaler">
        <MalerPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
