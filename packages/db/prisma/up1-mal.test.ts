import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { UP1_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * UP1 «Nedstigningskum i grunnen» (REVISJON, ordre UP-deling 2026-09-22). To uavhengige trær:
 * kumtype (FØR) og materiale (FØR). Kumtype-grener (renneløp/ventil/uttak/stikkledning) i UNDER,
 * brannkumskilt (barn av uttak) i ETTER → alle bygget med `barnAv` (kryss-fase, §1f). 20 felt,
 * 12 alltid synlige (Type kum, Materiale, B1–B10).
 *
 * §7b/§7c: SP/OV/AF/V/SF er prosjekteringsbetegnelser (tillatt). Ingen Matrise/NS-EN/NS 3420/bajonett.
 */

const felt = (label: string): FeltDef => {
  const f = UP1_MAL.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};
const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];

describe("UP1 v-revisjon – nedstigningskum, to trær", () => {
  it("er malen for UP1 i kapittel UP", () => {
    expect(UP1_MAL.referanse).toBe("UP1");
    expect(UP1_MAL.kapittelKode).toBe("UP");
    expect(UP1_MAL.navn).toBe("UP1 – Nedstigningskum i grunnen");
  });

  it("har 20 felt; 12 alltid synlige (Type kum, Materiale, B1–B10)", () => {
    expect(UP1_MAL.felter).toHaveLength(20);
    const alltid = UP1_MAL.felter.filter((f) => !f.parentRef);
    expect(alltid).toHaveLength(12);
  });

  it("to uavhengige foreldre: kumtype og materiale (ulike ref, conditionActive)", () => {
    expect(felt("Type kum").ref).toBe("kumtype");
    expect(felt("Type kum").config?.conditionActive).toBe(true);
    expect(felt("Materiale").ref).toBe("materiale");
    expect(felt("Materiale").config?.conditionActive).toBe(true);
  });

  it("kumtype-grener: renneløp for SP/OV/AF, ventil/uttak/stikkledning for V", () => {
    expect(felt("Renneløp gjennom kummen").parentRef).toBe("kumtype");
    expect(eget(felt("Renneløp gjennom kummen"))).toEqual([
      "Spillvannskum (SP)", "Overvannskum (OV)", "Felleskum (AF)",
    ]);
    for (const l of ["Hovedventil", "Brannvannsuttak på ventilen", "Stikkledningsuttak fra kummen"]) {
      expect(felt(l).parentRef, l).toBe("kumtype");
      expect(eget(felt(l)), l).toEqual(["Vannkum (V)"]);
    }
  });

  it("uttak er BÅDE barn av kumtype OG forelder for skiltet; skiltet vises ved brannkum", () => {
    const uttak = felt("Brannvannsuttak på ventilen");
    expect(uttak.parentRef).toBe("kumtype");
    expect(uttak.ref).toBe("uttak");
    expect(uttak.config?.conditionActive).toBe(true);
    const skilt = felt("Brannkumskilt");
    expect(skilt.parentRef).toBe("uttak");
    expect(eget(skilt)).toEqual(["Ja – kummen er brannkum"]);
  });

  it("materialegrener: M2 for Betongelementer, M3 for Plast, M4 for plasstøpt kumbunn", () => {
    expect(felt("Kumskjøt og pakninger").parentRef).toBe("materiale");
    expect(eget(felt("Kumskjøt og pakninger"))).toEqual(["Betongelementer"]);
    expect(eget(felt("Oppføringsrør og form"))).toEqual(["Plast"]);
    expect(eget(felt("Plasstøpt kumbunn"))).toEqual(["Kumbunn av plasstøpt betong"]);
  });

  it("faser: type/materiale i FØR, kumtype-grener + material-grener i UNDER, skilt i ETTER", () => {
    expect(felt("Type kum").fase).toBe("FØR");
    expect(felt("Materiale").fase).toBe("FØR");
    for (const l of ["Renneløp gjennom kummen", "Hovedventil", "Brannvannsuttak på ventilen", "Stikkledningsuttak fra kummen", "Kumskjøt og pakninger", "Oppføringsrør og form", "Plasstøpt kumbunn"]) {
      expect(felt(l).fase, l).toBe("UNDER");
    }
    expect(felt("Brannkumskilt").fase).toBe("ETTER");
  });

  it("alle barn bruker conditionOwnValues, aldri conditionValues", () => {
    for (const b of UP1_MAL.felter.filter((f) => f.parentRef)) {
      expect(b.config, b.label).not.toHaveProperty("conditionValues");
      expect(eget(b).length, b.label).toBeGreaterThan(0);
    }
  });

  it("§7b: ingen Matrise/NS-EN/NS 3420/bajonett i felt eller hjelpetekst", () => {
    for (const f of UP1_MAL.felter) {
      const tekst = `${f.label} ${(f.config?.helpText as string) ?? ""} ${((f.config?.options as string[]) ?? []).join(" ")}`;
      expect(tekst).not.toMatch(/Matrise|NS-EN|NS 3420|bajonett/i);
    }
  });
});
