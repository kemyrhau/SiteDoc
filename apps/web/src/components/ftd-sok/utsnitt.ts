/**
 * Utsnitt til venstre i dokumentsøket (SØK-1 S2/S5, dokumentsok-visning-spec § 3). ÉN funksjon for
 * begge moduser (AI-søk og Tekstsøk), så utsnittet alltid er et vindu rundt treffet med «…» der det er kuttet.
 *
 * Prioritet:
 *  1. Rent semantisk treff → vindu rundt `semantiskSetning` (S5, egen stil — ikke gult). Mangler den:
 *     starten av chunken uten markering.
 *  2. Server-headline (ts_headline-sentinler, norsk stemming) → den, med «…» der den er kuttet.
 *  3. Første forekomst av et søkeord → vindu på ca. 32 ord rundt den, søkeord markert.
 *  4. Starten av chunken (240 tegn) + «…».
 *
 * `sectionTitle` vises som etikett, så den fjernes fra starten av utsnittet når chunken begynner med den.
 */

// Må matche HL_START/HL_STOP i apps/api/src/services/ai-sok-service.ts (ts_headline-sentinler).
export const HL_START = "❰HL❱";
export const HL_STOP = "❰/HL❱";

export const ELLIPSE = "…";

/** Felles stil for semantisk markering (S5) — skal ikke forveksles med gult ordtreff. */
export const SEMANTISK_KLASSE =
  "rounded bg-purple-50 underline decoration-purple-500 decoration-dotted decoration-2 underline-offset-2";
const VINDU_ORD = 32;
const ORD_FØR = 10;
const MAKS_TEGN_UTEN_TREFF = 240;

export type UtsnittDelType = "vanlig" | "treff" | "semantisk";
export interface UtsnittDel {
  tekst: string;
  type: UtsnittDelType;
}

export interface UtsnittInput {
  chunkText: string;
  søkeord: string;
  utdrag?: string | null;
  semantiskSetning?: string | null;
  sectionTitle?: string | null;
  metode?: "tekst" | "semantisk" | "begge";
}

