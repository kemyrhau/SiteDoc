import { ScrollView, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { Omfang } from "./sokLogikk";

const OMFANG: Array<{ id: Omfang; nøkkel: string }> = [
  { id: "alle", nøkkel: "sokMobil.omfangAlle" },
  { id: "mapper", nøkkel: "sokMobil.omfangMapper" },
  { id: "sjekklister", nøkkel: "sokMobil.omfangSjekklister" },
  { id: "oppgaver", nøkkel: "sokMobil.omfangOppgaver" },
];

/** Omfangsvelger (spec-sok-mobil § 9.4 A): fire chips under feltet, ett valg om gangen, samme stil som oppgave-segmentene. */
export function OmfangVelger({ valgt, onVelg }: { valgt: Omfang; onVelg: (o: Omfang) => void }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0 border-b border-gray-100 bg-gray-50"
      contentContainerClassName="gap-2 px-4 py-2"
      accessibilityRole="tablist"
      keyboardShouldPersistTaps="handled"
    >
      {OMFANG.map((o) => {
        const aktiv = valgt === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onVelg(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktiv }}
            className={`h-8 flex-row items-center rounded-full border px-3 ${
              aktiv ? "border-sitedoc-blue bg-blue-50" : "border-gray-200 bg-white"
            }`}
          >
            <Text className={`text-xs font-medium ${aktiv ? "text-sitedoc-blue" : "text-gray-600"}`}>
              {t(o.nøkkel)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
