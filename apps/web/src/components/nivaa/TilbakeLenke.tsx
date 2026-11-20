"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { gyldigRetur, tilbakeEtikett } from "@/lib/tilbake-adresse";

/**
 * Param-drevet «Tilbake til …»-lenke (fabels punkt F, primitiven fra runde 97).
 *
 * Flyttet UENDRET ut av `[prosjektId]/papirkurv/page.tsx` til delt komponent — en ny
 * kopi er ordre-brudd (SAMARBEIDSREGLER :997). Reglene primitiven bærer:
 *   - Leser faktisk sti fra `?retur=` og avviser alt utenfor `/dashbord/`
 *     (open-redirect-vakt, `gyldigRetur`) — aldri fritekst fra URL.
 *   - Etikett fra whitelist via `?kilde=`; ukjent/utelatt kilde → etikett fra adressen
 *     («Tilbake til Timer», «Tilbake til Mine timer») eller nøytral «Tilbake».
 *   - Uten `reserve`: rendrer ingenting når det ikke finnes en gyldig retur (papirkurven).
 *   - Med `reserve` (w14, timeføringen): går til den faste reserven når siden åpnes direkte.
 *   - Maks én per flate; øverst til venstre, over sidetittelen.
 */
const ETIKETT_FRA_KILDE: Record<string, string> = {
  maler: "papirkurv.returMaler",
};

export type TilbakeReserve = { href: string; labelKey: string };

/**
 * Adressen og etiketten knappen bruker. Samme adresse brukes etter sletting og lagring,
 * så brukeren havner der knappen ville ført. `null` = ingen retur og ingen reserve.
 */
export function useTilbakeAdresse(
  reserve?: TilbakeReserve,
): { href: string; labelKey: string } | null {
  const searchParams = useSearchParams();
  const returSti = gyldigRetur(searchParams.get("retur"));
  if (!returSti) return reserve ?? null;
  const kilde = searchParams.get("kilde");
  const labelKey = (kilde && ETIKETT_FRA_KILDE[kilde]) || tilbakeEtikett(returSti);
  return { href: returSti, labelKey };
}

export function TilbakeLenke({
  className,
  reserve,
}: {
  className?: string;
  reserve?: TilbakeReserve;
}) {
  const { t } = useTranslation();
  const adresse = useTilbakeAdresse(reserve);
  if (!adresse) return null;

  return (
    <Link
      href={adresse.href}
      className={
        className ??
        "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-sitedoc-primary hover:underline"
      }
    >
      <ArrowLeft className="h-4 w-4" />
      {t(adresse.labelKey)}
    </Link>
  );
}
