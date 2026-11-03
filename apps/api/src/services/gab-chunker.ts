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
 *
 * To rensinger: `rensGabPostLegacy` er den gamle kjeden fra `prosesserGab` uendret (post-beskrivelsene
 * i `FtdPost.beskrivelse` skal være byte for byte som før — Kontrollør-gate 2, 29.10). `rensGabSegment`
 * er chunk-rensingen og beholder linjeskift/tab fra `\par`/`\tab`. Låsetest i `gab-chunker.test.ts`.
 */
/* eslint-disable no-control-regex -- binær GAB-fil: null-byte og kontrolltegn er bevisst del av mønstrene */

/** Øvre grense for lagret chunk-tekst (`FtdDocumentChunk.chunkText`). */
const MAKS_LAGRET = 5000;

/**
 * Gammel post-rensing, flyttet ordrett fra `prosesserGab` (ekstraTekst). Brukes BARE for
 * `FtdPost.beskrivelse`. Kontrollkode-strippen fjerner også `\n` og `\t` fra `\par`/`\tab`,
 * mens mellomrommet etter kontrollordet står — derfor «Graving\par Dybde» → «Graving Dybde».
 * Ikke endre uten ny hjemmel: låsetesten feiler.
 */
export function rensGabPostLegacy(seg: string): string | null {
  const renset = seg.trim();
  if (renset.length < 4) return null;
  if (/^\$[0-9a-f-]{36}/.test(renset)) return null;
  if (/^\{\\rtf/.test(renset)) return null;
  if (!/[a-zA-ZæøåÆØÅ]{2,}/.test(renset)) return null;
  if (/^[\x00-\x1f]/.test(renset)) return null;
  const ren = renset
    .replace(/\\par\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-z]+\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "") // Fjern kontrollkoder (fjerner også \n og \t)
    .replace(/[^\x20-\x7eæøåÆØÅéèêëàáâãäöüïîìíñçÉÈÊËÀÁÂÃÄÖÜÏÎÌÍÑÇ\n\t]/g, "")
    .trim();
  if (ren.length >= 4 && /[a-zA-ZæøåÆØÅ]{2,}/.test(ren)) return ren;
  return null;
}

/** Chunk-rensing av ett null-skilt segment. `null` når segmentet er GUID, RTF-blokk, kontrollkoder eller uten ord. */
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
    // Rens 2 (relay 30.10, Kenneth-hjemmel «Ja, 1 og 2»), målt i «Storgata nord.gab» (1037 chunker):
    // «03Q» 1134 ganger (330 linjer alene, resten linjeslutt: «tegninger. 03Q», «Teknisk rom03Q»,
    // «Tilstandsklasse 203Q» — tallet skal stå), «From CodeItem» 256 hele linjer, mal-plassholdere
    // «[[DATO]]»/«[[TOTAL_SUM]]», enkeltstående «[»/«]», og opptil 11 linjeskift på rad.
    .replace(/^[ \t]*(?:03Q|From CodeItem|\[|\]|\[\[[A-ZÆØÅ0-9_]+\]\])[ \t]*(?:\n|$)/gm, "") // hele linjer
    .replace(/\[\[[A-ZÆØÅ0-9_]+\]\]/g, "") // plassholdere inne i linjer (kun STORE bokstaver — «[[» i binærsøppel røres ikke)
    .replace(/[ \t]*03Q[ \t]*$/gm, "") // «03Q» ved linjeslutt; «03Q» midt i linje («03Qq», «Kode 03QA») røres ikke
    .replace(/[ \t]+$/gm, "") // etterslep pr. linje, så «\n \n» teller som tomme linjer
    .replace(/\n{3,}/g, "\n\n") // ≥3 linjeskift → ett tomt avsnitt
    .trim();
  if (ren.length < 4 || !/[a-zA-ZæøåÆØÅ]{2,}/.test(ren)) return null;
  return ren;
}

/**
 * Mal-/forsidesegment: rått segment med mal-plassholder («[[DATO]]», «[[TOTAL_SUM]]» …). Slike
 * segmenter (forsiden «DEL III - Mengdebeskrivelse / Storgata nord / Tromsø kommune», anbudsskjemaet)
 * skal stå som egen chunk, ikke limes inn i siste post (målt: chunk 1036 i Storgata nord).
 * Antakelse: forsidelinjene ligger i samme null-skilte segment som plassholderen (segmentgrensene i
 * Storgata-fila er ikke målt lokalt — fila finnes bare på test).
 */
export function erMalSegment(seg: string): boolean {
  return /\[\[[A-ZÆØÅ0-9_]+\]\]/.test(seg);
}

/** Bygger søke-chunker av en GAB-fil (latin1-streng): rensede segmenter samlet opp til `maksChunk` tegn. */
export function byggGabChunker(tekst: string, maksChunk = 1500): string[] {
  const chunker: string[] = [];
  let gjeldende = "";
  const flush = () => {
    if (gjeldende) chunker.push(gjeldende.slice(0, MAKS_LAGRET));
    gjeldende = "";
  };
  for (const seg of tekst.split(/\x00+/)) {
    const ren = rensGabSegment(seg);
    if (!ren) continue;
    if (erMalSegment(seg)) {
      // Egen chunk for malen: flush posten før, malen alene, start ny etter.
      flush();
      chunker.push((ren + "\n").slice(0, MAKS_LAGRET));
      continue;
    }
    gjeldende += ren + "\n";
    if (gjeldende.length > maksChunk) flush();
  }
  flush();
  return chunker;
}
