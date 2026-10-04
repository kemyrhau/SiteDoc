import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * V17-A grep-vakt (spec § 8.3 / § 8 punkt 3) — som haversine-vakten i lag 1.
 *
 * Etter V17-A bygges ALLE geofence-kandidater (byggeplass + oppmøtested) via den
 * delte `tilGeofencer` (A4). Et gjenværende `radiusM != null`-filter på mobil
 * ville vært en kopi av gjenkjennings-regelen utenfor `sted.ts` — nøyaktig det
 * V17 samler. Vakten FEILER hvis et slikt filter dukker opp igjen i mobil-koden.
 *
 * Scope: `apps/mobile/src` + `apps/mobile/app` (GPS-gjenkjenningen bor her).
 * `sted.ts` ligger i `@sitedoc/shared` og er den tillatte kilden — utenfor scope.
 * Web `harGeofence` (`byggeplasser/page.tsx`) er en visnings-predikat, ikke en
 * gjenkjennings-kandidat, og er bevisst ikke dekket (web har ingen GPS).
 */

const MOBIL_ROT = join(__dirname, "..", "..");
const FILTER = /radiusM\s*!==?\s*null/;

function tsFiler(dir: string): string[] {
  const ut: string[] = [];
  for (const navn of readdirSync(dir)) {
    const sti = join(dir, navn);
    const st = statSync(sti);
    if (st.isDirectory()) {
      if (navn === "node_modules") continue;
      ut.push(...tsFiler(sti));
    } else if (/\.(ts|tsx)$/.test(navn) && !/\.test\.(ts|tsx)$/.test(navn)) {
      ut.push(sti);
    }
  }
  return ut;
}

describe("grep-vakt — ingen radiusM-null-filter på byggeplass-kandidater i mobil", () => {
  it("🔴 ingen `radiusM != null`-filter utenfor sted.ts (bruk tilGeofencer)", () => {
    const treff: string[] = [];
    for (const under of ["src", "app"]) {
      let rot: string;
      try {
        rot = join(MOBIL_ROT, under);
        statSync(rot);
      } catch {
        continue;
      }
      for (const fil of tsFiler(rot)) {
        const innhold = readFileSync(fil, "utf8");
        innhold.split("\n").forEach((linje, i) => {
          if (FILTER.test(linje)) treff.push(`${fil}:${i + 1}  ${linje.trim()}`);
        });
      }
    }
    expect(treff, `Fant radiusM-null-filter(e):\n${treff.join("\n")}`).toEqual([]);
  });
});
