import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { prosjektSokParametre, visProsjektSokRad, type Kilde } from "./sokLogikk";

/**
 * Søkeinngang B (spec-sok-innganger): under listesøket, bare når feltet har tekst. Listesøket selv er
 * uendret (filter, status og sortering gjelder); raden tar teksten med til `/sok` med listas kilde valgt.
 */
export function ProsjektSokRad({ kilde, tekst }: { kilde: Exclude<Kilde, "mapper">; tekst: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (!visProsjektSokRad(tekst)) return null;
  const parametre = prosjektSokParametre(kilde, tekst);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/sok", params: parametre })}
      accessibilityRole="link"
      className="flex-row items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5"
    >
      <Search size={14} color="#1e40af" />
      <Text className="flex-1 text-sm text-sitedoc-primary" numberOfLines={1}>
        {t("sokMobil.sokIHeleProsjektet", { q: parametre.q })}
      </Text>
      <ChevronRight size={16} color="#1e40af" />
    </Pressable>
  );
}
