import { View, Text, Pressable } from "react-native";
import { StatusMerkelapp } from "../StatusMerkelapp";
import { MedUtheving, formaterNummer } from "../dokumentliste/DokumentRadHjelpere";

/** Sjekkliste-/oppgavetreff som radene i dagens lister (spec § 2): nummer fet + tittel, undertekst, status. */
export function ListeTreffRad({
  rad,
  tokens,
  onPress,
  etikett,
}: {
  rad: {
    title: string;
    status: string;
    number?: number | null;
    template?: { name: string; prefix?: string | null } | null;
    utforerFaggruppe?: { name: string } | null;
  };
  tokens: string[];
  onPress: () => void;
  /** Kort type-etikett foran nummeret (HMS-kilden: Avvik/SJA/RUH). */
  etikett?: string;
}) {
  const nummer = formaterNummer(rad.template?.prefix, rad.number);
  const undertekst = [rad.template?.name === rad.title ? null : rad.template?.name, rad.utforerFaggruppe?.name]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable onPress={onPress} className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
      <View className="flex-1">
        <View className="flex-row">
          {etikett ? <Text className="text-sm text-gray-500">{etikett} · </Text> : null}
          {nummer ? <Text className="text-sm font-bold text-gray-900">{nummer} </Text> : null}
          <MedUtheving tekst={rad.title} tokens={tokens} className="flex-1 text-sm text-gray-900" />
        </View>
        {undertekst ? (
          <MedUtheving tekst={undertekst} tokens={tokens} className="mt-0.5 text-xs text-gray-500" />
        ) : null}
      </View>
      <StatusMerkelapp status={rad.status} />
    </Pressable>
  );
}
