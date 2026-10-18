// Objekt-identifisering ved trykk (F1, spec § 3) — rbush-bbox-indeks som første
// filter, deretter ekte geometri-avstand (punkt→segment/bue). Portert fra
// harness-v3.html sin bevisbare `hitTestWorld` (gate 3-telefon "TRYKK BESTÅTT",
// "SVAR (orkestrator 2026-10-13)": ekte geometri pr. primitiv, skravur/HATCH/flate
// taper alltid mot strek/kontur, minste objekt vinner innen ±4 px, to-pass-skanning
// 20/400 px) — se relay/arbeidstegning-prove/gate1/harness-v3.html for den
// opprinnelige målingen og kommentarene denne porteringen bygger på.

import RBush from "rbush";
import type { DxfKameraParametre, SkjermPunkt } from "./kamera-projeksjon";
import { pxPerVerdenhet, skjermTilVerden } from "./kamera-projeksjon";
import type { RegisterVerden, RegisterVerdenObjekt } from "./objektmodell";

const FLATE_KATEGORI_NOKKELORD = ["gulv", "golv", "dekke", "himling", "tak", "skravur"];

/** Flate-objekter (HATCH/SOLID, eller kategori som gulv/dekke/himling/skravur) treffer
 * KUN ved containment — skravur/fyll skal alltid tape mot strek/kontur ved nær-likhet. */
function erFlateObjekt(o: RegisterVerdenObjekt): boolean {
  if (o.dtype === "HATCH" || o.dtype === "SOLID") return true;
  const k = (o.kategori || "").toLowerCase();
  return FLATE_KATEGORI_NOKKELORD.some((n) => k.includes(n));
}

/** Modullinjer/akselinjer/Snittmarkør m.fl. (RETUR isolasjon `7d5d6787`, orkestrator
 * 2026-10-18 pkt 2): ArchiCAD/Revit sine egne 80-89-serie hjelpelinjer er STREK
 * (tier 0 i dag) og ligger ofte rett over en yttervegg og isolasjonsbåndet i den —
 * uten denne regelen vinner hjelpelinja ALLTID over isolasjonen, og brukeren kan
 * aldri velge isolasjonen der. Laveste prioritet (tier 2): taper mot BÅDE ekte
 * bygningsdel-strek OG flate/isolasjon. Primærsignal er `o.hjelpelinje` (render.py
 * sin `er_arkicad_hjelpelinje()`, kode-basert — "geometrisk akselinje-flagg" fra
 * ordren); kategori-tekst-nøkkelord er et fallback for registre konvertert FØR
 * flagget fantes (gamle cachede konverteringer uten `hjelpelinje`-feltet). Målt på
 * EKTE fallplan-DXF: "Snittmarkør · 852"-objekter var 28-125 m enkeltlinjer som
 * dominerte treffetesten over store deler av tegningen, nøyaktig som modullinjene. */
const AKSELINJE_KATEGORI_NOKKELORD = ["modullinje", "akselinje", "aksellinje", "snittmarkør"];

function erAkselinjeObjekt(o: RegisterVerdenObjekt): boolean {
  if (o.hjelpelinje === true) return true;
  const k = (o.kategori || "").toLowerCase();
  return AKSELINJE_KATEGORI_NOKKELORD.some((n) => k.includes(n));
}

function avstandTilBboxKantPx(
  wx: number,
  wy: number,
  b: readonly [number, number, number, number],
  pxPerV: number,
): number {
  let d: number;
  if (wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3]) {
    d = Math.min(wx - b[0], b[2] - wx, wy - b[1], b[3] - wy);
  } else {
    const dx = wx < b[0] ? b[0] - wx : wx > b[2] ? wx - b[2] : 0;
    const dy = wy < b[1] ? b[1] - wy : wy > b[3] ? wy - b[3] : 0;
    d = Math.hypot(dx, dy);
  }
  return d * pxPerV;
}

function distTilSegmentPx(
  wx: number,
  wy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  pxPerV: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  let t = dx === 0 && dy === 0 ? 0 : ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(wx - (ax + t * dx), wy - (ay + t * dy)) * pxPerV;
}

/** Avstand (px) til nærmeste geometri + DEN TREFFENDE polylinjens eget lokale bbox-
 * areal (ikke objektets fulle union-bbox — en dørblokk sin aggregerte bbox dekker
 * blad+sving+karm sammen og er ofte større enn selve svingen, Kenneth-korreksjon
 * 2026-10-13: "trykk på dørsving ga kledning, ikke dør"). */
