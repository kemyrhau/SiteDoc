/**
 * Arkivmal — bilde-inliner + komprimering (Stage 4b, api-sammenstilling).
 *
 * Containeren er nettverksfri → bildene inlines som data-URI av api-et. Rå
 * annoterte PNG-er (3,4 MB m/ alfakanal) må komprimeres, ellers blir HTML-
 * nyttelasten ~21 MB (målt). Men annotasjonen (tynne røde streker/piler) ER
 * dokumentasjonen: kvaliteten velges så annotasjonen er utvetydig lesbar i
 * trykk — annotasjon vinner over filstørrelse (cowork-presisering).
 *
 * Feilet henting → filnavnet føres i `manglende` (aldri stille hull; rendres som
 * mangel-merknad + registreres i loggseksjonen av sammenstillingen).
 */

import sharp from "sharp";

/** Trykk-oppløsning: 1600 px lang side ≈ 270 DPI på ~15 cm A4-bilde. Nok for tynne streker. */
const MAKS_KANT = 1600;
/** JPEG-kvalitet: høy nok til at annotasjons-streker holder seg skarpe. */
const JPEG_KVALITET = 88;

/**
 * Komprimerer ett bilde til trykk-JPEG. Flater transparent marg (annoterte PNG-er)
 * mot hvit, nedskalerer til trykk-oppløsning, beholder annotasjons-skarphet.
 */
export async function komprimerBilde(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .flatten({ background: "#ffffff" })
    .resize({ width: MAKS_KANT, height: MAKS_KANT, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_KVALITET })
    .toBuffer();
}

export interface InlineResultat {
  /** url → data:image/jpeg;base64,… for bilder som kom med. */
  dataUrl: Map<string, string>;
  /** url-er (filnavn) som IKKE kom med (henting/komprimering feilet). */
  manglende: string[];
}

/**
 * Henter, komprimerer og inliner en liste bilde-url-er. `hentBytes` er injisert
 * (DI) — sammenstillingen leverer disk-lesing eller signert-URL-henting; her er
 * det avkoblet og testbart. `null`/kast → manglende.
 */
export async function inlineBilder(
  hentBytes: (url: string) => Promise<Buffer | null>,
  urls: string[],
): Promise<InlineResultat> {
  const dataUrl = new Map<string, string>();
  const manglende: string[] = [];
  // Dedup: samme bilde kan refereres flere steder.
  for (const url of [...new Set(urls)]) {
    let bytes: Buffer | null = null;
    try {
      bytes = await hentBytes(url);
    } catch {
      bytes = null;
    }
    if (!bytes) {
      manglende.push(url);
      continue;
    }
    try {
      const jpg = await komprimerBilde(bytes);
      dataUrl.set(url, `data:image/jpeg;base64,${jpg.toString("base64")}`);
    } catch {
      manglende.push(url);
    }
  }
  return { dataUrl, manglende };
}
