import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { DatoVelgerFelt } from "./DatoVelgerFelt";
import { useTranslation } from "react-i18next";
import {
  type Periode,
  type PeriodeHurtigvalg,
  erUgyldigIntervall,
  HURTIGVALG_STANDARD,
  PERIODE_NOEKKEL,
} from "@sitedoc/shared";

/**
 * RN-variant av det delte periodefilteret (2026-08-23). Deler LOGIKKEN med web via
 * @sitedoc/shared (`HURTIGVALG_STANDARD`, `PERIODE_NOEKKEL`, `erUgyldigIntervall`) — hurtigvalg-
 * settet + i18n-nøklene kan ikke drifte fra web. Web-komponenten bruker DOM (`<button>`/`<input
 * type=date>`); denne bruker Pressable-chips + DateTimePicker. Ingen `valg`-prop: settet er
 * modul-konstant (samme strukturelle gard som web-tegningssiden).
 */
export function PeriodeFilter({
  periode,
  onEndre,
}: {
  periode: Periode;
  onEndre: (p: Periode) => void;
}) {
  const { t } = useTranslation();
  const [visVelger, setVisVelger] = useState<"fra" | "til" | null>(null);

  function velgHurtig(h: PeriodeHurtigvalg) {
    if (h === "egendefinert") onEndre({ hurtigvalg: h, fra: periode.fra, til: periode.til });
    else onEndre({ hurtigvalg: h, fra: null, til: null });
  }

  const formaterDato = (d: Date | null) =>
    d ? d.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }) : t("periodeFilter.velgDato");

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-1.5">
        {HURTIGVALG_STANDARD.map((h) => {
          const aktiv = periode.hurtigvalg === h;
          return (
            <Pressable
              key={h}
              onPress={() => velgHurtig(h)}
              className={`rounded-full px-3 py-1 ${aktiv ? "bg-blue-100" : "bg-gray-100"}`}
            >
              <Text className={`text-xs font-medium ${aktiv ? "text-blue-700" : "text-gray-600"}`}>
                {t(PERIODE_NOEKKEL[h])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {periode.hurtigvalg === "egendefinert" && (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-500">{t("periodeFilter.fra")}</Text>
            <Pressable
              onPress={() => setVisVelger("fra")}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1"
            >
              <Text className="text-xs text-gray-800">{formaterDato(periode.fra)}</Text>
            </Pressable>
            <Text className="text-xs text-gray-500">{t("periodeFilter.til")}</Text>
            <Pressable
              onPress={() => setVisVelger("til")}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1"
            >
              <Text className="text-xs text-gray-800">{formaterDato(periode.til)}</Text>
            </Pressable>
          </View>
          {erUgyldigIntervall(periode) && (
            <Text className="text-xs text-amber-600">{t("periodeFilter.ugyldigIntervall")}</Text>
          )}
        </View>
      )}

      {visVelger && (
        <DatoVelgerFelt
          value={(visVelger === "fra" ? periode.fra : periode.til) ?? new Date()}
          mode="date"
          onChange={(_event, valgtDato) => {
            const gjeldende = visVelger;
            if (Platform.OS !== "ios") setVisVelger(null); // Android-dialogen lukker seg selv
            if (valgtDato) {
              onEndre({ ...periode, [gjeldende === "fra" ? "fra" : "til"]: valgtDato });
            }
          }}
          onLukk={() => setVisVelger(null)}
        />
      )}
    </View>
  );
}
