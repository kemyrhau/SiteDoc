/**
 * A3 (web-timeforing-plan.md § 4.17 del D, B55): «Reise under terskel».
 *
 * En reiselinje (`erReise`) der firmaets regel ga arbeidstid, arbeideren likevel førte reisetid,
 * og den MÅLTE reisen er under terskelen. Regelen leses fra snapshotet på linja (`reiseRegel`),
 * slik den var da reisen ble ført: `regelKategori` er `klassifiserReise`-svaret, satt bare når
 * arbeideren valgte annet enn regelen (`reiseManuell.ts`). Ingen serverendring; eldre rader uten
 * snapshot får ikke merke.
 *
 * Gate A1–A3 vilkår 2: «arbeidstid» betyr ikke «under terskel» — `klassifiserReise` gir
 * `reiseUnderTerskelType` også når km-avstanden mangler, og `reiseOverTerskelType` kan være
 * arbeidstid. Merket krever derfor målingen, sammenlignet rått med terskelen (`<`, som
 * `klassifiserReise`).
 *
 * Får ikke merke: reise uten måling, målt reise på eller over terskelen, reise ført etter regelen,
 * og tid ført som arbeidstid (ikke reiselinje).
 */

export interface ReiseUnderTerskelRad {
  erReise?: boolean | null;
  reiseRegel?: unknown;
  reiseKjoretidMin?: number | null;
  reiseAvstandM?: number | null;
}

export interface ReiseUnderTerskel {
  enhet: "minutter" | "km";
  /** Reisens målte lengde i enheten (km med én desimal, eller hele minutter). */
  maalt: number;
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
    const avstand = tall(rad.reiseAvstandM);
    if (terskelM == null || avstand == null || avstand < 0 || avstand >= terskelM) return null;
    return { enhet: "km", maalt: rund1(avstand / 1000), terskel: rund1(terskelM / 1000) };
  }
  const terskelMin = tall(r.terskelMin);
  const kjoretid = tall(rad.reiseKjoretidMin);
  if (terskelMin == null || kjoretid == null || kjoretid < 0 || kjoretid >= terskelMin) return null;
  return { enhet: "minutter", maalt: Math.round(kjoretid), terskel: terskelMin };
}
