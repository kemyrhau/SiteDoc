/**
 * Rensing av GAB-segmenter (G-PROG anbudsfiler) til søkbar tekst — F2, relay 29.10.
 *
 * Fila er binær med null-skilte strenger: posttekst, GUID-er, RTF-blokker og rekker av
 * RTF-kontrollord uten mellomrom (målt: linjer på 5000 tegn). Tidligere ble søke-chunkene bygd
 * av rå segmenter mens bare post-beskrivelsene ble renset; chunkene fikk dermed RTF og GUID-er
 * (1288 av 2228 chunker i «Storgata nord.gab»). Begge bruker nå samme rensing.
 *
 * Kjent begrensning: hele RTF-blokker (`{\rtf…}`) hoppes over, ikke konverteres. Rentekst-varianten
 * av posten ligger som regel i et eget segment ved siden av.
 */
/* eslint-disable no-control-regex -- binær GAB-fil: null-byte og kontrolltegn er bevisst del av mønstrene */

/** Øvre grense for lagret chunk-tekst (`FtdDocumentChunk.chunkText`). */
const MAKS_LAGRET = 5000;

/** Renser ett null-skilt segment. `null` når segmentet er GUID, RTF-blokk, kontrollkoder eller uten ord. */
export function rensGabSegment(seg: string): string | null {
  const renset = seg.trim();
  if (renset.length < 4) return null;
  if (/^\$[0-9a-f-]{36}/.test(renset)) return null; // GUID
  if (/^\{\\rtf/.test(renset)) return null; // RTF-blokk
  if (!/[a-zA-ZæøåÆØÅ]{2,}/.test(renset)) return null;
  if (/^[\x00-\x1f]/.test(renset)) return null; // kontrollsekvens
  const ren = renset
    .replace(/\\par\b\s?/g, "\n")
    .replace(/\\tab\b\s?/g, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+\d*\s?/g, "") // øvrige RTF-kontrollord
    .replace(/[{}]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "") // kontrollkoder, men behold \t og \n fra \tab/\par
    .replace(/[^\x20-\x7eæøåÆØÅéèêëàáâãäöüïîìíñçÉÈÊËÀÁÂÃÄÖÜÏÎÌÍÑÇ\n\t]/g, "")
    .trim();
  if (ren.length < 4 || !/[a-zA-ZæøåÆØÅ]{2,}/.test(ren)) return null;
  return ren;
}

/** Bygger søke-chunker av en GAB-fil (latin1-streng): rensede segmenter samlet opp til `maksChunk` tegn. */
export function byggGabChunker(tekst: string, maksChunk = 1500): string[] {
  const chunker: string[] = [];
  let gjeldende = "";
  for (const seg of tekst.split(/\x00+/)) {
    const ren = rensGabSegment(seg);
    if (!ren) continue;
    gjeldende += ren + "\n";
    if (gjeldende.length > maksChunk) {
      chunker.push(gjeldende.slice(0, MAKS_LAGRET));
      gjeldende = "";
    }
  }
  if (gjeldende) chunker.push(gjeldende.slice(0, MAKS_LAGRET));
  return chunker;
}
