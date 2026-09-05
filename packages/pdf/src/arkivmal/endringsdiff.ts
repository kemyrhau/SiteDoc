/**
 * Endringslogg — lesbar diff-transform (RENT LAG). Gjør én rå feltendring
 * (`oldValue`/`newValue` = JSON-strenger) om til de radene en leser faktisk
 * forstår:
 *
 *  - Repeater-endring (array av rad-objekter): ekspanderes til ÉN rad per
 *    endret celle — «Rad 3 — Kommentar: X → Y» (vedtak 2026-08-16). Rader som
 *    er lagt til/fjernet gir ÉN oppsummeringslinje hver («Rad 4 (lagt til) —
 *    3 bilder»), ikke per-celle — ellers eksploderer en nyfylt 5-rads repeater
 *    til femten rader (uinformativ → informativ støy).
 *  - Bilde-/vedleggsverdi: «N bilder (filnavn …)». Filnavn BEHOLDES i loggen
 *    (motsatt utskriften) — der er filnavnet ofte eneste identifikator (punkt 3).
 *  - Primitiv verdi: ren tekst (JSON-anførselstegn strippet).
 *  - Kanonisk no-op: like verdier med ulik nøkkelrekkefølge gir ingen rad
 *    (punkt 1, render-siden — rydder allerede lagrede vær-rader i BEF-001).
 */

import { kanonisk, harMeningsfullLabel } from "../hjelpere";
import { feltKartFraRad } from "./repeaterRad";
import type { Segment } from "./typer";

export type { Segment };

/** Kolonne i en repeater: barn-objektets id → menneskevennlig label. */
export interface KolonneDef {
  id: string;
  label: string;
  /** Felttypens standardnavn (fra kallerens resolver) — fallback når `label` er tom. */
  standardNavn?: string | null;
}

/**
 * Én ekspandert endringsrad før tidspunkt/aktør påføres av combineren.
 * Verdiene er SEGMENTER (uendret/endret), ikke ferdig HTML — hver flate
 * (arkiv-PDF, web) rendrer markeringen på sin måte (`<strong>` rundt endrede
 * ord). Pakken returnerer aldri HTML til web.
 */
export interface DiffRad {
  felt: string;
  fraVerdi: Segment[] | null;
  tilVerdi: Segment[] | null;
}

/** Segmenter → ren tekst (plukker ut ordene uten markering — for tekst/tester). */
export function segmenterTilTekst(segs: Segment[] | null): string | null {
  return segs == null ? null : segs.map((s) => s.tekst).join("");
}

/** Minimal tre-node for kolonne-utledning (strukturell — unngår shared-avhengighet). */
interface TreNode {
  id: string;
  label: string;
  type?: string;
  children?: TreNode[];
}

/**
 * Kolonne-labels per felt-id fra objekt-treet: for hvert objekt med barn
 * (repeater) → `{ id, label }[]`. Delt av api-sammenstillingen og web-
 * endringsloggen så begge gjør repeater-celle-endringer om til «Rad N —
 * kolonnenavn» i stedet for barn-UUID. Rent lag; kalleren bygger treet
 * (`byggObjektTre`) og sender det inn.
 */
export function byggKolonnerPerFelt(
  tre: TreNode[],
  // Injisert resolver felttype→standardnavn (shared `standardFeltNavn`). Utelates i
  // pdf-interne tester; da faller tomme labels tilbake på «Kolonne N» som før.
  standardNavn?: (type: string) => string | null,
): Record<string, KolonneDef[]> {
  const kart: Record<string, KolonneDef[]> = {};
  const walk = (noder: TreNode[]): void => {
    for (const n of noder) {
      const barn = n.children ?? [];
      if (barn.length > 0) {
        kart[n.id] = barn.map((b) => ({
          id: b.id,
          label: b.label,
          standardNavn: b.type && standardNavn ? standardNavn(b.type) : null,
        }));
        walk(barn);
      }
    }
  };
  walk(tre);
  return kart;
}

/** Maks antall filnavn som listes før «+N flere» (holder radene lesbare). */
const MAKS_FILNAVN = 4;

