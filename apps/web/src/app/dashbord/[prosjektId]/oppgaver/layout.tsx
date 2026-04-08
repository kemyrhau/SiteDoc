"use client";

import { Suspense } from "react";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { OppgaverPanel } from "@/components/paneler/OppgaverPanel";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";

export default function OppgaverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SekundaertPanel tittel={t("oppgaver.tittel")}>
        <Suspense fallback={<div className="flex justify-center py-6"><Spinner size="sm" /></div>}>
          <OppgaverPanel />
        </Suspense>
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 px-6 pb-6">
        {children}
      </main>
    </>
  );
}
