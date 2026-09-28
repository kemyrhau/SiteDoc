import { useTranslation } from "react-i18next";
import { trafikklysOpsjoner, oversettStandardtekst, ukjentTrafikklysVerdi } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";

// Fargeklasser per verdi — plattform-lokalt (tailwind aktiv/inaktiv). Verdisettet + rekkefølgen
// kommer fra feltets `config.options` (via trafikklysOpsjoner) eller det kanoniske settet; her
// bor bare fargene, nøklet på verdi. Delmengde-felt (f.eks. tre lys) rører ikke denne.
const FARGE: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
  gray: { aktiv: "bg-gray-400", inaktiv: "bg-gray-200" },
};

export function TrafikklysObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const valgtVerdi = typeof verdi === "string" ? verdi : null;
  const foreldreloes = ukjentTrafikklysVerdi(verdi);

  // Feltets eget lyssett (delmengde/rekkefølge/egen etikett) når det finnes, ellers kanonisk.
  const valg = trafikklysOpsjoner(objekt.config?.options);

  return (
    // items-start så etiketter som bryter (smal skjerm: «Ikke relevant») ikke skyver sirklene.
    <div className="flex items-start gap-3">
      {valg.map(({ value, tekst, erI18nNokkel }) => {
        const erValgt = valgtVerdi === value;
        const farge = FARGE[value] ?? FARGE.gray!;
        // Seedet standardtekst → oversett; firmaets egen streng → rå; kanonisk → i18n-nøkkel.
        const label = erI18nNokkel ? t(tekst) : oversettStandardtekst(tekst, t) ?? tekst;
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
              {label}
            </span>
          </button>
        );
      })}
      {foreldreloes !== null && (
        // Deaktivert brikke med den RÅ verdien — et lagret svar skal aldri forsvinne stille.
        <div
          data-testid="trafikklys-foreldreloes"
          className="flex w-14 flex-col items-center gap-1"
        >
          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-gray-400 bg-gray-100" />
          <span className="text-center text-[10px] leading-tight font-medium text-gray-700 break-all">
            {foreldreloes}
          </span>
          {/* Synlig mikrotekst — samme ordlyd som arkiv-PDF-en, aldri bare i title-hover. */}
          <span className="text-center text-[9px] leading-tight text-gray-500">
            {t("rapportobjekt.ikkeGyldigValg")}
          </span>
        </div>
      )}
    </div>
  );
}
