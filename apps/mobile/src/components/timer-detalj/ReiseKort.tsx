import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — samme mønster som SplittRadModal (simulator-målt 2026-08-31).
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import {
  manuellReiseTerskelTekst,
  medOverforingPeriodeId,
  periodeDatoFraOverforing,
  type ReiseKortSperre,
} from "@sitedoc/shared";
import { forklaringTekst, useManuellReise, type ManuellReiseSpor, type ReiseKortValg } from "./useManuellReise";
import { VelgerFelt } from "./VelgerFelt";
import { FraTilTidFelt } from "./FraTilTidFelt";
import {
  erUtenOppmote,
  reiseKortKanLagre,
  reiseKortRad,
  reiseKortSluttForStart,
  TOMT_MANUELL_VALG,
  type ReiseKortManuellValg,
} from "./reiseKortManuell";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { UnderprosjektVelgerModal } from "./TimerSeksjon";
import { KnappMedForklaring } from "../KnappMedForklaring";
import { hentByggeplasserForProsjektLokalt } from "../../services/byggeplassKatalog";
import { hentUnderprosjekterLokalt } from "../../services/timerKatalog";
import { registrerOverforing } from "../../services/oppmoteOverforing";
import { useTimerSync } from "../../providers/TimerSyncProvider";

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
 *
 *  Del B (POST 2026-11-15 (13)): «Overføring til annet kontor» (≥ 2 aktive
 *  kontorer) setter et midlertidig oppmøtested ved lagring
 *  (`registrerOverforing`, optimistisk + kø); valg av eget faste kontor
 *  avslutter det. Kortlinjen «Midlertidig: X fra dd.mm · Avslutt» angrer.
 *
 *  O22 (vedtak-timer-web.md § Reisevinduet pkt 28): uten oppmøtested er kortet
 *  ikke sperret. Arbeideren skriver Start/Slutt selv (tidspunktet som henger på
 *  arbeidet er fylt ut), km-firma huker av for terskelen, og en blå tekst ber
 *  firmaadmin legge inn stedet. Offline — ingen nettkall (`reiseKortManuell.ts`).
 * ============================================================================ */

