import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { arbeidOgReise } from "@sitedoc/shared";

// Post 2026-11-14 (7) punkt 6: topp-banneret i det klassiske dagskortet måler
// dekning på arbeid UTEN reise og viser reise separat. Isolasjonen løftes KUN
// for banneret — ingen «+ Reise» i dagskortet.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const DAGSKORT = les("../../../app/timer/[id].tsx");
const BANNER = les("SummeringsBanner.tsx");

describe("SummeringsBanner — reise utenfor dekningen (post (7) punkt 6)", () => {
  it("dagskortet gir banneret arbeid uten reise og reise separat", () => {
    expect(DAGSKORT).toContain("arbeidOgReise(timerRader)");
    expect(DAGSKORT).toContain("totaltimer={bannerArbeidReise.arbeid}");
    expect(DAGSKORT).toContain("reiseTimer={bannerArbeidReise.reise}");
  });

  it("banneret viser reise-delen kun når reise > 0", () => {
    expect(BANNER).toMatch(/reiseTimer !== undefined && reiseTimer > 0/);
    expect(BANNER).toContain('t("timer.summeringReise"');
  });

  it("dagskortet har ikke «+ Reise»", () => {
    expect(DAGSKORT).not.toContain("timer.prosjektkort.nyReise");
  });

  it("regelen: arbeid 7 + reise 2 gir dekning 7, reise 2", () => {
    expect(
      arbeidOgReise([
        { timer: 7, erReise: false },
        { timer: 2, erReise: true },
      ]),
    ).toEqual({ arbeid: 7, reise: 2 });
  });
});
