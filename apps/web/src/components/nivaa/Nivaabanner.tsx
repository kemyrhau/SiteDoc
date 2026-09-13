"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Nivåbanner (fabels punkt B / B-presisering, malforvaltning-ia-notat-fabel-2026-09-13).
 *
 * Én strip under toppfeltet på alle flater som viser ETT arkivnivå. To halvdeler som
 * ALDRI deler ordlyd:
 *   - VENSTRE = NAVIGASJON («← Tilbake til …») — alltid et sidenavn fra kallstedet,
 *     aldri et nivånavn. Vises kun når flaten er nådd via en kontekstbytte-lenke
 *     (editor-flatene); menyflater sender ingen `tilbake` → «maks ÉN tilbake».
 *   - HØYRE = POSISJON («Du redigerer i» + nivåmerke + scope-tekst).
 *
 * Fargene er fabels (mockupen). De finnes IKKE i sitedoc-paletten
 * (retningslinjer/ui-standarder.md): fiolett er en helt ny nyanse, og blå/grønn
 * avviker fra `sitedoc-primary` (#1e40af) / `sitedoc-success` (#10b981). De brukes
 * KUN som semantiske nivåmerker her — ikke som ny generell palett-farge. Meldt til
 * Kenneth; Kenneth gater visuelt mot mockupen.
 */
export type Arkivnivaa = "sitedoc" | "firma" | "prosjekt";

const NIVAA_STIL: Record<Arkivnivaa, { merkeBg: string; stripBg: string; stripTekst: string }> = {
  sitedoc: { merkeBg: "#5843a8", stripBg: "#efeafb", stripTekst: "#43327e" },
  firma: { merkeBg: "#2451b3", stripBg: "#e8eefc", stripTekst: "#1e3a7a" },
  prosjekt: { merkeBg: "#3f6f1f", stripBg: "#eaf2e2", stripTekst: "#2c4f16" },
};

interface NivaabannerProps {
  nivaa: Arkivnivaa;
  /**
   * Kontekstbytte-retur (kun editor-flater). `href` er en kjent in-app-sti, `labelKey`
   * en i18n-nøkkel med et SIDENAVN. Utelates på menyflater (da vises ingen tilbake-lenke).
   */
  tilbake?: { href: string; labelKey: string };
  /** «rediger» (editor) → «Du redigerer i»; «liste» (oversikt) → «Du er i». */
  kontekst?: "rediger" | "liste";
}

export function Nivaabanner({ nivaa, tilbake, kontekst = "rediger" }: NivaabannerProps) {
  const { t } = useTranslation();
  const stil = NIVAA_STIL[nivaa];

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 px-4 py-2"
      style={{ backgroundColor: stil.stripBg, color: stil.stripTekst }}
    >
      {tilbake && (
        <Link
          href={tilbake.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          style={{ color: "inherit" }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t(tilbake.labelKey)}
        </Link>
      )}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-xs opacity-75">
          {kontekst === "liste" ? t("nivaabanner.duErI") : t("nivaabanner.duRedigererI")}
        </span>
        <span
          className="rounded px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: stil.merkeBg }}
        >
          {t(`nivaabanner.${nivaa}.merke`)}
        </span>
        <span className="text-[13px]">— {t(`nivaabanner.${nivaa}.scope`)}</span>
      </span>
    </div>
  );
}
