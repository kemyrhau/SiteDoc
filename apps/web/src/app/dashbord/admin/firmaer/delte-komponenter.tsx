"use client";

import { Clock, Truck, Package } from "lucide-react";
import type { FirmaStatus } from "@sitedoc/api/src/services/firmaOversikt";

/* ------------------------------------------------------------------ */
/*  Delte byggeklosser for firmaliste (1a) og firma-detaljside (1b).   */
/*  Holder klassifisering/visning ETT sted — ingen inline-duplisering. */
/* ------------------------------------------------------------------ */

const FIRMAMODULER = [
  { slug: "timer", label: "Timer", ikon: Clock },
  { slug: "maskin", label: "Maskin", ikon: Truck },
  { slug: "varelager", label: "Varelager", ikon: Package },
] as const;

/** Firmamoduler som piller — aktiv=grønn, inaktiv=grå. */
export function ModulPiller({
  aktiveFirmamoduler,
  storrelse = "sm",
}: {
  aktiveFirmamoduler: string[];
  storrelse?: "xs" | "sm";
}) {
  const klasseAktiv =
    storrelse === "xs"
      ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-200"
      : "inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200";
  const klasseInaktiv =
    storrelse === "xs"
      ? "inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400 ring-1 ring-inset ring-gray-200"
      : "inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200";
  const ikonStr = storrelse === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className="flex flex-wrap gap-1.5">
      {FIRMAMODULER.map(({ slug, label, ikon: Ikon }) => {
        const aktiv = aktiveFirmamoduler.includes(slug);
        return (
          <span key={slug} className={aktiv ? klasseAktiv : klasseInaktiv}>
            <Ikon className={ikonStr} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** Firma-status-badge. Fase 1: kun «Kunde» (fabel-gate §7.1). */
export function FirmaStatusBadge({ status, label }: { status: FirmaStatus; label: string }) {
  // Union har kun "kunde" nå — switch beholdes for utvidelse (Prøve/Skall).
  const stil =
    status === "kunde"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stil}`}>
      {label}
    </span>
  );
}

/**
 * Kompakt dato for «Sist aktivitet»-kolonnen. `null` → utfallstekst («—»).
 * Kun visning — signalet er Activity primær + updatedAt fallback (api-lag).
 */
export function formaterSistAktivitet(
  dato: string | Date | null,
  sprak: string,
  ingen: string,
): string {
  if (!dato) return ingen;
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return ingen;
  return d.toLocaleDateString(sprak || "nb", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
