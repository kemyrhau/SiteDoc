"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { TegningerPanel } from "@/components/paneler/TegningerPanel";
import { useTranslation } from "react-i18next";

export default function TegningerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SekundaertPanel tittel={t("nav.tegninger")}>
        <TegningerPanel />
      </SekundaertPanel>
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </>
  );
}
