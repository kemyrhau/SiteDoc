import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { overstigerMaskinTak } from "@sitedoc/shared";
import { hentDatabase } from "../../db/database";
import { byggeplassLocal, externalCostObjectLocal } from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import type {
  TimerRad,
  TilleggRad,
  MaskinRad,
  UtleggRad,
} from "../../types/timer-detalj";
import { TimerSeksjon } from "./TimerSeksjon";
import { TilleggSeksjon } from "./TilleggSeksjon";
import { UtleggSeksjon } from "./UtleggSeksjon";
import { MaskinSeksjon } from "./MaskinSeksjon";
import { VareforbrukLesListe, type VisVarelinje } from "./VareforbrukLesListe";

/**
 * Prosjekt-gruppe for dagsseddel-detaljen (T7-3b2/T7-4e): ECO-bøtter med timer
 * + maskin, tillegg og utlegg for ett prosjekt. Flyttet ut av `app/timer/[id].tsx`
 * (Prosjektkort L2) så kortskjermen `timer/[id]/kort/[projectId]` gjenbruker den
 * uendret.
 */
export function ProsjektGruppe({
  projectId,
  visHeader,
  sheetId,
  organizationId,
  sedelProjectId,
  sedelByggeplassId,
  dato,
  pauseMin,
  defaultAktivitetId,
  harEquipmentCache,
  harMaskinforerbevis,
  redigerbar,
  onPauseToggle,
  timerRader,
  alleTimerRader,
  tilleggRader,
  maskinRader,
  utleggRader,
  varer,
  onEndret,
}: {
  projectId: string;
  visHeader: boolean;
  sheetId: string;
  organizationId: string;
  /** Fallback for rader uten per-rad-projectId (pre-T7-3b1-data). */
  sedelProjectId: string;
  /** F3: sedel-nivå byggeplass — arvet verdi på rader uten per-rad-override. */
  sedelByggeplassId: string | null;
  /** F5: dag-nivå matpause-toggle (videreføres til TimerSeksjon). */
  onPauseToggle: (radId: string, vilHa: boolean) => void;
  dato: string;
  /** Sedel-nivå pause (min) — inngår i maskin-kapasitet per bucket (Del 2). */
  pauseMin: number;
  defaultAktivitetId: string | null;
  harEquipmentCache: boolean;
  harMaskinforerbevis: boolean;
  redigerbar: boolean;
  /** Prosjekt-scopet (denne gruppens rader) — visning/bøtter. */
  timerRader: TimerRad[];
  /** M3: sedelens fulle timer-rad-liste (alle prosjekter/ECO), kun overlapp-sjekk. */
  alleTimerRader: TimerRad[];
  tilleggRader: TilleggRad[];
  maskinRader: MaskinRad[];
  utleggRader: UtleggRad[];
  /** K20: dagskortets lesevisning. Prosjektkortet sender ikke — det har egen blokk. */
  varer?: VisVarelinje[];
  onEndret: () => void;
}) {
  const { t } = useTranslation();
  const prosjekt = useMemo(() => finnProsjektLokalt(projectId), [projectId]);
  // U1: v2 gruppe-header kan kollapses (skjuler ECO-bukets, beholder sum).
  const [kollapset, setKollapset] = useState(false);

  // Byggeplass i gruppe-header. Primærprosjektets byggeplass vises i sedel-
  // toppen (L1/B6 blå topp-oversikt) → ikke dupliser her. For SEKUNDÆR-grupper
  // (rad-nivå multi-prosjekt) vises byggeplassLocal.navn KUN når prosjektet har
  // nøyaktig én byggeplass i cache (unngå å vise feil ved flere).
  const byggeplassNavn = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    if (projectId === sedelProjectId) return null;
    const perProsjekt = db
      .select({ navn: byggeplassLocal.navn })
      .from(byggeplassLocal)
      .where(eq(byggeplassLocal.projectId, projectId))
      .all();
    if (perProsjekt.length === 1 && perProsjekt[0].navn) {
      return perProsjekt[0].navn;
    }
    return null;
  }, [projectId, sedelProjectId]);

  // Subtotal i gruppe-header: sum av prosjektets arbeidstimer. Maskin holdes
  // utenfor (vises som «herav» i hver ECO-bucket).
  const prosjektTimer = useMemo(
    () => timerRader.reduce((sum, r) => sum + (r.timer ?? 0), 0),
    [timerRader],
  );

  // T7-4e: bygg ECO-bukets innen dette prosjektet. Hovedgruppe (ECO=null)
  // vises alltid først; ECO-er i den rekkefølgen de først dukker opp i rader.
  // Rader uten projectId tilskrives sedelProjectId (pre-T7-3b1-fallback).
  const ecoBuckets = useMemo(() => {
    type Bucket = { ecoId: string | null; timer: TimerRad[]; maskin: MaskinRad[] };
    const map = new Map<string, Bucket>();
    const ekv = (eco: string | null) => eco ?? "";

    const finn = (eco: string | null): Bucket => {
      const k = ekv(eco);
      let b = map.get(k);
      if (!b) {
        b = { ecoId: eco, timer: [], maskin: [] };
        map.set(k, b);
      }
      return b;
    };
    for (const r of timerRader) finn(r.externalCostObjectId ?? null).timer.push(r);
    for (const r of maskinRader) finn(r.externalCostObjectId ?? null).maskin.push(r);
    // Hvis ingen rader: vis tom hovedgruppe så bruker kan legge til.
    if (map.size === 0) finn(null);
    // Sorter: hovedgruppe (null) først, deretter i innsetnings-rekkefølge.
    return Array.from(map.values()).sort((a, b) => {
      if (a.ecoId === null && b.ecoId !== null) return -1;
      if (a.ecoId !== null && b.ecoId === null) return 1;
      return 0;
    });
  }, [timerRader, maskinRader]);

  return (
    <Animated.View layout={LinearTransition} className="mt-2">
      {visHeader && (
        <Pressable
          onPress={() => setKollapset((v) => !v)}
          className="mx-4 mt-4 flex-row items-center justify-between gap-2 rounded-lg border border-gray-200 bg-blue-50 px-4 py-2.5"
        >
          <View className="flex-1 flex-row items-center gap-1.5">
            {kollapset ? (
              <ChevronRight size={16} color="#1e40af" />
            ) : (
              <ChevronDown size={16} color="#1e40af" />
            )}
            <View className="flex-1">
              <Text className="text-sm font-semibold text-sitedoc-primary">
                {prosjekt
                  ? `${prosjekt.projectNumber ? prosjekt.projectNumber + " — " : ""}${prosjekt.name}`
                  : projectId}
              </Text>
              {byggeplassNavn && (
                <Text className="text-xs text-gray-600">{byggeplassNavn}</Text>
              )}
            </View>
          </View>
          <Text className="text-sm font-semibold text-sitedoc-primary">
            {prosjektTimer.toFixed(2)} {t("timer.tEnhet")}
          </Text>
        </Pressable>
      )}

      {/* ECO-bukets (hovedgruppe + N underprosjekter) — skjules ved kollaps.
          U3: myk fade-inn/ut + layout-transisjon (Reanimated). */}
      {!kollapset && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          layout={LinearTransition}
        >
          {ecoBuckets.map((bucket) => (
            <EcoBucket
              key={bucket.ecoId ?? "hoved"}
              sheetId={sheetId}
              organizationId={organizationId}
              projectId={projectId}
              ecoId={bucket.ecoId}
              sedelByggeplassId={sedelByggeplassId}
              onPauseToggle={onPauseToggle}
              dato={dato}
              pauseMin={pauseMin}
              defaultAktivitetId={defaultAktivitetId}
              harEquipmentCache={harEquipmentCache}
              harMaskinforerbevis={harMaskinforerbevis}
              redigerbar={redigerbar}
              timerRader={bucket.timer}
              alleTimerRader={alleTimerRader}
              maskinRader={bucket.maskin}
              onEndret={onEndret}
            />
          ))}
        </Animated.View>
      )}

      {/* Tillegg per-prosjekt (separat fra ECO-bukets — ingen ECO-felt på SheetTillegg) */}
      <TilleggSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        projectId={projectId}
        rader={tilleggRader}
        redigerbar={redigerbar}
        onEndret={onEndret}
      />
      {/* U4: Utlegg per-prosjekt — egen bærer (SheetUtlegg), ordning utledet
          per prosjekt+kategori. Ligger etter Tillegg (to kataloger, to bærere). */}
      <UtleggSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        projectId={projectId}
        rader={utleggRader}
        redigerbar={redigerbar}
        onEndret={onEndret}
      />
      {varer && varer.length > 0 ? <VareforbrukLesListe varer={varer} /> : null}
      {/* sedelProjectId brukes ikke direkte her — beholdt for fremtidig
          backfill av rader uten projectId. void for å unngå lint-warning. */}
      {void sedelProjectId}
    </Animated.View>
  );
}

