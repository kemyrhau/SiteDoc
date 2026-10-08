/**
 * Flere målinger i én tegning — delt, ren datamodell (RETUR 2).
 *
 * Bakgrunn (Kenneth-ønske 2026-10-08): en ferdig måling blir liggende på
 * tegningen. Trykker du verktøyknappen igjen starter en NY måling, og den
 * forrige blir stående. Den valgte målingen er «aktiv» (vises i stripa,
 * punktene kan dras). «Slett» fjerner den aktive, «Slett alle» alle.
 *
 * Hele tilstanden og alle overganger ligger her som rene funksjoner slik at
 * mobil (`TegningsVisning.tsx`) og web (`tegninger/page.tsx`) deler NØYAKTIG
 * samme logikk — ingen kopi, og den kan testes uten å mounte noe UI.
 * Selve regnestykket (lengde/areal) bor i `maaling.ts` og gjenbrukes der.
 *
 * 🔴 Invariant: et trykk som ikke treffer et punkt eller en eksisterende
 * måling skal ALDRI slette/nullstille en ferdig figur (RETUR 2 § 2). Derfor
 * legger `leggTilPunkt` kun til i en AKTIV, påbegynt måling; alt annet er en
 * no-op på figurene.
 */

import type { Punkt } from "./maaling";

/** De tre måleverktøyene (paritet mobil/web). */
export type MaleVerktoy = "linjal" | "polylinje" | "areal";

/** Én måling i tegningen. */
export interface Maling {
  id: string;
  verktoy: MaleVerktoy;
  /** Punkter i prosent (0–100) av vist bilde — samme rom som markører. */
  punkter: Punkt[];
  /** true = linjal fullført / polylinje eller areal lukket. */
  ferdig: boolean;
}

/** Samlet måletilstand: alle målinger + hvilken som er aktiv (valgt). */
export interface MaleTilstand {
  malinger: Maling[];
  aktivId: string | null;
}

export const TOM_MALETILSTAND: MaleTilstand = { malinger: [], aktivId: null };

/** Minste antall punkter for at en måling er verdt å beholde. */
export function minPunkter(verktoy: MaleVerktoy): number {
  return verktoy === "areal" ? 3 : 2;
}

/** Den aktive målingen, eller null. */
export function aktivMaling(t: MaleTilstand): Maling | null {
  return t.malinger.find((m) => m.id === t.aktivId) ?? null;
}

/** Har tilstanden en aktiv måling som ennå tegnes (ikke ferdig)? */
export function harPaagaaende(t: MaleTilstand): boolean {
  const m = aktivMaling(t);
  return !!m && !m.ferdig;
}

/**
 * Finaliser en aktiv, lang-nok påbegynt måling (behold den ferdig) og forkast
 * en aktiv påbegynt måling som er for kort (abandonert). Ferdige målinger og
 * andre påbegynte (finnes ikke normalt) berøres ikke.
 */
function finaliserEllerForkast(malinger: Maling[], aktivId: string | null): Maling[] {
  return malinger
    .map((m) =>
      m.id === aktivId && !m.ferdig && m.punkter.length >= minPunkter(m.verktoy)
        ? { ...m, ferdig: true }
        : m,
    )
    .filter((m) => m.ferdig || m.punkter.length >= minPunkter(m.verktoy));
}

/**
 * Trykk på en verktøyknapp: avslutt/behold gjeldende aktive måling og start en
 * NY, tom måling av valgt verktøy (RETUR 2). `nyId` oppgis av kalleren (ingen
 * Date.now/Math.random her — holder funksjonen ren og testbar).
 */
export function startMaling(t: MaleTilstand, verktoy: MaleVerktoy, nyId: string): MaleTilstand {
  const malinger = finaliserEllerForkast(t.malinger, t.aktivId);
  return {
    malinger: [...malinger, { id: nyId, verktoy, punkter: [], ferdig: false }],
    aktivId: nyId,
  };
}

/**
 * Legg til et målepunkt i den AKTIVE, påbegynte målingen. Ingen aktiv påbegynt
 * måling → uendret (🔴 bom-trykk sletter aldri). `erNaer` avgjør om trykket
 * lukker polylinje/areal (kalleren eier terskelen: px på web, prosent på mobil).
 */
export function leggTilPunkt(
  t: MaleTilstand,
  p: Punkt,
  erNaer: (q: Punkt) => boolean,
): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || m.ferdig) return t;
  const neste = punktTilMaling(m, p, erNaer);
  if (neste === m) return t;
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? neste : x)) };
}

