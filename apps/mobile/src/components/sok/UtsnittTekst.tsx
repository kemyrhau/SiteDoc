import { Text } from "react-native";
import { byggUtsnitt, type UtsnittInput } from "@sitedoc/shared";

/** Utsnitt maks 3 linjer (spec § 2): gule ordtreff, semantisk setning på lys lilla bakgrunn. Samme utsnitt som web. */
export function UtsnittTekst(props: UtsnittInput) {
  const deler = byggUtsnitt(props);
  return (
    <Text className="mt-1 text-xs leading-5 text-gray-700" numberOfLines={3}>
      {deler.map((d, i) =>
        d.type === "treff" ? (
          <Text key={i} className="bg-yellow-200 text-gray-900">
            {d.tekst}
          </Text>
        ) : d.type === "semantisk" ? (
          <Text key={i} className="bg-purple-50 text-gray-900">
            {d.tekst}
          </Text>
        ) : (
          d.tekst
        ),
      )}
    </Text>
  );
}