/**
 * T7-4e (2026-05-16): EcoBucket — én bucket per (projectId, externalCostObjectId).
 * Speil av web EcoGruppe (T7-4c). Arbeidstimer (TimerSeksjon) er hovedposten;
 * maskintimer (MaskinSeksjon) rendres indentert som visuell underpost. Sum-
 * indikator nederst speiler server-validering fra T7-4b.
 */
function EcoBucket({
  sheetId,
  organizationId,
  projectId,
  ecoId,
  sedelByggeplassId,
  onPauseToggle,
  dato,
  pauseMin,
  defaultAktivitetId,
  harEquipmentCache,
  harMaskinforerbevis,
  redigerbar,
  timerRader,
  alleTimerRader,
  maskinRader,
  onEndret,
}: {
  sheetId: string;
  organizationId: string;
  projectId: string;
  ecoId: string | null;
  /** F3: sedel-nivå byggeplass — arvet verdi på rader uten per-rad-override. */
  sedelByggeplassId: string | null;
  /** F5: dag-nivå matpause-toggle (videreføres til TimerSeksjon). */
  onPauseToggle: (radId: string, vilHa: boolean) => void;
  dato: string;
  pauseMin: number;
  defaultAktivitetId: string | null;
  harEquipmentCache: boolean;
  harMaskinforerbevis: boolean;
  redigerbar: boolean;
  timerRader: TimerRad[];
  /** M3: sedelens fulle timer-rad-liste (kryss-bøtte), kun til overlapp-sjekk. */
  alleTimerRader: TimerRad[];
  maskinRader: MaskinRad[];
  onEndret: () => void;
}) {
  const { t } = useTranslation();
  const sumTimer = useMemo(
    () => timerRader.reduce((acc, r) => acc + r.timer, 0),
    [timerRader],
  );
  const sumMaskin = useMemo(
    () => maskinRader.reduce((acc, r) => acc + r.timer, 0),
    [maskinRader],
  );
  // Delt regel (@sitedoc/shared) — samme epsilon + pause-modell som server.
  const maskinOk = !overstigerMaskinTak(sumMaskin, sumTimer, pauseMin);

  // ECO-navn fra lokal cache (én lookup per bucket).
  const ecoNavn = useMemo(() => {
    if (!ecoId) return null;
    const db = hentDatabase();
    if (!db) return null;
    const eco = db
      .select()
      .from(externalCostObjectLocal)
      .where(eq(externalCostObjectLocal.id, ecoId))
      .all()[0];
    return eco ? { proAdmId: eco.proAdmId, kortNavn: eco.kortNavn } : null;
  }, [ecoId]);

  return (
    <View
      className={`mx-4 mt-3 rounded border bg-gray-50 p-3 ${
        ecoId ? "border-indigo-200" : "border-gray-200"
      }`}
    >
      {/* ECO-subheader + indigo-badge "→ Godkjenning byggherre" — kun ekte ECO-er */}
      {ecoId && (
        <View className="mb-2 flex-row items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <View className="flex-1 flex-row items-center gap-1.5">
            {ecoNavn ? (
              <>
                {/* U1: ECO-id som badge-chip */}
                <View className="rounded bg-indigo-100 px-1.5 py-0.5">
                  <Text className="text-xs font-semibold text-indigo-800">
                    {ecoNavn.proAdmId}
                  </Text>
                </View>
                <Text className="flex-1 text-xs font-medium text-gray-700">
                  {ecoNavn.kortNavn}
                </Text>
              </>
            ) : (
              <Text className="flex-1 text-xs font-semibold text-gray-800">
                {t("timer.detalj.ukjentEco")}
              </Text>
            )}
          </View>
          <View className="rounded bg-indigo-100 px-1.5 py-0.5">
            <Text className="text-xs font-medium text-indigo-800">
              → {t("timer.gruppe.tilByggherre")}
            </Text>
          </View>
        </View>
      )}

      {/* Arbeidstimer (hovedpost) */}
      <Text className="mb-1 text-xs font-medium text-gray-700">
        {t("timer.gruppe.arbeidstimer")} ({sumTimer.toFixed(2)} {t("timer.tEnhet")})
      </Text>
      <TimerSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        rader={timerRader}
        alleTimerRader={alleTimerRader}
        projectId={projectId}
        defaultEcoId={ecoId}
        visHeader={false}
        dato={dato}
        sedelByggeplassId={sedelByggeplassId}
        pauseMin={pauseMin}
        harEquipmentCache={harEquipmentCache}
        defaultAktivitetId={defaultAktivitetId}
        redigerbar={redigerbar}
        onPauseToggle={onPauseToggle}
        onEndret={onEndret}
      />

      {/* P1 (maskin-i-rad): maskin-radene rendres inline rett etter timer-radene
          i samme rad-liste, hver med et slate «MASKIN»-merke (MaskinRadVis). Den
          separate «herav maskin»-underposten + «+ Legg til maskin»-knappen er
          fjernet; ny maskin legges via timerrad-modalens valgfrie maskin-seksjon,
          mens eksisterende maskin-rader fortsatt redigeres inline (trykk rad). */}
      <MaskinSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        projectId={projectId}
        defaultEcoId={ecoId}
        visHeader={false}
        dato={dato}
        pauseMin={pauseMin}
        rader={maskinRader}
        harEquipmentCache={harEquipmentCache}
        harMaskinforerbevis={harMaskinforerbevis}
        redigerbar={redigerbar}
        onEndret={onEndret}
      />

      {/* Sum-indikator: grønn når maskin ≤ arbeid, rød ellers — speiler T7-4b.
          Del B pkt 3 (device-funn 2026-08-08): skjules når maskin = 0.00t. Et
          «Herav maskin 0.00t av Xt arbeid»-banner uten maskininngang er selv-
          motsigende og leses som at maskintimer ER ført. Ved maskin > 0 beholdes
          dagens ordlyd (allerede omformulert én gang, jf. BACKLOG maskinAvArbeid). */}
      {sumMaskin > 0 && (
        <View
          className={`mt-3 rounded border px-3 py-1.5 ${
            maskinOk
              ? "border-green-200 bg-green-50"
              : "border-red-300 bg-red-50"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              maskinOk ? "text-green-800" : "text-red-800"
            }`}
          >
            {t("timer.gruppe.maskinAvArbeid", {
              maskin: sumMaskin.toFixed(2),
              arbeid: sumTimer.toFixed(2),
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
