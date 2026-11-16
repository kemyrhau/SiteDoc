import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { dagSumTimer } from "./dagsoversikt";

// TILLEGG (33) pkt 3: «Sum i dag» og «Send dagen (N t)» fra én funksjon. Verdien er uendret
// (fravær telles ikke) til Kenneth har svart; da endres bare `dagSumTimer`.
const her = dirname(fileURLToPath(import.meta.url));
const OVERSIKT = readFileSync(
  join(her, "../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx"),
  "utf-8",
);

describe("TILLEGG (33) pkt 3 — dagens sum fra én kilde", () => {
  it("fravær telles ikke i dag (uendret atferd)", () => {
    expect(dagSumTimer({ arbeid: 3, fravaer: 4.5 })).toBe(3);
    expect(dagSumTimer({ arbeid: 0, fravaer: 7.5 })).toBe(0);
  });

  it("🔴 «Sum i dag» og Send-knappen leser begge `dagSum`", () => {
    expect(OVERSIKT).toContain("const dagSum = dagSumTimer(");
    expect(OVERSIKT).toContain("sendKnappTekst(sedel.status, dagSum, sum.reise)");
    expect(OVERSIKT).toContain("{t2(dagSum)}");
    expect(OVERSIKT).not.toContain("t2(sum.arbeid)");
  });
});
