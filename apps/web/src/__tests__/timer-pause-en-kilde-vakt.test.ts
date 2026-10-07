import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// V20 (pause — én kilde), test 12 + test 5 for WEB.
//
// PK1: timetallet på en TIMER-rad regnes med RADENS egen pause (`radPauseMin`),
// aldri firma-default (`standardPauseMin`) eller hodet (`sheet.pauseMin`). Denne
// vakten FEILER hvis noen fører `effektiveTimerFraSpenn`/`tilFraAntall` tilbake
// til firma-default/hodet i rad-dialogen. (Maskin-dialogen bruker med vilje
// `standardPauseMin` — maskin følger førerens økt — og ligger utenfor slicen.)
//
// PK7/test 5: «Rediger»-dialogen (sedel-hodet) sender IKKE lenger `pauseMin` —
// hodet utledes server-side (Σ rad). Vakten FEILER hvis pause-feltet kommer
// tilbake i hode-dialogen.

const KILDE = readFileSync(
  new URL("../app/dashbord/timer/[id]/page.tsx", import.meta.url),
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

describe("V20 test 12 — TimerRadDialog regner med radens pause (PK1)", () => {
  const slice = énLinje(funksjonsSlice("TimerRadDialog"));

  it("effektiveTimerFraSpenn får aldri standardPauseMin som siste argument", () => {
    expect(slice).not.toMatch(/effektiveTimerFraSpenn\([^)]*,\s*standardPauseMin\s*\)/);
  });

  it("effektiveTimerFraSpenn får aldri sedelens pauseMin-prop som siste argument", () => {
    // `, pauseMin)` = hode-/sedel-pausen. `, radPauseMin)` / `, pm)` er tillatt.
    expect(slice).not.toMatch(/effektiveTimerFraSpenn\([^)]*,\s*pauseMin\s*\)/);
  });

  it("tilFraAntall får aldri standardPauseMin/sedel-pause som siste argument", () => {
    expect(slice).not.toMatch(/tilFraAntall\([^)]*,\s*standardPauseMin\s*\)/);
    expect(slice).not.toMatch(/tilFraAntall\([^)]*,\s*pauseMin\s*\)/);
  });

  it("den gamle beregningsPauseMin-variabelen er borte", () => {
    expect(slice).not.toContain("beregningsPauseMin");
  });

  it("radPauseMin driver timeberegningen (positiv kontroll)", () => {
    expect(slice).toContain("radPauseMin");
  });
});

describe("V20 test 5 — Rediger-dialogen (hodet) sender ikke pauseMin (PK7)", () => {
  const slice = funksjonsSlice("RedigerHeaderDialog");

  it("hode-dialogen rører ikke pauseMin lenger", () => {
    expect(slice).not.toContain("pauseMin");
  });
});
