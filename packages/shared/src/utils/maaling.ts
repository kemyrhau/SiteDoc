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

/**
 * Kjente kilder til en tegnings målestokk. `"dwg"` (DWG-2, D5): utledet rett fra
 * tegningens egne enheter ($INSUNITS) ved konvertering — måling er aktiv direkte
 * (Kenneth Q4 2026-10-08), uten et bekreftelsessteg. Kalibrering kan alltid
 * overstyre den (→ `"kalibrert"`).
 */
export type ScaleKilde = "tittelfelt" | "manuell" | "kalibrert" | "georeferanse" | "dwg";

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
 * Virkelig areal (mm²) av et lukket polygon av prosent-punkter, via papir-
 * målestokk. Shoelace-formelen på PIKSEL-koordinater (prosent → piksel med
 * bildets faktiske bredde/høyde, slik `pikselAvstand` gjør — sideforholdet er
 * dermed korrekt ivaretatt), deretter skalert til virkelig areal med
 * `(mmPrPiksel · målestokk-nevner)²`.
 *
 * Punktene behandles som en lukket ring (siste → første). < 3 punkter → 0.
 * Robust mot klikk-rekkefølge (bruker absoluttverdien av det signerte arealet).
 */
export function malArealMm2(
  punkter: Punkt[],
  imageWidth: number,
  imageHeight: number,
  mmPrPiksel: number,
  malestokkNevner: number,
): number {
  if (punkter.length < 3) return 0;
  // Prosent → piksel (samme omregning som pikselAvstand).
  const px = punkter.map((p) => ({ x: (p.x / 100) * imageWidth, y: (p.y / 100) * imageHeight }));
  let sum = 0;
  for (let i = 0; i < px.length; i++) {
    const a = px[i]!;
    const b = px[(i + 1) % px.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  const arealPiksel = Math.abs(sum) / 2;
  const mmPrPikselVirkelig = mmPrPiksel * malestokkNevner;
  return arealPiksel * mmPrPikselVirkelig * mmPrPikselVirkelig;
}

/**
 * Kan måleverktøyet (papir-veien) være aktivt? Krever utledet mm/piksel OG en
 * tolkbar målestokk med en KJENT kilde.
 *
 * 🟢 Kenneth-vedtak 2026-10-07 («vis 1:50 → da skal de fungere → kalibrering
 * skal være en mulighet dersom 1:50 oppdages som feil»): et tittelfelt-forslag
 * er nå gyldig for måling med én gang — målestokken som VISES skal kunne brukes
 * uten et ekstra bekreftelsessteg. Kalibrering er korreksjonen dersom verdien er
 * feil (lagrer `kalibrert`), ikke en forutsetning. Georeferanse-veien håndteres
 * separat (den måler bakken, ikke papiret, og tåler at tegningen er strukket).
 * Kilden skal alltid vises ved måleresultatet, så brukeren ser hva målet bygger
 * på («1:50 (fra tittelfeltet)» osv.).
 *
 * 🔴 Invariant: verktøyet skal ALDRI være aktivt uten tolkbar målestokk og
 * mm/piksel. En ukjent kilde (`null`) teller ikke. Testen `maaling.test.ts`
 * feiler hvis dette brytes.
 */
export function kanMale(
  scale: string | null | undefined,
  mmPrPiksel: number | null | undefined,
  scaleKilde: string | null | undefined,
): boolean {
  if (mmPrPiksel == null || !Number.isFinite(mmPrPiksel) || mmPrPiksel <= 0) return false;
  if (parseMalestokk(scale) == null) return false;
  return (
    scaleKilde === "tittelfelt" ||
    scaleKilde === "manuell" ||
    scaleKilde === "kalibrert" ||
    scaleKilde === "georeferanse" ||
    scaleKilde === "dwg"
  );
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

// =============================================================================
// 90°-lås (ortho) + snapping — delt, ren geometri (ordre «90°-lås og snapping»).
//
// Prinsippet (som resten av fila): matematikken bor HER som rene funksjoner, og
// begge flater kaller den. Web kaller direkte; mobil (`TegningsVisning.tsx`)
// kaller den i React Native på commit-veien (gest/maledrag), mens den injiserte
// WebView-JS-en SPEILER en forenklet variant kun for live lupe/hjelpelinje (som
// `lupe.ts`). Siden snap/lås er idempotente (et punkt som allerede er snappet,
// snappes til seg selv) er det trygt at speilet driver det visuelle mens den
// delte funksjonen eier det LAGREDE punktet.
//
// 🔴 Vinkler regnes i PIKSELROM, ikke prosent. Prosentrommet er strukket av
// bildets sideforhold (bredde ≠ høyde i px), så «vinkelrett» og «nærmeste
// retning» blir feil hvis de måles i prosent. Vannrett/loddrett treffer riktig
// uansett (samme prosent-y ⟺ samme piksel-y), men avgjørelsen om hvilken
// retning som er nærmest må skje i piksler.
// =============================================================================

/** Klem en prosentverdi til 0–100. */
function klem100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function tilPiksel(p: Punkt, imageWidth: number, imageHeight: number): { x: number; y: number } {
  return { x: (p.x / 100) * imageWidth, y: (p.y / 100) * imageHeight };
}

function tilProsent(px: { x: number; y: number }, imageWidth: number, imageHeight: number): Punkt {
  return { x: klem100((px.x / imageWidth) * 100), y: klem100((px.y / imageHeight) * 100) };
}

/** En referanselinje (to prosent-punkter) å låse parallelt/vinkelrett på. */
export interface Referanselinje {
  a: Punkt;
  b: Punkt;
}

/** Detaljert resultat av en 90°-lås (for hjelpelinje + «90°»-etikett). */
export interface LaasDetalj {
  /** Låst punkt (prosent). */
  punkt: Punkt;
  /** Valgt låseretning som enhetsvektor i PIKSELROM. */
  retning: { x: number; y: number };
  /** Står den valgte retningen vinkelrett på referanselinjen / forrige segment? */
  vinkelrett: boolean;
}

/**
 * Kjernen i 90°-låsen (detaljert). Projiser `kandidat` på den NÆRMESTE av de
 * tillatte retningene fra `anker`:
 *   - med `referanse`: PARALLELT eller VINKELRETT på referanselinja (løser skrå
 *     vegger uten snap til tegningsgeometri — ordre GJENOPPTA § 1),
 *   - ellers: vannrett + loddrett (tegningens akser) + vinkelrett på forrige
 *     segment (`anker − forforrige`) for segment 2+.
 * «Nærmest» = minst normalavstand fra kandidat til retningens linje gjennom
 * anker. Alt i pikselrom (prosent forvrenger vinkler).
 */
function laasDetaljer(
  anker: Punkt,
  kandidat: Punkt,
  imageWidth: number,
  imageHeight: number,
  forforrige?: Punkt | null,
  referanse?: Referanselinje | null,
): LaasDetalj {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { punkt: kandidat, retning: { x: 1, y: 0 }, vinkelrett: false };
  }
  const a = tilPiksel(anker, imageWidth, imageHeight);
  const k = tilPiksel(kandidat, imageWidth, imageHeight);
  const v = { x: k.x - a.x, y: k.y - a.y };

  // Kandidatretninger (enhet, piksel) med et «vinkelrett»-flagg hver.
  const retninger: { d: { x: number; y: number }; perp: boolean }[] = [];
  if (referanse) {
    const ra = tilPiksel(referanse.a, imageWidth, imageHeight);
    const rb = tilPiksel(referanse.b, imageWidth, imageHeight);
    const u = { x: rb.x - ra.x, y: rb.y - ra.y };
    const len = Math.hypot(u.x, u.y);
    if (len > 0) {
      const un = { x: u.x / len, y: u.y / len };
      retninger.push({ d: un, perp: false }); // parallelt med veggen
      retninger.push({ d: { x: -un.y, y: un.x }, perp: true }); // vinkelrett inn mot veggen
    }
  }
  if (retninger.length === 0) {
    retninger.push({ d: { x: 1, y: 0 }, perp: false });
    retninger.push({ d: { x: 0, y: 1 }, perp: false });
    if (forforrige) {
      const f = tilPiksel(forforrige, imageWidth, imageHeight);
      const u = { x: a.x - f.x, y: a.y - f.y };
      const len = Math.hypot(u.x, u.y);
      if (len > 0) retninger.push({ d: { x: -u.y / len, y: u.x / len }, perp: true });
    }
  }

  let best = k;
  let bestRetning = retninger[0]!.d;
  let bestPerp = false;
  let bestAvstand = Infinity;
  for (const r of retninger) {
    const dl = Math.hypot(r.d.x, r.d.y);
    if (dl === 0) continue;
    const dn = { x: r.d.x / dl, y: r.d.y / dl };
    const proj = v.x * dn.x + v.y * dn.y; // skalar-projeksjon langs retningen
    const lp = { x: a.x + proj * dn.x, y: a.y + proj * dn.y };
    const avstand = Math.hypot(k.x - lp.x, k.y - lp.y);
    if (avstand < bestAvstand) {
      bestAvstand = avstand;
      best = lp;
      bestRetning = dn;
      bestPerp = r.perp;
    }
  }
  return { punkt: tilProsent(best, imageWidth, imageHeight), retning: bestRetning, vinkelrett: bestPerp };
}

/**
 * 90°-lås (enkel) — returnerer bare det låste punktet (prosent). Tynn wrapper over
 * `laasDetaljer`; `beregnSnap` bruker den detaljerte for hjelpelinje + etikett.
 */
export function laasVinkel(
  anker: Punkt,
  kandidat: Punkt,
  imageWidth: number,
  imageHeight: number,
  forforrige?: Punkt | null,
  referanse?: Referanselinje | null,
): Punkt {
  return laasDetaljer(anker, kandidat, imageWidth, imageHeight, forforrige, referanse).punkt;
}

/**
 * Endepunktene (prosent) der en akse gjennom `anker` med pikselretning `retning`
 * treffer bildekanten [0,W]×[0,H] — til å tegne den stiplede hjelpelinja tvers
 * over tegningen (GJENOPPTA § 2). null ved degenerert input.
 */
export function aksehjelpelinje(
  anker: Punkt,
  retning: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
): [Punkt, Punkt] | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null;
  const a = tilPiksel(anker, imageWidth, imageHeight);
  const dl = Math.hypot(retning.x, retning.y);
  if (dl === 0) return null;
  const d = { x: retning.x / dl, y: retning.y / dl };
  // Finn t der a + t·d krysser hver kant; behold de to ytterste innenfor boksen.
  const ts: number[] = [];
  if (d.x !== 0) {
    ts.push((0 - a.x) / d.x, (imageWidth - a.x) / d.x);
  }
  if (d.y !== 0) {
    ts.push((0 - a.y) / d.y, (imageHeight - a.y) / d.y);
  }
  // Behold t som gir et punkt innenfor boksen (med liten margin).
  const eps = 1e-6;
  const gyldige = ts.filter((t) => {
    const x = a.x + t * d.x;
    const y = a.y + t * d.y;
    return x >= -eps && x <= imageWidth + eps && y >= -eps && y <= imageHeight + eps;
  });
  if (gyldige.length < 2) return null;
  const tMin = Math.min(...gyldige);
  const tMax = Math.max(...gyldige);
  const p1 = { x: a.x + tMin * d.x, y: a.y + tMin * d.y };
  const p2 = { x: a.x + tMax * d.x, y: a.y + tMax * d.y };
  return [tilProsent(p1, imageWidth, imageHeight), tilProsent(p2, imageWidth, imageHeight)];
}

/**
 * Snap til nærmeste punkt i `mål` innen `tolPx` SKJERMPIKSLER. Treff → det
 * eksakte målpunktet (prosent); ingen treff → null. `rectW/rectH` er tegningens
 * VISTE størrelse i px (inkl. zoom), slik at terskelen er en skjermavstand.
 */
export function snapTilPunkt(
  kandidat: Punkt,
  mål: Punkt[],
  rectW: number,
  rectH: number,
  tolPx: number,
): Punkt | null {
  if (rectW <= 0 || rectH <= 0) return null;
  const kx = (kandidat.x / 100) * rectW;
  const ky = (kandidat.y / 100) * rectH;
  let best: Punkt | null = null;
  let bestAvstand = tolPx;
  for (const m of mål) {
    const mx = (m.x / 100) * rectW;
    const my = (m.y / 100) * rectH;
    const d = Math.hypot(mx - kx, my - ky);
    if (d <= bestAvstand) {
      bestAvstand = d;
      best = m;
    }
  }
  return best;
}

export interface Hjelpelinjer {
  /** x-prosent for en loddrett hjelpelinje (kandidaten deler x med et punkt), ellers null. */
  vertikal: number | null;
  /** y-prosent for en vannrett hjelpelinje (kandidaten deler y med et punkt), ellers null. */
  horisontal: number | null;
}

/**
 * Snap til 90°-hjelpelinjer: hvis kandidatens x er innen `tolPx` av et
 * referansepunkts x, lås x til det (loddrett hjelpelinje); samme for y (vannrett
 * hjelpelinje). x og y vurderes uavhengig. Returnerer justert punkt + hvilke
 * hjelpelinjer som ble aktive (for å tegne stiplet strek). Terskel i skjerm-px.
 */
export function snapTil90Linje(
  kandidat: Punkt,
  referanser: Punkt[],
  rectW: number,
  rectH: number,
  tolPx: number,
): { punkt: Punkt; hjelpelinjer: Hjelpelinjer } {
  const resultat: Hjelpelinjer = { vertikal: null, horisontal: null };
  if (rectW <= 0 || rectH <= 0 || referanser.length === 0) {
    return { punkt: kandidat, hjelpelinjer: resultat };
  }
  let x = kandidat.x;
  let y = kandidat.y;
  let bestX = tolPx;
  let bestY = tolPx;
  for (const r of referanser) {
    const dxPx = Math.abs(((r.x - kandidat.x) / 100) * rectW);
    if (dxPx <= bestX) {
      bestX = dxPx;
      x = r.x;
      resultat.vertikal = r.x;
    }
    const dyPx = Math.abs(((r.y - kandidat.y) / 100) * rectH);
    if (dyPx <= bestY) {
      bestY = dyPx;
      y = r.y;
      resultat.horisontal = r.y;
    }
  }
  return { punkt: { x, y }, hjelpelinjer: resultat };
}

export interface SnapInn {
  /** Rått kandidatpunkt (prosent), fra skjerm→prosent. */
  kandidat: Punkt;
  /** Forrige satte punkt i den påbegynte målingen (ortho-anker). null = første punkt / dra. */
  anker: Punkt | null;
  /** Punktet før ankeret (for vinkelrett på forrige segment). */
  forforrige: Punkt | null;
  /** Alle andre punkter på tegningen (snap-mål + hjelpelinje-referanser). */
  referanser: Punkt[];
  /** Valgt referanselinje (GJENOPPTA § 1) — lås parallelt/vinkelrett på den i stedet for akser. */
  referanselinje?: Referanselinje | null;
  /** 90°-lås på? */
  ortho: boolean;
  /** Snap på? */
  snap: boolean;
  imageWidth: number;
  imageHeight: number;
  /** Vist bilde-størrelse i px (inkl. zoom) for skjerm-terskler. */
  rectW: number;
  rectH: number;
  /** Treffradius punkt-snap (px). */
  punktTolPx: number;
  /** Treffradius hjelpelinje-snap (px). */
  guideTolPx: number;
}

export interface SnapResultat {
  /** Endelig punkt (prosent) — det som skal lagres/vises. */
  punkt: Punkt;
  /** Landet eksakt på et eksisterende punkt? */
  traffPunkt: boolean;
  /** Aktive 90°-hjelpelinjer fra eksisterende punkters akser (for stiplet strek). */
  hjelpelinjer: Hjelpelinjer;
  /** Ortho-aksens stiplede hjelpelinje gjennom ankeret (to prosent-punkter), ellers null. */
  aksehjelpelinje: [Punkt, Punkt] | null;
  /** Står det tegnede segmentet vinkelrett på referanselinja / forrige segment? → «90°»-etikett. */
  vinkelrett: boolean;
}

/**
 * Full snap+lås for ETT kandidatpunkt. Presedens (bevisst valg — se leveransen):
 *   1. snap på + nær et eksisterende punkt  → eksakt det punktet (vinner alltid).
 *   2. ortho på + anker finnes (segment 2+) → lås mot akser / referanselinje, og
 *      gi den stiplede aksehjelpelinja + «vinkelrett»-flagget for etiketten.
 *   3. snap på + ortho på + INGEN anker     → snap til 90°-hjelpelinjer fra punkter.
 * Uten anker (første punkt / fri dra) gjelder (1) og (3); et låst segment (2)
 * forblir rent (ingen hjelpelinje-forskyvning som bryter låsen).
 */
export function beregnSnap(inn: SnapInn): SnapResultat {
  const tom: Hjelpelinjer = { vertikal: null, horisontal: null };

  // 1) Eksakt punkt-snap vinner.
  if (inn.snap) {
    const p = snapTilPunkt(inn.kandidat, inn.referanser, inn.rectW, inn.rectH, inn.punktTolPx);
    if (p) return { punkt: p, traffPunkt: true, hjelpelinjer: tom, aksehjelpelinje: null, vinkelrett: false };
  }

  // 2) 90°-lås mot ankeret (akser eller valgt referanselinje).
  if (inn.ortho && inn.anker) {
    const d = laasDetaljer(inn.anker, inn.kandidat, inn.imageWidth, inn.imageHeight, inn.forforrige, inn.referanselinje);
    return {
      punkt: d.punkt,
      traffPunkt: false,
      hjelpelinjer: tom,
      aksehjelpelinje: aksehjelpelinje(inn.anker, d.retning, inn.imageWidth, inn.imageHeight),
      vinkelrett: d.vinkelrett,
    };
  }

  // 3) 90°-hjelpelinjer (forlengelse av vannrett/loddrett fra eksisterende punkter).
  if (inn.snap && inn.ortho) {
    const { punkt, hjelpelinjer } = snapTil90Linje(inn.kandidat, inn.referanser, inn.rectW, inn.rectH, inn.guideTolPx);
    return { punkt, traffPunkt: false, hjelpelinjer, aksehjelpelinje: null, vinkelrett: false };
  }

  return { punkt: inn.kandidat, traffPunkt: false, hjelpelinjer: tom, aksehjelpelinje: null, vinkelrett: false };
}
