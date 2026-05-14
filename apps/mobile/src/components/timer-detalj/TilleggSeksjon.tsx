import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../../db/database";
import { sheetTilleggLocal, tilleggLocal } from "../../db/schema";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import type { TilleggRad, Tillegg } from "../../types/timer-detalj";
import { ProsjektVelgerModal, ProsjektFelt } from "./ProsjektVelger";

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

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
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
