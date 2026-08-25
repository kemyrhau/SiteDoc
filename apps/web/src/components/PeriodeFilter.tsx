"use client";

import { useTranslation } from "react-i18next";
import {
  type Periode,
  type PeriodeHurtigvalg,
  erUgyldigIntervall,
  HURTIGVALG_STANDARD,
  PERIODE_NOEKKEL,
} from "@/lib/periode";

/**
 * Delt periodefilter (2026-08-23): i dag · siste uke · siste måned · siste 3 måneder · alle ·
 * egendefinert (fra/til som brukeren setter selv).
 * i18n via `periodeFilter.*`. Hurtigvalg-settet + i18n-nøklene bor i @sitedoc/shared (delt med
 * mobil-RN-varianten) så settet ikke kan drifte mellom flatene.
 */
// ÉN fast rekkefølge, LIK på alle flater (Kenneth-vedtak 2026-08-23): poenget med en delt komponent
// er at filteret oppfører seg identisk overalt. Ingen per-flate-trimming og ingen `valg`-prop — det
// ville gjeninnført divergensen. Settet er modul-konstant i @sitedoc/shared, delt med mobil-RN-
// varianten, og låst av test («standard-settet er de seks, likt på alle flater»).

/** Date → «yyyy-mm-dd» for <input type="date"> (lokal dato, ikke UTC-forskjøvet). */
function tilInputVerdi(d: Date | null): string {
  if (!d) return "";
  const år = d.getFullYear();
  const mnd = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${år}-${mnd}-${dag}`;
}
/** «yyyy-mm-dd» → Date ved lokal midnatt (tom → null). */
function fraInputVerdi(s: string): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

export function PeriodeFilter({ periode, onEndre }: { periode: Periode; onEndre: (p: Periode) => void }) {
  const { t } = useTranslation();

  function velgHurtig(h: PeriodeHurtigvalg) {
    // Egendefinert beholder allerede satte datoer; øvrige nullstiller (grensene avledes av valget).
    if (h === "egendefinert") onEndre({ hurtigvalg: h, fra: periode.fra, til: periode.til });
    else onEndre({ hurtigvalg: h, fra: null, til: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {HURTIGVALG_STANDARD.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => velgHurtig(h)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            periode.hurtigvalg === h ? "bg-blue-100 text-blue-700" : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          {t(PERIODE_NOEKKEL[h])}
        </button>
      ))}

      {periode.hurtigvalg === "egendefinert" && (
        <>
          <label className="ml-1 flex items-center gap-1 text-xs text-gray-500">
            {t("periodeFilter.fra")}
            <input
              type="date"
              value={tilInputVerdi(periode.fra)}
              onChange={(e) => onEndre({ ...periode, fra: fraInputVerdi(e.target.value) })}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            {t("periodeFilter.til")}
            <input
              type="date"
              value={tilInputVerdi(periode.til)}
              onChange={(e) => onEndre({ ...periode, til: fraInputVerdi(e.target.value) })}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            />
          </label>
          {erUgyldigIntervall(periode) && (
            <span className="text-xs text-amber-600">{t("periodeFilter.ugyldigIntervall")}</span>
          )}
        </>
      )}
    </div>
  );
}
