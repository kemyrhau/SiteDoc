/**
 * Objekter langt unna bygget (3D, web + mobil).
 *
 * Vedtak Kenneth 2026-11-17 (`docs/claude/3d-agent-prinsipper.md` § 3b punkt 3): objekter
 * langt unna bygget skjules som standard, og innramming/kamera ser bort fra dem. Typisk
 * feil-eksport DWG→IFC eller informasjonsfiler arkitekten har lagt langt unna tegningen.
 *
 * Regelen: et objekt er utligger når senteret ligger utenfor [P1 − margin, P99 + margin]
 * på minst én akse. Margin = maks(halve P1–P99-spennet på aksen, en firedel av største
 * spenn på tvers av aksene) — så et flatt tak og endene på lange bygg beholdes. Under
 * `MIN_OBJEKTER_FOR_UTLIGGERE` objekter er det for få til å skille, og ingen er utligger.
 */

export type Punkt3 = { x: number; y: number; z: number };
export type Boks3 = { min: Punkt3; max: Punkt3 };

const AKSER = ["x", "y", "z"] as const;

export const MIN_OBJEKTER_FOR_UTLIGGERE = 10;

export function erGyldigBoks(b: Boks3): boolean {
  return AKSER.every(
    (a) => Number.isFinite(b.min[a]) && Number.isFinite(b.max[a]) && b.min[a] <= b.max[a],
  );
}

function persentil(sortert: number[], p: number): number {
  const i = (sortert.length - 1) * p;
  const lav = Math.floor(i);
  const høy = Math.ceil(i);
  return sortert[lav]! + (sortert[høy]! - sortert[lav]!) * (i - lav);
}

export function unionAvBokser(bokser: Boks3[]): Boks3 {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of bokser) {
    for (const a of AKSER) {
      if (b.min[a] < min[a]) min[a] = b.min[a];
      if (b.max[a] > max[a]) max[a] = b.max[a];
    }
  }
  return { min, max };
}

export type UtliggerResultat = {
  /** Indekser (i input-lista) til objekter langt unna bygget. Ugyldige bokser er aldri utliggere. */
  utliggere: number[];
  /** Union av gyldige bokser som ikke er utliggere — det innramming og kamera skal bruke. */
  boks: Boks3;
  /** Antall gyldige bokser vurdert. */
  antall: number;
};

/** Finn objektene langt unna bygget. null når ingen boks er gyldig. */
export function finnUtliggere(bokser: Boks3[]): UtliggerResultat | null {
  const gyldigeIdx: number[] = [];
  bokser.forEach((b, i) => { if (erGyldigBoks(b)) gyldigeIdx.push(i); });
  if (gyldigeIdx.length === 0) return null;
  const alleGyldige = gyldigeIdx.map((i) => bokser[i]!);
  if (gyldigeIdx.length < MIN_OBJEKTER_FOR_UTLIGGERE) {
    return { utliggere: [], boks: unionAvBokser(alleGyldige), antall: gyldigeIdx.length };
  }

  const sentre = alleGyldige.map((b) => ({
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  }));
  const grenser = AKSER.map((a) => {
    const s = sentre.map((c) => c[a]).sort((p, q) => p - q);
    return { a, lav: persentil(s, 0.01), høy: persentil(s, 0.99) };
  });
  const størsteSpenn = Math.max(...grenser.map((g) => g.høy - g.lav));
  const intervall = grenser.map((g) => {
    const margin = Math.max((g.høy - g.lav) / 2, størsteSpenn / 4);
    return { a: g.a, fra: g.lav - margin, til: g.høy + margin };
  });

  const utliggere: number[] = [];
  const beholdt: Boks3[] = [];
  sentre.forEach((c, j) => {
    const inne = intervall.every(({ a, fra, til }) => c[a] >= fra && c[a] <= til);
    if (inne) beholdt.push(alleGyldige[j]!);
    else utliggere.push(gyldigeIdx[j]!);
  });
  if (beholdt.length === 0) {
    return { utliggere: [], boks: unionAvBokser(alleGyldige), antall: gyldigeIdx.length };
  }
  return { utliggere, boks: unionAvBokser(beholdt), antall: gyldigeIdx.length };
}
