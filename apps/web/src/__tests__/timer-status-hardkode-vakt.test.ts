import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Del 7 gate 2: vakt mot at en flate hardkoder en status-farge igjen. De to
// web-status-badgene skal lese farge fra den delte kilden (timerStatusEtikett →
// Badge), ikke fra en lokal Tailwind-fargetabell. FEILER hvis noen limer inn
// bg-<palett>-100 på nytt. (Uten denne drifter opprydningen tilbake.)

function les(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf-8");
}

// bg-green-50 (maskin-av-arbeid-validering i attestering-buckets) er IKKE en
// status-badge-farge og er utenfor Del 7 — derfor -100-suffikset her.
const STATUS_FARGER = /bg-(gray|blue|green|amber|red)-100/;

describe("Del 7 — ingen hardkodet status-farge i web-badgene", () => {
  it("StatusBadge.tsx (sedel) har ingen bg-<palett>-100", () => {
    expect(les("../components/timer/StatusBadge.tsx")).not.toMatch(STATUS_FARGER);
  });

  it("attestering-buckets.tsx (rad-badge) har ingen status-badge-farge", () => {
    // RadStatusBadge brukte bg-green/red/gray-100 — skal være borte. bg-green-50
    // (validerings-boks, linje ~675) er en annen sak og treffes ikke av -100.
    expect(les("../components/attestering/attestering-buckets.tsx")).not.toMatch(
      STATUS_FARGER,
    );
  });

  it("ingen bg-amber igjen i noen av de to (Del 7 funn 3)", () => {
    expect(les("../components/timer/StatusBadge.tsx")).not.toContain("bg-amber");
    expect(
      les("../components/attestering/attestering-buckets.tsx"),
    ).not.toContain("bg-amber");
  });
});
