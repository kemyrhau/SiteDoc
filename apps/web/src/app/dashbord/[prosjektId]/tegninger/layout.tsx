"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { TegningerPanel } from "@/components/paneler/TegningerPanel";

export default function TegningerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Tegninger">
        <TegningerPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
