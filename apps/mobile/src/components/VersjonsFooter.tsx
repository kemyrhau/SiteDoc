import { Text, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useOta } from "../providers/OtaProvider";
import { OTA_STATUS_NOEKKEL } from "../services/otaStatus";

type BuildExtra = { gitCommit?: string; byggDato?: string };

/**
 * Diskret build-identifikator: `v{semver} (build {N}) · {commit} · {dato}`.
 * - semver fra app.json (`expoConfig.version`)
 * - build-nr fra `Application.nativeBuildVersion` (= EAS auto-inkrement =
 *   TestFlight «Build N»). Kan være null i Expo Go/dev → «(build …)» utelates.
 * - commit (7 tegn) + byggDato fra app.config.js `extra` (EAS-build-tid).
 *   Lokalt vises commit fra `git rev-parse --short HEAD`, ev. "dev".
 * - OTA-id: når en expo-updates-oppdatering kjører, kan JS-en være NYERE enn
 *   binæren. Da lyver commit-hashen (den er byggets), så vi viser
 *   `Updates.updateId` (7 tegn) i tillegg. Kjører den innebygde bundelen
 *   (ingen oppdatering hentet) eller dev, er updateId null → utelates.
 *
 * Brukes nederst på «Mer»-skjermen og i login-footeren (synlig før
 * innlogging — nyttig ved feilsøking). Ingen i18n på selve versjonslinja:
 * innholdet er versjon/build/hash/dato (ikke oversettbart).
 *
 * `visOtaStatus` (kun «Mer»): én statuslinje under med OTA-status i klartekst
 * (ota-varsel 2026-11-03) — trykkbar ved «klar», «Se etter oppdatering» ved
 * «oppdatert». Ingenting i dev / Expo Go.
 */
export function VersjonsFooter({
  className = "",
  visOtaStatus = false,
}: {
  className?: string;
  visOtaStatus?: boolean;
}) {
  const versjon = Constants.expoConfig?.version ?? "?";
  const { gitCommit = "dev", byggDato } = (Constants.expoConfig?.extra ??
    {}) as BuildExtra;
  // nativeBuildVersion er null i Expo Go / dev-klient uten native build.
  const byggNr = Application.nativeBuildVersion;
  // isEnabled er false i dev (ingen expo-updates-runtime) → updateId røres ikke.
  const otaId =
    Updates.isEnabled && Updates.updateId
      ? Updates.updateId.slice(0, 7)
      : null;
  const versjonslinje = (
    <Text className={`text-center text-xs text-gray-400 ${visOtaStatus ? "" : className}`}>
      v{versjon}
      {byggNr ? ` (build ${byggNr})` : ""} · {gitCommit}
      {otaId ? ` · OTA ${otaId}` : ""}
      {byggDato ? ` · ${byggDato}` : ""}
    </Text>
  );
  if (!visOtaStatus) return versjonslinje;
  return (
    <View className={className}>
      {versjonslinje}
      <OtaStatusLinje />
    </View>
  );
}

function OtaStatusLinje() {
  const { t } = useTranslation();
  const { status, seEtter, oppdater } = useOta();
  if (status === "av") return null;
  const tekst = t(OTA_STATUS_NOEKKEL[status]);
  if (status === "klar") {
    return (
      <Pressable onPress={oppdater} hitSlop={8} accessibilityRole="button" className="mt-1">
        <Text className="text-center text-xs font-semibold text-sitedoc-primary">{tekst}</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-1 flex-row justify-center gap-2">
      <Text className="text-xs text-gray-500">{tekst}</Text>
      {status === "oppdatert" && (
        <Pressable onPress={seEtter} hitSlop={8} accessibilityRole="button">
          <Text className="text-xs font-semibold text-sitedoc-primary">{t("ota.seEtter")}</Text>
        </Pressable>
      )}
    </View>
  );
}