function avstandTilGeomPx(
  wx: number,
  wy: number,
  geom: number[][],
  pxPerV: number,
): { dist: number; lokalAreal: number } {
  let best = Infinity;
  let bestPoly: number[] | null = null;
  for (const poly of geom) {
    if (poly.length <= 2) {
      const d = Math.hypot(wx - (poly[0] ?? 0), wy - (poly[1] ?? 0)) * pxPerV;
      if (d < best) {
        best = d;
        bestPoly = poly;
      }
      continue;
    }
    for (let i = 0; i + 3 < poly.length; i += 2) {
      // Løkkegrensen (i+3 < length) garanterer at alle fire finnes.
      const d = distTilSegmentPx(wx, wy, poly[i]!, poly[i + 1]!, poly[i + 2]!, poly[i + 3]!, pxPerV);
      if (d < best) {
        best = d;
        bestPoly = poly;
      }
    }
  }
  let lokalAreal = Infinity;
  if (bestPoly) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < bestPoly.length; i += 2) {
      // Løkkegrensen (i+1 < length) garanterer at begge finnes.
      const x = bestPoly[i]!;
      const y = bestPoly[i + 1]!;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    lokalAreal = Math.max(1, x1 - x0) * Math.max(1, y1 - y0);
  }
  return { dist: best, lokalAreal };
}

interface BboxPost {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  handle: string;
}

/** Spatial indeks over objekt-bbox. Bygg én gang pr. register (ved innlasting),
 * gjenbruk pr. trykk — ~21k objekter linjært scannet pr. trykk var unødvendig
 * arbeid når bare noen titalls kan være aktuelle kandidater (Kenneth-korreksjon:
 * "rbush som første filter"). */
export function byggBboxIndeks(register: RegisterVerden): RBush<BboxPost> {
  const items: BboxPost[] = [];
  for (const [handle, o] of Object.entries(register.objekter)) {
    const b = o.bbox;
    if (!b) continue;
    items.push({ minX: b[0], minY: b[1], maxX: b[2], maxY: b[3], handle });
  }
  const indeks = new RBush<BboxPost>();
  indeks.load(items);
  return indeks;
}

/**
 * Finn objektet under et skjermpunkt (F1 — akseptkriterier A1/A8/A12/A13 m.fl.).
 *
 * To-pass-skanning: 20 px toleranse først, deretter 20×20 = 400 px (telefon-finger /
 * lav zoom) — samme fallback som harness gate 3-telefon. Tre prioritetsnivåer (tier):
 * 0 = ekte bygningsdel-strek, 1 = flate (HATCH/skravur/kategori-nøkkelord, treffer KUN
 * ved containment), 2 = modullinjer/akselinjer (ArchiCAD/Revit sine egne hjelpelinjer —
 * RETUR isolasjon `7d5d6787`: disse må IKKE vinne over isolasjon/flate, ellers kan
 * brukeren aldri velge isolasjonen under dem). Strek/kontur bruker ekte geometri-
 * avstand når `geom` finnes (bbox-kant som fallback, f.eks. romtagg-attributtblokker
 * uten egen linjeverk). Ved nær-likhet (±4 px) vinner minste lokale areal (dørsving
 * mot veggkledning); ved klar forskjell (>4 px) vinner nærmest — begge kun innad i
 * samme tier.
 */
export function hitTestWorld(
  skjerm: SkjermPunkt,
  kamera: DxfKameraParametre,
  register: RegisterVerden,
  indeks: RBush<BboxPost>,
): RegisterVerdenObjekt | null {
  const { verdenX: wx, verdenY: wy } = skjermTilVerden(skjerm, kamera);
  const pxPerV = pxPerVerdenhet(kamera);

  function scan(tolPx: number): RegisterVerdenObjekt | null {
    const tolWorld = tolPx / pxPerV;
    const kandidater = indeks.search({
      minX: wx - tolWorld,
      minY: wy - tolWorld,
      maxX: wx + tolWorld,
      maxY: wy + tolWorld,
    });
    let best: RegisterVerdenObjekt | null = null;
    let bestTier = 3;
    let bestAvstand = Infinity;
    let bestArea = Infinity;
    for (const item of kandidater) {
      const o = register.objekter[item.handle];
      if (!o) continue;
      const b = o.bbox;
      if (!b) continue;
      const innenfor = wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3];
      const flate = erFlateObjekt(o);
      if (flate && !innenfor) continue;

      let avstandPx: number;
      let area: number;
      if (!flate && o.geom && o.geom.length) {
        const r = avstandTilGeomPx(wx, wy, o.geom, pxPerV);
        avstandPx = r.dist;
        area = r.lokalAreal;
      } else {
        avstandPx = avstandTilBboxKantPx(wx, wy, b, pxPerV);
        area = (b[2] - b[0]) * (b[3] - b[1]);
      }
      if (!flate && !innenfor && avstandPx > tolPx) continue;

      const tier = erAkselinjeObjekt(o) ? 2 : flate ? 1 : 0;
      const diff = avstandPx - bestAvstand;
      const bedre =
        tier < bestTier ||
        (tier === bestTier && Math.abs(diff) <= 4 && area < bestArea) ||
        (tier === bestTier && diff < -4);
      if (bedre) {
        best = o;
        bestTier = tier;
        bestAvstand = Math.min(avstandPx, bestAvstand);
        bestArea = area;
      }
    }
    return best;
  }

  return scan(20) ?? scan(20 * 20);
}
