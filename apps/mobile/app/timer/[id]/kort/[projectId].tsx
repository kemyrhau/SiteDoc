import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  sheetUtleggLocal,
  equipmentLocal,
  byggeplassLocal,
} from "../../../../src/db/schema";
import { useTimerSync } from "../../../../src/providers/TimerSyncProvider";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useNettverk } from "../../../../src/providers/NettverkProvider";
import { trpc } from "../../../../src/lib/trpc";
import { TimerStatusMerkelapp } from "../../../../src/components/TimerStatusMerkelapp";
import { ProsjektGruppe } from "../../../../src/components/timer-detalj/ProsjektGruppe";
import { BekreftFjernMatpauseModal } from "../../../../src/components/timer-detalj/BekreftFjernMatpauseModal";
import { KortVareforbrukModal } from "../../../../src/components/timer-detalj/KortVareforbrukModal";
import {
  VareforbrukLesListe,
  type VisVarelinje,
} from "../../../../src/components/timer-detalj/VareforbrukLesListe";
import { KortHode } from "../../../../src/components/timer-detalj/prosjektkort/ProsjektkortSamleside";
import { ProsjektkortKontekst } from "../../../../src/components/timer-detalj/prosjektkortKontekst";
import { finnProsjektLokalt } from "../../../../src/services/prosjektKatalog";
import { hentReiseLonnsartId } from "../../../../src/services/timerKatalog";
import { harMaskinforerbevisLokalt } from "../../../../src/services/maskinKatalog";
import { hentVarelagerProsjekterLokalt } from "../../../../src/services/vareKatalog";
import {
  hentLokaleVarelinjer,
  type LokalVarelinje,
} from "../../../../src/services/vareforbrukSync";
import { visVareforbrukKnapp } from "@sitedoc/shared";
import {
  flyttMatpauseVedAvhuking,
  settMatpauseBaerer,
  fjernMatpause,
} from "../../../../src/services/matpause";
import { useMiniToast, MiniToast } from "../../../../src/components/MiniToast";
import { useReLesVedSynk } from "../../../../src/hooks/useReLesVedSynk";
import { formatNorskDato } from "../../../../src/utils/dato";
import {
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
  varerForProsjekt,
} from "../../../../src/lib/prosjektkortMobil";
import type {
  Sedel,
  TimerRad,
  TilleggRad,
  MaskinRad,
  UtleggRad,
} from "../../../../src/types/timer-detalj";

/**
 * Prosjektkort L2 (spec § 4.3): ett prosjekts del av dagen. Samme DailySheet
 * som samlesiden (modell A) — radene filtreres på prosjektet. Prosjektet er
 * låst i rad-modalen via ProsjektkortKontekst; byggeplass kan fortsatt velges.
 * Et tomt kort lagres ikke: det finnes først når første rad er lagt til.
 */
