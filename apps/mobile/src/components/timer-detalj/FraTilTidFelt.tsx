import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";

/* ============================================================================
 *  FraTilTidFelt (T4-e 2026-05-16)
 *
 *  Gjenbrukbar tids-velger for fra/til-tid per rad på dagsseddel (timer +
 *  maskin). Bruker @react-native-community/datetimepicker i mode="time".
 *
 *  State eies av forelder — komponenten er kontrollert via fraTid/tilTid (HH:MM
 *  eller null) + setters. Picker-toggle-state holdes internt.
 *
 *  Validering (fraTid < tilTid) gjøres av forelder ved lagre, ikke her.
 * ============================================================================ */

interface Props {
  fraTid: string | null;
  tilTid: string | null;
  onFraEndret: (hhmm: string) => void;
  onTilEndret: (hhmm: string) => void;
}

export function FraTilTidFelt({ fraTid, tilTid, onFraEndret, onTilEndret }: Props) {
  const { t } = useTranslation();
  const [visFraPicker, setVisFraPicker] = useState(false);
  const [visTilPicker, setVisTilPicker] = useState(false);

  return (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.startTid")}
        </Text>
        <Pressable
          onPress={() => setVisFraPicker(true)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-3"
        >
          <Text className={`text-base ${fraTid ? "text-gray-900" : "text-gray-400"}`}>
            {fraTid ?? "—"}
          </Text>
        </Pressable>
        {visFraPicker && (
          <DateTimePicker
            value={hhmmTilDate(fraTid)}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, valgt) => {
              setVisFraPicker(Platform.OS === "ios");
              if (valgt) onFraEndret(dateTilHhmm(valgt));
            }}
          />
        )}
      </View>

      <View className="flex-1">
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.sluttTid")}
        </Text>
        <Pressable
          onPress={() => setVisTilPicker(true)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-3"
        >
          <Text className={`text-base ${tilTid ? "text-gray-900" : "text-gray-400"}`}>
            {tilTid ?? "—"}
          </Text>
        </Pressable>
        {visTilPicker && (
          <DateTimePicker
            value={hhmmTilDate(tilTid)}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, valgt) => {
              setVisTilPicker(Platform.OS === "ios");
              if (valgt) onTilEndret(dateTilHhmm(valgt));
            }}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Konverter HH:MM-streng til en Date hvor kun time/minutt-komponenten er
 * relevant. Datoen er i dag — picker'en bruker bare tid-feltene.
 * Null/ugyldig input → kl. 08:00 i dag (en sannsynlig start på arbeidsdag).
 */
function hhmmTilDate(hhmm: string | null): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (!hhmm) {
    d.setHours(8, 0);
    return d;
  }
  const deler = hhmm.split(":");
  const timer = Number(deler[0] ?? 0);
  const minutter = Number(deler[1] ?? 0);
  d.setHours(isNaN(timer) ? 8 : timer, isNaN(minutter) ? 0 : minutter);
  return d;
}

function dateTilHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Sammenlign to HH:MM-strenger. Returnerer true hvis fra < til.
 * Brukes til validering i forelder før lagring.
 */
export function fraErForTil(fra: string | null, til: string | null): boolean {
  if (!fra || !til) return true; // null tolereres — kun lukke hvis begge er satt
  return hhmmTilMinutter(fra) < hhmmTilMinutter(til);
}

function hhmmTilMinutter(hhmm: string): number {
  const deler = hhmm.split(":");
  const t = Number(deler[0] ?? 0);
  const m = Number(deler[1] ?? 0);
  return t * 60 + m;
}
