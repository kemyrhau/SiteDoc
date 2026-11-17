/**
 * Layout-regler for 3D-sidene (3d-visning og tegning-3d) i prosjekt-layouten.
 *
 * Bakgrunn (W1, regresjon fra `cebe06f1`): `dashbord/layout.tsx` pakker sidene i
 * `<main className="flex-1 overflow-y-auto">`. `main` er en blokk, ikke en
 * flex-beholder, så `flex-1` på prosjekt-layoutens rot gir ingen høyde — roten
 * blir like høy som innholdet. 3D-lerretet ligger `absolute inset-0` i den boksen
 * og ble derfor bare så høyt som modellista. På 3D-sidene får roten `h-full`
 * (main har bestemt høyde som strukket flex-element). Andre sider beholder
 * innholdshøyde, så scrollen i `main` virker som før.
 */

export function erTreDVisning(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.endsWith("/3d-visning") || pathname.endsWith("/tegning-3d");
}

const ROT_KLASSE = "flex flex-1 flex-col overflow-hidden";

export function prosjektLayoutRotKlasse(er3DVisning: boolean): string {
  return er3DVisning ? `${ROT_KLASSE} h-full` : ROT_KLASSE;
}
