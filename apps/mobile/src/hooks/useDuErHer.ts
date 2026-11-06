import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { duErHerPosisjon } from "../lib/tegningDuErHer";

/**
 * Henter forgrunns-GPS én gang når tegningsmodalen åpnes (ORDRE 23) og regner om til
 * tegningsprosent. Ber ALDRI om tillatelse — kun gitt tillatelse brukes (LokasjonSeksjon eier
 * spørsmålet). Ingen GPS, ingen georeferanse eller utenfor tegningen → null, uten melding.
 */
export function useDuErHer(aapen: boolean, geoReference: unknown): { x: number; y: number } | null {
  const [gps, settGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!aapen || geoReference == null) {
      settGps(null);
      return;
    }
    let avbrutt = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!avbrutt) settGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // GPS feilet stille — ingen prikk
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [aapen, geoReference]);

  return duErHerPosisjon(geoReference, gps);
}
