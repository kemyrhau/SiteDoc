import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_LEVETID_MS, LEVETID_NAAR_G_LEVERT_MS } from "./hmac";

/**
 * 🔴 SNUBLETRÅD for den MIDLERTIDIGE 24t-levetiden (E, Kenneth-vedtak 2026-09-24).
 *
 * 24 t er valgt fordi del G (selvfornyelse — `SignertBilde` + G2 debouncet
 * re-emisjon) ikke er levert. Når G lander SKAL levetiden ned til 15 min.
 *
 * Presedens: `Dockerfile.api:36-38` bar en «ordnes senere»-kommentar som rotnet i
 * 3,5 mnd. En kommentar holder ikke. To RØDE tester gjør — hver med sin egen grunn,
 * så det er entydig hvilken som slo ut (aldri to assertions i én test):
 *   Test 1 — G-koblingen: fanger «G levert, men levetiden står igjen på 24 t».
 *   Test 2 — fristen:     fanger «24 t har stått for lenge», uansett G.
 */

const HER = dirname(fileURLToPath(import.meta.url)); // apps/api/src/utils
const REPO_ROT = resolve(HER, "../../../.."); // → monorepo-rot
const SIGNERT_BILDE = resolve(REPO_ROT, "apps/web/src/components/SignertBilde.tsx");

/**
 * G-DETEKTOR — entydig, filsystem-basert (ikke et manuelt flagg som kan glemmes).
 * Del G er «levert» når G1-komponenten finnes. Ordre G1 navngir den EKSAKT:
 * `apps/web/src/components/SignertBilde.tsx`. Cowork målte «0 treff på SignertBilde»
 * på develop → signalet slår ut presis når artefakten lander.
 */
export function delGErLevert(): boolean {
  return existsSync(SIGNERT_BILDE);
}

describe("levetid-snubletråd — 24t er midlertidig til del G lander", () => {
  it("G-detektoren er ENTYDIG: false nå, men existsSync slår faktisk ut på en fil som finnes", () => {
    // Uten denne kunne detektoren vært en forkledd `return false` som aldri fanger G.
    expect(delGErLevert()).toBe(false); // develop: SignertBilde finnes ikke ennå
    expect(existsSync(resolve(HER, "hmac.ts"))).toBe(true); // existsSync fungerer mot en ekte sti
  });

  it("SNUBLETRÅD 1 (G-kobling): del G er levert → levetiden MÅ være 15 min", () => {
    if (!delGErLevert()) return; // G ikke levert → 24 t er riktig, tråden hviler
    expect(
      STANDARD_LEVETID_MS,
      "del G (SignertBilde) er levert — sett STANDARD_LEVETID_MS til LEVETID_NAAR_G_LEVERT_MS (15 min)",
    ).toBe(LEVETID_NAAR_G_LEVERT_MS);
  });

  it("SNUBLETRÅD 2 (frist): 24 t skulle vært midlertidig — ta en bevisst beslutning", () => {
    const frist = Date.parse("2026-11-30T00:00:00Z");
    expect(
      Date.now(),
      "30.11.2026 er passert og levetiden er fortsatt 24 t — senk til 15 min (om G er live) eller flytt fristen BEVISST",
    ).toBeLessThan(frist);
  });

  it("så lenge tråden hviler er STANDARD_LEVETID_MS 24 t (dokumenterer nåtilstanden)", () => {
    expect(STANDARD_LEVETID_MS).toBe(24 * 60 * 60 * 1000);
  });
});
