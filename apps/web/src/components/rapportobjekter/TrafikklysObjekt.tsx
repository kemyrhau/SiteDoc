import { useTranslation } from "react-i18next";
import { TRAFIKKLYS_VALG } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

// Fargeklasser per verdi — plattform-lokalt (tailwind aktiv/inaktiv). Verdisettet + etikettene
// bor i @sitedoc/shared (TRAFIKKLYS_VALG); her bor bare fargene. Rekkefølgen kommer fra kilden.
const FARGE: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
  gray: { aktiv: "bg-gray-400", inaktiv: "bg-gray-200" },
};

export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    // items-start så etiketter som bryter (smal skjerm: «Ikke relevant») ikke skyver sirklene.
    <div className="flex items-start gap-3">
      {TRAFIKKLYS_VALG.map(({ value, i18nKey }) => {
        const erValgt = valgtVerdi === value;
        const farge = FARGE[value]!;
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : value);
            }}
            disabled={leseModus}
            className="flex w-14 flex-col items-center gap-1 disabled:cursor-not-allowed"
          >
            {/* Fabel-vedtak: navnet vises ALLTID ved fargen (s/h + fargeblind), ikke i tooltip. */}
            <span
              className={`h-5 w-5 shrink-0 rounded-full transition-all ${erValgt ? farge.aktiv : farge.inaktiv} ${
                erValgt ? "ring-2 ring-gray-800 ring-offset-1" : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
              }`}
            />
            <span className={`text-center text-[10px] leading-tight ${erValgt ? "font-medium text-gray-800" : "text-gray-500"}`}>
              {t(i18nKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
