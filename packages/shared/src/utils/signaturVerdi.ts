/**
 * Signaturfelt-verdi — én delt kilde for lesning + visning (web + mobil).
 *
 * Bakgrunn (fabel-vedtak 2026-09-05, delleveranse 2 til `fix/signatur-kollaps`):
 * en signatur midt i et skjema var i praksis anonym — `felt.ts` rendret bare
 * `<img src="data:...">`, uten hvem og når. Signaturfeltet bærer nå et snapshot
 * av signerende bruker (navn + id) og tidspunktet.
 *
 * FORMATSKIFTE MED BAKOVERKOMPATIBILITET (målt 2026-09-05): verdien var en RÅ
 * data-URL-streng på alle tre flater (web/mobil/PDF). Eksisterende signaturer i
 * prod er derfor strenger. Regelen:
 *   - streng (`data:...`)  → legacy → vis bildet, INGEN meta-linje (ikke «Ukjent»).
 *   - objekt (`dataUrl`+…) → nytt   → vis bildet + «navn ?? Ukjent · dd.mm.åååå kl. hh:mm».
 *
 * KRAV (fabel): tre flater skal ikke hver for seg avgjøre streng-vs-objekt — det er
 * nettopp drift-klassen vi rydder opp i. `lesSignaturVerdi` er den ene leseren.
 * Web + mobil importerer den herfra. PDF (`packages/pdf`, dokumentert null-
 * avhengigheter — `felt.ts:90`) kan ikke importere @sitedoc/shared og SPEILER
 * derfor denne logikken lokalt med peker-kommentar — samme mønster pdf allerede
 * bruker for `enhet ?? unit`-fallbacken.
 *
 * `brukerId` er et snapshot ved siden av `navn`: navnet er bevisst frosset (viser
 * hva personen het da han signerte), men id-en gjør at signaturen senere kan
 * kobles til en deltaker i runde-modellen (redesign-Opus, `signature_list`) — ett
 * felt nå er forskjellen på en migrering og en gjettelek senere.
 */

export interface SignaturVerdi {
  /** Signaturbildet som data-URL (`data:image/png;base64,...`). */
  dataUrl: string;
  /** Innlogget brukers id ved signering. `null` for legacy-signaturer. */
  brukerId: string | null;
  /** Innlogget brukers navn ved signering (frosset snapshot). `null` for legacy. */
  navn: string | null;
  /** Signeringstidspunkt, lokal ISO-8601 med offset. `null` for legacy. */
  tidspunkt: string | null;
}

/**
 * Les en signaturfeltverdi bakoverkompatibelt.
 * @returns normalisert `SignaturVerdi`, eller `null` når feltet er tomt/ugyldig.
 */
export function lesSignaturVerdi(verdi: unknown): SignaturVerdi | null {
  // Legacy: rå data-URL-streng (pre 2026-09-05).
  if (typeof verdi === "string") {
    return verdi.startsWith("data:")
      ? { dataUrl: verdi, brukerId: null, navn: null, tidspunkt: null }
      : null;
  }
  // Nytt format: objekt med data-URL + snapshot av hvem/når.
  if (verdi && typeof verdi === "object" && !Array.isArray(verdi)) {
    const o = verdi as Record<string, unknown>;
    const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : null;
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    return {
      dataUrl,
      brukerId: typeof o.brukerId === "string" ? o.brukerId : null,
      navn: typeof o.navn === "string" ? o.navn : null,
      tidspunkt: typeof o.tidspunkt === "string" ? o.tidspunkt : null,
    };
  }
  return null;
}

/**
 * Formatér signeringstidspunktet til `dd.mm.åååå kl. hh:mm`.
 *
 * Parser dato/tid-komponentene DIREKTE fra ISO-strengen (ikke via `Date`-metoder),
 * så veggklokken vises identisk på alle flater uavhengig av render-miljøets
 * tidssone — en PDF rendret på en UTC-server viser samme klokkeslett som telefonen
 * signaturen ble laget på. `signaturTidspunktNaa` lagrer derfor lokal-ISO med offset.
 *
 * @returns formatert streng, eller `null` for legacy/manglende tidspunkt.
 */
export function formaterSignaturTidspunkt(tidspunkt: string | null): string | null {
  if (!tidspunkt) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(tidspunkt);
  if (!m) return null;
  const [, aar, maaned, dag, time, minutt] = m;
  return `${dag}.${maaned}.${aar} kl. ${time}:${minutt}`;
}

/**
 * Meta-linjen under signaturbildet: «navn ?? Ukjent · dd.mm.åååå kl. hh:mm».
 * @returns linjen, eller `null` for legacy-signaturer (streng uten tidspunkt) → ingen linje vises.
 */
export function formaterSignaturLinje(sig: SignaturVerdi): string | null {
  const tid = formaterSignaturTidspunkt(sig.tidspunkt);
  if (!tid) return null;
  return `${sig.navn ?? "Ukjent"} · ${tid}`;
}

/**
 * Signeringstidspunkt NÅ som lokal ISO-8601 med offset (f.eks.
 * `2026-09-05T14:32:07+02:00`). Lokal — ikke `toISOString()` (UTC) — så
 * veggklokken er innbakt i verdien og vises likt på tvers av flater/tidssoner.
 */
export function signaturTidspunktNaa(dato: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offMin = -dato.getTimezoneOffset();
  const fortegn = offMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offMin);
  return (
    `${dato.getFullYear()}-${p(dato.getMonth() + 1)}-${p(dato.getDate())}` +
    `T${p(dato.getHours())}:${p(dato.getMinutes())}:${p(dato.getSeconds())}` +
    `${fortegn}${p(Math.floor(absMin / 60))}:${p(absMin % 60)}`
  );
}
