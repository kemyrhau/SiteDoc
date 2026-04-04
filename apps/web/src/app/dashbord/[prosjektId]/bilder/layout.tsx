"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { BilderPanel } from "@/components/paneler/BilderPanel";
import { BilderProvider } from "@/kontekst/bilder-kontekst";
import { useTranslation } from "react-i18next";

export default function BilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <BilderProvider>
      <SekundaertPanel tittel={t("nav.bilder")}>
        <BilderPanel />
      </SekundaertPanel>
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </BilderProvider>
  );
}
