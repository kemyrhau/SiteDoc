import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useOta } from "../providers/OtaProvider";
import { fordelBunnInnsetter } from "../services/otaStatus";
import { ModalInnsetterKontekst } from "./ModalInnsetter";

/**
 * «Ny versjon er klar · Oppdater» nederst i appen (ota-varsel 2026-11-03).
 * Ligger som søsken UNDER navigatoren: tar egen plass, dekker aldri fanelinja
 * eller lagre-knapper. Mens linja vises får navigatoren `bottom: 0` i
 * safe-area-konteksten (fanelinja leser den derfra) og linja tar
 * home-indikator-marginen selv — se `fordelBunnInnsetter`. Ingen lukk-knapp;
 * linja forsvinner når den nye versjonen er tatt i bruk.
 *
 * `ModalInnsetterKontekst` bærer de RÅ innsetterne forbi overstyringen: en
 * `<Modal>` dekker også linja, så modalinnhold trenger full bunnmarg.
 */
export function MedOtaLinje({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status, oppdater } = useOta();
  const innsetter = useSafeAreaInsets();
  const synlig = status === "klar";
  const { navigator, modal, linjeBunn } = fordelBunnInnsetter(innsetter, synlig);

  return (
    <View style={{ flex: 1 }}>
      <ModalInnsetterKontekst.Provider value={modal}>
        <SafeAreaInsetsContext.Provider value={navigator}>
          <View style={{ flex: 1 }}>{children}</View>
        </SafeAreaInsetsContext.Provider>
      </ModalInnsetterKontekst.Provider>
      {synlig && (
        <Pressable
          onPress={oppdater}
          accessibilityRole="button"
          className="bg-sitedoc-primary"
          style={{ paddingBottom: linjeBunn }}
        >
          <View className="flex-row items-center justify-center gap-1 py-2.5">
            <Text className="text-sm text-white">{t("ota.nyVersjonKlar")} ·</Text>
            <Text className="text-sm font-semibold text-white underline">{t("ota.oppdater")}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
