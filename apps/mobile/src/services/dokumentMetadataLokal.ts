import type { Statushendelser, Utfylling } from "@sitedoc/shared";

/**
 * Metadata M-pakke B-2/B-4 (2026-11-04): `statushendelser` og `utfylling` fra
 * `hentForProsjekt` lagres som JSON-tekst i sjekkliste_local/oppgave_local, så person-/
 * periodefilteret og «sendt»-sorteringen virker offline. Tre tilstander må overleve
 * rundturen: feltet mangler (eldre API → kolonne NULL → `undefined`), `utfylling: null`
 * (endringslogg av i malen → tekst "null" → `null`) og en verdi.
 */

export interface MetadataFelt {
  statushendelser?: Statushendelser | null;
  utfylling?: Utfylling | null;
}

const tilTekst = (v: unknown): string | null => (v === undefined ? null : JSON.stringify(v));

function fraTekst<T>(tekst: string | null): T | null | undefined {
  if (tekst == null) return undefined;
  try {
    return JSON.parse(tekst) as T | null;
  } catch {
    return undefined;
  }
}

/** Server-rad → kolonneverdier for lokal lagring. */
export function metadataTilLokal(r: MetadataFelt): { statushendelser: string | null; utfylling: string | null } {
  return { statushendelser: tilTekst(r.statushendelser), utfylling: tilTekst(r.utfylling) };
}

/** Lokale kolonner → felt på DokumentRad (utelatt når eldre API ikke leverte dem). */
export function metadataFraLokal(r: { statushendelser: string | null; utfylling: string | null }): MetadataFelt {
  const ut: MetadataFelt = {};
  const s = fraTekst<Statushendelser>(r.statushendelser);
  if (s !== undefined) ut.statushendelser = s;
  const u = fraTekst<Utfylling>(r.utfylling);
  if (u !== undefined) ut.utfylling = u;
  return ut;
}
