import { useState } from "react";
import { View, Text, Platform, Modal, Pressable } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { rundTilNarmeste } from "../../utils/tidsrunding";
import { TidFeltBoks } from "./TidFeltBoks";

/* ============================================================================
 *  FraTilTidFelt (T4-e 2026-05-16, T.5 2026-05-16)
 *
 *  Gjenbrukbar tids-velger for fra/til-tid per rad på dagsseddel (timer +
 *  maskin). Bruker @react-native-community/datetimepicker i mode="time".
 *
 *  State eies av forelder — komponenten er kontrollert via fraTid/tilTid (HH:MM
 *  eller null) + setters. Picker-toggle-state holdes internt.
 *
 *  Validering (fraTid < tilTid) gjøres av forelder ved lagre, ikke her.
 *
 *  T.5: tidsrundingMinutter rundes inn FØR onFraEndret/onTilEndret kalles.
 *  null = ingen avrunding (identity).
 * ============================================================================ */

interface Props {
  fraTid: string | null;
  tilTid: string | null;
  /** T.5: null = ingen runding. Verdier 15/30/60. */
  tidsrundingMinutter: number | null;
  onFraEndret: (hhmm: string) => void;
  onTilEndret: (hhmm: string) => void;
}

export function FraTilTidFelt({
  fraTid,
  tilTid,
  tidsrundingMinutter,
  onFraEndret,
  onTilEndret,
}: Props) {
  const { t } = useTranslation();
  // Hvilket felt er åpent + utkast-verdien som scrolles (committes først ved
  // «Ferdig» på iOS; Android-dialogen committer ved OK).
  const [aktiv, setAktiv] = useState<null | "fra" | "til">(null);
  const [utkast, setUtkast] = useState<Date>(() => new Date());

  // T.5: minuteInterval er kun en hint (iOS/Android respekterer bare faste
  // verdier) → vi runder uansett ved commit via rundTilNarmeste.
  const minutt =
    tidsrundingMinutter === 15 || tidsrundingMinutter === 30
      ? tidsrundingMinutter
      : undefined;

  function aapne(felt: "fra" | "til") {
    setUtkast(hhmmTilDate(felt === "fra" ? fraTid : tilTid));
    setAktiv(felt);
  }

  function commit(dato: Date, felt: "fra" | "til") {
    const hhmm = rundTilNarmeste(dateTilHhmm(dato), tidsrundingMinutter);
    if (felt === "fra") onFraEndret(hhmm);
    else onTilEndret(hhmm);
  }

  return (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.startTid")}
        </Text>
        <TidFeltBoks verdi={fraTid} onPress={() => aapne("fra")} />
      </View>

      <View className="flex-1">
        <Text className="mb-1 text-sm font-medium text-gray-700">
          {t("timer.felt.sluttTid")}
        </Text>
        <TidFeltBoks verdi={tilTid} onPress={() => aapne("til")} />
      </View>

      {/* iOS: full-bredde spinner i transparent bunn-ark-modal. Modal (ikke
          absolutt overlay) fordi den rendres på native-rot → escaper flex-1-
          kolonnen helt (ingen overflyt) og legger seg korrekt over forelder-
          pageSheet (z-order). «Ferdig» committer scrollet verdi; backdrop/
          «Avbryt» lukker uten å røre feltet. */}
      {Platform.OS === "ios" && aktiv !== null && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setAktiv(null)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setAktiv(null)}
          >
            <Pressable
              className="rounded-t-2xl bg-white pb-6"
              onPress={() => {}}
            >
              <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
                <Pressable onPress={() => setAktiv(null)} hitSlop={8}>
                  <Text className="text-base text-gray-600">
                    {t("handling.avbryt")}
                  </Text>
                </Pressable>
                <Text className="text-base font-semibold text-gray-900">
                  {aktiv === "fra"
                    ? t("timer.felt.startTid")
                    : t("timer.felt.sluttTid")}
                </Text>
                <Pressable
                  onPress={() => {
                    commit(utkast, aktiv);
                    setAktiv(null);
                  }}
                  hitSlop={8}
                >
                  <Text className="text-base font-semibold text-sitedoc-primary">
                    {t("handling.ferdig")}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={utkast}
                mode="time"
                is24Hour
                display="spinner"
                minuteInterval={minutt}
                onChange={(_, valgt) => {
                  if (valgt) setUtkast(valgt);
                }}
                style={{ width: "100%" }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Android: behold native dialog (display="default") — committer ved OK,
          «dismissed» lar feltet stå urørt. */}
      {Platform.OS === "android" && aktiv !== null && (
        <DateTimePicker
          value={utkast}
          mode="time"
          is24Hour
          display="default"
          minuteInterval={minutt}
          onChange={(e, valgt) => {
            const felt = aktiv;
            setAktiv(null);
            if (e.type === "set" && valgt && felt) commit(valgt, felt);
          }}
        />
      )}
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
