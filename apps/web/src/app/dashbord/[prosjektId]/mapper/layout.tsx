"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { MapperPanel } from "@/components/paneler/MapperPanel";

export default function MapperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Mapper">
        <MapperPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
