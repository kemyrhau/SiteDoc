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

import { kanonisk } from "../hjelpere";

/** Kolonne i en repeater: barn-objektets id → menneskevennlig label. */
export interface KolonneDef {
  id: string;
  label: string;
}

/** Én ekspandert endringsrad før tidspunkt/aktør påføres av combineren. */
export interface DiffRad {
  felt: string;
  fraVerdi: string | null;
  tilVerdi: string | null;
}

/** Maks antall filnavn som listes før «+N flere» (holder radene lesbare). */
const MAKS_FILNAVN = 4;

/**
 * Fjerner ikke-brukerinnhold før sammenligning: query-parametre på vedlegg-URL.
 * En signert URL (`?exp=&sig=`) varierer per lagring — samme bilde, ulik streng —
 * fordi klienten returnerer det den ble servert (signert). Uten dette teller hver
 * auto-vær-lagring de urørte repeater-bildene som «endret». Samme klasse som
 * nøkkelsorteringen: ulikt som streng, likt som informasjon.
 *
 * Interne tidsstempel-felt legges til her etter måling (Spørring 4).
 * Brukes KUN til sammenligning — visning og lagret verdi er uendret.
 */
export function normaliserForDiff(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normaliserForDiff);
  if (v != null && typeof v === "object") {
    const ut: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      ut[k] = k === "url" && typeof x === "string" ? x.split("?")[0] : normaliserForDiff(x);
    }
    return ut;
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

/** En rå verdi → lesbar streng. Null/tom → null («Ikke utfylt» ved render). */
function lesbarVerdi(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    if (v.every(erBildeObjekt)) return bildeSammendrag(v);
    if (v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ");
    // Array av rad-objekter uten kolonne-kontekst (fallback) → antall.
    return `${v.length} rad${v.length === 1 ? "" : "er"}`;
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
  const utfylte = Object.values(rad).filter((c) => lesbarCelle(c) != null).length;
  const bilder = tellBilder(rad);
  const deler: string[] = [];
  if (utfylte > 0) deler.push(`${utfylte} felt utfylt`);
  if (bilder > 0) deler.push(`${bilder} bilde${bilder === 1 ? "" : "r"}`);
  return deler.length ? deler.join(", ") : "tom rad";
}

/** Kolonne-label for et barn-id; faller tilbake til id-en når ukjent. */
function kolonneLabel(kolonner: KolonneDef[], id: string): string {
  return kolonner.find((k) => k.id === id)?.label ?? id;
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
      ut.push({ felt: `Rad ${nr} (lagt til)`, fraVerdi: null, tilVerdi: radSammendrag(tRad) });
      continue;
    }
    if (fRad !== undefined && tRad === undefined) {
      ut.push({ felt: `Rad ${nr} (fjernet)`, fraVerdi: radSammendrag(fRad), tilVerdi: null });
      continue;
    }
    if (fRad === undefined || tRad === undefined) continue;
    const nøkler = new Set([...Object.keys(fRad), ...Object.keys(tRad)]);
    for (const k of ordneNøkler(nøkler, kolonner)) {
      if (likForDiff(fRad[k], tRad[k])) continue; // uendret celle (etter normalisering)
      ut.push({
        felt: `Rad ${nr} — ${kolonneLabel(kolonner, k)}`,
        fraVerdi: lesbarCelle(fRad[k]),
        tilVerdi: lesbarCelle(tRad[k]),
      });
    }
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
  return [{ felt: feltLabel, fraVerdi: f, tilVerdi: t }];
}
