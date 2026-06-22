import { View, Text, Pressable } from "react-native";
import { ChevronDown, X } from "lucide-react-native";

/**
 * U2 — delt trykkbart velger-felt med synlig chevron-affordance.
 *
 * Erstatter de tidligere flate tekstboksene som åpnet velger-modaler (arbeider
 * trodde de var låste, device-funn #a). Brukes på alle modal-velgere i
 * timer-detalj-modalene (prosjekt/lønnsart/aktivitet/ECO/utstyr/enhet/tillegg).
 *
 * Særtilfeller bevart:
 * - `underTekst`: ekstra under-linje inni boksen (f.eks. utstyr «#internNummer»).
 * - `onClear`: når satt + `verdi` finnes vises en clear-X til høyre (ECO).
 */
interface VelgerFeltProps {
  /** Vist valgt verdi. null = vis placeholder (grå). */
  verdi: string | null;
  /** Placeholder-streng — caller sender allerede t()-oversatt tekst. */
  placeholder: string;
  /** Åpne velger-modalen. */
  onPress: () => void;
  /** Valgfri under-linje (f.eks. «#internNummer» på utstyr). */
  underTekst?: string | null;
  /** Valgfri clear-handling. Når satt + verdi finnes vises X-knapp til høyre. */
  onClear?: () => void;
  /** Valgfri ekstra styling på boksen. */
  className?: string;
}

export function VelgerFelt({
  verdi,
  placeholder,
  onPress,
  underTekst,
  onClear,
  className = "",
}: VelgerFeltProps) {
  const boks = (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border border-gray-300 bg-white px-3 py-3 ${
        onClear ? "flex-1" : ""
      } ${className}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text
            className={`text-base ${verdi ? "text-gray-900" : "text-gray-400"}`}
          >
            {verdi ?? placeholder}
          </Text>
          {underTekst ? (
            <Text className="mt-0.5 text-xs text-gray-500">{underTekst}</Text>
          ) : null}
        </View>
        <ChevronDown size={18} color="#9ca3af" />
      </View>
    </Pressable>
  );

  if (onClear) {
    return (
      <View className="flex-row items-center gap-2">
        {boks}
        {verdi ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            className="rounded p-2 active:bg-gray-100"
          >
            <X size={18} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>
    );
  }
  return boks;
}