/**
 * Fjerner ikke-brukerinnhold før sammenligning, slik at «likt som informasjon»
 * teller som likt selv når strengen skiller seg:
 *
 *  1. **Signert-URL-query** på vedlegg (`?exp=&sig=`) varierer per lagring — samme
 *     bilde, ulik streng — fordi klienten returnerer det den ble servert (signert).
 *     Uten dette teller hver auto-vær-lagring de urørte repeater-bildene som «endret».
 *  2. **Tomhet** (`null` · `""` · `[]` · `{}` · manglende nøkkel) kollapses til
 *     fraværende. En tom celle skifter form mellom autolagringer (`{verdi:""}` ↔
 *     `{}` ↔ nøkkel-fraværende ↔ `{verdi:null}`); uten dette regnes tom→tom som en
 *     endring og loggen spammes med «Rad N — Kolonne M til «Ikke utfylt»». Samme
 *     tomhets-definisjon som `harFaktiskInnholdForObjekt` (mal.ts). Reell tømming
 *     («Ja»→tom) består som endring: en ikke-tom verdi kollapser ikke.
 *
 * 🔴 Array-LENGDE og -rekkefølge BEVARES — repeater-rad-identitet er
 * betydningsbærende. Vi kollapser tomhet i element-INNHOLD, aldri ved å fjerne
 * elementer (ellers forskyves «Rad 3» til «Rad 2» og loggen lyver).
 *
 * Brukes KUN til sammenligning (`likForDiff`) — visning og lagret verdi er uendret.
 */
export function normaliserForDiff(v: unknown): unknown {
  if (v == null) return undefined; // null → fraværende
  if (typeof v === "string") return v === "" ? undefined : v; // "" → fraværende
  if (Array.isArray(v)) {
    if (v.length === 0) return undefined; // [] → fraværende
    // Lengde/rekkefølge bevares: map, aldri filtrer. Tomt element → undefined
    // (blir `null` i kanonisk JSON) → to tomme rader er fortsatt like.
    return v.map(normaliserForDiff);
  }
  if (typeof v === "object") {
    const ut: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const rå = k === "url" && typeof x === "string" ? x.split("?")[0] : x;
      const nx = normaliserForDiff(rå);
      if (nx !== undefined) ut[k] = nx; // dropp tomme nøkler
    }
    return Object.keys(ut).length === 0 ? undefined : ut; // {} → fraværende
  }
  return v;
}

/** Sanne verdier som er like ETTER normalisering (nøkkelrekkefølge + signatur). */
export function likForDiff(a: unknown, b: unknown): boolean {
  return kanonisk(normaliserForDiff(a)) === kanonisk(normaliserForDiff(b));
}

/** JSON-parse med rå-streng-fallback ved ugyldig JSON; tom/null → undefined. */
function tolk(str: string | null | undefined): unknown {
  if (str == null) return undefined;
  const t = str.trim();
  if (t === "") return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return str;
  }
}

function erBildeObjekt(v: unknown): v is { url?: string; type?: string; filnavn?: string } {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as { url?: unknown; type?: unknown; filnavn?: unknown };
  const filnavn = typeof o.filnavn === "string" ? o.filnavn : "";
  return typeof o.url === "string" && (o.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(filnavn));
}

function erObjekt(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Array av rad-objekter (repeater) — IKKE et bilde-array (attachments). */
function erRepeater(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every(erObjekt) && !v.every(erBildeObjekt);
}

/** Teller bilde-objekter rekursivt (celle-verdi og nestet vedlegg). */
function tellBilder(v: unknown): number {
  let n = 0;
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) {
      for (const y of x) walk(y);
    } else if (x != null && typeof x === "object") {
      if (erBildeObjekt(x)) n++;
      else for (const y of Object.values(x)) walk(y);
    }
  };
  walk(v);
  return n;
}

/** «N bilder (filnavn1, filnavn2 …)» — filnavn beholdt (punkt 3). */
function bildeSammendrag(bilder: unknown[]): string {
  const n = bilder.length;
  const tekst = `${n} bilde${n === 1 ? "" : "r"}`;
  const navn = bilder
    .map((b) => (erBildeObjekt(b) && typeof b.filnavn === "string" ? b.filnavn : ""))
    .filter(Boolean);
  if (navn.length === 0) return tekst;
  const vist = navn.slice(0, MAKS_FILNAVN);
  const rest = navn.length - vist.length;
  return `${tekst} (${vist.join(", ")}${rest > 0 ? `, +${rest} flere` : ""})`;
}

