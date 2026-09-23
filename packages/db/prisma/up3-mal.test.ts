import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UP3_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UP3 «Sandfangkum og hjelpesluk» (NY, ordre UP-deling § 7). To trær: type (FØR, forelder for
 * sandvolum + dykker i UNDER → `barnAv` kryss-fase) og materiale (FØR → barn UNDER). Gevinsten ved å
 * skille UP3 ut er at sandfang slipper renneløp/ventil/uttak — men det er IKKE fravær av forgrening
 * (normen deler UP3 på materiale og dykker).
 */

const felt = (label: string): FeltDef => {
  const f = UP3_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];

describe("UP3 – sandfangkum og hjelpesluk (ny)", () => {
  it("er malen for UP3 i kapittel UP", () => {
    expect(UP3_MAL.referanse).toBe("UP3");
    expect(UP3_MAL.kapittelKode).toBe("UP");
    expect(UP3_MAL.navn).toBe("UP3 – Sandfangkum og hjelpesluk");
  });

  it("type er forelder (FØR); sandvolum og dykker vises kun for Sandfangkum, i UNDER", () => {
    expect(felt("Type").ref).toBe("type");
    expect(felt("Type").fase).toBe("FØR");
    expect(felt("Type").config?.options).toEqual(["Sandfangkum", "Hjelpesluk"]);
    for (const l of ["Sandvolum og høyde til utløp", "Dykker og tilgang for tømming"]) {
      expect(felt(l).parentRef, l).toBe("type");
      expect(eget(felt(l)), l).toEqual(["Sandfangkum"]);
      expect(felt(l).fase, l).toBe("UNDER");
    }
  });

  it("materiale er forelder (Betong/Plast); INGEN M4", () => {
    expect(felt("Materiale").config?.options).toEqual(["Betong", "Plast"]);
    expect(eget(felt("Kumskjøt og pakninger"))).toEqual(["Betong"]);
    expect(eget(felt("Oppføringsrør og form"))).toEqual(["Plast"]);
    expect(UP3_MAL.felter.some((f) => f.label === "Plasstøpt kumbunn")).toBe(false);
  });

  it("et hjelpesluk viser ingen sandfang-grener (to foreldre, uavhengige trær)", () => {
    // Hjelpesluk utløser verken sandvolum eller dykker → begge har Sandfangkum som eneste utløser.
    const sandfangGrener = UP3_MAL.felter.filter((f) => f.parentRef === "type");
    expect(sandfangGrener).toHaveLength(2);
    for (const g of sandfangGrener) expect(eget(g)).not.toContain("Hjelpesluk");
  });

  it("§7b: ingen Matrise/NS-EN/NS 3420/bajonett", () => {
    for (const f of UP3_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(tekst).not.toMatch(/Matrise|NS-EN|NS 3420|bajonett/i);
    }
  });
});
