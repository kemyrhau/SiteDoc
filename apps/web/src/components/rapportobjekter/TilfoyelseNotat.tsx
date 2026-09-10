import { useTranslation } from "react-i18next";
import type { Tilfoyelse } from "./typer";

function formaterTilfoyelseTid(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Lesbar tekst for en tapende kollisjonsverdi. Skalar → som den er; array → komma-liste.
 * Defensivt: en tapende celleverdi er nå en skalar (repeater-kollisjon festes pr. celle),
 * men skulle et objekt likevel nå hit, vis en lesbar markør — aldri rå JSON på skjerm.
 */
export function tilfoyelseVerdiTekst(verdi: unknown): string {
  if (verdi == null) return "";
  if (typeof verdi === "string" || typeof verdi === "number" || typeof verdi === "boolean") return String(verdi);
  if (Array.isArray(verdi)) return verdi.map((v) => tilfoyelseVerdiTekst(v)).filter(Boolean).join(", ");
  if (typeof verdi === "object") {
    const v = verdi as { verdi?: unknown; filnavn?: unknown };
    if (v.verdi != null && typeof v.verdi !== "object") return String(v.verdi);
    if (typeof v.filnavn === "string") return v.filnavn;
    return "(kompleks verdi)";
  }
  return String(verdi);
}

/**
 * Tapende verdier ved kollisjon (feltvis/celle-nivå merge-deteksjon). Feltnært og synlig —
 * den som skal rette etterpå ser hva som ble notert, av hvem, når. Ingenting slettes.
 * Delt av toppnivå-felt (FeltWrapper) og repeater-celler (RepeaterObjekt).
 */
export function TilfoyelseNotat({ tilfoyelser }: { tilfoyelser: Tilfoyelse[] | undefined }) {
  const { t } = useTranslation();
  if (!tilfoyelser || tilfoyelser.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {t("kollisjon.notat.tittel")}
      </p>
      <div className="mt-1 flex flex-col gap-1.5">
        {tilfoyelser.map((til, i) => (
          <div key={`${til.tidspunkt}-${i}`} className="border-l-2 border-amber-300 pl-2">
            <p className="text-sm text-gray-800">{tilfoyelseVerdiTekst(til.verdi)}</p>
            <p className="text-[11px] text-amber-700">
              {til.brukerNavn}
              {til.tidspunkt ? ` · ${formaterTilfoyelseTid(til.tidspunkt)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
