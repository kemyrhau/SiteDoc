import { Text, Pressable } from "react-native";
import { Clock } from "lucide-react-native";

/**
 * U3 — delt trykkbar tid-felt-boks med synlig Clock-affordanse.
 *
 * Speiler VelgerFelt-mønsteret (U2), men med Clock-ikon i stedet for chevron:
 * tid-feltene åpner en DateTimePicker-spinner, ikke en nedtrekks-modal. Erstatter
 * de tidligere flate tekstboksene som «så låst ut» (device-funn #c, tid-felt).
 *
 * Ren presentasjon: picker-logikk (DateTimePicker, state, T.5-runding) eies av
 * forelder. Komponenten rendrer kun boksen + ikonet og kaller onPress.
 */
interface TidFeltBoksProps {
  /** Vist tid (HH:MM) eller null = vis placeholder (grå). */
  verdi: string | null;
  /** Placeholder når verdi er null. Default «—». */
  placeholder?: string;
  /** Åpne tid-spinneren. */
  onPress: () => void;
}

export function TidFeltBoks({ verdi, placeholder = "—", onPress }: TidFeltBoksProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3"
    >
      <Text className={`text-base ${verdi ? "text-gray-900" : "text-gray-400"}`}>
        {verdi ?? placeholder}
      </Text>
      <Clock size={18} color="#9ca3af" />
    </Pressable>
  );
}
