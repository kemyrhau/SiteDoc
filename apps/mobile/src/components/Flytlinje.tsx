/**
 * Flytlinje (M1) + flyt-sheet (M3) for mobilens detaljskjermer.
 *
 * Slår sammen de to tidligere flyt-representasjonene (FlytIndikator i header +
 * boks-raden i DokumentHandlingsmeny) til ÉN linje i den blå headeren:
 *  - Per ledd: faggruppefarge-svatt (10px) + navn. Aktivt ledd = hvit chip m/fet tekst.
 *  - Kompakt-regel arvet fra FlytIndikator: aktiv + én nabo, «+N» ved >3 ledd.
 *  - Under linjen: «Du har ballen» (grønn prikk) når recipient = meg/min gruppe,
 *    ellers «Venter på [aktivt ledd]».
 *  - Tap på linjen → flyt-sheet (M3): ren visning av flyten, ingen statushandlinger.
 *
 * Delt kilde: `byggLedd`/`finnAktivtIndex` fra dokumentflyt-ledd.ts — ingen ny ledd-logikk.
 * Felles komponent for oppgave- og sjekkliste-detalj (ingen duplisert JSX).
 */

import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Star, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  byggLedd,
  finnAktivtIndex,
  forkort,
  type FlytMedlem,
  type Ledd,
} from "../utils/dokumentflyt-ledd";

/** Overføring (tidslinje-hendelse) — kun feltene sheet-tidsstemplet trenger. */
interface Overforing {
  id: string;
  createdAt: string | Date;
  recipientUser?: { id: string; name: string | null } | null;
  recipientGroup?: { id: string; name: string | null } | null;
}

/** Innlogget brukers identitet i flyten — for «(deg)»-markering. */
interface MegInfo {
  userId?: string;
  gruppeIder?: string[];
}

