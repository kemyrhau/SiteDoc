import { describe, it, expect } from "vitest";
import { celleTilstand, celleLaast, erVideresendAdminLaast } from "@/lib/flytmatrise-def";
import { PROSJEKTADMIN_ROLLE } from "@sitedoc/shared";

/**
 * H3 (videresend-rettighet, fabel-vedtak 2026-07-26): videresend-celler (`til = "forwarded"`)
 * er admin-only. Flyt-roller ser cellen LÅST (ikke en av-celle man kan slå PÅ, som ville vært
 * en no-op ved runtime); prosjektadmin beholder den PÅ.
 */
describe("flytmatrise — videresend er admin-only (låst for flyt-roller)", () => {
  const flytRoller = ["registrator", "bestiller", "utforer", "godkjenner"] as const;

  it.each(flytRoller)("%s: videresend-celle er låst", (rolle) => {
    expect(erVideresendAdminLaast(rolle, "received", "forwarded")).toBe(true);
    expect(celleLaast(rolle, "received", "forwarded")).toBe(true);
    expect(celleTilstand(rolle, "received", "forwarded", {})).toBe("laast");
    expect(celleTilstand(rolle, "responded", "forwarded", {})).toBe("laast");
  });

  it("prosjektadmin: videresend-celle er PÅ (ikke låst)", () => {
    expect(erVideresendAdminLaast(PROSJEKTADMIN_ROLLE, "received", "forwarded")).toBe(false);
    expect(celleLaast(PROSJEKTADMIN_ROLLE, "received", "forwarded")).toBe(false);
    expect(celleTilstand(PROSJEKTADMIN_ROLLE, "received", "forwarded", {})).toBe("standard-pa");
  });

  it("positiv override kan ikke låse opp videresend for flyt-rolle (låsen vinner)", () => {
    const override = { "utforer:received:forwarded": true };
    expect(celleTilstand("utforer", "received", "forwarded", override)).toBe("laast");
  });

  it("ikke-videresend-celler er upåvirket (utfører received→responded fortsatt PÅ)", () => {
    expect(celleTilstand("utforer", "received", "responded", {})).toBe("standard-pa");
  });
});
