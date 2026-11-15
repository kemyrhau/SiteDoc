import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — samme mønster som SplittRadModal (simulator-målt 2026-08-31).
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ReiseKortSperre } from "@sitedoc/shared";
import { forklaringTekst, useManuellReise, type ManuellReiseSpor, type ReiseKortValg } from "./useManuellReise";
import { VelgerFelt } from "./VelgerFelt";
import { UnderprosjektVelgerModal } from "./TimerSeksjon";
import { KnappMedForklaring } from "../KnappMedForklaring";
import { hentByggeplasserForProsjektLokalt } from "../../services/byggeplassKatalog";
import { hentUnderprosjekterLokalt } from "../../services/timerKatalog";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise»).
 *
 *  Erstatter `TimerRadModal` med `reise.laast` for NY reise-rad. Kortet viser
 *  Tur / Retur (+ overføringen første/siste dag i en periode, forhåndsvalgt),
 *  oppmøtestedet som tekst (bare når firmaet har flere), én resultatlinje og
 *  underprosjekt. Tid, kjøretid, lønnsart og aktivitet utledes — den ansatte
 *  velger aldri oppmøtested, maskin eller beskrivelse.
 *
 *  Lagre sperres (KnappMedForklaring) når resultatet har en sperre.
 * ============================================================================ */

export type ReiseKortLagring = {
  projectId: string;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string;
  tilTid: string;
  externalCostObjectId: string | null;
  reiseSpor: ManuellReiseSpor;
};

const SPERRE_NOKKEL: Record<ReiseKortSperre, string> = {
  byggeplassPeriode: "timer.reiseKort.sperre.byggeplassPeriode",
  manglerKjoretid: "timer.reiseKort.sperre.manglerKjoretid",
  manglerDagstid: "timer.reiseKort.sperre.manglerDagstid",
  utenforDognet: "timer.reiseKort.sperre.utenforDognet",
  manglerArt: "timer.reiseTerskel.manglerArt",
  manglerRegel: "timer.reiseKort.sperre.manglerRegel",
};

