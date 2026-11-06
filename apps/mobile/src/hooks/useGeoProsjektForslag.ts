import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { gjenkjennSted, tilGeofencer } from "@sitedoc/shared";
import { hentByggeplasserForFirmaLokalt } from "../services/byggeplassKatalog";

/**
 * GPS-forslag til prosjektlista bak «+» (ORDRE 17; flyttet ut av ny.tsx).
 * Gjenkjenner byggeplass via geofence (H2, LAG 1-A) og returnerer byggeplassens
 * prosjekt. Treffet er et FORSLAG — arbeideren velger i lista (Q1). Stille null
 * ved avslått tillatelse, ingen posisjon eller ingen treff.
 */
export function useGeoProsjektForslag(orgId: string | null, aktiv = true): string | null {
  const [forslagId, setForslagId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !aktiv) return;
    let avbrutt = false;
    (async () => {
      try {
        const status = await Location.requestForegroundPermissionsAsync();
        if (avbrutt || status.status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (avbrutt) return;
        // V17-A: kandidater via tilGeofencer (A4). Treff mappes tilbake til
        // byggeplass-raden for prosjektet (Sirkel bærer ikke projectId).
        const rader = hentByggeplasserForFirmaLokalt(orgId);
        const kandidater = rader.flatMap((b) =>
          tilGeofencer({ id: b.id, lat: b.lat, lng: b.lng, radiusM: b.radiusM, soner: [] }),
        );
        const treff = gjenkjennSted(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          kandidater,
        );
        if (avbrutt || !treff) return;
        setForslagId(rader.find((b) => b.id === treff.sted.id)?.projectId ?? null);
      } catch {
        // Stille avslag — manuell valg i lista fungerer som før.
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [orgId, aktiv]);

  return forslagId;
}
