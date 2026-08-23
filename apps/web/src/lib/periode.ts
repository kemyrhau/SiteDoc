/**
 * Delt periode-filter-logikk (2026-08-23). Bygget for tegningssiden, men laget delt så Bilder-siden
 * (som har to hardkodede kopier av dette mønsteret) kan bytte over trivielt senere.
 */

/** Hurtigvalg for periode. «egendefinert» → bruk `fra`/`til` direkte. «3mnd» finnes for Bilder-siden. */
export type PeriodeHurtigvalg = "idag" | "uke" | "mnd" | "3mnd" | "alle" | "egendefinert";

export interface Periode {
  hurtigvalg: PeriodeHurtigvalg;
  /** Kun brukt (og redigerbar) ved `egendefinert`. Null = åpen ende. */
  fra: Date | null;
  til: Date | null;
}

const DØGN_MS = 86_400_000;

/** Starten av dagen `n` døgn tilbake (00:00 lokal tid). n=0 → i dag. */
function startAvDagFor(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * DØGN_MS);
}

/**
 * Utleder `{fra, til}` for et hurtigvalg. `egendefinert` og `alle` gir ingen avledet grense (custom
 * bruker sine egne datoer; alle = ingen grense). idag/uke/mnd → fra = starten av perioden, til = null
 * (åpen fremover, så «i dag» også fanger dagens senere bilder).
 */
export function grenserForHurtigvalg(valg: PeriodeHurtigvalg): { fra: Date | null; til: Date | null } {
  switch (valg) {
    case "idag":
      return { fra: startAvDagFor(0), til: null };
    case "uke":
      return { fra: startAvDagFor(7), til: null };
    case "mnd":
      return { fra: startAvDagFor(30), til: null };
    case "3mnd":
      return { fra: startAvDagFor(90), til: null };
    default:
      return { fra: null, til: null }; // alle + egendefinert (custom setter egne)
  }
}

/**
 * De EFFEKTIVE grensene for en periode: for `egendefinert` brukes periodens egne fra/til, ellers
 * det avledede hurtigvalget.
 */
export function effektiveGrenser(periode: Periode): { fra: Date | null; til: Date | null } {
  if (periode.hurtigvalg === "egendefinert") return { fra: periode.fra, til: periode.til };
  return grenserForHurtigvalg(periode.hurtigvalg);
}

/**
 * Er en dato innenfor perioden? `til` er inklusiv HELE til-dagen (mønster fra Bilder-siden:
 * `til + 1 døgn`). Åpen ende når en grense er null. Merk: `fra > til` gir tom (ingen dato passerer
 * begge testene) — det er meningen, jf. hint-en i UI-en.
 */
export function innenforPeriode(dato: Date, fra: Date | null, til: Date | null): boolean {
  if (fra && dato < fra) return false;
  if (til && dato > new Date(til.getTime() + DØGN_MS)) return false;
  return true;
}

/** True hvis begge custom-datoer er satt OG fra er etter til (ugyldig intervall → UI viser hint). */
export function erUgyldigIntervall(periode: Periode): boolean {
  return (
    periode.hurtigvalg === "egendefinert" &&
    periode.fra != null &&
    periode.til != null &&
    periode.fra > periode.til
  );
}
