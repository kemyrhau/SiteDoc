import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { Pencil, X, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { utledArbeidstidFraRader } from "@sitedoc/shared";
import { DatoVelgerFelt } from "../DatoVelgerFelt";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../db/database";
import { dagsseddelLocal } from "../../db/schema";
import { isoTidspunktTilHHMM } from "../../utils/dato";
import { TidFeltBoks } from "./TidFeltBoks";

/** Minimumsformen ArbeidstidSeksjon trenger av en timer-rad (PK7-utledning). */
type ArbeidstidRad = {
  fraTid?: string | null;
  tilTid?: string | null;
  pauseMin?: number | null;
  timer: number;
};

interface ArbeidstidSeksjonProps {
  sheetId: string;
  dato: string; // ISO YYYY-MM-DD
  startAt: string | null;
  endAt: string | null;
  pauseMin: number;
  /** V20/PK7: radene «Arbeidstid i dag» utledes av når det finnes rader med tid. */
  timerRader: ArbeidstidRad[];
  redigerbar: boolean;
  onEndret: () => void;
}

export function ArbeidstidSeksjon({
  sheetId,
  dato,
  startAt,
  endAt,
  pauseMin,
  timerRader,
  redigerbar,
  onEndret,
}: ArbeidstidSeksjonProps) {
  const { t } = useTranslation();
  const [visModal, setVisModal] = useState(false);

  // V20/PK7: «Arbeidstid i dag» er en VISNING utledet av radene (delt
  // `utledArbeidstidFraRader`) — ikke hodet. Finnes rader med tid → vis første
  // fraTid – siste tilTid · Σ pause, tekst «Utledet av radene under». Ellers vis
  // rammen (`startAt/endAt/pauseMin` fra stempling/norm) som prefyll-hint.
  const utledet = utledArbeidstidFraRader(timerRader);
  const harRaderMedTid = utledet.startTid !== null;
  const visStart = harRaderMedTid
    ? utledet.startTid
    : isoTidspunktTilHHMM(startAt) || "—";
  const visSlutt = harRaderMedTid
    ? utledet.sluttTid
    : isoTidspunktTilHHMM(endAt) || "—";
  const visPause = harRaderMedTid ? utledet.sumPauseMin : pauseMin;

  return (
    <View className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Clock size={16} color="#6b7280" />
          <Text className="text-sm font-medium text-gray-600">
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
        {harRaderMedTid
          ? t("timer.arbeidstidUtledet")
          : t("timer.arbeidstidPrefyltHint")}
      </Text>
      <View className="mt-3 flex-row gap-3">
        <Felt label={t("timer.felt.startTid")} verdi={visStart || "—"} />
        <Felt label={t("timer.felt.sluttTid")} verdi={visSlutt || "—"} />
        <Felt label={t("timer.felt.pauseMin")} verdi={`${visPause} min`} />
      </View>

      {visModal && (
        <RedigerArbeidstidModal
          sheetId={sheetId}
          dato={dato}
          startAt={startAt}
          endAt={endAt}
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
  onLukk,
  onLagret,
}: {
  sheetId: string;
  dato: string;
  startAt: string | null;
  endAt: string | null;
  onLukk: () => void;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const [startDato, setStartDato] = useState<Date | null>(
    startAt ? new Date(startAt) : null,
  );
  const [endDato, setEndDato] = useState<Date | null>(endAt ? new Date(endAt) : null);
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

    // V20/PK7: hodet `pauseMin` skrives IKKE her lenger — det utledes server-side
    // (Σ rad) og speiles lokalt av matpause-veien. Rammen (start/slutt) beholdes
    // for stempling/glemt-dag (`sluttTidKilde`).
    db.update(dagsseddelLocal)
      .set({
        startAt: nyStart,
        endAt: nyEnd,
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
              <DatoVelgerFelt
                value={startDato ?? new Date()}
                mode="time"
                is24Hour
                onChange={(_, valgt) => {
                  if (Platform.OS !== "ios") setVisStartPicker(false); // Android lukker selv
                  if (valgt) setStartDato(valgt);
                }}
                onLukk={() => setVisStartPicker(false)}
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
              <DatoVelgerFelt
                value={endDato ?? new Date()}
                mode="time"
                is24Hour
                onChange={(_, valgt) => {
                  if (Platform.OS !== "ios") setVisEndPicker(false); // Android lukker selv
                  if (valgt) setEndDato(valgt);
                }}
                onLukk={() => setVisEndPicker(false)}
              />
            )}
          </View>

          {/* V20/PK7: pausefeltet er fjernet — matpausen eies av radene
              (avkrysningen), hodet utledes server-side (Σ rad). Start/slutt
              beholdes som ramme for stempling/glemt-dag. */}

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
