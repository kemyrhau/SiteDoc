/**
 * A3 (web-timeforing-plan.md § 4.17 del D, B55): «Reise under terskel».
 *
 * En reiselinje (`erReise`) der firmaets regel sa arbeidstid — reisen var under terskelen — og
 * arbeideren likevel førte reisetid. Regelen leses fra snapshotet på linja (`reiseRegel`), slik den
 * var da reisen ble ført: `regelKategori` er satt bare når arbeideren valgte annet enn regelen
 * (`reiseManuell.ts`). Ingen serverendring; eldre rader uten snapshot får ikke merke.
 *
 * Får ikke merke: reise over terskelen, reise under terskelen i et firma som har «reisetid» under
 * terskel, og tid ført som arbeidstid (ikke reiselinje).
 */

export interface ReiseUnderTerskelRad {
  erReise?: boolean | null;
  reiseRegel?: unknown;
  reiseKjoretidMin?: number | null;
  reiseAvstandM?: number | null;
}

export interface ReiseUnderTerskel {
  enhet: "minutter" | "km";
  /** Reisens lengde i enheten (km eller minutter); null når linja ikke har målingen. */
  maalt: number | null;
  /** Firmaets terskel i enheten. */
  terskel: number;
}

const tall = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rund1 = (n: number) => Math.round(n * 10) / 10;

export function reiseUnderTerskel(rad: ReiseUnderTerskelRad): ReiseUnderTerskel | null {
  if (rad.erReise !== true) return null;
  const regel = rad.reiseRegel;
  if (!regel || typeof regel !== "object") return null;
  const r = regel as Record<string, unknown>;
  if (r.regelKategori !== "arbeidstid") return null;
  if (r.enhet === "km") {
    const terskelM = tall(r.terskelM);
    if (terskelM == null) return null;
    const avstand = tall(rad.reiseAvstandM);
    return { enhet: "km", maalt: avstand == null ? null : rund1(avstand / 1000), terskel: rund1(terskelM / 1000) };
  }
  const terskelMin = tall(r.terskelMin);
  if (terskelMin == null) return null;
  const kjoretid = tall(rad.reiseKjoretidMin);
  return { enhet: "minutter", maalt: kjoretid == null ? null : Math.round(kjoretid), terskel: terskelMin };
}
