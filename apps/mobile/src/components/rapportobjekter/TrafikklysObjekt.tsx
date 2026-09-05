import { View, Pressable } from "react-native";
import type { RapportObjektProps } from "./typer";

// Fire verdier — paritet med web (green/yellow/red/gray). Grå = "Ikke relevant".
const FARGER: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
  gray: { aktiv: "bg-gray-400", inaktiv: "bg-gray-200" },
};

export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <View className="flex-row items-center gap-2 py-2">
      {(["green", "yellow", "red", "gray"] as const).map((farge) => {
        const erValgt = valgtVerdi === farge;
        const fargeKlasse = erValgt ? FARGER[farge].aktiv : FARGER[farge].inaktiv;
        return (
          // Trykkflate 44×44px (del6b hit-target ≥44px) — synlig prikk 24px inni
          <Pressable
            key={farge}
            onPress={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : farge);
            }}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <View
              className={`h-6 w-6 rounded-full ${fargeKlasse} ${erValgt ? "border-2 border-gray-800" : ""}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
