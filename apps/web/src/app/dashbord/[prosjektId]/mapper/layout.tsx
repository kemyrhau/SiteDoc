"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { MapperPanel } from "@/components/paneler/MapperPanel";
import { useTranslation } from "react-i18next";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";

export default function MapperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const nyNav = useNyNavigasjon();
  return (
    <>
      {/* s1: skjul/vis-pil kun bak flagget — brødsmulen i innholdsheaderen
          er da tilstrekkelig navigasjon. Flagg av = panelet alltid synlig. */}
      <SekundaertPanel tittel={t("mapper.tittel")} skjulNokkel={nyNav ? "sitedoc-mapper-panel" : undefined}>
        <MapperPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
