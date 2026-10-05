import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// V19-C (C-3): mobilens forslag (SheetTimerForslag) er IKKE lønnsdata og skal ALDRI
// ut i rapport/eksport/PDF (paritetsmatrisen, M15). Eksporten leser kun sheet_timer
// via byggDetaljRader. Denne vakten feiler rødt hvis noen senere drar forslag-begrepet
// inn i eksport-modulen eller detalj-rad-byggeren. Serveren har sin egen lekkasje-
// vakt (spec § 6.1d, grep + ende-til-ende); dette er web-/shared-speilet.

function les(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf-8");
}

const FORSLAG_SPOR =
  /forslag|SheetTimerForslag|forsonDagskort|byggForsonInputFraValg|parForslagMotSedel|ForslagValgSeksjon/i;

describe("V19-C (C-3) — forslag lekker aldri inn i eksport-stien", () => {
  it("timer-rapport-eksport.ts refererer aldri forslaget", () => {
    expect(les("../lib/timer-rapport-eksport.ts")).not.toMatch(FORSLAG_SPOR);
  });

  it("detalj-rad-byggeren (timerDetaljRader) refererer aldri forslaget", () => {
    expect(les("../../../../packages/shared/src/utils/timerDetaljRader.ts")).not.toMatch(
      FORSLAG_SPOR,
    );
  });
});
