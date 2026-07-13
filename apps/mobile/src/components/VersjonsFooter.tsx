import { Text } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";

type BuildExtra = { gitCommit?: string; byggDato?: string };

/**
 * Diskret build-identifikator: `v{semver} (build {N}) · {commit} · {dato}`.
 * - semver fra app.json (`expoConfig.version`)
 * - build-nr fra `Application.nativeBuildVersion` (= EAS auto-inkrement =
 *   TestFlight «Build N»). Kan være null i Expo Go/dev → «(build …)» utelates.
 * - commit (7 tegn) + byggDato fra app.config.js `extra` (EAS-build-tid).
 *   Lokalt vises commit fra `git rev-parse --short HEAD`, ev. "dev".
 *
 * Brukes nederst på «Mer»-skjermen og i login-footeren (synlig før
 * innlogging — nyttig ved feilsøking). Ingen i18n: innholdet er
 * versjon/build/hash/dato (ikke oversettbart).
 */
export function VersjonsFooter({ className = "" }: { className?: string }) {
  const versjon = Constants.expoConfig?.version ?? "?";
  const { gitCommit = "dev", byggDato } = (Constants.expoConfig?.extra ??
    {}) as BuildExtra;
  // nativeBuildVersion er null i Expo Go / dev-klient uten native build.
  const byggNr = Application.nativeBuildVersion;
  return (
    <Text className={`text-center text-xs text-gray-400 ${className}`}>
      v{versjon}
      {byggNr ? ` (build ${byggNr})` : ""} · {gitCommit}
      {byggDato ? ` · ${byggDato}` : ""}
    </Text>
  );
}
