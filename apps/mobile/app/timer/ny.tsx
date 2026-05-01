import { useState, useMemo, useEffect, type ReactElement } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, ChevronRight, Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import DateTimePicker from "@react-native-community/datetimepicker";
import { hentDatabase } from "../../src/db/database";
import { dagsseddelLocal, aktivitetLocal } from "../../src/db/schema";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { trpc } from "../../src/lib/trpc";
import { eq } from "drizzle-orm";

type Prosjekt = { id: string; name: string; projectNumber: string | null };
type Aktivitet = { id: string; navn: string; kode: string | null };

function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}

function formatNorskDato(iso: string): string {
  return new Date(iso).toLocaleDateString("no-NB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NyDagsseddelSide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const [dato, setDato] = useState<string>(formatIsoDato(new Date()));
  const [visDatoVelger, setVisDatoVelger] = useState(false);
  const [valgtProsjekt, setValgtProsjekt] = useState<Prosjekt | null>(null);
  const [valgtAktivitet, setValgtAktivitet] = useState<Aktivitet | null>(null);
  const [beskrivelse, setBeskrivelse] = useState("");
  const [visProsjektVelger, setVisProsjektVelger] = useState(false);
  const [visAktivitetVelger, setVisAktivitetVelger] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [lagrer, setLagrer] = useState(false);

  // Hent prosjekter (online — for offline-bruk må klargjøring kjøres først)
  const { data: prosjekterData } = trpc.prosjekt.hentMine.useQuery(undefined, {
    staleTime: 60 * 1000,
  });
  const prosjekter = (prosjekterData ?? []) as unknown as Prosjekt[];

  // Hent aktive aktiviteter fra lokal cache (offline-trygt — uavhengig av org-id
  // siden hver bruker kun har sitt firmas data lokalt)
  const aktiviteter = useMemo<Aktivitet[]>(() => {
    const db = hentDatabase();
    if (!db) return [];
    const rader = db
      .select({
        id: aktivitetLocal.id,
        navn: aktivitetLocal.navn,
        kode: aktivitetLocal.kode,
      })
      .from(aktivitetLocal)
      .where(eq(aktivitetLocal.aktiv, true))
      .all();
    return rader;
  }, []);

  // Auto-velg "Anleggsarbeid" hvis seedet
  useEffect(() => {
    if (!valgtAktivitet && aktiviteter.length > 0) {
      const default_ = aktiviteter.find((a) => a.navn === "Anleggsarbeid");
      if (default_) setValgtAktivitet(default_);
      else if (aktiviteter.length === 1) setValgtAktivitet(aktiviteter[0]);
    }
  }, [aktiviteter, valgtAktivitet]);

  function lagre() {
    setFeil(null);

    if (!valgtProsjekt) {
      setFeil(t("timer.feil.prosjektPaakrevd"));
      return;
    }
    if (!valgtAktivitet) {
      setFeil(t("timer.feil.aktivitetPaakrevd"));
      return;
    }
    if (!bruker?.id) {
      setFeil(t("timer.feil.ikkeInnlogget"));
      return;
    }

    const db = hentDatabase();
    if (!db) {
      setFeil(t("timer.feil.dbIkkeTilgjengelig"));
      return;
    }

    setLagrer(true);
    try {
      const id = randomUUID();
      const naa = Date.now();

      // Vi mangler organizationId fra brukeren — bruker tomt for nå.
      // Server validerer ved sync uansett.
      db.insert(dagsseddelLocal)
        .values({
          id,
          userId: bruker.id,
          organizationId: "",
          projectId: valgtProsjekt.id,
          aktivitetId: valgtAktivitet.id,
          avdelingId: null,
          byggeplassId: null,
          dato,
          startAt: null,
          endAt: null,
          pauseMin: 0,
          status: "draft",
          beskrivelse: beskrivelse.trim() || null,
          lederKommentar: null,
          attestertVed: null,
          syncStatus: "pending",
          feilmelding: null,
          sistEndretLokalt: naa,
          sistSynkronisert: null,
        })
        .run();

      oppdaterTellere();
      void triggerSync();

      router.replace(`/timer/${id}`);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setLagrer(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900">
          {t("timer.nyDagsseddel")}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
        {/* Dato */}
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t("timer.felt.dato")}
          </Text>
          <Pressable
            onPress={() => setVisDatoVelger(true)}
            className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
          >
            <View className="flex-row items-center gap-2">
              <Calendar size={18} color="#6b7280" />
              <Text className="text-base text-gray-900">
                {formatNorskDato(dato)}
              </Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </Pressable>
        </View>

        {visDatoVelger && (
          <DateTimePicker
            value={new Date(dato)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, valgt) => {
              setVisDatoVelger(Platform.OS === "ios");
              if (valgt) setDato(formatIsoDato(valgt));
            }}
          />
        )}

        {/* Prosjekt */}
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")} *
          </Text>
          <Pressable
            onPress={() => setVisProsjektVelger(true)}
            className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
          >
            <Text
              className={`flex-1 text-base ${valgtProsjekt ? "text-gray-900" : "text-gray-400"}`}
            >
              {valgtProsjekt
                ? `${valgtProsjekt.projectNumber ? valgtProsjekt.projectNumber + " — " : ""}${valgtProsjekt.name}`
                : t("timer.velgProsjekt")}
            </Text>
            <ChevronRight size={18} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Aktivitet */}
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t("timer.felt.aktivitet")} *
          </Text>
          <Pressable
            onPress={() => setVisAktivitetVelger(true)}
            className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
          >
            <Text
              className={`flex-1 text-base ${valgtAktivitet ? "text-gray-900" : "text-gray-400"}`}
            >
              {valgtAktivitet
                ? valgtAktivitet.navn
                : t("timer.velgAktivitet")}
            </Text>
            <ChevronRight size={18} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Beskrivelse */}
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700">
            {t("timer.felt.beskrivelse")}
          </Text>
          <TextInput
            value={beskrivelse}
            onChangeText={setBeskrivelse}
            placeholder={t("timer.beskrivelsePlaceholder")}
            multiline
            numberOfLines={3}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
            style={{ textAlignVertical: "top", minHeight: 80 }}
          />
        </View>

        {feil && <Text className="text-sm text-red-600">{feil}</Text>}

        {/* Lagre-knapp */}
        <Pressable
          onPress={lagre}
          disabled={lagrer}
          className="mt-2 items-center rounded-lg bg-blue-600 px-6 py-4 active:bg-blue-700 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-white">
            {lagrer ? t("handling.lagrer") : t("timer.lagreOgFortsett")}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Prosjekt-velger */}
      <ListeVelgerModal<Prosjekt>
        synlig={visProsjektVelger}
        tittel={t("timer.velgProsjekt")}
        elementer={prosjekter}
        valgtId={valgtProsjekt?.id ?? null}
        renderRad={(p) => (
          <>
            <Text className="text-base text-gray-900">{p.name}</Text>
            {p.projectNumber && (
              <Text className="text-xs text-gray-500">{p.projectNumber}</Text>
            )}
          </>
        )}
        onVelg={(p) => {
          setValgtProsjekt(p);
          setVisProsjektVelger(false);
        }}
        onLukk={() => setVisProsjektVelger(false)}
      />

      {/* Aktivitet-velger */}
      <ListeVelgerModal<Aktivitet>
        synlig={visAktivitetVelger}
        tittel={t("timer.velgAktivitet")}
        elementer={aktiviteter}
        valgtId={valgtAktivitet?.id ?? null}
        renderRad={(a) => (
          <>
            <Text className="text-base text-gray-900">{a.navn}</Text>
            {a.kode && (
              <Text className="text-xs text-gray-500">{a.kode}</Text>
            )}
          </>
        )}
        onVelg={(a) => {
          setValgtAktivitet(a);
          setVisAktivitetVelger(false);
        }}
        onLukk={() => setVisAktivitetVelger(false)}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Generisk liste-velger-modal                                         */
/* ------------------------------------------------------------------ */

function ListeVelgerModal<T extends { id: string }>({
  synlig,
  tittel,
  elementer,
  valgtId,
  renderRad,
  onVelg,
  onLukk,
}: {
  synlig: boolean;
  tittel: string;
  elementer: T[];
  valgtId: string | null;
  renderRad: (e: T) => ReactElement;
  onVelg: (e: T) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const filtrert = useMemo(() => {
    if (!sok.trim()) return elementer;
    const q = sok.toLowerCase();
    return elementer.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
  }, [elementer, sok]);

  return (
    <Modal
      visible={synlig}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {tittel}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {elementer.length > 7 && (
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
              onPress={() => onVelg(item)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">{renderRad(item)}</View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenTilgjengelige")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
