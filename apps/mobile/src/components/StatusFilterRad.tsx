import { useMemo } from "react";
import { Text, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { DOCUMENT_STATUSES } from "@sitedoc/shared";
import { STATUS_MAP } from "./StatusMerkelapp";

/**
 * Delt status-filter for mobil-lister (sjekkliste / oppgave / HMS).
 * Horisontal chip-rad: «Alle» + kun statuser som faktisk finnes i lista
 * (renere UI — ingen chip for en status uten dokumenter). Farger fra delt
 * `STATUS_MAP`. Single-select, klientside — små lister, ingen ekstra henting.
 *
 * Rendres ikke når det er ≤ 1 distinkt status (ingenting å filtrere på).
 * Chips er ≥ 44px høye (mobil hit-target).
 */
export function StatusFilterRad({
  statuser,
  valgt,
  onVelg,
}: {
  /** Distinkte statuser som finnes i lista (urangert). */
  statuser: string[];
  /** Valgt status, eller null for «Alle». */
  valgt: string | null;
  onVelg: (status: string | null) => void;
}) {
  const { t } = useTranslation();

  // Sorter etter kanonisk dokumentstatus-rekkefølge for forutsigbar rad.
  const sorterte = useMemo(() => {
    const unike = Array.from(new Set(statuser));
    return unike.sort(
      (a, b) =>
        (DOCUMENT_STATUSES as readonly string[]).indexOf(a) -
        (DOCUMENT_STATUSES as readonly string[]).indexOf(b),
    );
  }, [statuser]);

  if (sorterte.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-gray-100 bg-white"
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
    >
      <Chip
        label={t("status.alle")}
        aktiv={valgt === null}
        bg="bg-sitedoc-blue"
        tekstFarge="text-white"
        onPress={() => onVelg(null)}
      />
      {sorterte.map((status) => {
        const info = STATUS_MAP[status];
        return (
          <Chip
            key={status}
            label={info ? t(info.noekkel) : status}
            aktiv={valgt === status}
            bg={info?.bg ?? "bg-gray-100"}
            tekstFarge={info?.tekstFarge ?? "text-gray-700"}
            onPress={() => onVelg(status)}
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  aktiv,
  bg,
  tekstFarge,
  onPress,
}: {
  label: string;
  aktiv: boolean;
  bg: string;
  tekstFarge: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[44px] items-center justify-center rounded-full px-4 ${
        aktiv ? bg : "bg-gray-100"
      }`}
    >
      <Text className={`text-sm font-medium ${aktiv ? tekstFarge : "text-gray-500"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
