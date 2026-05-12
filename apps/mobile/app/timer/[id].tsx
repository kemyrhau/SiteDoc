import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import {
  ArrowLeft,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  aktivitetLocal,
  equipmentLocal,
} from "../../src/db/schema";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { TimerStatusMerkelapp } from "../../src/components/TimerStatusMerkelapp";
import { DagstotalBanner } from "../../src/components/DagstotalBanner";
import { TimerSeksjon } from "../../src/components/timer-detalj/TimerSeksjon";
import { TilleggSeksjon } from "../../src/components/timer-detalj/TilleggSeksjon";
import { MaskinSeksjon } from "../../src/components/timer-detalj/MaskinSeksjon";
import { formatNorskDato, formatTidspunkt } from "../../src/utils/dato";
import type {
  Sedel,
  TimerRad,
  TilleggRad,
  MaskinRad,
  Aktivitet,
} from "../../src/types/timer-detalj";

export default function DagsseddelDetalj() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const sheetId = params.id ?? "";
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [aktivitet, setAktivitet] = useState<Aktivitet | null>(null);
  const [harEquipmentCache, setHarEquipmentCache] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

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

    const tider = db
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all();
    setTimerRader(tider);

    const tillegg = db
      .select()
      .from(sheetTilleggLocal)
      .where(eq(sheetTilleggLocal.dagsseddelId, sheetId))
      .all();
    setTilleggRader(tillegg);

    const maskiner = db
      .select()
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all();
    setMaskinRader(maskiner);

    const akt = db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.id, sedelRad.aktivitetId))
      .all()[0];
    setAktivitet(akt ?? null);

    // Soft-skjul-sjekk: maskin-seksjonen vises kun hvis Equipment-cache er
    // populert (Maskin-modul aktivert + firmaet har utstyr) eller hvis
    // sedlen allerede har maskin-rader (gamle rader bevares).
    const equipmentCount = db
      .select({ id: equipmentLocal.id })
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, sedelRad.organizationId))
      .all().length;
    setHarEquipmentCache(equipmentCount > 0);
  }, [sheetId]);

  useFocusEffect(
    useCallback(() => {
      lesData();
    }, [lesData]),
  );

  const erRedigerbar = useMemo(() => {
    if (!sedel) return false;
    return sedel.status === "draft" || sedel.status === "returned";
  }, [sedel]);

  const markerEndretOgLes = useCallback(() => {
    const db = hentDatabase();
    if (!db || !sedel) return;
    db.update(dagsseddelLocal)
      .set({
        sistEndretLokalt: Date.now(),
        syncStatus: "pending",
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    oppdaterTellere();
    void triggerSync();
    lesData();
  }, [sedel, sheetId, oppdaterTellere, triggerSync, lesData]);

  function sendTilAttestering() {
    if (!sedel) return;
    if (timerRader.length === 0) {
      setFeil(t("timer.feil.minstEnTimerRad"));
      return;
    }
    const db = hentDatabase();
    if (!db) return;
    db.update(dagsseddelLocal)
      .set({
        status: "sent",
        syncStatus: "pending",
        sistEndretLokalt: Date.now(),
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    setFeil(null);
    oppdaterTellere();
    void triggerSync();
    lesData();
  }

  function slettSedel() {
    Alert.alert(
      t("timer.bekreftSlett"),
      t("timer.bekreftSlettBeskrivelse"),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        {
          text: t("handling.slett"),
          style: "destructive",
          onPress: () => {
            const db = hentDatabase();
            if (!db) return;
            // Fjern lokale rader + selve sedlen.
            // Server-siden får aldri sett en pending-sedel som slettes lokalt.
            db.delete(sheetTimerLocal)
              .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
              .run();
            db.delete(sheetTilleggLocal)
              .where(eq(sheetTilleggLocal.dagsseddelId, sheetId))
              .run();
            db.delete(sheetMachineLocal)
              .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
              .run();
            db.delete(dagsseddelLocal)
              .where(eq(dagsseddelLocal.id, sheetId))
              .run();
            oppdaterTellere();
            router.back();
          },
        },
      ],
    );
  }

  if (!sedel) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.dagsseddel")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t("timer.ikkeFunnet")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {formatNorskDato(sedel.dato)}
          </Text>
          {aktivitet && (
            <Text className="text-xs text-gray-500">{aktivitet.navn}</Text>
          )}
        </View>
        <TimerStatusMerkelapp
          status={sedel.status}
          syncStatus={sedel.syncStatus}
        />
      </View>

      {/* Dagstotal-banner — sum på tvers av prosjekter for samme dato.
          Ekskluderer denne sedlen for å vise hva som er ført ANDRE steder. */}
      <DagstotalBanner
        userId={sedel.userId}
        dato={sedel.dato}
        ekskluderSheetId={sedel.id}
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-24">
        {/* Status-banners */}
        {sedel.status === "returned" && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.detalj.returnertTittel")}
              </Text>
            </View>
            {sedel.lederKommentar && (
              <Text className="mt-1 text-sm text-amber-800">
                {sedel.lederKommentar}
              </Text>
            )}
            <Text className="mt-1 text-xs text-amber-700">
              {t("timer.detalj.returnertHjelp")}
            </Text>
          </View>
        )}

        {sedel.status === "accepted" && (
          <View className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={16} color="#15803d" />
              <Text className="text-sm font-semibold text-green-900">
                {t("timer.detalj.attestertTittel")}
              </Text>
            </View>
            {sedel.attestertVed && (
              <Text className="mt-1 text-xs text-green-800">
                {formatTidspunkt(sedel.attestertVed)}
              </Text>
            )}
          </View>
        )}

        {sedel.syncStatus === "conflict" && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-900">
                {t("timer.sync.konflikt")}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-red-800">
              {sedel.feilmelding ?? t("timer.sync.konfliktBeskrivelse")}
            </Text>
          </View>
        )}

        {sedel.syncStatus === "pending" && (
          <View className="mx-4 mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
            <View className="flex-row items-center gap-2">
              <RotateCcw size={14} color="#a16207" />
              <Text className="text-sm text-yellow-800">
                {t("timer.sync.venterEn")}
              </Text>
            </View>
          </View>
        )}

        <TimerSeksjon
          sheetId={sheetId}
          rader={timerRader}
          projectId={sedel.projectId}
          defaultAktivitetId={sedel.aktivitetId ?? null}
          redigerbar={erRedigerbar}
          onEndret={markerEndretOgLes}
        />

        <TilleggSeksjon
          sheetId={sheetId}
          rader={tilleggRader}
          redigerbar={erRedigerbar}
          onEndret={markerEndretOgLes}
        />

        <MaskinSeksjon
          sheetId={sheetId}
          rader={maskinRader}
          organizationId={sedel.organizationId}
          harEquipmentCache={harEquipmentCache}
          redigerbar={erRedigerbar}
          onEndret={markerEndretOgLes}
        />

        {feil && (
          <Text className="mx-4 mt-4 text-sm text-red-600">{feil}</Text>
        )}

        {/* Handlinger */}
        <View className="mx-4 mt-6 gap-2">
          {erRedigerbar && (
            <Pressable
              onPress={sendTilAttestering}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Send size={16} color="#ffffff" />
              <Text className="text-base font-semibold text-white">
                {t("timer.sendTilAttestering")}
              </Text>
            </Pressable>
          )}
          {sedel.status === "draft" && (
            <Pressable
              onPress={slettSedel}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-300 bg-white py-3 active:bg-red-50"
            >
              <Trash2 size={16} color="#dc2626" />
              <Text className="text-base font-medium text-red-600">
                {t("timer.slettDagsseddel")}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
