/**
 * Konverteringsmarkør (2026-10-11): leser `{ kodeversjon, konvertertTid, motor }` som
 * api lagrer under `markor` i `drawings.konvertering_rapport` (ved siden av DWG-
 * fullstendighetsrapporten). BEVISER hvilken kode som sist konverterte tegningen — vist
 * som stille metadata i «Rediger tegningsdetaljer» og revisjonslista.
 *
 * Rent lesende + defensivt: feltet er `Json?` og kan være null, en ren
 * fullstendighetsrapport uten `markor` (eldre tegning), eller ukjent form.
 */
export interface KonverteringMarkor {
  kodeversjon: string;
  konvertertTid: string;
  motor: string;
}

/** Hent markøren fra `konverteringRapport`, eller null om den mangler/har feil form. */
export function lesKonverteringMarkor(rapport: unknown): KonverteringMarkor | null {
  if (!rapport || typeof rapport !== "object") return null;
  const markor = (rapport as { markor?: unknown }).markor;
  if (!markor || typeof markor !== "object") return null;
  const { kodeversjon, konvertertTid, motor } = markor as Record<string, unknown>;
  if (
    typeof kodeversjon !== "string" ||
    typeof konvertertTid !== "string" ||
    typeof motor !== "string"
  ) {
    return null;
  }
  return { kodeversjon, konvertertTid, motor };
}

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
