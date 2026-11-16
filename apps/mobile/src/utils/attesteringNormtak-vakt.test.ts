import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE (33) c3 B10 (§ 11.10.4 Web/Attestering, mobil-delen): attesteringslista på
// telefon viser serverens brudd med den delte linja. Kildevakt — lista er online-only
// og serverfeltet er målt i api-testen (`fravaer-normtak.integration.test.ts`).
const her = dirname(fileURLToPath(import.meta.url));
const LISTE = readFileSync(join(her, "../../app/timer/attestering/index.tsx"), "utf-8");

describe("🔴 B10 — brudd i mobilens attesteringsliste", () => {
  it("leser serverfeltet fravaerNormtakBrudd og bygger linja med den delte funksjonen", () => {
    expect(LISTE).toContain("fravaerNormtakBrudd?: NormtakBruddData | null");
    expect(LISTE).toMatch(/byggNormtakBruddLinje\(t, rad\.fravaerNormtakBrudd, formatKortTall\)/);
  });
});
