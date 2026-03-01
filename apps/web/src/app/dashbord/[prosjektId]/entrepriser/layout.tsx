"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { EntrepriserPanel } from "@/components/paneler/EntrepriserPanel";

export default function EntrepriserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Entrepriser">
        <EntrepriserPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
