import { Text } from "react-native";

/**
 * Delte rad-hjelpere for dokumentlistene (sjekkliste, innboks). Skilt ut så
 * lister ikke kopierer nummer-formatering og søke-utheving — «to flater, én
 * kilde» (samme prinsipp som dokumentlisteFilter.ts).
 */

export function formaterNummer(
  prefix: string | null | undefined,
  nummer: number | null | undefined,
): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

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
