import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { Tilfoyelse } from "../../hooks/useSjekklisteSkjema";

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
    <View className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {t("kollisjon.notat.tittel")}
      </Text>
      <View className="mt-1 gap-1.5">
        {tilfoyelser.map((til, i) => (
          <View key={`${til.tidspunkt}-${i}`} className="border-l-2 border-amber-300 pl-2">
            <Text className="text-sm text-gray-800">{tilfoyelseVerdiTekst(til.verdi)}</Text>
            <Text className="text-[11px] text-amber-700">
              {til.brukerNavn}
              {til.tidspunkt ? ` · ${formaterTilfoyelseTid(til.tidspunkt)}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
