"use client";

import { Suspense } from "react";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { SjekklisterPanel } from "@/components/paneler/SjekklisterPanel";
import { Spinner } from "@siteflow/ui";

export default function SjekklisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SekundaertPanel tittel="Sjekklister">
        <Suspense fallback={<div className="flex justify-center py-6"><Spinner size="sm" /></div>}>
          <SjekklisterPanel />
        </Suspense>
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
