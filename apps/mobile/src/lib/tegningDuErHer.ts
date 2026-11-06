/**
 * «Du er her» og bunnfelt for tegningsmodalen i oppgave/sjekkliste (ORDRE 23, 2026-11-06).
 * Ren logikk — kallstedet henter GPS og sender posisjonen inn. Prikken er kun visning:
 * den lagres aldri og blir aldri redigeringsmarkør.
 */
import { beregnTransformasjon, gpsTilTegning } from "@sitedoc/shared";
import type { GeoReferanse } from "@sitedoc/shared";

/**
 * GPS → tegningsprosent via den delte transformen. `gpsTilTegning` clamper til 0–100, så en
 * posisjon utenfor tegningen havner på kanten — kantverdi tolkes derfor som «utenfor» (ingen
 * prikk). `erInnenforTegning` kan ikke brukes: den sjekker den clampede verdien og slår alltid til.
 */
export function duErHerPosisjon(
  geoReference: unknown,
  gps: { lat: number; lng: number } | null,
): { x: number; y: number } | null {
  if (!gps || geoReference == null) return null;
  let pos: { x: number; y: number };
  try {
    pos = gpsTilTegning(gps, beregnTransformasjon(geoReference as GeoReferanse));
  } catch {
    return null; // degenerert georeferanse
  }
  if (!(pos.x > 0 && pos.x < 100 && pos.y > 0 && pos.y < 100)) return null;
  return pos;
}

/**
 * Hva bunnfeltet viser: Lagre når punktet kan flyttes; ellers en forklaring på låsen —
 * offline først (det er den årsaken brukeren kan gjøre noe med), deretter utkast-låsen.
 */
export function tegningBunnfelt(opts: { kanRedigerePunkt: boolean; offline: boolean }): "lagre" | "laastOffline" | "laastSendt" {
  if (opts.kanRedigerePunkt) return "lagre";
  return opts.offline ? "laastOffline" : "laastSendt";
}
