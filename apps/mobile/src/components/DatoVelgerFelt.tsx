import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";

/**
 * Delt dato/tid-velger for SKJEMA-felt: iOS-picker + en eksplisitt «Ferdig»-knapp.
 *
 * iOS-spinneren (og inline-kalenderen) lukker seg ALDRI av seg selv — uten en vei ut blir
 * brukeren stående i en velger han ikke kommer ut av (målt i 5 flater 2026-08-24). «Ferdig»
 * er den eksplisitte utgangen. Sentralisert her fordi driften ligger i UTSEENDET og ORDLYDEN
 * på knappen, ikke i kontrollflyten: fem inline-kopier ville drevet fra hverandre. Hver side
 * beholder sin egen vis/skjul-state og sin egen `onChange`-logikk; denne eier kun boksen.
 *
 * NÅR VELGER MAN HVILKET MØNSTER:
 *  - `DatoVelgerFelt` (inline + «Ferdig»): når velgeren er ETT felt blant mange på et skjema —
 *    en modal er for tung der.
 *  - Bottom-sheet-modal (se `timer-detalj/FraTilTidFelt.tsx`): når velgeren ER hovedhandlingen
 *    på flaten. Ikke dupliser den her; de to mønstrene er bevisste, ikke drift.
 *
 * Android: den native dialogen lukker seg selv ved valg/avbryt, så «Ferdig» vises kun på iOS.
 * `onChange` sendes rått gjennom (event + valgt dato) så siden beholder full kontroll — inkl.
 * dato→tid-kjeding (DatoTidObjekt) og Android-lukking i sin egen handler.
 */
export function DatoVelgerFelt({
  value,
  mode = "date",
  is24Hour,
  iosDisplay = "spinner",
  onChange,
  onLukk,
}: {
  value: Date;
  mode?: "date" | "time";
  is24Hour?: boolean;
  /** iOS-visning: «spinner» (rulle) eller «inline» (kalender). Android bruker alltid «default». */
  iosDisplay?: "spinner" | "inline";
  onChange: (event: DateTimePickerEvent, dato?: Date) => void;
  /** Lukk velgeren (fra «Ferdig» på iOS). Android lukker selv i sidens onChange. */
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <DateTimePicker
        value={value}
        mode={mode}
        is24Hour={is24Hour}
        display={Platform.OS === "ios" ? iosDisplay : "default"}
        onChange={onChange}
      />
      {Platform.OS === "ios" && (
        <Pressable
          onPress={onLukk}
          className="mt-1 items-center rounded-lg bg-sitedoc-primary px-4 py-2"
          hitSlop={8}
        >
          <Text className="text-sm font-medium text-white">{t("handling.ferdig")}</Text>
        </Pressable>
      )}
    </View>
  );
}
