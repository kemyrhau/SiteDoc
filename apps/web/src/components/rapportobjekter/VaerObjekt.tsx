import { Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  kilde?: "manuell" | "automatisk";
}

export function VaerObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const vaerVerdi = (verdi as VaerVerdi) ?? {};

  const oppdater = (felt: keyof Omit<VaerVerdi, "kilde">, nyVerdi: string) => {
    onEndreVerdi({
      ...vaerVerdi,
      [felt]: nyVerdi || undefined,
      kilde: "manuell",
    });
  };

  const harData = vaerVerdi.temp || vaerVerdi.conditions || vaerVerdi.wind;

  // Kompakt oppsummering i utfyllingsmodus
  if (!leseModus) {
    const deler = [
      vaerVerdi.temp,
      vaerVerdi.conditions,
      vaerVerdi.wind ? `${vaerVerdi.wind}` : undefined,
    ].filter(Boolean);

    return (
      <div className="flex flex-col gap-1.5">
        {vaerVerdi.kilde === "automatisk" && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <Cloud className="h-3.5 w-3.5" />
            {t("rapportobjekt.vaer.automatiskHentet")}
          </div>
        )}
        {harData ? (
          <p className="text-sm text-gray-700">{deler.join(" · ")}</p>
        ) : (
          <p className="text-sm italic text-gray-400">{t("felt.ingenVaerdata")}</p>
        )}
      </div>
    );
  }

  // Full visning med inputfelter i lesemodus (brukes i print)
  const inputKlasse = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 cursor-not-allowed bg-gray-50 text-gray-500";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">{t("rapportobjekt.vaer.temperatur")}</label>
        <input
          type="text"
          value={vaerVerdi.temp ?? ""}
          onChange={(e) => oppdater("temp", e.target.value)}
          placeholder="f.eks. 15°C"
          disabled
          className={inputKlasse}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">{t("felt.vaerForhold")}</label>
        <input
          type="text"
          value={vaerVerdi.conditions ?? ""}
          onChange={(e) => oppdater("conditions", e.target.value)}
          placeholder="f.eks. Overskyet"
          disabled
          className={inputKlasse}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">{t("felt.vaerVind")}</label>
        <input
          type="text"
          value={vaerVerdi.wind ?? ""}
          onChange={(e) => oppdater("wind", e.target.value)}
          placeholder="f.eks. 5 m/s NV"
          disabled
          className={inputKlasse}
        />
      </div>
    </div>
  );
}
