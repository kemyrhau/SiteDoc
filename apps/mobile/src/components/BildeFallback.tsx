import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { ImageOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/**
 * Synlig sluttilstand for et bilde som ikke kan vises (slettet fil / alle forsøk
 * brukt). Gis til `AutentisertBilde` via `fallback`-propen. Mønsteret — grå boks,
 * `ImageOff`-ikon i `#9ca3af`, valgfri forklaringstekst — er løftet ut av
 * `FeltDokumentasjon` (som beholder sin egen inline-variant), så de seks øvrige
 * kallstedene deler ÉN kilde framfor å hver hardkode firkanten.
 *
 * 🔴 Boksen fyller plassen bildet skulle hatt: kallstedet gir `className`/`style` med
 * NØYAKTIG samme dimensjoner som bildet, så en død fil ikke får layouten til å hoppe.
 * Skalér ikon og tekst til flaten — et 20px-ikon midt i et fullskjerms zoom-vindu er
 * tallene kopiert, ikke mønsteret gjenbrukt. Derfor er `ikonStr`/`tekstKlasse` eksplisitte.
 *
 * `visTekst=false` (eller for lite flate) → ikonet alene. Stille tomhet unngås uansett:
 * firkanten står der og sier «her er et vedlegg som ikke kan vises».
 */
export function BildeFallback({
  className = "",
  style,
  ikonStr = 20,
  tekstKlasse = "text-[9px]",
  visTekst = true,
}: {
  /** Tailwind-dimensjoner for boksen (f.eks. `h-20 w-20 rounded-lg`). */
  className?: string;
  /** Style-dimensjoner der kallstedet bruker `style={{ width, height }}`. */
  style?: StyleProp<ViewStyle>;
  /** Ikonstørrelse i px — skalér til boksen (20 for 72–80px, ~36 inline, ~48 zoom). */
  ikonStr?: number;
  /** Tailwind-tekstklasse — `text-[9px]` i små bokser, `text-xs`/`text-sm` på større. */
  tekstKlasse?: string;
  /** Vis forklaringsteksten? Slå av der flaten er for trang. */
  visTekst?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      className={`items-center justify-center rounded-lg bg-gray-100 px-1 ${className}`}
      style={style}
    >
      <ImageOff size={ikonStr} color="#9ca3af" />
      {visTekst && (
        <Text className={`mt-1 text-center text-gray-500 ${tekstKlasse}`} numberOfLines={2}>
          {t("felt.vedleggKunneIkkeLastes")}
        </Text>
      )}
    </View>
  );
}
