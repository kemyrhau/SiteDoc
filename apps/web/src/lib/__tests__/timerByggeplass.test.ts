import { describe, expect, it } from "vitest";
import {
  byggeplasserForProsjekt,
  velgStandardByggeplass,
  byggeplassErEndret,
  byggeplassPayload,
  radByggeplassLinje,
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

/**
 * Ordre (12) B — «utelatt = urørt» på klientsiden: redigering av en eksisterende rad
 * sender byggeplassId KUN når brukeren har endret den. Fjernes betingelsen, sender
 * web null/gammel verdi og overskriver byggeplassen mobilen satte.
 */
describe("byggeplassErEndret / byggeplassPayload (ordre 12 B)", () => {
  it("🔴 eksisterende rad, uendret byggeplass → feltet utelates i payloaden", () => {
    const endret = byggeplassErEndret({ erNy: false, opprinnelig: "bp-1", byggeplassId: "bp-1" });
    expect(endret).toBe(false);
    const payload = byggeplassPayload({ endret, byggeplassId: "bp-1" });
    expect(payload).toEqual({});
    expect("byggeplassId" in payload).toBe(false);
  });

  it("🔴 eksisterende rad uten byggeplass, uendret → utelatt (ikke null)", () => {
    const endret = byggeplassErEndret({ erNy: false, opprinnelig: null, byggeplassId: null });
    expect(byggeplassPayload({ endret, byggeplassId: null })).toEqual({});
  });

  it("eksisterende rad, endret eller tømt → sendes", () => {
    expect(
      byggeplassPayload({
        endret: byggeplassErEndret({ erNy: false, opprinnelig: "bp-1", byggeplassId: "bp-2" }),
        byggeplassId: "bp-2",
      }),
    ).toEqual({ byggeplassId: "bp-2" });
    expect(
      byggeplassPayload({
        endret: byggeplassErEndret({ erNy: false, opprinnelig: "bp-1", byggeplassId: null }),
        byggeplassId: null,
      }),
    ).toEqual({ byggeplassId: null });
  });

  it("ny rad sender alltid, også null", () => {
    const endret = byggeplassErEndret({ erNy: true, opprinnelig: null, byggeplassId: null });
    expect(byggeplassPayload({ endret, byggeplassId: null })).toEqual({ byggeplassId: null });
  });
});

describe("V22 — «Prosjekt · Byggeplass»-linja på timeraden", () => {
  const t = (k: string) => k;
  const linje = (o: Partial<Parameters<typeof radByggeplassLinje>[0]>) =>
    radByggeplassLinje({
      radByggeplassId: null,
      sedelByggeplassId: null,
      projectId: "A",
      byggeplasser: alle,
      kortModus: false,
      t,
      ...o,
    });

  it("🔴 egen byggeplass på raden vises med navn, ikke nedtonet", () => {
    expect(linje({ radByggeplassId: "a2", sedelByggeplassId: "a1" })).toEqual({
      tekst: "Lab 17",
      arvet: false,
      ingen: false,
    });
  });

  it("🔴 arvet fra dagskortet merkes «(fra dagskortet)»", () => {
    expect(linje({ sedelByggeplassId: "a1" })).toEqual({
      tekst: "Lab 16 (timer.byggeplass.fraDagskort)",
      arvet: true,
      ingen: false,
    });
  });

  it("i prosjektkort-modus heter arven «fra dagen» (som mobil)", () => {
    expect(linje({ sedelByggeplassId: "a1", kortModus: true }).tekst).toBe(
      "Lab 16 (timer.byggeplass.fraDagen)",
    );
  });

  it("🔴 dagskortets byggeplass på et annet prosjekt arves ikke", () => {
    expect(linje({ sedelByggeplassId: "b1" })).toEqual({
      tekst: "timer.byggeplass.ingenValgt",
      arvet: false,
      ingen: true,
    });
  });

  it("🔴 mangler begge → «Ingen byggeplass»", () => {
    expect(linje({}).ingen).toBe(true);
    expect(linje({}).tekst).toBe("timer.byggeplass.ingenValgt");
    expect(linje({ radByggeplassId: "slettet" }).ingen).toBe(true);
    expect(linje({ sedelByggeplassId: "a1", byggeplasser: undefined }).ingen).toBe(true);
  });
});