export function ReiseKort({
  organizationId,
  userId,
  dato,
  projectId,
  sedelByggeplassId,
  aktivitetId,
  dagsrader,
  resolverLonnsartId,
  medOverforing,
  skjulOverforingRetninger = [],
  onLagre,
  onLukk,
}: {
  organizationId: string;
  userId: string;
  dato: string;
  projectId: string;
  /** Sedelens (kontekstens) byggeplass — forhåndsvalgt mål. */
  sedelByggeplassId: string | null;
  /** Sedelens aktivitet — reise-raden får den automatisk. null → Lagre sperret. */
  aktivitetId: string | null;
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean }[];
  resolverLonnsartId: string | null;
  /** false i Bekreft dag: der er overføringen alt en forslagsrad (unngår dobbel). */
  medOverforing: boolean;
  /** Retninger sedelen alt har en overføringsrad for — tilbys ikke igjen. */
  skjulOverforingRetninger?: ReadonlyArray<"ut" | "retur">;
  onLagre: (l: ReiseKortLagring) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();

  const byggeplasser = useMemo(
    () => hentByggeplasserForProsjektLokalt(projectId).map((b) => ({ id: b.id, navn: b.navn ?? "" })),
    [projectId],
  );
  const underprosjekter = useMemo(() => hentUnderprosjekterLokalt(projectId), [projectId]);
  const [byggeplassId, setByggeplassId] = useState<string | null>(
    sedelByggeplassId ?? (byggeplasser.length === 1 ? byggeplasser[0]!.id : null),
  );
  const [ecoId, setEcoId] = useState<string | null>(null);
  const [visEcoVelger, setVisEcoVelger] = useState(false);
  const [valg, setValg] = useState<ReiseKortValg | null>(null);

  const reise = useManuellReise({
    organizationId,
    userId,
    dato,
    projectId,
    byggeplassId,
    dagsrader,
    resolverLonnsartId,
    valg,
    skjulOverforingRetninger,
    medOverforing,
    kontekstByggeplassId: byggeplassId,
  });

  const { overforingValg, aktivtValg, resultat, oppmotestedNavn } = reise;

  const erOverforing = aktivtValg.type === "overforing";
  const overforing = erOverforing ? reise.overforinger[aktivtValg.indeks] : undefined;
  const visByggeplassVelger = !erOverforing && byggeplasser.length > 1;
  const eco = underprosjekter.find((u) => u.id === ecoId) ?? null;

  const sperre = resultat.sperre;
  const kanLagre =
    sperre == null &&
    !!aktivitetId &&
    !!resultat.spor &&
    !!resultat.klassifisering?.lonnsartId &&
    !!resultat.fraTid &&
    !!resultat.tilTid;

  function lagre() {
    if (!kanLagre || !aktivitetId || !resultat.spor || !resultat.klassifisering?.lonnsartId) return;
    onLagre({
      projectId,
      byggeplassId: erOverforing ? (overforing?.byggeplassId ?? byggeplassId) : byggeplassId,
      lonnsartId: resultat.klassifisering.lonnsartId,
      aktivitetId,
      timer: resultat.timer,
      fraTid: resultat.fraTid!,
      tilTid: resultat.tilTid!,
      externalCostObjectId: ecoId,
      reiseSpor: resultat.spor,
    });
  }

  const valgKnapp = (v: ReiseKortValg, tekst: string, key: string) => {
    const aktiv =
      v.type === aktivtValg.type &&
      (v.type !== "overforing" || (aktivtValg.type === "overforing" && v.indeks === aktivtValg.indeks));
    return (
      <Pressable
        key={key}
        onPress={() => setValg(v)}
        className={`rounded-lg border px-3 py-2.5 ${aktiv ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"}`}
      >
        <Text className={`text-sm ${aktiv ? "font-medium text-blue-800" : "text-gray-800"}`}>{tekst}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onLukk}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <Pressable onPress={onLukk} hitSlop={8} accessibilityLabel={t("handling.avbryt")}>
            <X size={22} color="#374151" />
          </Pressable>
          <Text className="text-base font-semibold text-gray-900">{t("timer.reiseKort.tittel")}</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
          <View className="flex-row flex-wrap gap-2">
            {valgKnapp({ type: "tur" }, t("timer.reiseKort.tur"), "tur")}
            {valgKnapp({ type: "retur" }, t("timer.reiseKort.retur"), "retur")}
          </View>
          {overforingValg.length > 0 && (
            <View className="gap-2">
              {overforingValg.map(({ o, indeks }) =>
                valgKnapp(
                  { type: "overforing", indeks },
                  t("timer.reiseKort.overforing", { fra: o.fraNavn, til: o.tilNavn }),
                  `ovf-${indeks}`,
                ),
              )}
            </View>
          )}

          {!erOverforing && oppmotestedNavn && (
            <Text className="text-sm text-gray-700">
              {t("timer.reiseKort.fraOppmotested", { navn: oppmotestedNavn })}
            </Text>
          )}

          {visByggeplassVelger && (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.byggeplass")}</Text>
              {byggeplasser.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setByggeplassId(b.id)}
                  className={`flex-row items-center justify-between border-b border-gray-100 px-3 py-2.5 ${
                    b.id === byggeplassId ? "bg-blue-50" : ""
                  }`}
                >
                  <Text className="text-sm text-gray-900">{b.navn}</Text>
                  {b.id === byggeplassId && <Check size={16} color="#1e40af" />}
                </Pressable>
              ))}
            </View>
          )}

          {/* Resultatlinjen: tid og kjøretid, deretter hvorfor arbeid/reise. */}
          {resultat.fraTid && resultat.tilTid && resultat.kjoretidMin != null && (
            <View>
              <Text className="text-sm font-medium text-gray-900">
                {t("timer.reiseKort.resultat", {
                  fraTid: resultat.fraTid,
                  tilTid: resultat.tilTid,
                  min: resultat.kjoretidMin,
                })}
              </Text>
              {resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
                <Text className="mt-1 text-xs text-gray-500">
                  {forklaringTekst(
                    t,
                    resultat.klassifisering,
                    reise.lonnsartNavn(resultat.klassifisering.lonnsartId),
                  )}
                </Text>
              )}
            </View>
          )}

          {underprosjekter.length > 0 && (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.underprosjekt")}</Text>
              <VelgerFelt
                verdi={eco ? `${eco.proAdmId} — ${eco.kortNavn}` : null}
                placeholder={t("timer.velgUnderprosjekt")}
                onPress={() => setVisEcoVelger(true)}
              />
            </View>
          )}

          <KnappMedForklaring sperret={!kanLagre} forklaring={
              sperre ? t(SPERRE_NOKKEL[sperre]) : !aktivitetId ? t("timer.feil.aktivitetPaakrevd") : ""
            }>
            <Pressable
              onPress={lagre}
              disabled={!kanLagre}
              className={`items-center rounded-lg py-3 ${kanLagre ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <Text className="text-sm font-semibold text-white">{t("handling.lagre")}</Text>
            </Pressable>
          </KnappMedForklaring>
        </ScrollView>
        {visEcoVelger && (
          <UnderprosjektVelgerModal
            projectId={projectId}
            valgtId={ecoId}
            onVelg={(id) => {
              setEcoId(id);
              setVisEcoVelger(false);
            }}
            onLukk={() => setVisEcoVelger(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
