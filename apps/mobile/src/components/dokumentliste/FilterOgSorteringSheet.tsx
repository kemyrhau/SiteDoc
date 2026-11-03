import { useState, type ReactElement } from "react";
import { View, Text, Pressable, Modal, ScrollView, Switch } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { Periode } from "@sitedoc/shared";
import { EnkeltvelgerModal, type VelgerAlternativ } from "./EnkeltvelgerModal";
import { PeriodeFilter } from "../PeriodeFilter";
import {
  SORTERINGER,
  type DokumentAlternativer,
  type Sortering,
} from "./dokumentlisteFilter";
import { filterEtikett, FRIST_NOEKKEL } from "./filterEtikett";

type NedtrekkKol =
  | "emne"
  | "mal"
  | "opprettetAv"
  | "ansvarlig"
  | "bestillerFaggruppe"
  | "utforerFaggruppe"
  | "tegning";

const SORTERING_NOEKKEL: Record<Sortering, string> = {
  nyeste: "dokumentsok.sorteringNyeste",
  eldste: "dokumentsok.sorteringEldste",
  endret: "dokumentsok.sorteringEndret",
  frist: "dokumentsok.sorteringFrist",
  nummer: "dokumentsok.sorteringNummer",
  emne: "dokumentsok.sorteringEmne",
  navn: "dokumentsok.sorteringNavn",
};

const NEDTREKK_TITTEL: Record<NedtrekkKol, string> = {
  emne: "tabell.emne",
  mal: "tabell.mal",
  opprettetAv: "tabell.opprettetAv",
  ansvarlig: "tabell.ansvarlig",
  bestillerFaggruppe: "tabell.bestillerFaggruppe",
  utforerFaggruppe: "tabell.utforerFaggruppe",
  tegning: "tabell.tegning",
};

