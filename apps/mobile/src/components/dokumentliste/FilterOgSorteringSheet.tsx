import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { EnkeltvelgerModal, type VelgerAlternativ } from "./EnkeltvelgerModal";
import type { Sortering } from "./dokumentlisteFilter";

type Alternativer = {
  dokumentflyt: VelgerAlternativ[];
  mal: VelgerAlternativ[];
  ansvarlig: VelgerAlternativ[];
  tegning: VelgerAlternativ[];
};

type ApentNedtrekk = "mal" | "ansvarlig" | "tegning" | "frist" | null;

/**
 * Filter- og sorterings-sheet (fabel-mockup panel 3). Delvis flate: trykk-utenfor
 * lukker. Egenskapssettet speiler webs kolonner (dokumentflyt · emne/mal ·
 * ansvarlig · tidsfrist · tegning) + sortering. Status og byggeplass er BEVISST
 * ikke her (statuschippene ER status-trakten; byggeplass bor i kontekstvelgeren).
 */
export function FilterOgSorteringSheet({
  synlig,
  alternativer,
  filterVerdier,
  sortering,
  antallTreff,
  onSettFilter,
  onSettSortering,
  onNullstill,
  onLukk,
}: {
  synlig: boolean;
  alternativer: Alternativer;
  filterVerdier: Record<string, string>;
  sortering: Sortering;
  antallTreff: number;
  onSettFilter: (kolId: string, verdi: string) => void;
  onSettSortering: (s: Sortering) => void;
  onNullstill: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [apent, setApent] = useState<ApentNedtrekk>(null);

  const fristAlternativer: VelgerAlternativ[] = [
    { value: "forfalt", label: t("dokumentsok.fristForfalt") },
    { value: "har_frist", label: t("dokumentsok.fristHarFrist") },
    { value: "ingen_frist", label: t("dokumentsok.fristIngenFrist") },
  ];

  const valgteFlyt = new Set(
    (filterVerdier.dokumentflyt ?? "").split(",").filter(Boolean),
  );
  const toggleFlyt = (value: string) => {
    const neste = new Set(valgteFlyt);
    if (neste.has(value)) neste.delete(value);
    else neste.add(value);
    onSettFilter("dokumentflyt", Array.from(neste).join(","));
  };

  const etikett = (kolId: string, alle: string, alt: VelgerAlternativ[]) => {
    const v = filterVerdier[kolId];
    if (!v) return alle;
    return alt.find((a) => a.value === v)?.label ?? v;
  };

  const Nedtrekk = ({
    label,
    verdi,
    aktiv,
    onTrykk,
  }: {
    label: string;
    verdi: string;
    aktiv: boolean;
    onTrykk: () => void;
  }) => (
    <View className="flex-1 gap-1.5">
      <Text className="text-xs font-semibold text-gray-500">{label}</Text>
      <Pressable
        onPress={onTrykk}
        className="flex-row items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
      >
        <Text className={aktiv ? "text-sm text-gray-900" : "text-sm text-gray-400"} numberOfLines={1}>
          {verdi}
        </Text>
        <ChevronDown size={16} color="#9ca3af" />
      </Pressable>
    </View>
  );

  return (
    <Modal visible={synlig} transparent animationType="slide" onRequestClose={onLukk}>
      {/* Delvis flate: trykk-utenfor lukker. */}
      <Pressable className="flex-1 bg-black/40" onPress={onLukk} />
      <View className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pb-8 pt-2 shadow-xl">
        <View className="mx-auto mb-3 h-1 w-9 rounded-full bg-gray-300" />
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-bold text-gray-900">
            {t("dokumentsok.filterOgSortering")}
          </Text>
          <Pressable onPress={onNullstill} hitSlop={10}>
            <Text className="text-sm font-semibold text-sitedoc-primary">
              {t("handling.nullstill")}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
          {/* Dokumentflyt — multi-chips */}
          <View className="mb-4 gap-1.5">
            <Text className="text-xs font-semibold text-gray-500">
              {t("tabell.dokumentflyt")}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {alternativer.dokumentflyt.map((a) => {
                const valgt = valgteFlyt.has(a.value);
                return (
                  <Pressable
                    key={a.value}
                    onPress={() => toggleFlyt(a.value)}
                    className={`rounded-full px-3 py-1.5 ${
                      valgt ? "bg-sitedoc-primary" : "border border-gray-300"
                    }`}
                  >
                    <Text className={`text-xs ${valgt ? "text-white" : "text-gray-700"}`}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
              {alternativer.dokumentflyt.length === 0 && (
                <Text className="text-xs text-gray-400">{t("dokumentsok.alle")}</Text>
              )}
            </View>
          </View>

          {/* Emne / mal */}
          <View className="mb-4">
            <Nedtrekk
              label={t("dokumentsok.emneMal")}
              verdi={etikett("mal", t("dokumentsok.alle"), alternativer.mal)}
              aktiv={!!filterVerdier.mal}
              onTrykk={() => setApent("mal")}
            />
          </View>

          {/* Ansvarlig + Tidsfrist side om side */}
          <View className="mb-4 flex-row gap-2">
            <Nedtrekk
              label={t("tabell.ansvarlig")}
              verdi={etikett("ansvarlig", t("dokumentsok.alle"), alternativer.ansvarlig)}
              aktiv={!!filterVerdier.ansvarlig}
              onTrykk={() => setApent("ansvarlig")}
            />
            <Nedtrekk
              label={t("tabell.tidsfrist")}
              verdi={etikett("frist", t("dokumentsok.alle"), fristAlternativer)}
              aktiv={!!filterVerdier.frist}
              onTrykk={() => setApent("frist")}
            />
          </View>

          {/* Tilknyttet tegning */}
          <View className="mb-4">
            <Nedtrekk
              label={t("tabell.tegning")}
              verdi={etikett("tegning", t("dokumentsok.alleTegninger"), alternativer.tegning)}
              aktiv={!!filterVerdier.tegning}
              onTrykk={() => setApent("tegning")}
            />
          </View>

          {/* Sortering — enkelt-chips */}
          <View className="mb-2 gap-1.5">
            <Text className="text-xs font-semibold text-gray-500">
              {t("dokumentsok.sortering")}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {(
                [
                  ["nyeste", t("dokumentsok.sorteringNyeste")],
                  ["eldste", t("dokumentsok.sorteringEldste")],
                  ["navn", t("dokumentsok.sorteringNavn")],
                ] as const
              ).map(([verdi, label]) => {
                const valgt = sortering === verdi;
                return (
                  <Pressable
                    key={verdi}
                    onPress={() => onSettSortering(verdi)}
                    className={`rounded-full px-3 py-1.5 ${
                      valgt ? "bg-sitedoc-primary" : "border border-gray-300"
                    }`}
                  >
                    <Text className={`text-xs ${valgt ? "text-white" : "text-gray-700"}`}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <Pressable
          onPress={onLukk}
          className="mt-3 rounded-xl bg-sitedoc-primary py-3"
        >
          <Text className="text-center text-sm font-semibold text-white">
            {t("dokumentsok.visTreff", { antall: antallTreff })}
          </Text>
        </Pressable>
      </View>

      {/* Nedtrekk-velgere (enkelt-select, byggeplass-velger-mønster) */}
      {apent === "mal" && (
        <EnkeltvelgerModal
          tittel={t("dokumentsok.emneMal")}
          alternativer={alternativer.mal}
          valgt={filterVerdier.mal ?? ""}
          alleLabel={t("dokumentsok.alle")}
          onVelg={(v) => { onSettFilter("mal", v); setApent(null); }}
          onLukk={() => setApent(null)}
        />
      )}
      {apent === "ansvarlig" && (
        <EnkeltvelgerModal
          tittel={t("tabell.ansvarlig")}
          alternativer={alternativer.ansvarlig}
          valgt={filterVerdier.ansvarlig ?? ""}
          alleLabel={t("dokumentsok.alle")}
          onVelg={(v) => { onSettFilter("ansvarlig", v); setApent(null); }}
          onLukk={() => setApent(null)}
        />
      )}
      {apent === "tegning" && (
        <EnkeltvelgerModal
          tittel={t("tabell.tegning")}
          alternativer={alternativer.tegning}
          valgt={filterVerdier.tegning ?? ""}
          alleLabel={t("dokumentsok.alleTegninger")}
          onVelg={(v) => { onSettFilter("tegning", v); setApent(null); }}
          onLukk={() => setApent(null)}
        />
      )}
      {apent === "frist" && (
        <EnkeltvelgerModal
          tittel={t("tabell.tidsfrist")}
          alternativer={fristAlternativer}
          valgt={filterVerdier.frist ?? ""}
          alleLabel={t("dokumentsok.alle")}
          onVelg={(v) => { onSettFilter("frist", v); setApent(null); }}
          onLukk={() => setApent(null)}
        />
      )}
    </Modal>
  );
}
