"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

/**
 * Param-drevet «Tilbake til …»-lenke (fabels punkt F, primitiven fra runde 97).
 *
 * Flyttet UENDRET ut av `[prosjektId]/papirkurv/page.tsx` til delt komponent — en ny
 * kopi er ordre-brudd (SAMARBEIDSREGLER :997). Reglene primitiven bærer:
 *   - Leser faktisk sti fra `?retur=` og avviser alt utenfor `/dashbord/`
 *     (open-redirect-vakt) — aldri fritekst fra URL.
 *   - Etikett fra whitelist via `?kilde=`; ukjent/utelatt kilde → nøytral fallback.
 *   - Rendrer ingenting når det ikke finnes en gyldig retur (brukeren kom via menyen).
 *   - Maks én per flate; øverst til venstre, over sidetittelen.
 */
const ETIKETT_FRA_KILDE: Record<string, string> = {
  maler: "papirkurv.returMaler",
};

export function TilbakeLenke({ className }: { className?: string }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const returParam = searchParams.get("retur");
  const returSti = returParam && returParam.startsWith("/dashbord/") ? returParam : null;
  if (!returSti) return null;

  const kilde = searchParams.get("kilde");
  const labelKey = (kilde && ETIKETT_FRA_KILDE[kilde]) || "papirkurv.returTilbake";

  return (
    <Link
      href={returSti}
      className={
        className ??
        "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-sitedoc-primary hover:underline"
      }
    >
      <ArrowLeft className="h-4 w-4" />
      {t(labelKey)}
    </Link>
  );
}
