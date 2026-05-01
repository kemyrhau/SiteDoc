import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
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
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Pencil,
  X,
  Check,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  lonnsartLocal,
  tilleggLocal,
  aktivitetLocal,
  externalCostObjectLocal,
} from "../../src/db/schema";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { TimerStatusMerkelapp } from "../../src/components/TimerStatusMerkelapp";

type Sedel = typeof dagsseddelLocal.$inferSelect;
type TimerRad = typeof sheetTimerLocal.$inferSelect;
type TilleggRad = typeof sheetTilleggLocal.$inferSelect;
type Lonnsart = typeof lonnsartLocal.$inferSelect;
type Tillegg = typeof tilleggLocal.$inferSelect;
type Aktivitet = typeof aktivitetLocal.$inferSelect;
type Underprosjekt = typeof externalCostObjectLocal.$inferSelect;

function formatNorskDato(iso: string): string {
  return new Date(iso).toLocaleDateString("no-NB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTidspunkt(iso: string): string {
  return new Date(iso).toLocaleString("no-NB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DagsseddelDetalj() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const sheetId = params.id ?? "";
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [aktivitet, setAktivitet] = useState<Aktivitet | null>(null);

  const [visTimerModal, setVisTimerModal] = useState(false);
  const [visTilleggModal, setVisTilleggModal] = useState(false);
  const [redigerTimerRadId, setRedigerTimerRadId] = useState<string | null>(null);
  const [redigerTilleggRadId, setRedigerTilleggRadId] = useState<string | null>(null);
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

    const akt = db
      .select()
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.id, sedelRad.aktivitetId))
      .all()[0];
    setAktivitet(akt ?? null);
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

  const totaltimer = useMemo(
    () => timerRader.reduce((acc, r) => acc + r.timer, 0),
    [timerRader],
  );

  function markerEndret() {
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
  }

  function leggTilTimerRad(
    lonnsartId: string,
    timer: number,
    externalCostObjectId: string | null,
  ) {
    const db = hentDatabase();
    if (!db) return;
    db.insert(sheetTimerLocal)
      .values({
        id: randomUUID(),
        dagsseddelId: sheetId,
        lonnsartId,
        externalCostObjectId,
        timer,
        sistEndretLokalt: Date.now(),
      })
      .run();
    markerEndret();
    lesData();
  }

  function oppdaterTimerRad(
    radId: string,
    lonnsartId: string,
    timer: number,
    externalCostObjectId: string | null,
  ) {
    const db = hentDatabase();
    if (!db) return;
    db.update(sheetTimerLocal)
      .set({
        lonnsartId,
        timer,
        externalCostObjectId,
        sistEndretLokalt: Date.now(),
      })
      .where(eq(sheetTimerLocal.id, radId))
      .run();
    markerEndret();
    lesData();
  }

  function fjernTimerRad(radId: string) {
    const db = hentDatabase();
    if (!db) return;
    db.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, radId)).run();
    markerEndret();
    lesData();
  }

  function leggTilTilleggRad(tilleggId: string, antall: number, kommentar: string | null) {
    const db = hentDatabase();
    if (!db) return;
    db.insert(sheetTilleggLocal)
      .values({
        id: randomUUID(),
        dagsseddelId: sheetId,
        tilleggId,
        antall,
        kommentar,
        sistEndretLokalt: Date.now(),
      })
      .run();
    markerEndret();
    lesData();
  }

  function oppdaterTilleggRad(
    radId: string,
    tilleggId: string,
    antall: number,
    kommentar: string | null,
  ) {
    const db = hentDatabase();
    if (!db) return;
    db.update(sheetTilleggLocal)
      .set({ tilleggId, antall, kommentar, sistEndretLokalt: Date.now() })
      .where(eq(sheetTilleggLocal.id, radId))
      .run();
    markerEndret();
    lesData();
  }

  function fjernTilleggRad(radId: string) {
    const db = hentDatabase();
    if (!db) return;
    db.delete(sheetTilleggLocal).where(eq(sheetTilleggLocal.id, radId)).run();
    markerEndret();
    lesData();
  }

  function sendTilGodkjenning() {
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

        {/* Timer-rader */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
            <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {t("timer.kol.timer")} · {totaltimer.toFixed(2)} {t("timer.tEnhet")}
            </Text>
            {erRedigerbar && (
              <Pressable
                onPress={() => {
                  setRedigerTimerRadId(null);
                  setVisTimerModal(true);
                }}
                hitSlop={8}
                className="rounded-full bg-blue-600 p-1.5"
              >
                <Plus size={14} color="#ffffff" />
              </Pressable>
            )}
          </View>
          {timerRader.length === 0 ? (
            <View className="bg-white px-4 py-6">
              <Text className="text-center text-sm text-gray-400">
                {t("timer.ingenTimerRader")}
              </Text>
            </View>
          ) : (
            timerRader.map((rad) => (
              <TimerRadVis
                key={rad.id}
                rad={rad}
                redigerbar={erRedigerbar}
                onRediger={() => {
                  setRedigerTimerRadId(rad.id);
                  setVisTimerModal(true);
                }}
                onSlett={() => fjernTimerRad(rad.id)}
              />
            ))
          )}
        </View>

        {/* Tillegg-rader */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
            <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {t("timer.kol.tillegg")}
            </Text>
            {erRedigerbar && (
              <Pressable
                onPress={() => {
                  setRedigerTilleggRadId(null);
                  setVisTilleggModal(true);
                }}
                hitSlop={8}
                className="rounded-full bg-blue-600 p-1.5"
              >
                <Plus size={14} color="#ffffff" />
              </Pressable>
            )}
          </View>
          {tilleggRader.length === 0 ? (
            <View className="bg-white px-4 py-6">
              <Text className="text-center text-sm text-gray-400">
                {t("timer.ingenTilleggRader")}
              </Text>
            </View>
          ) : (
            tilleggRader.map((rad) => (
              <TilleggRadVis
                key={rad.id}
                rad={rad}
                redigerbar={erRedigerbar}
                onRediger={() => {
                  setRedigerTilleggRadId(rad.id);
                  setVisTilleggModal(true);
                }}
                onSlett={() => fjernTilleggRad(rad.id)}
              />
            ))
          )}
        </View>

        {feil && (
          <Text className="mx-4 mt-4 text-sm text-red-600">{feil}</Text>
        )}

        {/* Handlinger */}
        <View className="mx-4 mt-6 gap-2">
          {erRedigerbar && (
            <Pressable
              onPress={sendTilGodkjenning}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Send size={16} color="#ffffff" />
              <Text className="text-base font-semibold text-white">
                {t("timer.sendTilGodkjenning")}
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

      {/* Timer-rad modal */}
      {visTimerModal && (
        <TimerRadModal
          projectId={sedel.projectId}
          eksisterendeRad={
            redigerTimerRadId
              ? timerRader.find((r) => r.id === redigerTimerRadId) ?? null
              : null
          }
          onLagre={(lonnsartId, timer, externalCostObjectId) => {
            if (redigerTimerRadId) {
              oppdaterTimerRad(
                redigerTimerRadId,
                lonnsartId,
                timer,
                externalCostObjectId,
              );
            } else {
              leggTilTimerRad(lonnsartId, timer, externalCostObjectId);
            }
            setVisTimerModal(false);
            setRedigerTimerRadId(null);
          }}
          onLukk={() => {
            setVisTimerModal(false);
            setRedigerTimerRadId(null);
          }}
        />
      )}

      {/* Tillegg-rad modal */}
      {visTilleggModal && (
        <TilleggRadModal
          eksisterendeRad={
            redigerTilleggRadId
              ? tilleggRader.find((r) => r.id === redigerTilleggRadId) ?? null
              : null
          }
          onLagre={(tilleggId, antall, kommentar) => {
            if (redigerTilleggRadId) {
              oppdaterTilleggRad(redigerTilleggRadId, tilleggId, antall, kommentar);
            } else {
              leggTilTilleggRad(tilleggId, antall, kommentar);
            }
            setVisTilleggModal(false);
            setRedigerTilleggRadId(null);
          }}
          onLukk={() => {
            setVisTilleggModal(false);
            setRedigerTilleggRadId(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ============================================================================
 *  Rad-visninger
 * ============================================================================ */

function TimerRadVis({
  rad,
  redigerbar,
  onRediger,
  onSlett,
}: {
  rad: TimerRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSlett: () => void;
}) {
  const lonnsart = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.id, rad.lonnsartId))
      .all()[0];
    return treff ?? null;
  }, [rad.lonnsartId]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-base text-gray-900">
          {lonnsart?.navn ?? rad.lonnsartId}
        </Text>
        <View className="flex-row gap-2">
          {lonnsart?.kode && (
            <Text className="text-xs text-gray-500">{lonnsart.kode}</Text>
          )}
          {rad.externalCostObjectId && (
            <UnderprosjektEtikett ecoId={rad.externalCostObjectId} />
          )}
        </View>
      </View>
      <Text className="font-mono text-base text-gray-900">
        {rad.timer.toFixed(2)}
      </Text>
      {redigerbar && (
        <View className="flex-row gap-1">
          <Pressable
            onPress={onRediger}
            hitSlop={8}
            className="rounded p-1.5 active:bg-gray-100"
          >
            <Pencil size={16} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={onSlett}
            hitSlop={8}
            className="rounded p-1.5 active:bg-red-50"
          >
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function UnderprosjektEtikett({ ecoId }: { ecoId: string }) {
  const eco = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, ecoId))
        .all()[0] ?? null
    );
  }, [ecoId]);
  if (!eco) return null;
  return (
    <Text className="text-xs font-medium text-blue-700">
      {eco.proAdmId} {eco.kortNavn}
    </Text>
  );
}

function TilleggRadVis({
  rad,
  redigerbar,
  onRediger,
  onSlett,
}: {
  rad: TilleggRad;
  redigerbar: boolean;
  onRediger: () => void;
  onSlett: () => void;
}) {
  const tillegg = useMemo(() => {
    const db = hentDatabase();
    if (!db) return null;
    const treff = db
      .select()
      .from(tilleggLocal)
      .where(eq(tilleggLocal.id, rad.tilleggId))
      .all()[0];
    return treff ?? null;
  }, [rad.tilleggId]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-base text-gray-900">
          {tillegg?.navn ?? rad.tilleggId}
        </Text>
        {rad.kommentar && (
          <Text className="text-xs text-gray-500">{rad.kommentar}</Text>
        )}
      </View>
      <Text className="font-mono text-base text-gray-900">{rad.antall.toFixed(2)}</Text>
      {redigerbar && (
        <View className="flex-row gap-1">
          <Pressable
            onPress={onRediger}
            hitSlop={8}
            className="rounded p-1.5 active:bg-gray-100"
          >
            <Pencil size={16} color="#6b7280" />
          </Pressable>
          <Pressable
            onPress={onSlett}
            hitSlop={8}
            className="rounded p-1.5 active:bg-red-50"
          >
            <Trash2 size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ============================================================================
 *  Timer-rad modal (lønnsart-velger + timer-input)
 * ============================================================================ */

function TimerRadModal({
  projectId,
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  projectId: string;
  eksisterendeRad: TimerRad | null;
  onLagre: (
    lonnsartId: string,
    timer: number,
    externalCostObjectId: string | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [valgtLonnsartId, setValgtLonnsartId] = useState<string>(
    eksisterendeRad?.lonnsartId ?? "",
  );
  const [timer, setTimer] = useState<string>(
    eksisterendeRad?.timer ? eksisterendeRad.timer.toFixed(2) : "",
  );
  const [valgtEcoId, setValgtEcoId] = useState<string | null>(
    eksisterendeRad?.externalCostObjectId ?? null,
  );
  const [feil, setFeil] = useState<string | null>(null);
  const [visLonnsartVelger, setVisLonnsartVelger] = useState(false);
  const [visEcoVelger, setVisEcoVelger] = useState(false);

  const valgtLonnsart = useMemo(() => {
    if (!valgtLonnsartId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(lonnsartLocal)
        .where(eq(lonnsartLocal.id, valgtLonnsartId))
        .all()[0] ?? null
    );
  }, [valgtLonnsartId]);

  const valgtEco = useMemo(() => {
    if (!valgtEcoId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(externalCostObjectLocal)
        .where(eq(externalCostObjectLocal.id, valgtEcoId))
        .all()[0] ?? null
    );
  }, [valgtEcoId]);

  function lagre() {
    setFeil(null);
    if (!valgtLonnsartId) {
      setFeil(t("timer.feil.lonnsartPaakrevd"));
      return;
    }
    const tall = parseFloat(timer.replace(",", "."));
    if (isNaN(tall) || tall <= 0 || tall > 24) {
      setFeil(t("timer.feil.ugyldigTimer"));
      return;
    }
    onLagre(valgtLonnsartId, tall, valgtEcoId);
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {eksisterendeRad ? t("timer.rediger.timer") : t("timer.tilfoy.timer")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.lonnsart")} *
            </Text>
            <Pressable
              onPress={() => setVisLonnsartVelger(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <Text
                className={`text-base ${valgtLonnsart ? "text-gray-900" : "text-gray-400"}`}
              >
                {valgtLonnsart?.navn ?? t("timer.velgLonnsart")}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.antallTimer")} *
            </Text>
            <TextInput
              value={timer}
              onChangeText={setTimer}
              placeholder="0,00"
              keyboardType="decimal-pad"
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          {/* Underprosjekt (valgfritt) — Tilleggsarbeid, Endring m.fl. */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.underprosjekt")}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setVisEcoVelger(true)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3"
              >
                <Text
                  className={`text-base ${valgtEco ? "text-gray-900" : "text-gray-400"}`}
                >
                  {valgtEco
                    ? `${valgtEco.proAdmId} — ${valgtEco.kortNavn}`
                    : t("timer.velgUnderprosjekt")}
                </Text>
              </Pressable>
              {valgtEcoId && (
                <Pressable
                  onPress={() => setValgtEcoId(null)}
                  hitSlop={8}
                  className="rounded p-2 active:bg-gray-100"
                >
                  <X size={18} color="#6b7280" />
                </Pressable>
              )}
            </View>
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <Pressable
            onPress={lagre}
            className="mt-4 items-center rounded-lg bg-blue-600 px-6 py-4 active:bg-blue-700"
          >
            <Text className="text-base font-semibold text-white">
              {t("handling.lagre")}
            </Text>
          </Pressable>
        </ScrollView>

        {visLonnsartVelger && (
          <LonnsartVelgerModal
            valgtId={valgtLonnsartId}
            onVelg={(id) => {
              setValgtLonnsartId(id);
              setVisLonnsartVelger(false);
            }}
            onLukk={() => setVisLonnsartVelger(false)}
          />
        )}

        {visEcoVelger && (
          <UnderprosjektVelgerModal
            projectId={projectId}
            valgtId={valgtEcoId}
            onVelg={(id) => {
              setValgtEcoId(id);
              setVisEcoVelger(false);
            }}
            onLukk={() => setVisEcoVelger(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function LonnsartVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const lonnsarter = useMemo<Lonnsart[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return lonnsarter;
    const q = sok.toLowerCase();
    return lonnsarter.filter(
      (l) =>
        l.navn.toLowerCase().includes(q) ||
        (l.kode ?? "").toLowerCase().includes(q),
    );
  }, [lonnsarter, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgLonnsart")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {lonnsarter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                <Text className="text-xs text-gray-500">
                  {[item.kode, item.type].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenLonnsarter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

/* ============================================================================
 *  Underprosjekt-velger (ECO) — filtrerer på prosjekt
 * ============================================================================ */

function UnderprosjektVelgerModal({
  projectId,
  valgtId,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const ecoer = useMemo<Underprosjekt[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(externalCostObjectLocal)
      .where(
        and(
          eq(externalCostObjectLocal.projectId, projectId),
          eq(externalCostObjectLocal.status, "aktiv"),
          eq(externalCostObjectLocal.timerregistreringApen, true),
        ),
      )
      .all();
  }, [projectId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return ecoer;
    const q = sok.toLowerCase();
    return ecoer.filter(
      (e) =>
        e.proAdmId.toLowerCase().includes(q) ||
        e.kortNavn.toLowerCase().includes(q),
    );
  }, [ecoer, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgUnderprosjekt")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {ecoer.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">
                  {item.proAdmId}
                </Text>
                <Text className="text-sm text-gray-600">{item.kortNavn}</Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenUnderprosjekter")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

/* ============================================================================
 *  Tillegg-rad modal (tillegg-velger + antall + kommentar)
 * ============================================================================ */

function TilleggRadModal({
  eksisterendeRad,
  onLagre,
  onLukk,
}: {
  eksisterendeRad: TilleggRad | null;
  onLagre: (tilleggId: string, antall: number, kommentar: string | null) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [valgtTilleggId, setValgtTilleggId] = useState<string>(
    eksisterendeRad?.tilleggId ?? "",
  );
  const [antall, setAntall] = useState<string>(
    eksisterendeRad?.antall ? eksisterendeRad.antall.toFixed(2) : "1",
  );
  const [kommentar, setKommentar] = useState<string>(
    eksisterendeRad?.kommentar ?? "",
  );
  const [feil, setFeil] = useState<string | null>(null);
  const [visVelger, setVisVelger] = useState(false);

  const valgtTillegg = useMemo(() => {
    if (!valgtTilleggId) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select()
        .from(tilleggLocal)
        .where(eq(tilleggLocal.id, valgtTilleggId))
        .all()[0] ?? null
    );
  }, [valgtTilleggId]);

  function lagre() {
    setFeil(null);
    if (!valgtTilleggId) {
      setFeil(t("timer.feil.tilleggPaakrevd"));
      return;
    }
    const tall = parseFloat(antall.replace(",", "."));
    if (isNaN(tall) || tall <= 0) {
      setFeil(t("timer.feil.ugyldigAntall"));
      return;
    }
    onLagre(valgtTilleggId, tall, kommentar.trim() || null);
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {eksisterendeRad ? t("timer.rediger.tillegg") : t("timer.tilfoy.tillegg")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.tillegg")} *
            </Text>
            <Pressable
              onPress={() => setVisVelger(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <Text
                className={`text-base ${valgtTillegg ? "text-gray-900" : "text-gray-400"}`}
              >
                {valgtTillegg?.navn ?? t("timer.velgTillegg")}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.antall")} *
            </Text>
            <TextInput
              value={antall}
              onChangeText={setAntall}
              keyboardType="decimal-pad"
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.kommentar")}
            </Text>
            <TextInput
              value={kommentar}
              onChangeText={setKommentar}
              multiline
              numberOfLines={3}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
              style={{ textAlignVertical: "top", minHeight: 80 }}
            />
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <Pressable
            onPress={lagre}
            className="mt-4 items-center rounded-lg bg-blue-600 px-6 py-4 active:bg-blue-700"
          >
            <Text className="text-base font-semibold text-white">
              {t("handling.lagre")}
            </Text>
          </Pressable>
        </ScrollView>

        {visVelger && (
          <TilleggVelgerModal
            valgtId={valgtTilleggId}
            onVelg={(id) => {
              setValgtTilleggId(id);
              setVisVelger(false);
            }}
            onLukk={() => setVisVelger(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function TilleggVelgerModal({
  valgtId,
  onVelg,
  onLukk,
}: {
  valgtId: string;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const tilleggListe = useMemo<Tillegg[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(tilleggLocal)
      .where(eq(tilleggLocal.aktiv, true))
      .all();
  }, []);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return tilleggListe;
    const q = sok.toLowerCase();
    return tilleggListe.filter(
      (l) =>
        l.navn.toLowerCase().includes(q) ||
        (l.kode ?? "").toLowerCase().includes(q),
    );
  }, [tilleggListe, sok]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.velgTillegg")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {tilleggListe.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.navn}</Text>
                <Text className="text-xs text-gray-500">
                  {[item.kode, item.type].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenTillegg")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