/** Prosent på norsk form med én desimal: 75.17 → «75,2 %» (speiler cellrenderen). */
function prosent(n: number): string {
  return `${n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Bar UUID (v1–5). En rå id er en maskinreferanse, aldri menneskelesbart innhold. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** En rå verdi → lesbar streng. Null/tom → null («Ikke utfylt» ved render). */
function lesbarVerdi(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    // Funn 3: historiske tegningsfelt lagret verdien som bar drawingId-streng (uten
    // navn/koordinat). En rå UUID skal ALDRI stå i et kvalitetsdokument — den ser ut
    // som informasjon, men er støy ingen kan lese. Ny data lagrer {drawingId,pos,navn}
    // og vises korrekt over. Transformen kan ikke slå opp navnet (avhengighetsfri),
    // så vi er ærlige: vi vet det er en tegningsreferanse, ikke hvilken.
    if (UUID_RE.test(t)) return "(tegningsreferanse)";
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    if (v.every(erBildeObjekt)) return bildeSammendrag(v);
    if (v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ");
    // Array av rad-objekter uten kolonne-kontekst (fallback) → antall.
    return `${v.length} rad${v.length === 1 ? "" : "er"}`;
  }
  // Funn 3 (2026-08-21): drawing_position-markør {drawingId,positionX,positionY,
  // drawingName}. Uten denne casen traff markøren «ukjent objekt → null»-
  // fallbacken → ekte posisjonsendringer viste «Ikke utfylt → Ikke utfylt» i
  // endringsloggen. Identiske markører filtreres alt av rå-sammenligningen;
  // dette gjør ULIKE lesbare. Koordinat vises her (endringslogg, ikke innhold).
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.drawingId === "string" && typeof o.positionX === "number" && typeof o.positionY === "number") {
      const navn = typeof o.drawingName === "string" && o.drawingName.trim() ? o.drawingName.trim() : "Tegning";
      return `${navn} (${prosent(o.positionX)}, ${prosent(o.positionY)})`;
    }
  }
  // Ukjent objekt-struktur → skjul rå struktur (aldri UUID/uploads-sti i loggen).
  return null;
}

/** En repeater-CELLE ({verdi, kommentar, vedlegg} el. rå verdi) → lesbar streng. */
function lesbarCelle(celle: unknown): string | null {
  if (celle == null) return null;
  if (typeof celle !== "object" || Array.isArray(celle)) return lesbarVerdi(celle);
  const o = celle as { verdi?: unknown; kommentar?: unknown; vedlegg?: unknown };
  const deler: string[] = [];
  const v = lesbarVerdi(o.verdi);
  if (v) deler.push(v);
  if (Array.isArray(o.vedlegg) && o.vedlegg.length > 0) {
    const b = lesbarVerdi(o.vedlegg);
    if (b) deler.push(b);
  }
  if (typeof o.kommentar === "string" && o.kommentar.trim()) deler.push(`merknad: ${o.kommentar.trim()}`);
  return deler.length ? deler.join(" · ") : null;
}

/** Kompakt oppsummering av en hel rad (lagt til/fjernet). */
function radSammendrag(rad: Record<string, unknown>): string {
  const celler = feltKartFraRad(rad); // produksjonsform { _radId, felter } → cellene, ellers raden selv
  const utfylte = Object.values(celler).filter((c) => lesbarCelle(c) != null).length;
  const bilder = tellBilder(celler);
  const deler: string[] = [];
  if (utfylte > 0) deler.push(`${utfylte} felt utfylt`);
  if (bilder > 0) deler.push(`${bilder} bilde${bilder === 1 ? "" : "r"}`);
  return deler.length ? deler.join(", ") : "tom rad";
}

/** Tokeniser til ord + mellomrom/skilletegn (separatorene beholdes for rekonstruksjon). */
function tokeniser(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

/** Slår sammen sammenhengende tokens med samme `endret`-flagg til ett segment. */
function byggSegmenter(tokens: string[], endret: boolean[]): Segment[] {
  const segs: Segment[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const forrige = segs[segs.length - 1];
    if (forrige && forrige.endret === endret[k]) forrige.tekst += tokens[k];
    else segs.push({ tekst: tokens[k]!, endret: endret[k]! });
  }
  return segs;
}

/**
 * Ord-nivå diff (ikke tegn-nivå): finner lengste felles delsekvens av ord og
 * markerer ord som IKKE er felles som endret. Slik uthever et endret ord i et
 * langt avsnitt seg, i stedet for at hele teksten gjentas identisk på begge
 * sider av pilen.
 */
function ordDiff(fra: string, til: string): { fra: Segment[]; til: Segment[] } {
  const a = tokeniser(fra);
  const b = tokeniser(til);
  const m = a.length;
  const n = b.length;
  // LCS-lengder (DP bakfra).
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  // Backtrack: marker felles tokens som uendret.
  const aEndret = new Array<boolean>(m).fill(true);
  const bEndret = new Array<boolean>(n).fill(true);
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      aEndret[i] = false;
      bEndret[j] = false;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return { fra: byggSegmenter(a, aEndret), til: byggSegmenter(b, bEndret) };
}

/**
 * Gjør fra/til-strenger om til segmenter. Når begge finnes gjøres ord-diff
 * (endrede ord markeres). Når bare én side finnes (lagt til / fjernet / tom →
 * utfylt) er hele verdien ny/borte — da ingen intern uthevning (konteksten
 * «Ikke utfylt → X» bærer betydningen).
 */
function tilSegmenter(fra: string | null, til: string | null): { fraVerdi: Segment[] | null; tilVerdi: Segment[] | null } {
  if (fra != null && til != null) {
    const d = ordDiff(fra, til);
    return { fraVerdi: d.fra, tilVerdi: d.til };
  }
  return {
    fraVerdi: fra != null ? [{ tekst: fra, endret: false }] : null,
    tilVerdi: til != null ? [{ tekst: til, endret: false }] : null,
  };
}

/**
 * Kolonne-label for et barn-id. Rekkefølge: egen label → felttypens standardnavn
 * (injisert resolver, f.eks. «Posisjon i tegning») → «Kolonne N» (posisjon). Aldri
 * rå barn-UUID og aldri en ren plassholder som «_» (en tom label bruker malbyggeren,
 * og `"_".trim()` er ikke tom, så trim alene fanget den ikke). En label uten noe
 * alfanumerisk tegn regnes som meningsløs. Standardnavn-fallbacken (bygg 50) erstatter
 * «Kolonne N» for repeater-barn uten label, som ellers ga byggherren «Kolonne 3».
 */
function kolonneLabel(kolonner: KolonneDef[], id: string, ordinal: number): string {
  const def = kolonner.find((k) => k.id === id);
  const label = def?.label?.trim();
  if (harMeningsfullLabel(label)) return label!;
  const std = def?.standardNavn?.trim();
  if (harMeningsfullLabel(std)) return std!;
  return `Kolonne ${ordinal}`;
}

/** Én celles innhold delt i sammenlignbare deler (verdi · bilder · merknad). */
function celleDeler(celle: unknown): { verdi: string | null; bilder: string | null; kommentar: string | null } {
  if (celle == null) return { verdi: null, bilder: null, kommentar: null };
  if (typeof celle !== "object" || Array.isArray(celle)) {
    return { verdi: lesbarVerdi(celle), bilder: null, kommentar: null };
  }
  const o = celle as { verdi?: unknown; kommentar?: unknown; vedlegg?: unknown };
  return {
    verdi: lesbarVerdi(o.verdi),
    bilder: Array.isArray(o.vedlegg) && o.vedlegg.length > 0 ? lesbarVerdi(o.vedlegg) : null,
    kommentar: typeof o.kommentar === "string" && o.kommentar.trim() ? `merknad: ${o.kommentar.trim()}` : null,
  };
}

function slåSammenDeler(d: { verdi: string | null; bilder: string | null; kommentar: string | null }): string | null {
  const deler = [d.verdi, d.bilder, d.kommentar].filter((x): x is string => x != null);
  return deler.length ? deler.join(" · ") : null;
}

/**
 * Fra/til for en endret celle — viser BARE delene som faktisk er ulike. Uten
 * dette gjentas en uendret bildeliste identisk på begge sider av pilen når bare
 * teksten endret seg. Faller tilbake til hele cellen om ingen del skiller seg
 * (skjer ikke etter `likForDiff`-filteret, men er en trygg bunn).
 */
function lesbarCelleDiff(fraCelle: unknown, tilCelle: unknown): { fra: string | null; til: string | null } {
  const df = celleDeler(fraCelle);
  const dt = celleDeler(tilCelle);
  const uf = { ...df };
  const ut = { ...dt };
  for (const nøkkel of ["verdi", "bilder", "kommentar"] as const) {
    if (df[nøkkel] === dt[nøkkel]) {
      uf[nøkkel] = null;
      ut[nøkkel] = null;
    }
  }
  const fra = slåSammenDeler(uf);
  const til = slåSammenDeler(ut);
  if (fra == null && til == null) return { fra: lesbarCelle(fraCelle), til: lesbarCelle(tilCelle) };
  return { fra, til };
}

/**
 * Ordner nøkler etter kolonne-rekkefølgen (stabil visning); nøkler uten
 * kolonne-def kommer sist i innsettingsrekkefølge.
 */
function ordneNøkler(nøkler: Set<string>, kolonner: KolonneDef[]): string[] {
  const orden = new Map(kolonner.map((k, i) => [k.id, i]));
  return [...nøkler].sort((a, b) => {
    const ia = orden.has(a) ? orden.get(a)! : Number.MAX_SAFE_INTEGER;
    const ib = orden.has(b) ? orden.get(b)! : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
}

/** Diff to repeater-arrays → celle-rader + rad-lagt-til/fjernet-linjer. */
function diffRepeater(
  fra: Record<string, unknown>[],
  til: Record<string, unknown>[],
  kolonner: KolonneDef[],
): DiffRad[] {
  const ut: DiffRad[] = [];
  const maks = Math.max(fra.length, til.length);
  for (let i = 0; i < maks; i++) {
    const fRad = fra[i];
    const tRad = til[i];
    const nr = i + 1;
    if (fRad === undefined && tRad !== undefined) {
      ut.push({ felt: `Rad ${nr} (lagt til)`, ...tilSegmenter(null, radSammendrag(tRad)) });
      continue;
    }
    if (fRad !== undefined && tRad === undefined) {
      ut.push({ felt: `Rad ${nr} (fjernet)`, ...tilSegmenter(radSammendrag(fRad), null) });
      continue;
    }
    if (fRad === undefined || tRad === undefined) continue;
    // Produksjonsform: cellene bor i `.felter` ({ _radId, felter }), ikke på raden.
    // Uten uttrekket ble nøklene «_radId»/«felter» → «Kolonne 2» + tom celle-diff.
    const fCeller = feltKartFraRad(fRad);
    const tCeller = feltKartFraRad(tRad);
    const nøkler = new Set([...Object.keys(fCeller), ...Object.keys(tCeller)]);
    ordneNøkler(nøkler, kolonner).forEach((k, ki) => {
      if (likForDiff(fCeller[k], tCeller[k])) return; // uendret celle (etter normalisering)
      const diff = lesbarCelleDiff(fCeller[k], tCeller[k]);
      ut.push({
        felt: `Rad ${nr} — ${kolonneLabel(kolonner, k, ki + 1)}`,
        ...tilSegmenter(diff.fra, diff.til),
      });
    });
  }
  return ut;
}

/**
 * Ekspanderer én rå feltendring til lesbare rader. `feltLabel` er den lagrede
 * `fieldLabel` (brukes for ikke-repeater-endringer; repeater-rader får
 * «Rad N — kolonne»). `kolonner` er repeaterens barn-kolonner (tom for
 * ikke-repeater). Returnerer `[]` når endringen er en kanonisk no-op.
 */
export function ekspanderEndring(
  feltLabel: string,
  fraVerdi: string | null,
  tilVerdi: string | null,
  kolonner: KolonneDef[] = [],
): DiffRad[] {
  const fra = tolk(fraVerdi);
  const til = tolk(tilVerdi);

  if (erRepeater(fra) || erRepeater(til)) {
    return diffRepeater(erRepeater(fra) ? fra : [], erRepeater(til) ? til : [], kolonner);
  }

  // Ikke-repeater: normalisert sammenligning fanger nøkkelrekkefølge- + signatur-no-ops.
  if (likForDiff(fra, til)) return [];
  const f = lesbarVerdi(fra);
  const t = lesbarVerdi(til);
  if (f === t) return []; // lesbar ekvivalens (ekstra sikring)
  return [{ felt: feltLabel, ...tilSegmenter(f, t) }];
}
