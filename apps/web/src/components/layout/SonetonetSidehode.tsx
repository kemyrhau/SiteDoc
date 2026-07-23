"use client";

import type { ReactNode } from "react";
import { SONE_GRADIENT, SONE_MARKOR, type Sone } from "./sone-farger";

/**
 * P1-C: sonetonet sidehode — svak sonetone (gradient mot hvit) + 4px sonefarget
 * markør på venstre kant. Nivåsignal på selve siden, i tillegg til chippen i
 * topplinja (`KontekstChip`). Amber = FIRMA, blå = PROSJEKT (låst grammatikk,
 * vedtak del 5). Farger fra delt kilde (`sone-farger.ts`) så verktøylinje-
 * markøren (`Verktoylinje.tsx`) ikke dupliserer verdiene.
 *
 * Gradient = fabel-fasit § 2a: linear-gradient(sonetone → hvit ved 85%). Bevisst
 * svak — statusfargene i tabellen skal vinne (§ 2C).
 */
export function SonetonetSidehode({
  sone,
  children,
  className = "",
}: {
  sone: Sone;
  children: ReactNode;
  /** Ytre klasser (typisk `mb-*`). Boksen har egen px/py; ytre marg mot innholdet
   * under hører hjemme her, ikke som `mb-*` på det innpakkede hode-innholdet
   * (der ville margen ligge INNE i den tonede boksen). */
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border-l-4 px-4 py-3 ${SONE_GRADIENT[sone]} ${SONE_MARKOR[sone]} ${className}`}
    >
      {children}
    </div>
  );
}
