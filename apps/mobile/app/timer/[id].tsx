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
  Plus,
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
  externalCostObjectLocal,
} from "../../src/db/schema";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { TimerStatusMerkelapp } from "../../src/components/TimerStatusMerkelapp";
import { DagstotalBanner } from "../../src/components/DagstotalBanner";
import { TimerSeksjon } from "../../src/components/timer-detalj/TimerSeksjon";
import { TilleggSeksjon } from "../../src/components/timer-detalj/TilleggSeksjon";
import { MaskinSeksjon } from "../../src/components/timer-detalj/MaskinSeksjon";
import { ArbeidstidSeksjon } from "../../src/components/timer-detalj/ArbeidstidSeksjon";
import { SummeringsBanner } from "../../src/components/timer-detalj/SummeringsBanner";
import { ProsjektVelgerModal } from "../../src/components/timer-detalj/ProsjektVelger";
import { finnProsjektLokalt } from "../../src/services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../../src/services/kalenderKatalog";
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
  // Tomme prosjekt-grupper som brukeren har lagt til via «+ Legg til prosjekt».
  // Gruppen blir varig så snart første rad er lagt til i den.
  const [ekstraProsjektIder, setEkstraProsjektIder] = useState<string[]>([]);
  const [visLeggTilProsjekt, setVisLeggTilProsjekt] = useState(false);

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

  const arbeidstidTimer = useMemo(() => {
    if (!sedel) return null;
    // T4-e: Hvis brukeren har satt egen start/slutt på sedelen, bruk de.
    // Ellers fall tilbake til effektiv dagsnorm fra firma-kalender (firma-
    // default + sommertid-overstyring fra arbeidstidskalender_local).
    if (sedel.startAt && sedel.endAt) {
      const diff =
        (new Date(sedel.endAt).getTime() - new Date(sedel.startAt).getTime()) /
        3600000;
      return Math.max(0, diff - (sedel.pauseMin ?? 0) / 60);
    }
    const effektiv = hentEffektivArbeidstidLokal(
      sedel.organizationId,
      new Date(`${sedel.dato}T00:00:00`),
    );
    return effektiv.dagsnorm;
  }, [sedel]);

  const totaltimer = useMemo(
    () => timerRader.reduce((sum, r) => sum + (r.timer ?? 0), 0),
    [timerRader],
  );

  // T7-3b2: aktive prosjekt-grupper. Inkluder alltid sedel.projectId som
  // standard-gruppe, samt alle distinkte projectId fra rader og bruker-
  // tilføyde ekstra-grupper.
  const aktiveProsjektIder = useMemo(() => {
    if (!sedel) return [];
    const ider = new Set<string>([sedel.projectId]);
    for (const r of timerRader) if (r.projectId) ider.add(r.projectId);
    for (const r of tilleggRader) if (r.projectId) ider.add(r.projectId);
    for (const r of maskinRader) if (r.projectId) ider.add(r.projectId);
    for (const id of ekstraProsjektIder) ider.add(id);
    return Array.from(ider);
  }, [sedel, timerRader, tilleggRader, maskinRader, ekstraProsjektIder]);

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

        <ArbeidstidSeksjon
          sheetId={sheetId}
          dato={sedel.dato}
          startAt={sedel.startAt}
          endAt={sedel.endAt}
          pauseMin={sedel.pauseMin}
          redigerbar={erRedigerbar}
          onEndret={markerEndretOgLes}
        />

        {/* T7-4e (2026-05-16): per-prosjekt blokker, med N ECO-bukets per
            prosjekt. Hver bucket inneholder timer + maskin (underpost).
            Tillegg holdes per-prosjekt (ingen ECO-felt på SheetTillegg).
            Speil av T7-4c web-strukturen. */}
        {aktiveProsjektIder.map((pid) => (
          <ProsjektGruppe
            key={pid}
            projectId={pid}
            visHeader={aktiveProsjektIder.length > 1}
            sheetId={sheetId}
            organizationId={sedel.organizationId}
            sedelProjectId={sedel.projectId}
            dato={sedel.dato}
            defaultAktivitetId={sedel.aktivitetId ?? null}
            harEquipmentCache={harEquipmentCache}
            redigerbar={erRedigerbar}
            timerRader={timerRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            tilleggRader={tilleggRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            maskinRader={maskinRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            onEndret={markerEndretOgLes}
          />
        ))}

        {erRedigerbar && (
          <Pressable
            onPress={() => setVisLeggTilProsjekt(true)}
            className="mx-4 mt-4 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white py-3 active:bg-gray-50"
          >
            <Plus size={14} color="#1e40af" />
            <Text className="text-sm font-medium text-sitedoc-primary">
              {t("timer.leggTilProsjekt")}
            </Text>
          </Pressable>
        )}

        {feil && (
          <Text className="mx-4 mt-4 text-sm text-red-600">{feil}</Text>
        )}

        {/* Handlinger */}
        <View className="mx-4 mt-6 gap-2">
          {erRedigerbar && (
            <SummeringsBanner
              totaltimer={totaltimer}
              arbeidstidTimer={arbeidstidTimer}
            />
          )}
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

      {visLeggTilProsjekt && (
        <ProsjektVelgerModal
          organizationId={sedel.organizationId}
          valgtId={null}
          ekskluderIder={aktiveProsjektIder}
          onVelg={(id) => {
            setEkstraProsjektIder((forrige) =>
              forrige.includes(id) ? forrige : [...forrige, id],
            );
            setVisLeggTilProsjekt(false);
          }}
          onLukk={() => setVisLeggTilProsjekt(false)}
        />
      )}
    </SafeAreaView>
  );
}

function ProsjektGruppe({
  projectId,
  visHeader,
  sheetId,
  organizationId,
  sedelProjectId,
  dato,
  defaultAktivitetId,
  harEquipmentCache,
  redigerbar,
  timerRader,
  tilleggRader,
  maskinRader,
  onEndret,
}: {
  projectId: string;
  visHeader: boolean;
  sheetId: string;
  organizationId: string;
  /** Fallback for rader uten per-rad-projectId (pre-T7-3b1-data). */
  sedelProjectId: string;
  dato: string;
  defaultAktivitetId: string | null;
  harEquipmentCache: boolean;
  redigerbar: boolean;
  timerRader: TimerRad[];
  tilleggRader: TilleggRad[];
  maskinRader: MaskinRad[];
  onEndret: () => void;
}) {
  const prosjekt = useMemo(() => finnProsjektLokalt(projectId), [projectId]);

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
    <View className="mt-2">
      {visHeader && (
        <View className="mx-4 mt-4 rounded-t-lg border border-b-0 border-gray-200 bg-blue-50 px-4 py-2">
          <Text className="text-sm font-semibold text-sitedoc-primary">
            {prosjekt
              ? `${prosjekt.projectNumber ? prosjekt.projectNumber + " — " : ""}${prosjekt.name}`
              : projectId}
          </Text>
        </View>
      )}

      {/* ECO-bukets (hovedgruppe + N underprosjekter) */}
      {ecoBuckets.map((bucket) => (
        <EcoBucket
          key={bucket.ecoId ?? "hoved"}
          sheetId={sheetId}
          organizationId={organizationId}
          projectId={projectId}
          ecoId={bucket.ecoId}
          dato={dato}
          defaultAktivitetId={defaultAktivitetId}
          harEquipmentCache={harEquipmentCache}
          redigerbar={redigerbar}
          timerRader={bucket.timer}
          maskinRader={bucket.maskin}
          onEndret={onEndret}
        />
      ))}

      {/* Tillegg per-prosjekt (separat fra ECO-bukets — ingen ECO-felt på SheetTillegg) */}
      <TilleggSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        projectId={projectId}
        rader={tilleggRader}
        redigerbar={redigerbar}
        onEndret={onEndret}
      />
      {/* sedelProjectId brukes ikke direkte her — beholdt for fremtidig
          backfill av rader uten projectId. void for å unngå lint-warning. */}
      {void sedelProjectId}
    </View>
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
  dato,
  defaultAktivitetId,
  harEquipmentCache,
  redigerbar,
  timerRader,
  maskinRader,
  onEndret,
}: {
  sheetId: string;
  organizationId: string;
  projectId: string;
  ecoId: string | null;
  dato: string;
  defaultAktivitetId: string | null;
  harEquipmentCache: boolean;
  redigerbar: boolean;
  timerRader: TimerRad[];
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
  const maskinOk = sumMaskin <= sumTimer + 0.001;

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
          <Text className="flex-1 text-xs font-semibold text-gray-800">
            {ecoNavn
              ? `${ecoNavn.proAdmId} · ${ecoNavn.kortNavn}`
              : t("timer.detalj.ukjentEco")}
          </Text>
          <View className="rounded-full bg-indigo-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-indigo-800">
              → {t("timer.gruppe.tilByggherre")}
            </Text>
          </View>
        </View>
      )}

      {/* Arbeidstimer (hovedpost) */}
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
        {t("timer.gruppe.arbeidstimer")} ({sumTimer.toFixed(2)} {t("timer.tEnhet")})
      </Text>
      <TimerSeksjon
        sheetId={sheetId}
        organizationId={organizationId}
        rader={timerRader}
        projectId={projectId}
        defaultEcoId={ecoId}
        visHeader={false}
        dato={dato}
        defaultAktivitetId={defaultAktivitetId}
        redigerbar={redigerbar}
        onEndret={onEndret}
      />

      {/* Maskintimer som underpost (indentert via ml-3 + border-l-2) */}
      <View className="ml-3 mt-3 border-l-2 border-gray-200 pl-3">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t("timer.gruppe.maskintimer")} ({sumMaskin.toFixed(2)} {t("timer.tEnhet")})
        </Text>
        <MaskinSeksjon
          sheetId={sheetId}
          organizationId={organizationId}
          projectId={projectId}
          defaultEcoId={ecoId}
          visHeader={false}
          dato={dato}
          rader={maskinRader}
          harEquipmentCache={harEquipmentCache}
          redigerbar={redigerbar}
          onEndret={onEndret}
        />
      </View>

      {/* Sum-indikator: grønn når maskin ≤ arbeid, rød ellers — speiler T7-4b */}
      {(sumTimer > 0 || sumMaskin > 0) && (
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
