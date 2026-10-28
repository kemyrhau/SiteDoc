/**
 * Håndhever taket på rotens CLAUDE.md (Kenneth-vedtak 2026-10-28).
 * Tellemetode = python `len()`: kodepunkter, ikke UTF-16-enheter (`tekst.length` teller emoji dobbelt).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TAK = 15000;
// packages/shared/src/ → rot er tre nivåer opp
const CLAUDE_MD = fileURLToPath(new URL("../../../CLAUDE.md", import.meta.url));

describe("CLAUDE.md-taket", () => {
  it(`er høyst ${TAK} tegn (kodepunkter, som python len())`, () => {
    const antall = [...readFileSync(CLAUDE_MD, "utf-8")].length;
    expect(
      antall,
      `CLAUDE.md er ${antall} tegn, taket er ${TAK}. Flytt innhold til docs/claude/ — se docs/claude/dokumentasjons-standard.md § CLAUDE.md-taket`,
    ).toBeLessThanOrEqual(TAK);
  });
});
