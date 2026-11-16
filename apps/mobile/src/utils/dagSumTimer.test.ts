import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { dagSumTimer } from "./dagsoversikt";

// TILLEGG (33) pkt 3: «Sum i dag» og «Send dagen (N t)» fra én funksjon.
// RETUR (33) c pkt 2 (Kenneth 2026-11-16): fravær telles med — lønnsarten sorterer det ut.
const her = dirname(fileURLToPath(import.meta.url));
const OVERSIKT = readFileSync(
  join(her, "../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx"),
  "utf-8",
);

describe("TILLEGG (33) pkt 3 — dagens sum fra én kilde", () => {
  it("RETUR (33) c pkt 2: fravær telles med i dagsummen", () => {
    expect(dagSumTimer({ arbeid: 3, fravaer: 4.5 })).toBe(7.5);
    expect(dagSumTimer({ arbeid: 0, fravaer: 7.5 })).toBe(7.5); // bare fravær → fraværstimene
    expect(dagSumTimer({ arbeid: 7.5, fravaer: 0 })).toBe(7.5);
  });

  it("vakt: `dagSumTimer` har én kaller (prosjektkort-oversikten)", () => {
    expect(OVERSIKT.match(/dagSumTimer\(/g)).toHaveLength(1);
  });

  it("🔴 «Sum i dag» og Send-knappen leser begge `dagSum`", () => {
    expect(OVERSIKT).toContain("const dagSum = dagSumTimer(");
    expect(OVERSIKT).toContain("sendKnappTekst(sedel.status, dagSum, sum.reise)");
    expect(OVERSIKT).toContain("{t2(dagSum)}");
    expect(OVERSIKT).not.toContain("t2(sum.arbeid)");
  });
});
