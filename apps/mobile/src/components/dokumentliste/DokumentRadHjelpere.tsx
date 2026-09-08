import { Text } from "react-native";

/**
 * Delte rad-hjelpere for dokumentlistene (hjem, innboks, hms, sjekkliste,
 * oppgave). Søke-uthevingen (`MedUtheving`) bor her fordi den bruker
 * react-native `Text`; den rene nummer-formateringen bor i @sitedoc/shared og
 * re-eksporteres herfra så kallstedene kan importere alt fra ett sted.
 */

export { formaterNummer } from "@sitedoc/shared";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Uthever søke-treff (gul, fabel-mockup panel 2) i en tekst. */
export function MedUtheving({
  tekst,
  tokens,
  className,
}: {
  tekst: string;
  tokens: string[];
  className: string;
}) {
  if (tokens.length === 0) {
    return (
      <Text className={className} numberOfLines={1}>
        {tekst}
      </Text>
    );
  }
  const rx = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "ig");
  const treffSett = new Set(tokens.map((tk) => tk.toLowerCase()));
  const deler = tekst.split(rx);
  return (
    <Text className={className} numberOfLines={1}>
      {deler.map((del, i) =>
        treffSett.has(del.toLowerCase()) ? (
          <Text key={i} className="bg-yellow-200 text-gray-900">
            {del}
          </Text>
        ) : (
          del
        ),
      )}
    </Text>
  );
}
