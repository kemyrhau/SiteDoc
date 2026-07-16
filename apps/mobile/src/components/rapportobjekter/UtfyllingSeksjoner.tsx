import { useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { grupperMedOverskrift } from "@sitedoc/shared";

type MinObjekt = { id: string; type: string; label: string; parentId?: string | null };

/**
 * Kollapsbare heading-seksjoner i mobil utfylling (fase M-3a del 2, pkt 2).
 * Grupperer den flate objektlista på rot-headings (delt logikk i
 * `@sitedoc/shared`) UTEN datamodell-endring. Felter før første heading vises
 * ugruppert. `render` gjenbruker skjermens eksisterende per-objekt-rendring.
 */
export function UtfyllingSeksjoner<T extends MinObjekt>({
  objekter,
  render,
}: {
  objekter: T[];
  render: (objekt: T) => ReactNode;
}) {
  const seksjoner = grupperMedOverskrift(objekter);
  const [kollapsede, setKollapsede] = useState<Set<string>>(new Set());

  // Ingen rot-headings → ren flat visning uten seksjons-krom.
  if (!seksjoner.some((s) => s.overskrift !== null)) {
    return <>{objekter.map(render)}</>;
  }

  function veksle(id: string) {
    setKollapsede((forrige) => {
      const neste = new Set(forrige);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  return (
    <>
      {seksjoner.map((seksjon, i) => {
        if (!seksjon.overskrift) {
          return <View key={`ledende-${i}`}>{seksjon.felter.map(render)}</View>;
        }
        const id = seksjon.overskrift.id;
        const kollapset = kollapsede.has(id);
        return (
          <View key={id} className="mb-2 overflow-hidden rounded-xl border border-gray-200">
            <Pressable
              onPress={() => veksle(id)}
              className="flex-row items-center justify-between bg-gray-50 px-4 py-3"
            >
              <Text className="flex-1 text-base font-semibold text-gray-900">
                {seksjon.overskrift.label}
              </Text>
              {kollapset ? (
                <ChevronRight size={18} color="#6b7280" />
              ) : (
                <ChevronDown size={18} color="#6b7280" />
              )}
            </Pressable>
            {!kollapset && <View className="px-2 pb-2 pt-1">{seksjon.felter.map(render)}</View>}
          </View>
        );
      })}
    </>
  );
}
