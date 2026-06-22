import { Text } from "react-native";
import Constants from "expo-constants";

type BuildExtra = { gitCommit?: string; byggDato?: string };

/**
 * Diskret build-identifikator: `v{semver} · {commit} · {dato}`.
 * - semver fra app.json (`expoConfig.version`)
 * - commit (7 tegn) + byggDato fra app.config.js `extra` (EAS-build-tid).
 *   Lokalt vises commit "dev".
 *
 * Brukes nederst på «Mer»-skjermen og i login-footeren (synlig før
 * innlogging — nyttig ved feilsøking). Ingen i18n: innholdet er
 * versjon/hash/dato (ikke oversettbart).
 */
export function VersjonsFooter({ className = "" }: { className?: string }) {
  const versjon = Constants.expoConfig?.version ?? "?";
  const { gitCommit = "dev", byggDato } = (Constants.expoConfig?.extra ??
    {}) as BuildExtra;
  return (
    <Text className={`text-center text-xs text-gray-400 ${className}`}>
      v{versjon} · {gitCommit}
      {byggDato ? ` · ${byggDato}` : ""}
    </Text>
  );
}