function punktTilMaling(m: Maling, p: Punkt, erNaer: (q: Punkt) => boolean): Maling {
  if (m.verktoy === "linjal") {
    const punkter = [...m.punkter, p].slice(-2);
    return { ...m, punkter, ferdig: punkter.length >= 2 };
  }
  if (m.verktoy === "areal") {
    // 🔴 RETUR 6 § 1: areal lukkes KUN ved trykk nær FØRSTE punkt (den eneste
    // auto-avslutningen som er lov). Et trykk nær et annet punkt setter et nytt
    // punkt. Terskelen (`erNaer`) eies av kalleren og skal regnes i SKJERM-/side-
    // piksler (~12 pt), ikke prosent — ellers lukker arealet seg selv ved innzoom.
    if (m.punkter.length >= 3 && m.punkter[0] && erNaer(m.punkter[0])) {
      return { ...m, ferdig: true };
    }
    return { ...m, punkter: [...m.punkter, p] };
  }
  // 🔴 RETUR 6 § 1 + TILLEGG: polylinje auto-lukker ALDRI (den gjorde det før på
  // trykk nær et hvilket som helst punkt → figuren ble ferdig → mobil hoppet til
  // Flytt «av seg selv»). Polylinje avsluttes bare eksplisitt (Fullfør / Enter).
  return { ...m, punkter: [...m.punkter, p] };
}

/** Marker den aktive målingen som ferdig (Fullfør / Lukk flate). */
export function settFerdig(t: MaleTilstand): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || m.ferdig) return t;
  if (m.punkter.length < minPunkter(m.verktoy)) return t;
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? { ...x, ferdig: true } : x)) };
}

/**
 * 🟢 TILLEGG (web polylinje-paritet): «Fortsett» en ferdig måling — åpne den aktive
 * igjen (`ferdig = false`) så nye punkter kan legges til. Ingen aktiv / allerede
 * påbegynt → uendret. (Areal forblir en ring; nye punkter legges til før lukking.)
 */
export function gjenoppta(t: MaleTilstand): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || !m.ferdig) return t;
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? { ...x, ferdig: false } : x)) };
}

/**
 * Flytt et punkt i den aktive målingen (dra). Rører ikke `ferdig` — et lukket
 * areal/polylinje forblir lukket mens punktet justeres (TILLEGG RETUR 1).
 */
export function flyttPunkt(t: MaleTilstand, index: number, p: Punkt): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || index < 0 || index >= m.punkter.length) return t;
  const punkter = m.punkter.slice();
  punkter[index] = p;
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? { ...x, punkter } : x)) };
}

/** Velg en eksisterende måling som aktiv (trykk på den). Ukjent id → uendret. */
export function velgMaling(t: MaleTilstand, id: string): MaleTilstand {
  if (t.aktivId === id) return t;
  if (!t.malinger.some((m) => m.id === id)) return t;
  return { ...t, aktivId: id };
}

/** Slett den aktive målingen. Ingen aktiv → uendret. */
export function slettAktiv(t: MaleTilstand): MaleTilstand {
  if (t.aktivId == null) return t;
  return { malinger: t.malinger.filter((m) => m.id !== t.aktivId), aktivId: null };
}

/** Slett alle målinger. */
export function slettAlle(): MaleTilstand {
  return { malinger: [], aktivId: null };
}

/**
 * 🟢 RETUR 6 § 2: sett inn et nytt hjørne ETTER kant-indeksen `kantIndex` i den
 * aktive målingen (trykk på en kant → nytt punkt der, dragbart med en gang).
 * `kantIndex` er segmentet mellom punkt `kantIndex` og `kantIndex+1`; for et lukket
 * areals siste kant (n-1 → 0) er `kantIndex = n-1`, og punktet legges til sist.
 * Returnerer uendret tilstand ved ugyldig kant. (Ingen `ferdig`-endring — en lukket
 * figur forblir lukket.)
 */
export function settInnPunktPaaKant(t: MaleTilstand, kantIndex: number, p: Punkt): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || kantIndex < 0 || kantIndex >= m.punkter.length) return t;
  const punkter = m.punkter.slice();
  punkter.splice(kantIndex + 1, 0, p);
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? { ...x, punkter } : x)) };
}

/** Indeksen det nye hjørnet får når man setter inn på `kantIndex`. */
export function nyKantPunktIndeks(kantIndex: number): number {
  return kantIndex + 1;
}

/**
 * 🟢 RETUR 6 § 2: fjern et hjørne i den aktive målingen. Beholder minst
 * `minPunkter` (areal 3, ellers 2) — ellers uendret (et areal kan ikke bli en linje).
 */
export function fjernPunkt(t: MaleTilstand, index: number): MaleTilstand {
  const m = aktivMaling(t);
  if (!m || index < 0 || index >= m.punkter.length) return t;
  if (m.punkter.length - 1 < minPunkter(m.verktoy)) return t;
  const punkter = m.punkter.filter((_, i) => i !== index);
  return { ...t, malinger: t.malinger.map((x) => (x.id === m.id ? { ...x, punkter } : x)) };
}