/** Søketermer slik klient-highlight alltid har tolket dem: ord > 2 tegn, små bokstaver. */
export function søkeTermer(søkeord: string): string[] {
  return søkeord
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normWs = (s: string) => s.replace(/\s+/g, " ").trim();

/** Del tekst i vanlig/treff etter søketermer (case-insensitivt). */
export function markerTermer(tekst: string, termer: string[]): UtsnittDel[] {
  if (termer.length === 0 || tekst.length === 0) return tekst ? [{ tekst, type: "vanlig" }] : [];
  const regex = new RegExp(`(${termer.map(esc).join("|")})`, "gi");
  return tekst
    .split(regex)
    .filter((d) => d.length > 0)
    .map((d) => ({ tekst: d, type: termer.includes(d.toLowerCase()) ? "treff" : "vanlig" }));
}

/** Fjern `sectionTitle` (+ etterfølgende skilletegn/mellomrom) fra starten av teksten. */
export function fjernOverskrift(tekst: string, sectionTitle?: string | null): string {
  if (!sectionTitle) return tekst;
  const tittel = sectionTitle.trim();
  const trimmet = tekst.trimStart();
  if (!tittel || !trimmet.toLowerCase().startsWith(tittel.toLowerCase())) return tekst;
  return trimmet.slice(tittel.length).replace(/^[\s:.\-–—]+/, "");
}

/** Klipp `tekst` til et vindu på ca. VINDU_ORD ord rundt tegnposisjonen [fokusStart, fokusSlutt). */
function vinduRundt(tekst: string, fokusStart: number, fokusSlutt: number) {
  const ord = [...tekst.matchAll(/\S+/g)].map((m) => ({ start: m.index!, slutt: m.index! + m[0].length }));
  if (ord.length <= VINDU_ORD) return { start: 0, slutt: tekst.length, før: false, etter: false };
  let fokusOrd = ord.findIndex((o) => o.slutt > fokusStart);
  if (fokusOrd < 0) fokusOrd = 0;
  let sisteFokusOrd = ord.findIndex((o) => o.slutt >= fokusSlutt);
  if (sisteFokusOrd < 0) sisteFokusOrd = ord.length - 1;
  let fra = Math.max(0, fokusOrd - ORD_FØR);
  let til = Math.min(ord.length, Math.max(fra + VINDU_ORD, sisteFokusOrd + 1));
  if (til - fra < VINDU_ORD) fra = Math.max(0, til - VINDU_ORD);
  til = Math.min(ord.length, til);
  return {
    start: fra === 0 ? 0 : ord[fra]!.start,
    slutt: til === ord.length ? tekst.length : ord[til - 1]!.slutt,
    før: fra > 0,
    etter: til < ord.length,
  };
}

function medEllipse(deler: UtsnittDel[], før: boolean, etter: boolean): UtsnittDel[] {
  const ut = [...deler];
  if (før) ut.unshift({ tekst: `${ELLIPSE} `, type: "vanlig" });
  if (etter) ut.push({ tekst: ` ${ELLIPSE}`, type: "vanlig" });
  return ut;
}

/** Parse ts_headline-sentinler til deler. */
function parseHeadline(utdrag: string): UtsnittDel[] {
  const deler = utdrag.split(new RegExp(`(${esc(HL_START)}|${esc(HL_STOP)})`));
  const ut: UtsnittDel[] = [];
  let inne = false;
  for (const d of deler) {
    if (d === HL_START) inne = true;
    else if (d === HL_STOP) inne = false;
    else if (d) ut.push({ tekst: d, type: inne ? "treff" : "vanlig" });
  }
  return ut;
}

/** Fjern de første `antall` tegnene fra delene (overskrift som står først i headline). */
function kappStart(deler: UtsnittDel[], antall: number): UtsnittDel[] {
  const ut: UtsnittDel[] = [];
  let rest = antall;
  for (const d of deler) {
    if (rest >= d.tekst.length) {
      rest -= d.tekst.length;
      continue;
    }
    ut.push({ ...d, tekst: d.tekst.slice(rest) });
    rest = 0;
  }
  return ut;
}

export function byggUtsnitt(input: UtsnittInput): UtsnittDel[] {
  const tekst = fjernOverskrift(input.chunkText, input.sectionTitle);
  const termer = søkeTermer(input.søkeord);

  // 1. Rent semantisk treff: setningen forklarer treffet (S5). Ingen gul markering.
  if (input.metode === "semantisk") {
    // Setningen er funnet i rå chunk-tekst; står overskriften først i den, er den kappet her.
    const setning = input.semantiskSetning
      ? tekst.includes(input.semantiskSetning)
        ? input.semantiskSetning
        : fjernOverskrift(input.semantiskSetning, input.sectionTitle)
      : null;
    const pos = setning ? tekst.indexOf(setning) : -1;
    if (setning && pos >= 0) {
      const v = vinduRundt(tekst, pos, pos + setning.length);
      const sStart = Math.max(pos, v.start);
      const sSlutt = Math.min(pos + setning.length, v.slutt);
      const deler: UtsnittDel[] = [
        { tekst: tekst.slice(v.start, sStart), type: "vanlig" },
        { tekst: tekst.slice(sStart, sSlutt), type: "semantisk" },
        { tekst: tekst.slice(sSlutt, v.slutt), type: "vanlig" },
      ].filter((d) => d.tekst.length > 0) as UtsnittDel[];
      return medEllipse(deler, v.før, v.etter);
    }
    return startAvTekst(tekst, []);
  }

  // 2. Server-headline (Tekstsøk og AI-treff med ordtreff).
  if (input.utdrag && input.utdrag.includes(HL_START)) {
    let deler = parseHeadline(input.utdrag);
    let ren = deler.map((d) => d.tekst).join("");
    const tittel = input.sectionTitle?.trim();
    if (tittel && ren.trimStart().toLowerCase().startsWith(tittel.toLowerCase())) {
      const kapp = ren.length - fjernOverskrift(ren, tittel).length;
      deler = kappStart(deler, kapp);
      ren = deler.map((d) => d.tekst).join("");
    }
    const nTekst = normWs(tekst);
    const nRen = normWs(ren);
    return medEllipse(deler, !nTekst.startsWith(nRen), !nTekst.endsWith(nRen));
  }

  // 3. Første forekomst av et søkeord.
  if (termer.length > 0) {
    const m = new RegExp(termer.map(esc).join("|"), "i").exec(tekst);
    if (m) {
      const v = vinduRundt(tekst, m.index, m.index + m[0].length);
      return medEllipse(markerTermer(tekst.slice(v.start, v.slutt), termer), v.før, v.etter);
    }
  }

  // 4. Ingen treff i teksten.
  return startAvTekst(tekst, termer);
}

function startAvTekst(tekst: string, termer: string[]): UtsnittDel[] {
  if (tekst.length <= MAKS_TEGN_UTEN_TREFF) return markerTermer(tekst, termer);
  const kutt = tekst.slice(0, MAKS_TEGN_UTEN_TREFF);
  const vedOrd = kutt.lastIndexOf(" ");
  return medEllipse(markerTermer(vedOrd > 0 ? kutt.slice(0, vedOrd) : kutt, termer), false, true);
}

/** Posisjonsetikett: «side N» når sidetall finnes, ellers «avsnitt N». Aldri begge (S2, T4). */
export function posisjonsEtikett(
  pageNumber: number | null | undefined,
  chunkIndex: number | null | undefined,
): { type: "side"; nr: number } | { type: "avsnitt"; nr: number } | null {
  if (pageNumber != null && pageNumber > 0) return { type: "side", nr: pageNumber };
  if (chunkIndex != null) return { type: "avsnitt", nr: chunkIndex + 1 };
  return null;
}
