// Runde 8 timer, mobil (Kenneth 2026-11-28 «A»): «Følger med» i arbeiderens «Del opp» av en
// timerad. Maskin og ventende vare: tall pr. del. Tillegg, utlegg og reise: velg delen (knapper).
// Forslag og summvakt er `beregnDelOppFordeling` i @sitedoc/shared — samme som web og server.

import { View, Text, TextInput, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { DelOppFeil, DelOppFordeling } from "@sitedoc/shared";
import { TASTATUR_FERDIG_ID } from "./TastaturFerdig";

export type MobilFolgerMed = {
  maskiner: { id: string; navn: string; timer: number }[];
  varer: { id: string; navn: string; enhet: string; antall: number; synket: boolean }[];
  tillegg: { id: string; navn: string }[];
  utlegg: { id: string; navn: string }[];
  reiser: { id: string; retning: string | null; fraTid: string | null; tilTid: string | null }[];
};

export function harMobilFolgerMed(d: MobilFolgerMed): boolean {
  return d.maskiner.length + d.varer.length + d.tillegg.length + d.utlegg.length + d.reiser.length > 0;
}

type Props = {
  antallDeler: number;
  data: MobilFolgerMed;
  fordeling: DelOppFordeling;
  feil: DelOppFeil[];
  /** Synket vare: `offline` = låst på del 1 uten nett; `del1` = del 1 må beholde noe. */
  synketFeil: { id: string; type: "offline" | "del1" }[];
  paaNett: boolean;
  /** Tekstfeltene holdes som tekst (RN-desimaltasting); tallet regnes ved endring. */
  tekst: Record<string, string>;
  onTall: (type: "maskiner" | "varer", id: string, del: number, tekst: string) => void;
  onDel: (type: "tillegg" | "utlegg" | "reiser", id: string, del: number) => void;
};

const fmt = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });

export function FolgerMedSeksjon(p: Props) {
  const { t } = useTranslation();
  const delNavn = (i: number) => t("timer.splitt.del", { nr: i + 1 });
  const deler = Array.from({ length: p.antallDeler }, (_, i) => i);

  const sumTekst = (id: string, skal: number, tall: number[]) => {
    const f = p.feil.filter((x) => x.id === id);
    if (!f.some((x) => x.type === "maskinSum" || x.type === "vareSum")) return null;
    return t("timer.splitt.folgerMed.sumFeil", { sum: fmt(tall.reduce((a, b) => a + b, 0)), skal: fmt(skal) });
  };

  const tallRad = (
    type: "maskiner" | "varer",
    id: string,
    etikett: string,
    skal: number,
    tall: number[],
    laast: boolean,
    merknad: string | null,
  ) => (
    <View key={id} className="gap-1">
      <Text className="text-sm text-gray-800">{etikett}</Text>
      <View className="flex-row flex-wrap gap-2">
        {deler.map((i) => (
          <View key={i} className="flex-row items-center gap-1">
            <Text className="text-xs text-gray-600">{delNavn(i)}</Text>
            <TextInput
              accessibilityLabel={`${etikett} — ${delNavn(i)}`}
              value={p.tekst[`${id}:${i}`] ?? fmt(tall[i] ?? 0)}
              onChangeText={(v) => p.onTall(type, id, i, v)}
              editable={!laast}
              keyboardType="decimal-pad"
              inputAccessoryViewID={TASTATUR_FERDIG_ID}
              className={`w-20 rounded border px-2 py-1.5 text-right text-sm ${
                laast ? "border-gray-200 bg-gray-100 text-gray-500" : "border-gray-300 bg-white text-gray-900"
              }`}
            />
          </View>
        ))}
      </View>
      {sumTekst(id, skal, tall) && <Text className="text-xs text-red-600">{sumTekst(id, skal, tall)}</Text>}
      {merknad && <Text className="text-xs text-amber-700">{merknad}</Text>}
    </View>
  );

  const delValg = (type: "tillegg" | "utlegg" | "reiser", id: string, etikett: string, valgt: number, horerTil: string) => (
    <View key={id} className="gap-1">
      <Text className="text-sm text-gray-800">{etikett}</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-gray-600">{horerTil}</Text>
        {deler.map((i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityState={{ selected: valgt === i }}
            accessibilityLabel={`${etikett} — ${horerTil} ${delNavn(i)}`}
            onPress={() => p.onDel(type, id, i)}
            className={`rounded-full border px-3 py-1 ${
              valgt === i ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"
            }`}
          >
            <Text className={`text-xs ${valgt === i ? "font-semibold text-blue-700" : "text-gray-700"}`}>
              {delNavn(i)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const reiseEtikett = (r: MobilFolgerMed["reiser"][number]) => {
    const v = { fra: r.fraTid ?? "—", til: r.tilTid ?? "—" };
    if (r.retning === "ut") return t("timer.splitt.folgerMed.reiseUt", v);
    if (r.retning === "retur") return t("timer.splitt.folgerMed.reiseHjem", v);
    return t("timer.splitt.folgerMed.reise", v);
  };
  const delFor = (liste: { id: string; del: number }[], id: string) => liste.find((f) => f.id === id)?.del ?? 0;

  return (
    <View className="gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <View>
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("timer.splitt.folgerMed.tittel")}
        </Text>
        <Text className="text-xs text-gray-500">{t("timer.splitt.folgerMed.hjelp")}</Text>
      </View>
      {p.data.maskiner.map((m) =>
        tallRad(
          "maskiner",
          m.id,
          `${t("timer.splitt.folgerMed.maskin")}: ${m.navn} · ${fmt(m.timer)} t`,
          m.timer,
          p.fordeling.maskiner.find((f) => f.id === m.id)?.timer ?? [],
          false,
          null,
        ),
      )}
      {p.data.varer.map((v) => {
        const sf = p.synketFeil.find((f) => f.id === v.id);
        const laast = v.synket && !p.paaNett;
        const merknad = laast
          ? t("timer.splitt.folgerMed.vareSynketOffline")
          : sf?.type === "del1"
            ? t("timer.splitt.folgerMed.vareSynketDel1")
            : null;
        return tallRad(
          "varer",
          v.id,
          `${t("timer.splitt.folgerMed.vare")}: ${v.navn} · ${fmt(v.antall)} ${v.enhet}`,
          v.antall,
          p.fordeling.varer.find((f) => f.id === v.id)?.antall ?? [],
          laast,
          merknad,
        );
      })}
      {p.data.tillegg.map((r) =>
        delValg(
          "tillegg",
          r.id,
          `${t("timer.splitt.folgerMed.tillegg")}: ${r.navn}`,
          delFor(p.fordeling.tillegg, r.id),
          t("timer.splitt.folgerMed.horerTil"),
        ),
      )}
      {p.data.utlegg.map((r) =>
        delValg(
          "utlegg",
          r.id,
          `${t("timer.splitt.folgerMed.utlegg")}: ${r.navn}`,
          delFor(p.fordeling.utlegg, r.id),
          t("timer.splitt.folgerMed.horerTil"),
        ),
      )}
      {p.data.reiser.map((r) =>
        delValg("reiser", r.id, reiseEtikett(r), delFor(p.fordeling.reiser, r.id), t("timer.splitt.folgerMed.reiseHorerTil")),
      )}
    </View>
  );
}
