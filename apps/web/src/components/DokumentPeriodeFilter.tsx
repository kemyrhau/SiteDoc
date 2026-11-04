"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import { PERIODE_NOEKKEL, STATUS_PERIODEFELT, type Periode, type PeriodeFelt } from "@sitedoc/shared";
import { PeriodeFilter } from "@/components/PeriodeFilter";

/**
 * B-0 (metadata-spec § 2): periodefilter for dokumentlistene (sjekklister, oppgaver) — velg om
 * perioden gjelder opprettet (`createdAt`) eller sist endret (`updatedAt`), deretter det delte
 * `PeriodeFilter`. Knappen er markert når perioden er aktiv (alt annet enn «alle»).
 * M-pakke B-2: `statusFelt` legger til sendt/godkjent/lukket — bare når API-et leverer
 * `statushendelser`, ellers skjules valgene stille.
 */

const FELT_NOKKEL: Record<PeriodeFelt, string> = {
  opprettet: "periodeFilter.opprettet",
  endret: "periodeFilter.endret",
  sendt: "periodeFilter.sendt",
  godkjent: "periodeFilter.godkjent",
  lukket: "periodeFilter.lukket",
};
export function DokumentPeriodeFilter({
  periode,
  felt,
  onEndrePeriode,
  onEndreFelt,
  statusFelt = false,
}: {
  periode: Periode;
  felt: PeriodeFelt;
  onEndrePeriode: (p: Periode) => void;
  onEndreFelt: (f: PeriodeFelt) => void;
  statusFelt?: boolean;
}) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const aktiv = periode.hurtigvalg !== "alle";

  useEffect(() => {
    if (!apen) return;
    const lukk = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setApen(false);
    };
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [apen]);

  const feltTekst = t(FELT_NOKKEL[felt]);
  const felter: PeriodeFelt[] = statusFelt ? ["opprettet", "endret", ...STATUS_PERIODEFELT] : ["opprettet", "endret"];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setApen((v) => !v)}
        aria-pressed={aktiv}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
          aktiv ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        <Calendar className="h-3.5 w-3.5" />
        {aktiv ? `${feltTekst}: ${t(PERIODE_NOEKKEL[periode.hurtigvalg])}` : t("periodeFilter.periode")}
      </button>
      {apen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-max max-w-[90vw] rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="mb-2 inline-flex overflow-hidden rounded-md border border-gray-200">
            {felter.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onEndreFelt(f)}
                aria-pressed={felt === f}
                className={`px-2.5 py-1 text-xs font-medium ${
                  felt === f ? "bg-sitedoc-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t(FELT_NOKKEL[f])}
              </button>
            ))}
          </div>
          <PeriodeFilter periode={periode} onEndre={onEndrePeriode} />
        </div>
      )}
    </div>
  );
}
