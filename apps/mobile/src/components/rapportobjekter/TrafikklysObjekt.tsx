import { View, Pressable } from "react-native";
import type { RapportObjektProps } from "./typer";

const FARGER: Record<string, { aktiv: string; inaktiv: string }> = {
  green: { aktiv: "bg-green-500", inaktiv: "bg-green-200" },
  yellow: { aktiv: "bg-yellow-400", inaktiv: "bg-yellow-200" },
  red: { aktiv: "bg-red-500", inaktiv: "bg-red-200" },
};

export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const valgtVerdi = typeof verdi === "string" ? verdi : null;

  return (
    <View className="flex-row items-center gap-4 py-2">
      {(["green", "yellow", "red"] as const).map((farge) => {
        const erValgt = valgtVerdi === farge;
        const fargeKlasse = erValgt ? FARGER[farge].aktiv : FARGER[farge].inaktiv;
        return (
          <Pressable
            key={farge}
            onPress={() => {
              if (leseModus) return;
              onEndreVerdi(erValgt ? null : farge);
            }}
            className={`h-12 w-12 rounded-full ${fargeKlasse} ${
              erValgt ? "border-2 border-gray-800" : ""
            }`}
          />
        );
      })}
    </View>
  );
}
