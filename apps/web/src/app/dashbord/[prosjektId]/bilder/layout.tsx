"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { BilderPanel } from "@/components/paneler/BilderPanel";
import { BilderProvider } from "@/kontekst/bilder-kontekst";

export default function BilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BilderProvider>
      <SekundaertPanel tittel="Bilder">
        <BilderPanel />
      </SekundaertPanel>
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </BilderProvider>
  );
}