interface FlytlinjeProps {
  medlemmer: FlytMedlem[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  status: string;
  bestillerUserId?: string;
  /** Har innlogget bruker/gruppe ballen nå? (beregnHarBallen på skjermen) */
  harBallen: boolean;
  meg?: MegInfo;
  overforinger?: Overforing[];
  /** Skjermens dato-formaterer (unngår Date-avhengighet i komponenten). */
  formaterTid: (dato: string | Date) => string;
}

const DEFAULT_FARGE = "#9ca3af"; // gray-400 hvis Faggruppe.color mangler
const AKTIV_TEKST = "#1e40af"; // sitedoc-primary — aktiv chip på hvit bakgrunn

export function Flytlinje({
  medlemmer,
  recipientUserId,
  recipientGroupId,
  status,
  bestillerUserId,
  harBallen,
  meg,
  overforinger,
  formaterTid,
}: FlytlinjeProps) {
  const { t } = useTranslation();
  const [visSheet, setVisSheet] = useState(false);

  const ledd = useMemo(() => byggLedd(medlemmer), [medlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId),
    [ledd, status, recipientUserId, recipientGroupId, bestillerUserId],
  );

  if (ledd.length === 0) return null;

  // Kompakt: aktiv + én nabo på hver side når >3 ledd (arvet fra FlytIndikator).
  const kompakt = ledd.length > 3;
  const visbare = kompakt
    ? filtrerNaboer(ledd, aktivtIndex)
    : ledd.map((l, i) => ({ ledd: l, i }));
  const skjulteAntall = ledd.length - visbare.length;
  const aktivtNavn = aktivtIndex >= 0 ? ledd[aktivtIndex]?.navn ?? null : null;

  return (
    <>
      <Pressable onPress={() => setVisSheet(true)} className="px-4 pb-1.5 pt-0.5">
        {/* Flytlinjen */}
        <View className="flex-row items-center gap-1">
          {visbare.map(({ ledd: l, i }, vis) => {
            const erAktiv = i === aktivtIndex;
            const farge = l.farge ?? DEFAULT_FARGE;
            return (
              <View key={i} className="flex-row items-center gap-1">
                {vis > 0 && <Text className="text-[10px] text-white/40">→</Text>}
                {erAktiv ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-white px-2 py-0.5">
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: farge }} />
                    <Text
                      style={{ color: AKTIV_TEKST }}
                      className="text-[11px] font-bold"
                      numberOfLines={1}
                    >
                      {forkort(l.navn, 18)}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1">
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: farge }} />
                    <Text className="text-[11px] text-white/70" numberOfLines={1}>
                      {forkort(l.navn, 12)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          {skjulteAntall > 0 && (
            <Text className="text-[10px] text-white/50">+{skjulteAntall}</Text>
          )}
        </View>

        {/* «Hvem har ballen»-mikrotekst */}
        <View className="mt-0.5 flex-row items-center gap-1">
          {harBallen ? (
            <>
              <View className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <Text className="text-[10px] font-medium text-green-300">
                {t("flytlinje.duHarBallen")}
              </Text>
            </>
          ) : aktivtNavn ? (
            <Text className="text-[10px] text-white/60">
              {t("flytlinje.venterPaa", { ledd: aktivtNavn })}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <FlytSheet
        synlig={visSheet}
        onLukk={() => setVisSheet(false)}
        ledd={ledd}
        aktivtIndex={aktivtIndex}
        harBallen={harBallen}
        meg={meg}
        overforinger={overforinger}
        formaterTid={formaterTid}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Flyt-sheet (M3) — ren visning, ingen statushandlinger              */
/* ------------------------------------------------------------------ */

function FlytSheet({
  synlig,
  onLukk,
  ledd,
  aktivtIndex,
  harBallen,
  meg,
  overforinger,
  formaterTid,
}: {
  synlig: boolean;
  onLukk: () => void;
  ledd: Ledd[];
  aktivtIndex: number;
  harBallen: boolean;
  meg?: MegInfo;
  overforinger?: Overforing[];
  formaterTid: (dato: string | Date) => string;
}) {
  const { t } = useTranslation();

  return (
    <Modal visible={synlig} transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onLukk}>
        <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-3" onPress={() => {}}>
          {/* Header m/synlig Lukk (Avbryt-prinsippet) */}
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-800">
              {t("flytlinje.flytTittel")}
            </Text>
            <Pressable onPress={onLukk} hitSlop={8} className="flex-row items-center gap-1">
              <Text className="text-sm font-medium text-gray-500">{t("flytlinje.lukk")}</Text>
              <X size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {ledd.map((l, i) => {
              const erAktiv = i === aktivtIndex;
              const farge = l.farge ?? DEFAULT_FARGE;
              const tid = overforinger ? sisteTidForLedd(l, overforinger) : null;
              return (
                <View key={i} className="flex-row">
                  {/* Node + vertikal koblingslinje */}
                  <View className="mr-3 items-center" style={{ width: 28 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: farge,
                        borderWidth: erAktiv ? 3 : 0,
                        borderColor: "#22c55e", // green-500 — aktivt ledd uthevet
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text className="text-xs font-bold text-white">{i + 1}</Text>
                    </View>
                    {i < ledd.length - 1 && (
                      <View className="flex-1 bg-gray-200" style={{ width: 2, minHeight: 14 }} />
                    )}
                  </View>

                  {/* Innhold */}
                  <View className={`flex-1 ${i < ledd.length - 1 ? "pb-4" : ""}`}>
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-sm font-semibold text-gray-900">{l.navn}</Text>
                      {erAktiv && harBallen && (
                        <View className="rounded-full bg-green-100 px-2 py-0.5">
                          <Text className="text-[10px] font-bold uppercase tracking-wide text-green-700">
                            {t("flytlinje.dinTur")}
                          </Text>
                        </View>
                      )}
                    </View>

                    {l.medlemmer.map((m) => {
                      const navn =
                        m.projectMember?.user.name ??
                        m.group?.name ??
                        m.faggruppe?.name ??
                        "?";
                      const erMeg =
                        (!!m.projectMember?.user.id && m.projectMember.user.id === meg?.userId) ||
                        (!!m.group?.id && (meg?.gruppeIder ?? []).includes(m.group.id));
                      return (
                        <View
                          key={m.id ?? `${m.rolle}-${navn}`}
                          className="mt-0.5 flex-row items-center gap-1.5"
                        >
                          {m.erHovedansvarlig && <Star size={11} color="#f59e0b" fill="#f59e0b" />}
                          <Text className="text-xs text-gray-700">
                            {navn}
                            {erMeg ? ` ${t("flytlinje.deg")}` : ""}
                          </Text>
                          <Text className="text-[11px] text-gray-400">
                            · {t(`dokumentflyt.${m.rolle}`)}
                          </Text>
                        </View>
                      );
                    })}

                    {tid && (
                      <Text className="mt-1 text-[10px] text-gray-400">{formaterTid(tid)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Hjelpere                                                           */
/* ------------------------------------------------------------------ */

/** Kompakt-visning: aktivt ledd + én nabo på hver side (samme regel som FlytIndikator). */
function filtrerNaboer(
  ledd: Ledd[],
  aktivtIndex: number,
): Array<{ ledd: Ledd; i: number }> {
  if (aktivtIndex === -1) {
    return ledd.slice(-2).map((l, k) => ({ ledd: l, i: ledd.length - 2 + k }));
  }
  const start = Math.max(0, aktivtIndex - 1);
  const slutt = Math.min(ledd.length - 1, aktivtIndex + 1);
  const res: Array<{ ledd: Ledd; i: number }> = [];
  for (let i = start; i <= slutt; i++) {
    const l = ledd[i];
    if (l) res.push({ ledd: l, i });
  }
  return res;
}

/**
 * Siste overførings-tidsstempel der ballen landet hos dette leddet.
 * Best-effort («der det finnes») — overforinger er kronologisk stigende, så siste
 * treff er nyeste. Matcher på mottaker-gruppe eller mottaker-bruker i leddet.
 */
function sisteTidForLedd(l: Ledd, overforinger: Overforing[]): string | Date | null {
  let best: string | Date | null = null;
  for (const o of overforinger) {
    const traff =
      (!!o.recipientGroup?.id && l.gruppeIder.has(o.recipientGroup.id)) ||
      (!!o.recipientUser?.id && l.brukerIder.has(o.recipientUser.id));
    if (traff) best = o.createdAt;
  }
  return best;
}

export type { FlytMedlem };
