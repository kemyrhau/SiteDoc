import type { TFunction } from "i18next";
import { formaterVaerTekst, erVaerVerdi } from "./vaerTekst";

/**
 * Lesbar tekst for en tapende kollisjonsverdi. Skalar → som den er; array → komma-liste;
 * vær-objekt → slik vær-feltet selv vises (ordre 2026-11-04 (3) P3).
 * Defensivt: en tapende celleverdi er nå en skalar (repeater-kollisjon festes pr. celle),
 * men skulle et objekt likevel nå hit, vis en lesbar markør — aldri rå JSON på skjerm.
 */
export function tilfoyelseVerdiTekst(verdi: unknown, t: TFunction): string {
  if (verdi == null) return "";
  if (typeof verdi === "string" || typeof verdi === "number" || typeof verdi === "boolean") return String(verdi);
  if (Array.isArray(verdi)) return verdi.map((v) => tilfoyelseVerdiTekst(v, t)).filter(Boolean).join(", ");
  if (typeof verdi === "object") {
    const v = verdi as { verdi?: unknown; filnavn?: unknown };
    if (v.verdi != null && typeof v.verdi !== "object") return String(v.verdi);
    if (typeof v.filnavn === "string") return v.filnavn;
    if (erVaerVerdi(v)) return formaterVaerTekst(v, t) || t("felt.ingenVaerdata");
    return t("kollisjon.notat.kompleksVerdi");
  }
  return String(verdi);
}
