/**
 * Beregning av norske helligdager — innebygd Gauss-påskealgoritme.
 *
 * Per fase-0-beslutninger.md § T.9 (vedtatt 2026-05-15).
 *
 * Norske helligdager er nasjonale — ingen region-varianter. Vi lagrer rene
 * datoer (uten tid) i ArbeidstidsKalender, så tidssone-håndtering er ikke
 * nødvendig. Derfor ingen avhengighet til date-fns-tz eller date-holidays.
 */

export interface Helligdag {
  dato: Date;
  navn: string;
  type: "helligdag";
}

/**
 * Beregner 1. påskedag for et gitt år via Meeus/Jones/Butcher Gauss-algoritmen.
 * Returnerer en Date i UTC ved midnatt — kalleren konverterer ved behov.
 *
 * Algoritmen er deterministisk og gyldig for år 1583 og fremover i den
 * gregorianske kalenderen.
 */
function beregnPaskedag(aar: number): Date {
  const a = aar % 19;
  const b = Math.floor(aar / 100);
  const c = aar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = april
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(aar, maaned - 1, dag));
}

/**
 * Adder antall dager til en UTC-dato uten tidssone-glidning.
 */
function leggTilDager(dato: Date, dager: number): Date {
  return new Date(
    Date.UTC(
      dato.getUTCFullYear(),
      dato.getUTCMonth(),
      dato.getUTCDate() + dager,
    ),
  );
}

/**
 * Returnerer alle 12 norske helligdager for et gitt år.
 *
 * 5 faste datoer:
 *   - 1. januar (1. nyttårsdag)
 *   - 1. mai (Offentlig høytidsdag)
 *   - 17. mai (Grunnlovsdag)
 *   - 25. desember (1. juledag)
 *   - 26. desember (2. juledag)
 *
 * 7 bevegelige datoer, relativt til 1. påskedag:
 *   - Skjærtorsdag (−3)
 *   - Langfredag (−2)
 *   - 1. påskedag (0)
 *   - 2. påskedag (+1)
 *   - Kristi himmelfartsdag (+39)
 *   - 1. pinsedag (+49)
 *   - 2. pinsedag (+50)
 *
 * Returneres sortert etter dato (Date i UTC ved midnatt).
 */
export function beregnNorskeHelligdager(aar: number): Helligdag[] {
  const paske = beregnPaskedag(aar);

  const helligdager: Helligdag[] = [
    { dato: new Date(Date.UTC(aar, 0, 1)), navn: "1. nyttårsdag", type: "helligdag" },
    { dato: leggTilDager(paske, -3), navn: "Skjærtorsdag", type: "helligdag" },
    { dato: leggTilDager(paske, -2), navn: "Langfredag", type: "helligdag" },
    { dato: paske, navn: "1. påskedag", type: "helligdag" },
    { dato: leggTilDager(paske, 1), navn: "2. påskedag", type: "helligdag" },
    { dato: new Date(Date.UTC(aar, 4, 1)), navn: "Offentlig høytidsdag", type: "helligdag" },
    { dato: new Date(Date.UTC(aar, 4, 17)), navn: "Grunnlovsdag", type: "helligdag" },
    { dato: leggTilDager(paske, 39), navn: "Kristi himmelfartsdag", type: "helligdag" },
    { dato: leggTilDager(paske, 49), navn: "1. pinsedag", type: "helligdag" },
    { dato: leggTilDager(paske, 50), navn: "2. pinsedag", type: "helligdag" },
    { dato: new Date(Date.UTC(aar, 11, 25)), navn: "1. juledag", type: "helligdag" },
    { dato: new Date(Date.UTC(aar, 11, 26)), navn: "2. juledag", type: "helligdag" },
  ];

  helligdager.sort((a, b) => a.dato.getTime() - b.dato.getTime());
  return helligdager;
}
