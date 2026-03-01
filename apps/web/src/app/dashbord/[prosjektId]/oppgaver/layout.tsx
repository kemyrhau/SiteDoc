"use client";

import { Suspense } from "react";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { OppgaverPanel } from "@/components/paneler/OppgaverPanel";
import { Spinner } from "@siteflow/ui";

export default function OppgaverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Oppgaver">
        <Suspense fallback={<div className="flex justify-center py-6"><Spinner size="sm" /></div>}>
          <OppgaverPanel />
        </Suspense>
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
