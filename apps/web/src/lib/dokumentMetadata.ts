/**
 * Metadata M-pakke (B-2/B-3/B-4) i web-listene (sjekklister, oppgaver): rene hjelpere for
 * kolonnene «Sendt av/Sendt», «Godkjent av/Godkjent», «Lukket av/Lukket», «Sist utfylt av/
 * Sist utfylt» og «Signatur» — celle-tekst, filterverdi, filteralternativer og sortering.
 * Feltene kommer fra `hentForProsjekt` (`statushendelser`, `utfylling`, `signatur`).
 */

import type { DokumentSignaturstatus, Statushendelser, Utfylling } from "@sitedoc/shared";

export interface MetadataRad {
  statushendelser?: Statushendelser | null;
  utfylling?: Utfylling | null;
  signatur?: DokumentSignaturstatus | null;
}

type Steg = "sendt" | "godkjent" | "lukket";

/** Kolonne-id → statussteg for «av»-kolonnene (person) og dato-kolonnene. */
export const PERSON_KOLONNER: Record<string, Steg> = { sendtAv: "sendt", godkjentAv: "godkjent", lukketAv: "lukket" };
export const DATO_KOLONNER: Record<string, Steg> = { sendtDato: "sendt", godkjentDato: "godkjent", lukketDato: "lukket" };

export type Signaturkategori = "signert" | "mangler" | "uten";

/** «✓» når komplett, «m/n» når det mangler, «—» uten signaturfelt. */
export function signaturTekst(s: DokumentSignaturstatus | null | undefined): string {
  if (!s) return "—";
  if (s.komplett) return "✓";
  return `${s.signert}/${s.kreves}`;
}

export function signaturKategori(s: DokumentSignaturstatus | null | undefined): Signaturkategori {
  if (!s) return "uten";
  return s.komplett ? "signert" : "mangler";
}

/**
 * Stigende sortering gir komplett først, så de som mangler (mest signert først), og til slutt
 * dokumenter uten signaturfelt.
 */
export function signaturSorterVerdi(s: DokumentSignaturstatus | null | undefined): number {
  if (!s) return 3;
  if (s.komplett) return 0;
  return 2 - (s.kreves > 0 ? s.signert / s.kreves : 0);
}

export function hendelseNavn(rad: MetadataRad, steg: Steg): string {
  return rad.statushendelser?.[steg]?.av.navn ?? "";
}

export function hendelseVed(rad: MetadataRad, steg: Steg): string | null {
  return rad.statushendelser?.[steg]?.ved ?? null;
}

/** Endringsloggen er av i malen → vi vet ikke hvem som fylte ut (vises som «—» m/forklaring). */
export function utfyllingUkjent(rad: MetadataRad): boolean {
  return rad.utfylling === null;
}

/** Enkel filterverdi for metadata-kolonnene; `undefined` = ikke en metadata-kolonne. */
export function metadataFilterVerdi(rad: MetadataRad, kolId: string): string | undefined {
  const steg = PERSON_KOLONNER[kolId];
  if (steg) return hendelseNavn(rad, steg);
  if (kolId === "signatur") return signaturKategori(rad.signatur);
  return undefined;
}

/** «Utfylt av» treffer alle som står i endringsloggen, ikke bare den siste. */
export function metadataFlereVerdier(rad: MetadataRad, kolId: string): string[] | undefined {
  if (kolId !== "sistUtfyltAv") return undefined;
  return (rad.utfylling?.alle ?? []).map((p) => p.navn).filter((n): n is string => !!n);
}

/** Adaptive personlister (bare navn som finnes i lista), A–Å. */
export function metadataFilterAlternativer(rader: readonly MetadataRad[]): Record<string, { value: string; label: string }[]> {
  const sortert = (navn: Iterable<string>) => [...new Set(navn)].sort((a, b) => a.localeCompare(b, "nb")).map((v) => ({ value: v, label: v }));
  const res: Record<string, { value: string; label: string }[]> = {};
  for (const [kolId, steg] of Object.entries(PERSON_KOLONNER)) {
    res[kolId] = sortert(rader.map((r) => hendelseNavn(r, steg)).filter(Boolean));
  }
  res.sistUtfyltAv = sortert(rader.flatMap((r) => metadataFlereVerdier(r, "sistUtfyltAv") ?? []));
  return res;
}