/**
 * Avslutt målemodus (Lukk/X): behold ferdige målinger, forkast en påbegynt
 * aktiv som er for kort, og fjern valget. Figurene blir liggende på tegningen.
 */
export function avsluttAktiv(t: MaleTilstand): MaleTilstand {
  return { malinger: finaliserEllerForkast(t.malinger, t.aktivId), aktivId: null };
}

// --- Hit-test (rene geometrifunksjoner, px-rom via vist bilde-rect) ---

function tilPx(p: Punkt, rectW: number, rectH: number): { x: number; y: number } {
  return { x: (p.x / 100) * rectW, y: (p.y / 100) * rectH };
}

/** Avstand fra punkt til linjesegment (px). */
function avstandTilSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let tt = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  tt = Math.max(0, Math.min(1, tt));
  return Math.hypot(p.x - (a.x + tt * dx), p.y - (a.y + tt * dy));
}

/** Er et px-punkt inne i et px-polygon (ray casting)? */
function punktIPolygon(p: { x: number; y: number }, pts: { x: number; y: number }[]): boolean {
  let inne = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const kryss =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (kryss) inne = !inne;
  }
  return inne;
}

/**
 * Nærmeste punkt i en liste innen `tolPx` skjerm-piksler. -1 = ingen treff.
 * Brukes til punkt-dra: ALLE punkter er grabbare, ikke bare det siste (RETUR 2 § 2).
 */
export function finnNaermestePunkt(
  punkter: Punkt[],
  p: Punkt,
  rectW: number,
  rectH: number,
  tolPx: number,
): number {
  const pp = tilPx(p, rectW, rectH);
  let best = -1;
  let bestAvstand = tolPx;
  for (let i = 0; i < punkter.length; i++) {
    const q = tilPx(punkter[i]!, rectW, rectH);
    const d = Math.hypot(q.x - pp.x, q.y - pp.y);
    if (d <= bestAvstand) {
      best = i;
      bestAvstand = d;
    }
  }
  return best;
}

/**
 * 🟢 RETUR 6 § 2: nærmeste KANT (segment) til `p` innen `tolPx` skjerm-piksler.
 * Returnerer kant-indeksen (segmentet mellom punkt `i` og `i+1`), eller -1. For et
 * `lukket` areal regnes også sluttkanten (siste → første), med kant-indeks n-1.
 * Brukes til «sett inn hjørne på kant» — kalleren sjekker punkt-treff FØRST (dra),
 * så kant-treff (sett inn).
 */
export function finnNaermesteKant(
  punkter: Punkt[],
  p: Punkt,
  rectW: number,
  rectH: number,
  tolPx: number,
  lukket: boolean,
): number {
  if (rectW <= 0 || rectH <= 0 || punkter.length < 2) return -1;
  const pp = tilPx(p, rectW, rectH);
  const pts = punkter.map((q) => tilPx(q, rectW, rectH));
  let best = -1;
  let bestAvstand = tolPx;
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = avstandTilSegment(pp, pts[i]!, pts[i + 1]!);
    if (d <= bestAvstand) {
      best = i;
      bestAvstand = d;
    }
  }
  if (lukket && pts.length >= 3) {
    const d = avstandTilSegment(pp, pts[pts.length - 1]!, pts[0]!);
    if (d <= bestAvstand) {
      best = pts.length - 1; // sluttkant (siste → første)
      bestAvstand = d;
    }
  }
  return best;
}

/**
 * Hvilken måling traff et trykk? Returnerer id-en til den øverste (sist tegnede)
 * målingen trykket treffer — på et punkt, en kant, eller (lukket areal) inni
 * flaten. Null = traff ingen. Brukes til å velge en eksisterende måling.
 */
export function finnMalingTreff(
  malinger: Maling[],
  p: Punkt,
  rectW: number,
  rectH: number,
  tolPx: number,
): string | null {
  if (rectW <= 0 || rectH <= 0) return null;
  const pp = tilPx(p, rectW, rectH);
  for (let i = malinger.length - 1; i >= 0; i--) {
    const m = malinger[i]!;
    const pts = m.punkter.map((q) => tilPx(q, rectW, rectH));
    if (pts.some((q) => Math.hypot(q.x - pp.x, q.y - pp.y) <= tolPx)) return m.id;
    const lukket = m.verktoy === "areal" && m.ferdig && pts.length >= 3;
    for (let j = 0; j + 1 < pts.length; j++) {
      if (avstandTilSegment(pp, pts[j]!, pts[j + 1]!) <= tolPx) return m.id;
    }
    if (lukket) {
      if (avstandTilSegment(pp, pts[pts.length - 1]!, pts[0]!) <= tolPx) return m.id;
      if (punktIPolygon(pp, pts)) return m.id;
    }
  }
  return null;
}
