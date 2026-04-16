"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { FaggrupperPanel } from "@/components/paneler/FaggrupperPanel";

export default function FaggrupperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Faggrupper">
        <FaggrupperPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
