"use client";

import { Suspense } from "react";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { SjekklisterPanel } from "@/components/paneler/SjekklisterPanel";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";

export default function SjekklisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SekundaertPanel tittel={t("sjekklister.tittel")}>
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
