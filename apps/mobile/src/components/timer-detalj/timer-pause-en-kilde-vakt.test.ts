import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// V20 (pause — én kilde), test 12 for MOBIL — speiler
// apps/web/src/__tests__/timer-pause-en-kilde-vakt.test.ts.
//
// PK1: radens timetall regnes med RADENS egen pause (`radPauseMin`/`radPauseMinFor`),
// aldri firma-default (den lokale `pauseMin` = standardPauseMin) eller hodet. Vakten
// FEILER hvis noen fører `effektiveTimerFraSpenn`/`tilFraAntall` i rad-modalen tilbake
// til firma-default.
//
// Scope: `TimerRadModal` (rad-skjemaet) — mobilens motstykke til webs TimerRadDialog.
// matpause.ts' `beregnRadTimer(rad, pauseFra, pauseMin)` er UTENFOR slicen: der er
// `pauseMin` verdien som faktisk skrives på raden (eller et hypotetisk bærer-tall i
// `kvalifiserteBaerere`), ikke en skjult firma-default på et timetall som vises.

const KILDE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "TimerSeksjon.tsx"),
  "utf-8",
);

/** Innholdet i én komponent-funksjon (fra `function Navn(` til neste `\nfunction `). */
function funksjonsSlice(navn: string): string {
  const start = KILDE.indexOf(`function ${navn}(`);
  if (start === -1) throw new Error(`Fant ikke function ${navn}`);
  const rest = KILDE.slice(start + 1);
  const neste = rest.indexOf("\nfunction ");
  return neste === -1 ? KILDE.slice(start) : KILDE.slice(start, start + 1 + neste);
}

/** Kollaps flerlinje-kall til én linje så regex kan matche argumentlister. */
function énLinje(s: string): string {
  return s.replace(/\s+/g, " ");
}

describe("V20 test 12 (mobil) — TimerRadModal regner med radens pause (PK1)", () => {
  const slice = énLinje(funksjonsSlice("TimerRadModal"));

  it("effektiveTimerFraSpenn får aldri firma-default pauseMin som siste argument", () => {
    // `, pauseMin)` = den lokale firma-default. `, radPauseMin)` / `radPauseMinFor(...)` er tillatt.
    // `,?` tåler etterstilt komma i flerlinje-kall (pauseMin,\n)).
    expect(slice).not.toMatch(/effektiveTimerFraSpenn\([^)]*,\s*pauseMin\s*,?\s*\)/);
  });

  it("tilFraAntall får aldri firma-default pauseMin som siste argument", () => {
    expect(slice).not.toMatch(/tilFraAntall\([^)]*,\s*pauseMin\s*,?\s*\)/);
  });

  it("ingen pauseVinduFra(fastStart) i modalen — vinduet kommer fra matpauseKontekst (PK5)", () => {
    // PK5: manuell rad skal IKKE lenger regne fastStart-vindu direkte; den deler
    // `matpauseKontekst` (pauseReferanse-aware). pauseVinduFra er fjernet fra fila.
    expect(KILDE).not.toContain("pauseVinduFra");
  });

  it("radPauseMinFor driver timeberegningen (positiv kontroll)", () => {
    expect(slice).toContain("radPauseMinFor");
  });
});
