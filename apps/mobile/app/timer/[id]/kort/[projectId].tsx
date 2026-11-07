import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetMachineLocal,
  equipmentLocal,
  byggeplassLocal,
} from "../../../../src/db/schema";
import { useTimerSync } from "../../../../src/providers/TimerSyncProvider";
import { useNettverk } from "../../../../src/providers/NettverkProvider";
import { trpc } from "../../../../src/lib/trpc";
import { TimerStatusMerkelapp } from "../../../../src/components/TimerStatusMerkelapp";
import { BekreftFjernMatpauseModal } from "../../../../src/components/timer-detalj/BekreftFjernMatpauseModal";
import type { VisVarelinje } from "../../../../src/components/timer-detalj/VareforbrukLesListe";
import { ProsjektkortDagsoversikt } from "../../../../src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt";
import { finnProsjektLokalt } from "../../../../src/services/prosjektKatalog";
import { finnUnderprosjektLokalt, hentReiseLonnsartId } from "../../../../src/services/timerKatalog";
import { harMaskinforerbevisLokalt } from "../../../../src/services/maskinKatalog";
import { hentVarelagerProsjekterLokalt } from "../../../../src/services/vareKatalog";
import {
  hentLokaleVarelinjer,
  type LokalVarelinje,
} from "../../../../src/services/vareforbrukSync";
import {
  flyttMatpauseVedAvhuking,
  settMatpauseBaerer,
  fjernMatpause,
} from "../../../../src/services/matpause";
import { useMiniToast, MiniToast } from "../../../../src/components/MiniToast";
import { useReLesVedSynk } from "../../../../src/hooks/useReLesVedSynk";
import { formatNorskDato, isoTidspunktTilHHMM } from "../../../../src/utils/dato";
import {
  effektivByggeplass,
  fraRuteParam,
  kortValgFor,
  raderPaaKort,
  type KortValg,
  type SedelKortKontekst,
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
  varerForProsjekt,
} from "../../../../src/lib/prosjektkortMobil";
import { KortHode } from "../../../../src/components/timer-detalj/prosjektkort/ProsjektkortSamleside";
import type {
  Sedel,
  TimerRad,
  MaskinRad,
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
  const params = useLocalSearchParams<{ id: string; projectId: string; bp?: string; up?: string }>();
  const sheetId = params.id ?? "";
  const projectId = params.projectId ?? "";
  // ORDRE 36b: kortet = (prosjekt, byggeplass, underprosjekt). Mangler `bp`
  // (gammel rute) velges prosjektets første kort.
  const bpParam = fraRuteParam(params.bp);
  const upParam = fraRuteParam(params.up) ?? null;
  const { triggerSync, oppdaterTellere, sistSynkronisert } = useTimerSync();
  const { erPaaNettet } = useNettverk();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [harEquipmentCache, setHarEquipmentCache] = useState(false);
  const [harMaskinforerbevis, setHarMaskinforerbevis] = useState(true);
  const { melding: pauseToast, vis: visPauseToast } = useMiniToast();
  const [bekreftFjernRadId, setBekreftFjernRadId] = useState<string | null>(null);
  const [lokaleVarer, setLokaleVarer] = useState<LokalVarelinje[]>([]);
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);

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
    setMaskinRader(
      db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
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

  // F5-matpausen er dag-nivå (kryss-kort), som på samlesiden. ORDRE 36b:
  // avhukingen vises i rad-modalen (RadHandlinger), ikke på rad-kortet.
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

  const sedelKontekst = useMemo<SedelKortKontekst | null>(() => {
    if (!sedel) return null;
    const db = hentDatabase();
    const bp =
      db && sedel.byggeplassId
        ? db
            .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
            .from(byggeplassLocal)
            .where(eq(byggeplassLocal.id, sedel.byggeplassId))
            .all()[0]
        : undefined;
    return {
      projectId: sedel.projectId,
      byggeplass: bp ? { id: bp.id, projectId: bp.projectId } : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedel?.projectId, sedel?.byggeplassId]);

  const ecoNavn = useCallback((ecoId: string): string => {
    const e = finnUnderprosjektLokalt(ecoId);
    return e ? `${e.proAdmId} — ${e.kortNavn}` : ecoId;
  }, []);

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

  const kontekst = sedelKontekst ?? { projectId: sedel.projectId, byggeplass: null };
  const iProsjektet = (r: { projectId: string | null }) =>
    (r.projectId ?? sedel.projectId) === projectId;
  const forste = [...timerRader, ...maskinRader].find(iProsjektet);
  const valg: KortValg =
    bpParam === undefined
      ? forste
        ? kortValgFor(forste, kontekst)
        : { projectId, byggeplassId: effektivByggeplass(projectId, null, kontekst), ecoId: null }
      : { projectId, byggeplassId: bpParam, ecoId: upParam };
  const kTimer = raderPaaKort(timerRader, kontekst, valg);
  const kMaskin = raderPaaKort(maskinRader, kontekst, valg);
  const kVarer = raderPaaKort(varer, kontekst, valg);
  // Tillegg og utlegg er dagsnivå (ORDRE 36b) — de ligger på samlesiden.
  const tomt = kTimer.length + kMaskin.length + kVarer.length === 0;

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
            navn={valg.ecoId ? `${prosjektNavn} · ${ecoNavn(valg.ecoId)}` : prosjektNavn}
            timer={tilKortTimerRader(kTimer, sedel.projectId, reiseLonnsartId)}
            maskin={tilKortMaskinRader(kMaskin, sedel.projectId)}
            varer={kVarer}
            utlegg={0}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            byggeplassNavn={byggeplassNavn}
          />
        </View>

        {/* T.11: soft-varsel når arbeider mangler gyldig maskinførerbevis
            (som maskinseksjonen viste det: kun når maskin er ført). */}
        {harEquipmentCache && !harMaskinforerbevis && kMaskin.length > 0 && (
          <View className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={14} color="#b45309" />
              <Text className="flex-1 text-xs text-amber-800">
                {t("timer.maskinforerbevis.arbeider")}
              </Text>
            </View>
          </View>
        )}

        {tomt && erRedigerbar && (
          <Text className="mx-4 mt-3 text-sm text-gray-500">
            {t("timer.prosjektkort.tomtKort")}
          </Text>
        )}

        {/* ORDRE 36b: kortet er dagsoversikten for ett prosjekt — linjene
            åpner de delte rad-modalene, skriving via radLagring. */}
        <ProsjektkortDagsoversikt
          enkeltProsjekt
          sheetId={sheetId}
          sedel={sedel}
          kort={[valg]}
          sedelKontekst={kontekst}
          ecoNavn={ecoNavn}
          timerRader={timerRader}
          maskinRader={maskinRader}
          varer={varer}
          reiseLonnsartId={reiseLonnsartId}
          harEquipmentCache={harEquipmentCache}
          varelagerProsjekter={varelagerProsjekter}
          normTimer={null}
          ramme={{
            fra: isoTidspunktTilHHMM(sedel.startAt),
            til: isoTidspunktTilHHMM(sedel.endAt),
            pauseMin: sedel.pauseMin ?? 0,
          }}
          rammeByggeplassNavn={null}
          prosjektNavn={() => prosjektNavn}
          byggeplassNavn={byggeplassNavn}
          redigerbar={erRedigerbar}
          onPauseToggle={handterPauseToggle}
          onEndret={markerEndretOgLes}
          onVarerLagret={() => {
            lesData();
            void triggerSync();
          }}
        />

      </ScrollView>

      <BekreftFjernMatpauseModal
        synlig={bekreftFjernRadId !== null}
        onAvbryt={() => setBekreftFjernRadId(null)}
        onBekreft={bekreftFjernMatpause}
      />

      <MiniToast melding={pauseToast} />
    </View>
  );
}
