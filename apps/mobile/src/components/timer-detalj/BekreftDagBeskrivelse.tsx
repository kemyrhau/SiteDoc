import { forwardRef, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Keyboard, Platform, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { harForslag, vekslForslag } from "../../utils/forslagVeksling";

/**
 * ORDRE 36a (spec § 3) «Hva gjorde du i dag?» — ett felt pr. prosjekt med
 * arbeid i `/timer/bekreft-dag`. Påkrevd: nøytral ramme til arbeideren har
 * forsøkt å bekrefte med tomt felt (`visFeil`), da rød ramme + mikrotekst.
 * RETUR 36c: chip legges til / fjernes igjen (`vekslForslag`) — skrevet tekst
 * overskrives aldri. Tastaturet lukkes med «Ferdig»: iOS via skjermens
 * `InputAccessoryView` (`tastaturId`), Android via knappen under feltet mens
 * tastaturet er oppe. Ingenting skrives herfra — teksten holdes i
 * skjermens retting til [Bekreft og lagre].
 * RETUR 36c-2 (D4): feltet har makshøyde med intern scroll, så markøren aldri
 * havner under tastaturet; skjermen ruller selve feltet (`onFeltY`) over
 * tastaturet og på nytt når innholdet vokser (`onInnholdEndret`). «Ferdig» er
 * en fullbredde-knapp ≥ 44 pt.
 */
export const BekreftDagBeskrivelse = forwardRef<
  TextInput,
  {
    prosjektNavn: string | null;
    /** Vis prosjektnavnet i etiketten (flere prosjekter samme dag). */
    visProsjekt: boolean;
    verdi: string;
    chips: string[];
    visFeil: boolean;
    onEndre: (tekst: string) => void;
    onLayout?: (e: LayoutChangeEvent) => void;
    /** iOS: nativeID til skjermens «Ferdig»-linje over tastaturet. */
    tastaturId?: string;
    /** Feltet fikk fokus — skjermen ruller det over tastaturet. */
    onFokus?: () => void;
    /** Tekstfeltets y innenfor kortet — rullemålet er feltet, ikke kortets topp. */
    onFeltY?: (y: number) => void;
    /** Innholdshøyden endret seg (ny linje) mens feltet har fokus. */
    onInnholdEndret?: () => void;
    /**
     * Radform (Kenneth 2026-11-12, beslutning 2): kortets arbeidsrader. Med to
     * eller flere får hver rad sitt eget felt; tomt felt = kortteksten
     * (vist som plassholder), skrevet tekst overstyrer for den raden.
     */
    rader?: { nokkel: string; tid: string; verdi: string; visFeil: boolean }[];
    onEndreRad?: (nokkel: string, tekst: string) => void;
    radRef?: (nokkel: string, felt: TextInput | null) => void;
    /** Radfeltets y innenfor kortet — sperren ruller hit (beslutning 3). */
    onRadY?: (nokkel: string, y: number) => void;
  }
>(function BekreftDagBeskrivelse(
  {
    prosjektNavn,
    visProsjekt,
    verdi,
    chips,
    visFeil,
    onEndre,
    onLayout,
    tastaturId,
    onFokus,
    onFeltY,
    onInnholdEndret,
    rader = [],
    onEndreRad,
    radRef,
    onRadY,
  },
  ref,
) {
  const { t } = useTranslation();
  const [harFokus, setHarFokus] = useState(false);
  const [tastaturOppe, setTastaturOppe] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const vis = Keyboard.addListener("keyboardDidShow", () => setTastaturOppe(true));
    const skjul = Keyboard.addListener("keyboardDidHide", () => setTastaturOppe(false));
    return () => {
      vis.remove();
      skjul.remove();
    };
  }, []);
  return (
    <View onLayout={onLayout} className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <Text className="text-sm font-medium text-gray-700">
        {t("timer.bekreftDag.beskrivelse.etikett")}
        {visProsjekt && prosjektNavn ? ` · ${prosjektNavn}` : ""}
      </Text>
      {chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {chips.map((c) => {
            const valgt = harForslag(verdi, c);
            return (
              <Pressable
                key={c}
                onPress={() => onEndre(vekslForslag(verdi, c))}
                className={`rounded-full border px-3 py-1 ${valgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
              >
                <Text className={`text-sm ${valgt ? "text-blue-700" : "text-gray-700"}`}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <TextInput
        ref={ref}
        value={verdi}
        onChangeText={onEndre}
        inputAccessoryViewID={Platform.OS === "ios" ? tastaturId : undefined}
        onFocus={() => {
          setHarFokus(true);
          onFokus?.();
        }}
        onBlur={() => setHarFokus(false)}
        onLayout={(e) => onFeltY?.(e.nativeEvent.layout.y)}
        onContentSizeChange={() => {
          if (harFokus) onInnholdEndret?.();
        }}
        scrollEnabled
        placeholder={t("timer.bekreftDag.beskrivelse.placeholder")}
        multiline
        textAlignVertical="top"
        className={`max-h-[140px] min-h-[56px] rounded-lg border px-3 py-3 text-base text-gray-900 ${
          visFeil ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
        }`}
      />
      {Platform.OS === "android" && harFokus && tastaturOppe ? (
        <Pressable
          onPress={() => Keyboard.dismiss()}
          className="min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4"
        >
          <Text className="text-base font-semibold text-white">{t("handling.ferdig")}</Text>
        </Pressable>
      ) : null}
      {visFeil ? (
        <Text className="text-xs text-red-700">
          {t("timer.bekreftDag.beskrivelse.paakrevd", { prosjekt: prosjektNavn ?? "" })}
        </Text>
      ) : null}
      {rader.length >= 2
        ? rader.map((r) => (
            <View key={r.nokkel} className="gap-1" onLayout={(e) => onRadY?.(r.nokkel, e.nativeEvent.layout.y)}>
              <Text className="text-sm text-gray-500" style={{ fontVariant: ["tabular-nums"] }}>
                {r.tid}
              </Text>
              <TextInput
                ref={(felt) => radRef?.(r.nokkel, felt)}
                value={r.verdi}
                onChangeText={(tekst) => onEndreRad?.(r.nokkel, tekst)}
                inputAccessoryViewID={Platform.OS === "ios" ? tastaturId : undefined}
                onFocus={() => setHarFokus(true)}
                onBlur={() => setHarFokus(false)}
                placeholder={verdi.trim() || t("timer.bekreftDag.beskrivelse.radPlassholder")}
                multiline
                textAlignVertical="top"
                className={`max-h-[100px] min-h-[44px] rounded-lg border px-3 py-2 text-base text-gray-900 ${
                  r.visFeil ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
                }`}
              />
              {r.visFeil ? (
                <Text className="text-xs text-red-700">
                  {t("timer.bekreftDag.beskrivelse.radMangler", { rad: r.tid })}
                </Text>
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
});
