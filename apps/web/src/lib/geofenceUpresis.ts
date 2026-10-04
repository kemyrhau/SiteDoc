import { GEOFENCE_GRENSER } from "@sitedoc/shared";

/*
 * V17-B / B-7 — ren predikat: er en byggeplass' SIRKEL-geofence «upresis»?
 *
 * Sann når radiusen er større enn GEOFENCE_UPRESIS_RADIUS_M og geofencen ikke er
 * sone-utledet (en sone-byggeplass har ingen meningsfull radius, B9). Utledet ved
 * visning — ingen kolonne. Testbar kilde så byggeplasslista og matrise-flaten (B-7)
 * deler ÉN definisjon av «upresis».
 */
export function erUpresisSirkel(lok: {
  radiusM?: number | null;
  geofenceKilde?: string | null;
}): boolean {
  return (
    lok.geofenceKilde !== "soner" &&
    lok.radiusM != null &&
    lok.radiusM > GEOFENCE_GRENSER.upresisRadiusM
  );
}
