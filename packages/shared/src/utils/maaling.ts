/**
 * Måling i tegning — utledet, selvvaliderende geometri.
 *
 * Prinsippet (ordre «måling i tegning», 2026-09-24): mm pr. piksel utledes av
 * MÅLTE fakta — papirbredde (pdfinfo) ÷ pikselbredde (sharp) — ALDRI av en
 * DPI-konstant. Endres DPI-flagget (apps/api/src/routes/tegning.ts) eller
 * skaleres bildet et sted, holder utledningen likevel: begge sidene av brøken
 * flytter seg i takt. Samme prinsipp som georeferanse-notatet: utled fra det
 * eksakte, ikke degradér til en antakelse.
 */

/** Punkt i prosent (0–100) av vist bilde — samme koordinatrom som tegningsmarkører. */
export type Punkt = { x: number; y: number };

/** Kjente kilder til en tegnings målestokk. */
export type ScaleKilde = "tittelfelt" | "manuell" | "kalibrert" | "georeferanse";

/**
 * mm pr. piksel PÅ PAPIRET = papirbredde (mm) ÷ pikselbredde.
 * Selvvaliderende: ved 200 DPI blir dette 25,4/200 = 0,127, men ved enhver
 * annen DPI eller bildeskalering gir formelen fortsatt riktig verdi, fordi
 * pikselbredden endres i takt med DPI-en.
 */
export function utledMmPrPiksel(papirbreddeMm: number, imageWidthPx: number): number {
  return papirbreddeMm / imageWidthPx;
}

/** "1:50" → 50. Tom/ugyldig → null. */
export function parseMalestokk(scale: string | null | undefined): number | null {
  if (!scale) return null;
  const raw = scale.match(/^\s*1\s*:\s*(\d+)\s*$/)?.[1];
  if (raw === undefined) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ord som innleder en målestokk i et tittelfelt. */
const MALESTOKK_ANKER = /\b(målestokk|mål|scale)\b/i;

/**
 * Målestokk fra tittelfelt-tekst (pdftotext). Søker verdien som FØLGER
 * «Mål»/«Målestokk»/«Scale» — IKKE løst `1:\d+`. En tegning inneholder flere
 * `1:NN` (detaljsnitt har egne målestokker), og teksten bærer koder som
 * `IV11_EI60/37dB`; et løst grep treffer feil og gjør det selvsikkert.
 *
 * pdftotext legger ofte etiketten («Mål:») og verdien («1:50») på ulike
 * linjer fordi tittelfeltet er tabellert — derfor søkes et lite vindu etter
 * ankeret, ikke bare samme linje. Returnerer normalisert "1:NN" eller null.
 */
export function finnMalestokkFraTekst(tekst: string): string | null {
  if (!tekst) return null;
  const linjer = tekst.split(/\r?\n/);
  for (let i = 0; i < linjer.length; i++) {
    const linje = linjer[i];
    if (linje === undefined || !MALESTOKK_ANKER.test(linje)) continue;
    const slutt = Math.min(i + 5, linjer.length - 1);
    for (let j = i; j <= slutt; j++) {
      const nn = linjer[j]?.match(/\b1\s*:\s*(\d+)\b/)?.[1];
      if (nn !== undefined) return `1:${nn}`;
    }
  }
  return null;
}

/**
 * KUN for negativ kontroll / demonstrasjon: løst grep som treffer det første
 * tall-par-mønsteret uansett kontekst. På en ekte tegning treffer dette
 * brannklasse-koden (`EI60/37dB` → «60/37») lenge før den ekte målestokken.
 * Aldri brukt til faktisk uttrekk — finnMalestokkFraTekst er den ekte veien.
 */
export function loesGrepMalestokk(tekst: string): string | null {
  const m = tekst.match(/\d+[:/]\s?\d+/);
  return m ? m[0] : null;
}

/** Pikselavstand mellom to prosent-punkter, gitt bildets pikseldimensjoner. */
export function pikselAvstand(a: Punkt, b: Punkt, imageWidth: number, imageHeight: number): number {
  const dx = ((b.x - a.x) / 100) * imageWidth;
  const dy = ((b.y - a.y) / 100) * imageHeight;
  return Math.hypot(dx, dy);
}

/**
 * Virkelig lengde (mm) mellom to prosent-punkter via papir-målestokk:
 *   pikselavstand × mmPrPiksel (papir) × målestokk-nevner.
 */
export function malMm(
  a: Punkt,
  b: Punkt,
  imageWidth: number,
  imageHeight: number,
  mmPrPiksel: number,
  malestokkNevner: number,
): number {
  return pikselAvstand(a, b, imageWidth, imageHeight) * mmPrPiksel * malestokkNevner;
}

/** Sum av virkelig lengde (mm) langs en polylinje av prosent-punkter. */
export function malPolylinjeMm(
  punkter: Punkt[],
  imageWidth: number,
  imageHeight: number,
  mmPrPiksel: number,
  malestokkNevner: number,
): number {
  let sum = 0;
  for (let i = 1; i < punkter.length; i++) {
    const a = punkter[i - 1];
    const b = punkter[i];
    if (a === undefined || b === undefined) continue;
    sum += malMm(a, b, imageWidth, imageHeight, mmPrPiksel, malestokkNevner);
  }
  return sum;
}

/**
 * Kan måleverktøyet (papir-veien) være aktivt? Krever utledet mm/piksel OG en
 * kjent, MENNESKE-BEKREFTET målestokk. En ubekreftet «tittelfelt»-verdi er et
 * FORSLAG, ikke en målestokk — verktøyet er avslått til et menneske har
 * bekreftet den. Georeferanse-veien håndteres separat (den måler bakken, ikke
 * papiret, og tåler at tegningen er strukket).
 *
 * 🔴 Invariant (ordre § 4): verktøyet skal ALDRI være aktivt med null
 * målestokk. Testen `maaling.test.ts` feiler hvis dette brytes.
 */
export function kanMale(
  scale: string | null | undefined,
  mmPrPiksel: number | null | undefined,
  scaleKilde: string | null | undefined,
): boolean {
  if (mmPrPiksel == null || !Number.isFinite(mmPrPiksel) || mmPrPiksel <= 0) return false;
  if (parseMalestokk(scale) == null) return false;
  return scaleKilde === "manuell" || scaleKilde === "kalibrert" || scaleKilde === "georeferanse";
}

/**
 * Kalibrering (fallback): bruker trekker en linje mellom to punkter og oppgir
 * virkelig lengde (mm) → regner ut målestokk-nevneren. Nødvendig for skannede
 * tegninger der papirmålestokken lyver fordi skanneren har strukket bildet.
 * Returnerer nevner eller null ved ugyldig inndata.
 */
export function kalibrerMalestokk(
  a: Punkt,
  b: Punkt,
  imageWidth: number,
  imageHeight: number,
  mmPrPiksel: number,
  virkeligMm: number,
): number | null {
  const papirMm = pikselAvstand(a, b, imageWidth, imageHeight) * mmPrPiksel;
  if (papirMm <= 0 || virkeligMm <= 0) return null;
  return virkeligMm / papirMm;
}
