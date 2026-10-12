/**
 * Konverteringsmarkør (2026-10-11): `{ kodeversjon, konvertertTid, motor }` som api
 * lagrer under `markor` i `drawings.konvertering_rapport`. BEVISER hvilken kode/motor
 * som sist konverterte tegningen — vist som stille metadata i «Rediger
 * tegningsdetaljer» og revisjonslista.
 *
 * `KonverteringMarkor` + `lesKonverteringMarkor` er flyttet til @sitedoc/shared (RETUR 2,
 * 2026-10-12) så mobil-viseren deler parseren. Re-eksporteres her for å beholde den
 * stabile `@/lib/konverteringMarkor`-importstien i web. UI-formatererne under er web-lokale.
 */
export { lesKonverteringMarkor, type KonverteringMarkor } from "@sitedoc/shared";

/** Kompakt lokaltid «dd.MM HH:mm» (f.eks. «11.10 10:45»). Tom streng ved ugyldig ISO. */
export function formaterKonvertertTid(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 8-tegns kort sha. «ukjent» beholdes som markør for manglende versjon. */
export function kortKodeversjon(kodeversjon: string): string {
  return kodeversjon === "ukjent" ? kodeversjon : kodeversjon.slice(0, 8);
}