/** YYYY-MM-DD → dd.mm */
function kortDato(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

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
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean; erOverforing?: boolean }[];
  resolverLonnsartId: string | null;
  /** false i Bekreft dag: der er overføringen alt en forslagsrad (unngår dobbel). */
  medOverforing: boolean;
  /** Retninger sedelen alt har en overføringsrad for — tilbys ikke igjen. */
  skjulOverforingRetninger?: ReadonlyArray<"ut" | "retur">;
  onLagre: (l: ReiseKortLagring) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { triggerSync } = useTimerSync();

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
  const [valg, setValgRaa] = useState<ReiseKortValg | null>(null);
  // O22: arbeiderens tider uten oppmøtested — nullstilles når retningen byttes.
  const [manuell, setManuell] = useState<ReiseKortManuellValg>(TOMT_MANUELL_VALG);
  const setValg = (v: ReiseKortValg | null) => {
    setValgRaa(v);
    setManuell(TOMT_MANUELL_VALG);
  };
  const tidsrundingMinutter = useMemo(
    () => hentOrganizationSettingLokalt(organizationId)?.tidsrundingMinutter ?? null,
    [organizationId],
  );

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
    manuellValg: manuell,
  });

  const { overforingValg, aktivtValg, resultat, oppmotestedNavn } = reise;

  const erOverforing = aktivtValg.type === "overforing";
  const erKontor = aktivtValg.type === "kontor";
  const overforing = erOverforing ? reise.overforinger[aktivtValg.indeks] : undefined;
  const visByggeplassVelger = !erOverforing && !erKontor && byggeplasser.length > 1;
  const { kontorOppsett, kontorKall, kontorKonflikt, apenOverforing } = reise;
  const eco = underprosjekter.find((u) => u.id === ecoId) ?? null;

  const sperre = resultat.sperre;
  const kanLagre = reiseKortKanLagre({ resultat, kontorKonflikt, aktivitetId });
  const utenOppmote = erUtenOppmote(resultat);
  const sluttForStart = reiseKortSluttForStart(resultat);
  // O22: km-firma huker av om reisen var lengre enn terskelen (som web, O12 pkt 9).
  const regel = reise.regel;
  const kmFirma = regel?.reiseTerskelEnhet === "km" && regel.reiseTerskelM != null;

  function lagre() {
    const rad = reiseKortRad({ resultat, kontorKonflikt, aktivitetId });
    if (!rad || !aktivitetId) return;
    let reiseSpor = rad.reiseSpor;
    if (erKontor && kontorKall) {
      // Perioden skrives FØR raden, så raden bærer periodens id i reiseRegel.
      const r = registrerOverforing({ userId, organizationId, ...kontorKall, id: randomUUID() });
      if (r.utfall === "konflikt") return;
      reiseSpor = medOverforingPeriodeId(reiseSpor, r.periodeId);
    }
    onLagre({
      projectId,
      byggeplassId: erKontor ? null : erOverforing ? (overforing?.byggeplassId ?? byggeplassId) : byggeplassId,
      lonnsartId: rad.lonnsartId,
      aktivitetId,
      timer: rad.timer,
      fraTid: rad.fraTid,
      tilTid: rad.tilTid,
      externalCostObjectId: ecoId,
      reiseSpor,
    });
    if (erKontor) void triggerSync();
  }

  /** Avslutt uten reise: perioden slutter dagen før sedeldatoen (slettes om den startet i dag). */
  function avsluttOverforing() {
    registrerOverforing({
      userId,
      organizationId,
      handling: "slutt",
      dato: periodeDatoFraOverforing(dato, "00:00", "retur"),
    });
    setValg(null);
    void triggerSync();
  }

  const valgKnapp = (v: ReiseKortValg, tekst: string, key: string) => {
    const aktiv =
      v.type === aktivtValg.type &&
      (v.type !== "overforing" || (aktivtValg.type === "overforing" && v.indeks === aktivtValg.indeks)) &&
      (v.type !== "kontor" || (aktivtValg.type === "kontor" && v.oppmotestedId === aktivtValg.oppmotestedId));
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

          {kontorOppsett && kontorOppsett.andre.length > 0 && (
            <View className="gap-2">
              <Text className="text-sm font-medium text-gray-700">{t("timer.reiseKort.annetKontor")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {kontorOppsett.andre.map((id) =>
                  valgKnapp(
                    { type: "kontor", oppmotestedId: id },
                    t("timer.reiseKort.tilKontor", { navn: reise.kontorNavn(id) }),
                    `kontor-${id}`,
                  ),
                )}
              </View>
            </View>
          )}

          {!erOverforing && oppmotestedNavn && (
            <Text className="text-sm text-gray-700">
              {t("timer.reiseKort.fraOppmotested", { navn: oppmotestedNavn })}
            </Text>
          )}
          {/* O22: oppmøtested mangler — feltet sier det, og arbeideren skriver tiden selv. */}
          {utenOppmote && (
            <Text className="text-sm text-gray-700">
              {aktivtValg.type === "retur" ? t("timer.reiseKort.til") : t("timer.reiseKort.fra")}:{" "}
              {t("timer.reiseKort.oppmoteIkkeValgt")}
            </Text>
          )}

          {apenOverforing && apenOverforing.oppmotestedId && (
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-700">
                {t("timer.reiseKort.midlertidigLinje", {
                  navn: reise.kontorNavn(apenOverforing.oppmotestedId),
                  dato: kortDato(apenOverforing.fraDato),
                })}
              </Text>
              <Text className="text-sm text-gray-400">·</Text>
              <Pressable onPress={avsluttOverforing} hitSlop={8}>
                <Text className="text-sm font-medium text-blue-700">{t("timer.reiseKort.avslutt")}</Text>
              </Pressable>
            </View>
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

          {/* O22: manuell modus uten oppmøtested — Start/Slutt, antall timer, km-avhuking, blå tekst. */}
          {utenOppmote && (
            <View className="gap-3">
              <View className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <Text className="text-sm text-blue-900">{t("timer.reiseKort.utenOppmote")}</Text>
              </View>
              <FraTilTidFelt
                fraTid={resultat.fraTid}
                tilTid={resultat.tilTid}
                tidsrundingMinutter={tidsrundingMinutter}
                onFraEndret={(hhmm) => setManuell((m) => ({ ...m, startTid: hhmm }))}
                onTilEndret={(hhmm) => setManuell((m) => ({ ...m, sluttTid: hhmm }))}
                paakrevd
              />
              {resultat.fraTid && resultat.tilTid && resultat.timer > 0 && (
                <Text className="text-sm text-gray-900">
                  {t("timer.felt.antallTimer")}: {(Math.round(resultat.timer * 100) / 100).toLocaleString("nb-NO")}
                </Text>
              )}
              {kmFirma && regel && resultat.klassifisering && (
                <Pressable
                  onPress={() =>
                    setManuell((m) => ({
                      ...m,
                      kategoriValg: m.kategoriValg === "reisetid" ? regel.reiseUnderTerskelType : "reisetid",
                    }))
                  }
                  className="flex-row items-center gap-2"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: manuell.kategoriValg === "reisetid" }}
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded border ${
                      manuell.kategoriValg === "reisetid" ? "border-blue-600 bg-blue-600" : "border-gray-400 bg-white"
                    }`}
                  >
                    {manuell.kategoriValg === "reisetid" && <Check size={14} color="#ffffff" />}
                  </View>
                  <Text className="text-sm text-gray-800">
                    {t("timer.reiseKort.merEnnKm", {
                      terskel: manuellReiseTerskelTekst(t, { type: "over", enhet: "km", terskelM: regel.reiseTerskelM! }),
                    })}
                  </Text>
                </Pressable>
              )}
              {resultat.klassifisering && resultat.klassifisering.lonnsartId != null && (
                <Text className="text-xs text-gray-500">
                  {forklaringTekst(
                    t,
                    resultat.klassifisering,
                    reise.lonnsartNavn(resultat.klassifisering.lonnsartId),
                  )}
                </Text>
              )}
              {sluttForStart && (
                <Text className="text-xs font-medium text-red-700">{t("timer.feil.sluttForStart")}</Text>
              )}
            </View>
          )}

          {/* Sperreårsaken synlig i kortet — på telefon er den ellers bare
              tilgjengelig ved trykk på den grå Lagre-knappen (L2 commit 9 / vilkår 1). */}
          {sperre && (
            <Text className="text-xs font-medium text-red-700">{t(SPERRE_NOKKEL[sperre])}</Text>
          )}
          {!sperre && kontorKonflikt && (
            <Text className="text-xs font-medium text-red-700">{t("timer.reiseKort.sperre.adminMidlertidig")}</Text>
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
              sperre
                ? t(SPERRE_NOKKEL[sperre])
                : kontorKonflikt
                  ? t("timer.reiseKort.sperre.adminMidlertidig")
                  : sluttForStart
                    ? t("timer.feil.sluttForStart")
                  : !aktivitetId
                    ? t("timer.feil.aktivitetPaakrevd")
                    : ""
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
