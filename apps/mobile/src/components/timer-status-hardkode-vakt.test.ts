import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const HER = dirname(fileURLToPath(import.meta.url));

// Del 7 gate 2 (mobil): vakt mot hardkodet status-farge i mobil-status-badgene.
// De skal lese farge fra den delte kilden (timerStatusEtikett → variantKlasse).
// FEILER hvis noen limer inn en status-fargeklasse på nytt.
//
// TimerStatusMerkelapp bærer også SYNC-badgen (bg-yellow-100 / bg-red-100 /
// bg-green-50) — den er UTENFOR Del 7 (konflikt-sporet) og skal bestå. Derfor
// sjekker vi bare status-fargene som STATUS_MAP hadde: gray/blue/amber/green-100.

function les(rel: string): string {
  return readFileSync(join(HER, rel), "utf-8");
}

describe("Del 7 — ingen hardkodet status-farge i mobil-badgene", () => {
  it("TimerStatusMerkelapp: STATUS_MAP-fargene er borte (sync urørt)", () => {
    const kilde = les("./TimerStatusMerkelapp.tsx");
    // Gamle status-farger (STATUS_MAP): gray/blue/amber/green-100.
    expect(kilde).not.toMatch(/bg-(gray|blue|amber|green)-100/);
    expect(kilde).not.toContain("bg-amber");
    // Sync-badgen skal fortsatt være der (bevis på at vi ikke rørte konflikt).
    expect(kilde).toContain("SYNC_MAP");
  });

  it("AttesteringStatusBadge (rad): ingen bg-<palett>-farge", () => {
    const kilde = les("./timer-attestering/AttesteringStatusBadge.tsx");
    expect(kilde).not.toMatch(/bg-(gray|blue|green|amber|red)-100/);
    expect(kilde).not.toContain("bg-amber");
  });
});