export default function ProsjektkortSkjerm() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; projectId: string }>();
  const sheetId = params.id ?? "";
  const projectId = params.projectId ?? "";
  const { triggerSync, oppdaterTellere, sistSynkronisert } = useTimerSync();
  const { erPaaNettet } = useNettverk();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [utleggRader, setUtleggRader] = useState<UtleggRad[]>([]);
  const [harEquipmentCache, setHarEquipmentCache] = useState(false);
  const [harMaskinforerbevis, setHarMaskinforerbevis] = useState(true);
  const { melding: pauseToast, vis: visPauseToast } = useMiniToast();
  const [bekreftFjernRadId, setBekreftFjernRadId] = useState<string | null>(null);
  const { bruker } = useAuth();
  const [lokaleVarer, setLokaleVarer] = useState<LokalVarelinje[]>([]);
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);
  const [visVareModal, setVisVareModal] = useState(false);

  // Samme lesing som timer/[id] — alle dagens rader (overlapp og matpause
  // gjelder hele dagen); filtrering pr. prosjekt skjer ved visning.
  const lesData = useCallback(() => {
    const db = hentDatabase();
    if (!db) return;
    const sedelRad = db
      .select()
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, sheetId))
      .all()[0];
    if (!sedelRad) {
      setSedel(null);
      return;
    }
    setSedel(sedelRad);
    setTimerRader(
      db.select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).all(),
    );
    setTilleggRader(
      db.select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.dagsseddelId, sheetId)).all(),
    );
    setMaskinRader(
      db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
    );
    setUtleggRader(
      db.select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.dagsseddelId, sheetId)).all(),
    );
    const equipmentCount = db
      .select({ id: equipmentLocal.id })
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, sedelRad.organizationId))
      .all().length;
    setHarEquipmentCache(equipmentCount > 0);
    setLokaleVarer(hentLokaleVarelinjer(sheetId, projectId));
  }, [sheetId, projectId]);

  useFocusEffect(
    useCallback(() => {
      lesData();
    }, [lesData]),
  );
  useReLesVedSynk(sistSynkronisert, lesData);

  useEffect(() => {
    const orgId = sedel?.organizationId;
    if (!orgId) return;
    let aktiv = true;
    void harMaskinforerbevisLokalt(orgId).then((gyldig) => {
      if (aktiv) setHarMaskinforerbevis(gyldig);
    });
    return () => {
      aktiv = false;
    };
  }, [sedel?.organizationId]);

  useEffect(() => {
    const orgId = sedel?.organizationId;
    if (!orgId) return;
    let aktiv = true;
    void hentVarelagerProsjekterLokalt(orgId).then((ider) => {
      if (aktiv) setVarelagerProsjekter(ider);
    });
    return () => {
      aktiv = false;
    };
  }, [sedel?.organizationId, sistSynkronisert]);

  const erRedigerbar = sedel?.status === "draft" || sedel?.status === "returned";

  const markerEndretOgLes = useCallback(() => {
    const db = hentDatabase();
    if (!db || !sedel) return;
    db.update(dagsseddelLocal)
      .set({ sistEndretLokalt: Date.now(), syncStatus: "pending" })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    oppdaterTellere();
    void triggerSync();
    lesData();
  }, [sedel, sheetId, oppdaterTellere, triggerSync, lesData]);

  // F5-matpausen er dag-nivå (kryss-kort), som på samlesiden.
  const handterPauseToggle = useCallback(
    (radId: string, vilHa: boolean) => {
      if (!sedel) return;
      if (vilHa) {
        settMatpauseBaerer(sheetId, radId, sedel.organizationId, sedel.dato);
        markerEndretOgLes();
        return;
      }
      const res = flyttMatpauseVedAvhuking(sheetId, radId, sedel.organizationId, sedel.dato);
      if (res.utfall === "flyttet") {
        markerEndretOgLes();
        visPauseToast(t("timer.matpause.flyttet", { tidsrom: res.tilTidsrom }));
      } else if (res.utfall === "ingenKvalifisert") {
        setBekreftFjernRadId(radId);
      }
    },
    [sedel, sheetId, markerEndretOgLes, visPauseToast, t],
  );

  const bekreftFjernMatpause = useCallback(() => {
    if (!sedel) return;
    fjernMatpause(sheetId, sedel.organizationId, sedel.dato);
    setBekreftFjernRadId(null);
    markerEndretOgLes();
  }, [sedel, sheetId, markerEndretOgLes]);

  const iKortet = useCallback(
    (r: { projectId: string | null }) =>
      (r.projectId ?? sedel?.projectId) === projectId,
    [sedel?.projectId, projectId],
  );

  const orgId = sedel?.organizationId;
  const reiseLonnsartId = useMemo(
    () => (orgId ? hentReiseLonnsartId(orgId) : null),
    [orgId],
  );
  const vareQuery = trpc.vareforbruk.hentMineForDato.useQuery(
    { organizationId: sedel?.organizationId ?? "", dato: sedel?.dato ?? "" },
    { enabled: erPaaNettet && !!sedel },
  );
  // Server-linjer + lokale fra kortet (L3). Synket lokal linje har samme id
  // som server-raden → telles én gang; offline vises de lokale alene.
  const varer = useMemo(
    () =>
      varerForProsjekt<VisVarelinje>(tilKortVarer(vareQuery.data ?? []), lokaleVarer, projectId),
    [vareQuery.data, lokaleVarer, projectId],
  );
  const kanForeVare = visVareforbrukKnapp({
    prosjektIderMedVarelager: varelagerProsjekter,
    projectId,
    erRedigerbar,
  });

  const prosjektNavn = useMemo(() => {
    const p = finnProsjektLokalt(projectId);
    if (!p) return projectId;
    return `${p.projectNumber ? p.projectNumber + " — " : ""}${p.name}`;
  }, [projectId]);

  const byggeplassNavn = useCallback((byggeplassId: string): string | null => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ navn: byggeplassLocal.navn })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, byggeplassId))
        .all()[0]?.navn ?? null
    );
  }, []);

  if (!sedel) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.prosjektkort.tittel")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t("timer.ikkeFunnet")}</Text>
        </View>
      </View>
    );
  }

  const kTimer = timerRader.filter(iKortet);
  const kTillegg = tilleggRader.filter(iKortet);
  const kMaskin = maskinRader.filter(iKortet);
  const kUtlegg = utleggRader.filter(iKortet);
  const tomt =
    kTimer.length + kTillegg.length + kMaskin.length + kUtlegg.length === 0;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
          {formatNorskDato(sedel.dato)} · {t("timer.prosjektkort.tittel")}
        </Text>
        <TimerStatusMerkelapp status={sedel.status} syncStatus={sedel.syncStatus} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-24">
        <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <KortHode
            projectId={projectId}
            navn={prosjektNavn}
            timer={tilKortTimerRader(kTimer, sedel.projectId, reiseLonnsartId)}
            maskin={tilKortMaskinRader(kMaskin, sedel.projectId)}
            varer={varer}
            utlegg={kUtlegg.length}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            byggeplassNavn={byggeplassNavn}
          />
        </View>

        {tomt && erRedigerbar && (
          <Text className="mx-4 mt-3 text-sm text-gray-500">
            {t("timer.prosjektkort.tomtKort")}
          </Text>
        )}

        {/* Arbeidstimer (ECO-bøtter, maskin som underpost), tillegg og utlegg —
            samme komponent som dagskortet, med prosjektet låst. */}
        <ProsjektkortKontekst.Provider value={true}>
          <ProsjektGruppe
            projectId={projectId}
            visHeader={false}
            sheetId={sheetId}
            organizationId={sedel.organizationId}
            sedelProjectId={sedel.projectId}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            dato={sedel.dato}
            pauseMin={sedel.pauseMin}
            defaultAktivitetId={sedel.aktivitetId ?? null}
            harEquipmentCache={harEquipmentCache}
            harMaskinforerbevis={harMaskinforerbevis}
            redigerbar={erRedigerbar}
            onPauseToggle={handterPauseToggle}
            timerRader={kTimer}
            alleTimerRader={timerRader}
            tilleggRader={kTillegg}
            maskinRader={kMaskin}
            utleggRader={kUtlegg}
            onEndret={markerEndretOgLes}
          />
        </ProsjektkortKontekst.Provider>

        {/* Vareforbruk (L3): føres fra kortet med prosjektet låst. */}
        {(varer.length > 0 || kanForeVare) && (
          <VareforbrukLesListe varer={varer}>
            {kanForeVare && (
              <Pressable
                onPress={() => setVisVareModal(true)}
                className="mt-2 self-start rounded-lg border border-blue-700 px-3 py-2 active:bg-blue-50"
              >
                <Text className="text-sm font-medium text-blue-700">
                  {t("timer.prosjektkort.nyVare")}
                </Text>
              </Pressable>
            )}
          </VareforbrukLesListe>
        )}
      </ScrollView>

      <BekreftFjernMatpauseModal
        synlig={bekreftFjernRadId !== null}
        onAvbryt={() => setBekreftFjernRadId(null)}
        onBekreft={bekreftFjernMatpause}
      />

      {bruker?.id && (
        <KortVareforbrukModal
          synlig={visVareModal}
          userId={bruker.id}
          organizationId={sedel.organizationId}
          sheetId={sheetId}
          projectId={projectId}
          prosjektNavn={prosjektNavn}
          dato={sedel.dato}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          onAvbryt={() => setVisVareModal(false)}
          onLagret={() => {
            setVisVareModal(false);
            lesData();
            void triggerSync();
          }}
        />
      )}

      <MiniToast melding={pauseToast} />
    </View>
  );
}
