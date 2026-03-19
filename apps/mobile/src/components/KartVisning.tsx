import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { MapPin } from "lucide-react-native";

// Fallback: Oslo sentrum
const STANDARD_POSISJON = {
  latitude: 59.91,
  longitude: 10.75,
};

export function KartVisning() {
  const [posisjon, setPosisjon] = useState(STANDARD_POSISJON);
  const [laster, setLaster] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<string>("");

  useEffect(() => {
    let avbrutt = false;

    async function hentPosisjon() {
      // expo-location støttes ikke på web
      if (Platform.OS === "web") {
        setLaster(false);
        return;
      }

      try {
        const Location = await import("expo-location");

        // Be om tillatelse
        setGpsStatus("Ber om tillatelse...");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("[KART] GPS-tillatelse ikke gitt:", status);
          setGpsStatus("GPS-tillatelse avslått");
          setLaster(false);
          return;
        }

        // Hent posisjon med timeout
        setGpsStatus("Henter posisjon...");
        const resultat = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);

        if (avbrutt) return;

        if (resultat) {
          console.log("[KART] GPS OK:", resultat.coords.latitude.toFixed(4), resultat.coords.longitude.toFixed(4));
          setPosisjon({
            latitude: resultat.coords.latitude,
            longitude: resultat.coords.longitude,
          });
          setGpsStatus("");
        } else {
          console.warn("[KART] GPS timeout — bruker standardposisjon");
          setGpsStatus("GPS utilgjengelig");
        }
      } catch (feil) {
        console.warn("[KART] GPS feil:", feil instanceof Error ? feil.message : feil);
        if (!avbrutt) setGpsStatus("GPS-feil");
      } finally {
        if (!avbrutt) {
          setLaster(false);
        }
      }
    }

    hentPosisjon();

    return () => {
      avbrutt = true;
    };
  }, []);

  if (laster) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#1e40af" />
        <Text className="mt-3 text-sm text-gray-500">
          {gpsStatus || "Henter posisjon…"}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-gray-100">
      <MapPin size={48} color="#1e40af" />
      <Text className="mt-4 text-base font-medium text-gray-700">
        Kartvisning
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        {posisjon.latitude.toFixed(4)}, {posisjon.longitude.toFixed(4)}
      </Text>
      {gpsStatus ? (
        <Text className="mt-2 text-xs text-amber-500">{gpsStatus}</Text>
      ) : null}
      <Text className="mt-4 px-8 text-center text-xs text-gray-400">
        Fullt kart vises i development build (EAS Build).
      </Text>
    </View>
  );
}
