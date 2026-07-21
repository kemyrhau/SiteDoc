import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";

/**
 * Quiz-spørsmål med riktig/feil-feedback — speiler mobil-varianten (PSI).
 * Web manglet denne i KOMPONENT_MAP → quiz falt til UkjentObjekt og svaret
 * kunne ikke lagres/vises (fase M-3a del 2, F2). Lagrer valgt indeks ved riktig
 * svar, som mobil. I leseModus vises lagret svar uten interaksjon.
 */
export function QuizObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const spørsmål = (objekt.config.question as string) ?? objekt.label;
  const alternativer = (objekt.config.options as string[]) ?? [];
  const riktigIndex = (objekt.config.correctIndex as number) ?? 0;
  const [valgt, setValgt] = useState<number | null>(
    typeof verdi === "number" ? verdi : null,
  );
  const [harSjekket, setHarSjekket] = useState(leseModus === true && verdi != null);

  const erRiktig = valgt === riktigIndex;

  function velg(index: number) {
    if (leseModus) return;
    if (harSjekket && erRiktig) return; // allerede besvart riktig
    setValgt(index);
    setHarSjekket(false);
  }

  function sjekk() {
    if (valgt === null) return;
    setHarSjekket(true);
    if (valgt === riktigIndex) {
      onEndreVerdi(valgt); // lagre riktig svar
    }
  }

  return (
    <div className="my-1 rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-base font-semibold text-gray-900">{spørsmål}</p>

      {alternativer.map((alt, i) => {
        const erValgt = valgt === i;
        const visRiktig = harSjekket && i === riktigIndex;
        const visFeil = harSjekket && erValgt && !erRiktig;
        return (
          <button
            key={i}
            type="button"
            onClick={() => velg(i)}
            disabled={leseModus || (harSjekket && erRiktig)}
            className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
              visRiktig
                ? "border-green-500 bg-green-50"
                : visFeil
                  ? "border-red-400 bg-red-50"
                  : erValgt
                    ? "border-sitedoc-primary bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                erValgt ? "border-sitedoc-primary bg-sitedoc-primary" : "border-gray-300"
              }`}
            >
              {erValgt && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span
              className={`flex-1 text-sm ${
                visRiktig
                  ? "font-medium text-green-700"
                  : visFeil
                    ? "text-red-600"
                    : "text-gray-800"
              }`}
            >
              {alt}
            </span>
            {visRiktig && <CheckCircle className="h-[18px] w-[18px] text-green-600" />}
            {visFeil && <XCircle className="h-[18px] w-[18px] text-red-500" />}
          </button>
        );
      })}

      {!leseModus && !harSjekket && valgt !== null && (
        <button
          type="button"
          onClick={sjekk}
          className="mt-1 w-full rounded-lg bg-sitedoc-primary py-2.5 text-center text-sm font-medium text-white"
        >
          {t("quiz.sjekkSvar")}
        </button>
      )}

      {harSjekket && !erRiktig && (
        <p className="mt-2 text-center text-sm text-red-600">{t("quiz.feilSvar")}</p>
      )}
      {harSjekket && erRiktig && (
        <p className="mt-2 text-center text-sm text-green-600">✓ {t("quiz.riktig")}</p>
      )}
    </div>
  );
}