/**
 * Filter- og sorterings-sheet (fabel-mockup panel 3, utvidet filter-mobil
 * 2026-11-03). Delvis flate: trykk-utenfor lukker. Seksjoner: «ballen hos meg»
 * (kun på nett) · sortering · HVA · NÅR · HVEM · HVOR. Adaptivt: et filter vises
 * bare når lista har minst to ulike verdier (eller filteret allerede er satt).
 * Status og byggeplass er BEVISST ikke her (statuschippene ER status-trakten;
 * byggeplass bor i kontekstvelgeren).
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
  periode,
  onSettPeriode,
  visBallen = false,
  visPrioritet = false,
}: {
  synlig: boolean;
  alternativer: DokumentAlternativer;
  filterVerdier: Record<string, string>;
  sortering: Sortering;
  antallTreff: number;
  onSettFilter: (kolId: string, verdi: string) => void;
  onSettSortering: (s: Sortering) => void;
  onNullstill: () => void;
  onLukk: () => void;
  /** Opprettet-periode. Utelatt = feltet vises ikke. */
  periode?: Periode;
  onSettPeriode?: (p: Periode) => void;
  /** «Ballen hos meg» — kun når brukerens grupper er kjent (på nett). */
  visBallen?: boolean;
  /** Prioritet-chips — kun oppgaver. */
  visPrioritet?: boolean;
}) {
  const { t } = useTranslation();
  const [apent, setApent] = useState<NedtrekkKol | null>(null);

  const nedtrekkAlt: Record<NedtrekkKol, VelgerAlternativ[]> = {
    emne: alternativer.emne.map((a) => ({ value: a.value, label: filterEtikett("emne", a.value, t) })),
    mal: alternativer.mal,
    opprettetAv: alternativer.opprettetAv,
    ansvarlig: alternativer.ansvarlig,
    bestillerFaggruppe: alternativer.bestillerFaggruppe,
    utforerFaggruppe: alternativer.utforerFaggruppe,
    tegning: alternativer.tegning,
  };
  const alleLabel = (kolId: NedtrekkKol) =>
    kolId === "tegning" ? t("dokumentsok.alleTegninger") : t("dokumentsok.alle");

  // Adaptivt: under to ulike verdier er filteret meningsløst — med mindre det alt er satt.
  const vis = (kolId: string, alt: VelgerAlternativ[]) => alt.length >= 2 || !!filterVerdier[kolId];

  const valgte = (kolId: string) => new Set((filterVerdier[kolId] ?? "").split(",").filter(Boolean));
  const toggle = (kolId: string, value: string) => {
    const neste = valgte(kolId);
    if (neste.has(value)) neste.delete(value);
    else neste.add(value);
    onSettFilter(kolId, Array.from(neste).join(","));
  };

  const chip = (key: string, label: string, valgt: boolean, onTrykk: () => void) => (
    <Pressable
      key={key}
      onPress={onTrykk}
      className={`rounded-full px-3 py-1.5 ${valgt ? "bg-sitedoc-primary" : "border border-gray-300"}`}
    >
      <Text className={`text-xs ${valgt ? "text-white" : "text-gray-700"}`}>{label}</Text>
    </Pressable>
  );

  const nedtrekk = (kolId: NedtrekkKol) => {
    const v = filterVerdier[kolId];
    const verdi = v ? nedtrekkAlt[kolId].find((a) => a.value === v)?.label ?? v : alleLabel(kolId);
    return (
      <View key={kolId} className="flex-1 gap-1.5">
        <Text className="text-xs font-semibold text-gray-500">{t(NEDTREKK_TITTEL[kolId])}</Text>
        <Pressable
          onPress={() => setApent(kolId)}
          className="flex-row items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
        >
          <Text className={v ? "text-sm text-gray-900" : "text-sm text-gray-400"} numberOfLines={1}>
            {verdi}
          </Text>
          <ChevronDown size={16} color="#9ca3af" />
        </Pressable>
      </View>
    );
  };

  /** Synlige nedtrekk, to og to side om side. */
  const nedtrekkRader = (kolIder: NedtrekkKol[]) => {
    const synlige = kolIder.filter((k) => vis(k, nedtrekkAlt[k]));
    const rader: ReactElement[] = [];
    for (let i = 0; i < synlige.length; i += 2) {
      const par = synlige.slice(i, i + 2);
      rader.push(
        <View key={par.join()} className="mb-3 flex-row gap-2">
          {par.map(nedtrekk)}
          {par.length === 1 && <View className="flex-1" />}
        </View>,
      );
    }
    return rader;
  };

  const seksjon = (tittel: string) => (
    <Text className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">{tittel}</Text>
  );

  const visPrio = visPrioritet && vis("prioritet", alternativer.prioritet);
  const visHva = vis("emne", nedtrekkAlt.emne) || vis("mal", alternativer.mal) || visPrio;
  const hvemKol: NedtrekkKol[] = ["opprettetAv", "ansvarlig", "bestillerFaggruppe", "utforerFaggruppe"];
  const visHvem = hvemKol.some((k) => vis(k, nedtrekkAlt[k]));
  const visFlyt = vis("dokumentflyt", alternativer.dokumentflyt);
  const visHvor = vis("tegning", alternativer.tegning) || visFlyt;

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

        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
          {visBallen && (
            <View className="mb-4 flex-row items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
              <Text className="text-sm font-medium text-gray-900">{t("dokumentsok.ballenHosMeg")}</Text>
              <Switch
                value={filterVerdier.ballen === "1"}
                onValueChange={(paa) => onSettFilter("ballen", paa ? "1" : "")}
              />
            </View>
          )}

          {seksjon(t("dokumentsok.sortering"))}
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {SORTERINGER.map((s) =>
              chip(s, t(SORTERING_NOEKKEL[s]), sortering === s, () => onSettSortering(s)),
            )}
          </View>

          {visHva && (
            <>
              {seksjon(t("dokumentsok.seksjonHva"))}
              {nedtrekkRader(["emne", "mal"])}
              {visPrio && (
                <View className="mb-4 gap-1.5">
                  <Text className="text-xs font-semibold text-gray-500">{t("tabell.prioritet")}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {alternativer.prioritet.map((a) =>
                      chip(a.value, filterEtikett("prioritet", a.value, t), valgte("prioritet").has(a.value), () =>
                        toggle("prioritet", a.value),
                      ),
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {seksjon(t("dokumentsok.seksjonNaar"))}
          <View className="mb-3 gap-1.5">
            <Text className="text-xs font-semibold text-gray-500">{t("tabell.tidsfrist")}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {Object.keys(FRIST_NOEKKEL).map((f) =>
                chip(f, filterEtikett("frist", f, t), filterVerdier.frist === f, () =>
                  onSettFilter("frist", filterVerdier.frist === f ? "" : f),
                ),
              )}
            </View>
          </View>
          {periode && onSettPeriode && (
            <View className="mb-4 gap-1.5">
              <Text className="text-xs font-semibold text-gray-500">{t("tabell.opprettet")}</Text>
              <PeriodeFilter periode={periode} onEndre={onSettPeriode} />
            </View>
          )}

          {visHvem && (
            <>
              {seksjon(t("dokumentsok.seksjonHvem"))}
              {nedtrekkRader(hvemKol)}
            </>
          )}

          {visHvor && (
            <>
              {seksjon(t("dokumentsok.seksjonHvor"))}
              {nedtrekkRader(["tegning"])}
              {visFlyt && (
                <View className="mb-2 gap-1.5">
                  <Text className="text-xs font-semibold text-gray-500">{t("tabell.dokumentflyt")}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {alternativer.dokumentflyt.map((a) =>
                      chip(a.value, a.label, valgte("dokumentflyt").has(a.value), () =>
                        toggle("dokumentflyt", a.value),
                      ),
                    )}
                  </View>
                </View>
              )}
            </>
          )}
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

      {/* Nedtrekk-velger (enkelt-select, byggeplass-velger-mønster) */}
      {apent && (
        <EnkeltvelgerModal
          tittel={t(NEDTREKK_TITTEL[apent])}
          alternativer={nedtrekkAlt[apent]}
          valgt={filterVerdier[apent] ?? ""}
          alleLabel={alleLabel(apent)}
          onVelg={(v) => { onSettFilter(apent, v); setApent(null); }}
          onLukk={() => setApent(null)}
        />
      )}
    </Modal>
  );
}
