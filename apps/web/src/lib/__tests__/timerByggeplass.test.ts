import { describe, expect, it } from "vitest";
import {
  byggeplasserForProsjekt,
  velgStandardByggeplass,
} from "../timerByggeplass";

const A1 = { id: "a1", projectId: "A", name: "Lab 16" };
const A2 = { id: "a2", projectId: "A", name: "Lab 17" };
const B1 = { id: "b1", projectId: "B", name: "Hall B" };
const alle = [A1, A2, B1];

describe("byggeplass per timer-rad (ordre 10)", () => {
  it("🔴 filtrerer på radens prosjekt", () => {
    expect(byggeplasserForProsjekt(alle, "A")).toEqual([A1, A2]);
    expect(byggeplasserForProsjekt(alle, "C")).toEqual([]);
    expect(byggeplasserForProsjekt(undefined, "A")).toEqual([]);
  });

  it("🔴 én byggeplass på prosjektet → velges automatisk", () => {
    expect(
      velgStandardByggeplass({ gjeldende: null, kandidater: [B1], toppbar: null }),
    ).toBe("b1");
  });

  it("🔴 prosjektbytte nullstiller byggeplass som ikke passer", () => {
    // Var a1 på prosjekt A; bytter til B med to kandidater og uten toppbar.
    const kandidaterB = [B1, { id: "b2", projectId: "B", name: "Hall C" }];
    expect(
      velgStandardByggeplass({ gjeldende: "a1", kandidater: kandidaterB, toppbar: null }),
    ).toBeNull();
  });

  it("toppbarens byggeplass forhåndsvelges kun når den hører til prosjektet", () => {
    const kandidaterA = byggeplasserForProsjekt(alle, "A");
    expect(
      velgStandardByggeplass({ gjeldende: null, kandidater: kandidaterA, toppbar: "a2" }),
    ).toBe("a2");
    expect(
      velgStandardByggeplass({ gjeldende: null, kandidater: kandidaterA, toppbar: "b1" }),
    ).toBeNull();
  });

  it("gyldig gjeldende verdi beholdes (brukerens valg overstyres ikke)", () => {
    expect(
      velgStandardByggeplass({ gjeldende: "a1", kandidater: [A1, A2], toppbar: "a2" }),
    ).toBe("a1");
  });
});
