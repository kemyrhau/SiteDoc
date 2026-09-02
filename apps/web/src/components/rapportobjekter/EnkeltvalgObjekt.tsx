import { useTranslation } from "react-i18next";
import { oversettStandardtekst } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";
import { normaliserOpsjon } from "./typer";

export function EnkeltvalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgtVerdi = typeof verdi === "string" ? verdi : "";
  const valgtLabel = alternativer.find((a) => a.value === valgtVerdi)?.label;
  // Seedet standard-opsjon → oversett; firmaets egen streng → rå
  const visLabel = (s: string) => oversettStandardtekst(s, t) ?? s;

  if (leseModus) {
    return (
      <p className="text-sm text-gray-900">{valgtLabel ? visLabel(valgtLabel) : <span className="italic text-gray-400">Ikke valgt</span>}</p>
    );
  }

  return (
    <select
      value={valgtVerdi}
      onChange={(e) => onEndreVerdi(e.target.value || null)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">Velg...</option>
      {alternativer.map((alt, index) => (
        <option key={`${alt.value}-${index}`} value={alt.value}>
          {visLabel(alt.label)}
        </option>
      ))}
    </select>
  );
}
