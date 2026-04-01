"use client";

import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { MapperPanel } from "@/components/paneler/MapperPanel";
import { useTranslation } from "react-i18next";

export default function MapperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SekundaertPanel tittel={t("mapper.tittel")}>
        <MapperPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </>
  );
}
