"use client";

import type { ReactNode } from "react";

/**
 * P1-C: sonetonet sidehode — svak sonetone (gradient mot hvit) + 4px sonefarget
 * markør på venstre kant. Nivåsignal på selve siden, i tillegg til chippen i
 * topplinja (`KontekstChip`). Amber = FIRMA, blå = PROSJEKT (låst grammatikk,
 * vedtak del 5). Delt kilde så begge HMS-skall (og senere par) ikke dupliserer
 * tone-/markør-logikken (§ 3-krav: ingen duplisert topplinje-logikk).
 *
 * Gradient = fabel-fasit § 2a: linear-gradient(sonetone → hvit ved 85%), toner
 * #fdf6ea (firma) / #eef4fd (prosjekt). Bevisst svak — statusfargene i tabellen
 * skal vinne (§ 2C).
 */
export function SonetonetSidehode({
  sone,
  children,
}: {
  sone: "firma" | "prosjekt";
  children: ReactNode;
}) {
  const bakgrunn =
    sone === "firma"
      ? "bg-[linear-gradient(90deg,#fdf6ea_0%,#ffffff_85%)] border-l-[#f5c97b]"
      : "bg-[linear-gradient(90deg,#eef4fd_0%,#ffffff_85%)] border-l-[#a9c4f5]";

  return (
    <div className={`rounded-lg border-l-4 px-4 py-3 ${bakgrunn}`}>{children}</div>
  );
}
