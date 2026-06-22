import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pencil, X, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import { dagsseddelLocal } from "../../db/schema";
import { isoTidspunktTilHHMM } from "../../utils/dato";
import { TidFeltBoks } from "./TidFeltBoks";

interface ArbeidstidSeksjonProps {
  sheetId: string;
  dato: string; // ISO YYYY-MM-DD
  startAt: string | null;
  endAt: string | null;
  pauseMin: number;
  redigerbar: boolean;
  onEndret: () => void;
}

export function ArbeidstidSeksjon({
  sheetId,
  dato,
  startAt,
  endAt,
  pauseMin,
  redigerbar,
  onEndret,
}: ArbeidstidSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);

  return (
    <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Clock size={16} color="#1f2937" />
          <Text className="text-base font-semibold text-gray-900">
            {t("timer.arbeidstidIDag")}
          </Text>
        </View>
        {redigerbar && (
          <Pressable
            onPress={() => setVisModal(true)}
            hitSlop={12}
            className="flex-row items-center gap-1 rounded p-1.5 active:bg-gray-100"
          >
            <Pencil size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600">{t("handling.rediger")}</Text>
          </Pressable>
        )}
      </View>
      <Text className="mt-1 text-xs text-gray-500">
        {t("timer.arbeidstidIDagBeskrivelse")}
      </Text>
      <View className="mt-3 flex-row gap-3">
        <Felt label={t("timer.felt.startTid")} verdi={isoTidspunktTilHHMM(startAt) || "—"} />
        <Felt label={t("timer.felt.sluttTid")} verdi={isoTidspunktTilHHMM(endAt) || "—"} />
        <Felt label={t("timer.felt.pauseMin")} verdi={`${pauseMin} min`} />
      </View>

      {visModal && (
        <RedigerArbeidstidModal
          sheetId={sheetId}
          dato={dato}
          startAt={startAt}
          endAt={endAt}
          pauseMin={pauseMin}
          onLukk={() => setVisModal(false)}
          onLagret={() => {
            setVisModal(false);
            onEndret();
          }}
        />
      )}
    </View>
  );
}

function dateTilHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Felt({ label, verdi }: { label: string; verdi: string }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-base text-gray-900">{verdi}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerArbeidstidModal                                              */
/* ------------------------------------------------------------------ */

function RedigerArbeidstidModal({
  sheetId,
  dato,
  startAt,
  endAt,
  pauseMin,
  onLukk,
  onLagret,
}: {
  sheetId: string;
  dato: string;
  startAt: string | null;
  endAt: string | null;
  pauseMin: number;
  onLukk: () => void;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const [startDato, setStartDato] = useState<Date | null>(
    startAt ? new Date(startAt) : null,
  );
  const [endDato, setEndDato] = useState<Date | null>(endAt ? new Date(endAt) : null);
  const [pause, setPause] = useState(String(pauseMin));
  const [visStartPicker, setVisStartPicker] = useState(false);
  const [visEndPicker, setVisEndPicker] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  function settTid(grunnDato: string, tidspunkt: Date | null): string | null {
    if (!tidspunkt) return null;
    const dag = new Date(`${grunnDato}T00:00:00`);
    dag.setHours(tidspunkt.getHours(), tidspunkt.getMinutes(), 0, 0);
    return dag.toISOString();
  }

  function lagre() {
    setFeil(null);

    const pauseTall = parseInt(pause || "0", 10);
    if (isNaN(pauseTall) || pauseTall < 0) {
      setFeil(t("timer.feil.ugyldigPause"));
      return;
    }

    const nyStart = settTid(dato, startDato);
    const nyEnd = settTid(dato, endDato);

    if (nyStart && nyEnd) {
      const diffMin =
        (new Date(nyEnd).getTime() - new Date(nyStart).getTime()) / 60000;
      if (diffMin <= 0) {
        setFeil(t("timer.feil.sluttForStart"));
        return;
      }
    }

    const db = hentDatabase();
    if (!db) {
      setFeil(t("timer.feil.dbIkkeTilgjengelig"));
      return;
    }

    db.update(dagsseddelLocal)
      .set({
        startAt: nyStart,
        endAt: nyEnd,
        pauseMin: pauseTall,
        // Slice 4b-2: manuell redigering av slutt-tid → bruker-bekreftet tid,
        // nullstiller evt. "system"/"midnatt" (fjerner kontroll-badge).
        sluttTidKilde: "bruker",
        syncStatus: "pending",
        sistEndretLokalt: Date.now(),
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();

    onLagret();
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
            {t("timer.arbeidstidIDag")}
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
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-xs text-gray-500">
            {t("timer.arbeidstidIDagBeskrivelse")}
          </Text>

          {/* Start-tid */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.startTid")}
            </Text>
            <TidFeltBoks
              verdi={startDato ? dateTilHhmm(startDato) : null}
              onPress={() => setVisStartPicker(true)}
            />
            {visStartPicker && (
              <DateTimePicker
                value={startDato ?? new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, valgt) => {
                  setVisStartPicker(Platform.OS === "ios");
                  if (valgt) setStartDato(valgt);
                }}
              />
            )}
          </View>

          {/* Slutt-tid */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.sluttTid")}
            </Text>
            <TidFeltBoks
              verdi={endDato ? dateTilHhmm(endDato) : null}
              onPress={() => setVisEndPicker(true)}
            />
            {visEndPicker && (
              <DateTimePicker
                value={endDato ?? new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, valgt) => {
                  setVisEndPicker(Platform.OS === "ios");
                  if (valgt) setEndDato(valgt);
                }}
              />
            )}
          </View>

          {/* Pause */}
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              {t("timer.felt.pauseMin")}
            </Text>
            <TextInput
              value={pause}
              onChangeText={setPause}
              keyboardType="number-pad"
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
          </View>

          {feil && <Text className="text-sm text-red-600">{feil}</Text>}

          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={onLukk}
              className="flex-1 items-center rounded-lg border border-gray-300 bg-white py-3 active:bg-gray-50"
            >
              <Text className="text-base font-medium text-gray-700">
                {t("handling.avbryt")}
              </Text>
            </Pressable>
            <Pressable
              onPress={lagre}
              className="flex-1 items-center rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Text className="text-base font-semibold text-white">
                {t("handling.lagre")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
