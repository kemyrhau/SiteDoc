import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Trash2, Pencil, X, Check, Camera, ImagePlus, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import {
  sheetTilleggLocal,
  tilleggLocal,
  sheetTilleggVedleggLocal,
} from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { taBilde, velgBilde } from "../../services/bilde";
import { lagreLokaltBilde, slettLokaltBilde } from "../../services/lokalBilde";
import { fjernTilleggVedleggServer } from "../../services/bildeRegistrering";
import { useOpplastingsKo } from "../../providers/OpplastingsKoProvider";
import { AUTH_CONFIG } from "../../config/auth";
import type { TilleggRad, Tillegg } from "../../types/timer-detalj";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";
import { VelgerFelt } from "./VelgerFelt";

interface TilleggSeksjonProps {
  sheetId: string;
  organizationId: string;
  projectId: string;
  rader: TilleggRad[];
  redigerbar: boolean;
  onEndret: () => void;
}

export function TilleggSeksjon({
  sheetId,
  organizationId,
  projectId,
  rader,
  redigerbar,
  onEndret,
}: TilleggSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);
  const [redigerRadId, setRedigerRadId] = useState<string | null>(null);

  const leggTil = useCallback(
    (
      radProjectId: string,
      tilleggId: string,
      antall: number,
      kommentar: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.insert(sheetTilleggLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: radProjectId,
          tilleggId,
          antall,
          kommentar,
          sistEndretLokalt: Date.now(),
        })
        .run();
      onEndret();
    },
    [sheetId, onEndret],
  );

  const oppdater = useCallback(
    (
      radId: string,
      radProjectId: string,
      tilleggId: string,
      antall: number,
      kommentar: string | null,
    ) => {
      const db = hentDatabase();
      if (!db) return;
      db.update(sheetTilleggLocal)
        .set({
          projectId: radProjectId,
          tilleggId,
          antall,
          kommentar,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(sheetTilleggLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  const fjern = useCallback(
    (radId: string) => {
      const db = hentDatabase();
      if (!db) return;
      db.delete(sheetTilleggLocal)
        .where(eq(sheetTilleggLocal.id, radId))
        .run();
      onEndret();
    },
    [onEndret],
  );

  return (
    <View className="mt-4">
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Text className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t("timer.kol.tillegg")}
        </Text>
        {redigerbar && (
          <Pressable
            onPress={() => {
              setRedigerRadId(null);
              setVisModal(true);
            }}
            hitSlop={8}
            className="rounded-full bg-blue-600 p-1.5"
          >
            <Plus size={14} color="#ffffff" />
          </Pressable>
        )}
      </View>
      {rader.length === 0 ? (
        <View className="bg-white px-4 py-6">
          <Text className="text-center text-sm text-gray-400">
            {t("timer.ingenTilleggRader")}
          </Text>
        </View>
      ) : (
        rader.map((rad) => (
          <TilleggRadVis
            key={rad.id}
            rad={rad}
            redigerbar={redigerbar}
            onRediger={() => {
              setRedigerRadId(rad.id);
              setVisModal(true);
            }}
            onSlett={() => fjern(rad.id)}
          />
        ))
      )}

      {visModal && (
        <TilleggRadModal
          eksisterendeRad={
            redigerRadId
              ? rader.find((r) => r.id === redigerRadId) ?? null
              : null
          }
          organizationId={organizationId}
          defaultProjectId={projectId}
          onLagre={(radProjectId, tilleggId, antall, kommentar) => {
            if (redigerRadId) {
              oppdater(redigerRadId, radProjectId, tilleggId, antall, kommentar);
            } else {
              leggTil(radProjectId, tilleggId, antall, kommentar);
            }
            setVisModal(false);
            setRedigerRadId(null);
          }}
          onLukk={() => {
            setVisModal(false);
            setRedigerRadId(null);
          }}
        />
      )}
    </View>
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

  // Funn #2: antall kvittering-vedlegg på raden (synlighets-indikator).
  const antallVedlegg = useMemo(() => {
    const db = hentDatabase();
    if (!db) return 0;
    return db
      .select()
      .from(sheetTilleggVedleggLocal)
      .where(eq(sheetTilleggVedleggLocal.sheetTilleggId, rad.id))
      .all().length;
  }, [rad.id]);

  return (
    <View className="flex-row items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <Text className="text-base text-gray-900">
          {tillegg?.navn ?? rad.tilleggId}
        </Text>
        {rad.kommentar && (
          <Text className="text-xs text-gray-500">{rad.kommentar}</Text>
        )}
        {antallVedlegg > 0 && (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Camera size={11} color="#9ca3af" />
            <Text className="text-xs text-gray-500">{antallVedlegg}</Text>
          </View>
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

type LokaltTilleggVedlegg = typeof sheetTilleggVedleggLocal.$inferSelect;

/**
 * Funn #2: kvittering-vedlegg på en tillegg-rad. Krever en lagret rad (id).
 * Offline-først: bildet tas + komprimeres (300–400 KB) + lagres lokalt, legges
 * i opplastings-køen, og synkes når nett er tilbake. «Venter på opplasting»
 * vises til `serverUrl` er satt.
 */
function VedleggSeksjon({
  sheetTilleggId,
  redigerbar,
}: {
  sheetTilleggId: string;
  redigerbar: boolean;
}) {
  const { t } = useTranslation();
  const { leggIKo, registrerTilleggVedleggCallback } = useOpplastingsKo();
  const [refreshKey, setRefreshKey] = useState(0);
  const [arbeider, setArbeider] = useState(false);

  const vedlegg = useMemo<LokaltTilleggVedlegg[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(sheetTilleggVedleggLocal)
      .where(eq(sheetTilleggVedleggLocal.sheetTilleggId, sheetTilleggId))
      .all();
    // refreshKey bumpes ved capture/fjern/kø-fullført
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetTilleggId, refreshKey]);

  // Live-oppdatering når køen fullfører en opplasting (serverUrl settes).
  useEffect(
    () => registrerTilleggVedleggCallback(() => setRefreshKey((k) => k + 1)),
    [registrerTilleggVedleggCallback],
  );

  const leggVed = useCallback(
    async (kilde: "kamera" | "galleri") => {
      setArbeider(true);
      try {
        const res = kilde === "kamera" ? await taBilde() : await velgBilde();
        if (!res) return;
        const db = hentDatabase();
        if (!db) return;
        const vedleggId = randomUUID();
        const filnavn = `kvittering-${vedleggId}.jpg`;
        const lokalSti = await lagreLokaltBilde(res.uri, filnavn);
        db.insert(sheetTilleggVedleggLocal)
          .values({
            id: vedleggId,
            sheetTilleggId,
            lokalSti,
            serverUrl: null,
            filnavn,
            mimeType: "image/jpeg",
            filstorrelse: res.filstorrelse,
            sistEndretLokalt: Date.now(),
          })
          .run();
        await leggIKo({
          sheetTilleggId,
          objektId: sheetTilleggId,
          vedleggId,
          lokalSti,
          filnavn,
          mimeType: "image/jpeg",
          filstorrelse: res.filstorrelse,
          gpsLat: res.gpsLat,
          gpsLng: res.gpsLng,
          gpsAktivert: true,
        });
        setRefreshKey((k) => k + 1);
      } finally {
        setArbeider(false);
      }
    },
    [sheetTilleggId, leggIKo],
  );

  const fjern = useCallback(async (v: LokaltTilleggVedlegg) => {
    const db = hentDatabase();
    if (!db) return;
    db.delete(sheetTilleggVedleggLocal)
      .where(eq(sheetTilleggVedleggLocal.id, v.id))
      .run();
    if (v.lokalSti) await slettLokaltBilde(v.lokalSti);
    if (v.serverUrl) fjernTilleggVedleggServer(v.id).catch(() => {});
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-gray-700">
        {t("timer.vedlegg.tittel")}
      </Text>
      {vedlegg.length === 0 ? (
        <Text className="mb-2 text-xs text-gray-400">
          {t("timer.vedlegg.ingen")}
        </Text>
      ) : (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {vedlegg.map((v) => {
            const uri = v.serverUrl
              ? `${AUTH_CONFIG.apiUrl}${v.serverUrl}`
              : v.lokalSti ?? undefined;
            return (
              <View key={v.id} className="relative">
                {uri && (
                  <Image
                    source={{ uri }}
                    className="h-20 w-20 rounded-lg bg-gray-100"
                  />
                )}
                {!v.serverUrl && (
                  <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center gap-1 rounded-b-lg bg-black/50 py-0.5">
                    <Clock size={10} color="#ffffff" />
                    <Text className="text-[10px] text-white">
                      {t("timer.vedlegg.venterOpplasting")}
                    </Text>
                  </View>
                )}
                {redigerbar && (
                  <Pressable
                    onPress={() => fjern(v)}
                    hitSlop={8}
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1"
                  >
                    <X size={12} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
      {redigerbar && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => leggVed("kamera")}
            disabled={arbeider}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 active:bg-gray-50"
          >
            <Camera size={18} color="#1e40af" />
            <Text className="text-sm font-medium text-sitedoc-primary">
              {t("timer.vedlegg.leggTil")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => leggVed("galleri")}
            disabled={arbeider}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 active:bg-gray-50"
          >
            <ImagePlus size={18} color="#1e40af" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function TilleggRadModal({
  eksisterendeRad,
  organizationId,
  defaultProjectId,
  onLagre,
  onLukk,
}: {
  eksisterendeRad: TilleggRad | null;
  organizationId: string;
  defaultProjectId: string;
  onLagre: (
    projectId: string,
    tilleggId: string,
    antall: number,
    kommentar: string | null,
  ) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [valgtProjectId, setValgtProjectId] = useState<string>(
    eksisterendeRad?.projectId ?? defaultProjectId,
  );
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
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);

  const valgtProsjekt = useMemo(() => {
    return valgtProjectId ? finnProsjektLokalt(valgtProjectId) : null;
  }, [valgtProjectId]);

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
    if (!valgtProjectId) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtTilleggId) {
      setFeil(t("timer.feil.tilleggPaakrevd"));
      return;
    }
    const tall = parseFloat(antall.replace(",", "."));
    if (isNaN(tall) || tall <= 0) {
      setFeil(t("timer.feil.ugyldigAntall"));
      return;
    }
    onLagre(valgtProjectId, valgtTilleggId, tall, kommentar.trim() || null);
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

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.prosjekt")} *
            </Text>
            <ProsjektFelt
              prosjektNavn={valgtProsjekt?.name ?? null}
              prosjektNummer={valgtProsjekt?.projectNumber ?? null}
              onTrykk={() => setVisProsjektVelger(true)}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.tillegg")} *
            </Text>
            <VelgerFelt
              verdi={valgtTillegg?.navn ?? null}
              placeholder={t("timer.velgTillegg")}
              onPress={() => setVisVelger(true)}
            />
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

          {/* Funn #2: kvittering-vedlegg — kun på lagret rad (krever id). For ny
              rad vises en hint om å lagre først. */}
          {eksisterendeRad ? (
            <VedleggSeksjon sheetTilleggId={eksisterendeRad.id} redigerbar={true} />
          ) : (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">
                {t("timer.vedlegg.tittel")}
              </Text>
              <Text className="text-xs text-gray-400">
                {t("timer.vedlegg.lagreForst")}
              </Text>
            </View>
          )}

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
        </KeyboardAvoidingView>

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

        {visProsjektVelger && (
          <ProsjektVelgerModal
            organizationId={organizationId}
            valgtId={valgtProjectId}
            onVelg={(id) => {
              setValgtProjectId(id);
              setVisProsjektVelger(false);
            }}
            onLukk={() => setVisProsjektVelger(false)}
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
          keyboardShouldPersistTaps="handled"
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
