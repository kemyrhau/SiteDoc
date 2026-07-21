import { describe, it, expect } from "vitest";
import { grupperMedOverskrift } from "./seksjoner";

type O = { id: string; type: string; parentId?: string | null };
const o = (id: string, type: string, parentId: string | null = null): O => ({ id, type, parentId });

describe("grupperMedOverskrift", () => {
  it("felter før første heading blir ledende seksjon (overskrift null)", () => {
    const s = grupperMedOverskrift([o("1", "location"), o("2", "text_field")]);
    expect(s).toHaveLength(1);
    expect(s[0]!.overskrift).toBeNull();
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["1", "2"]);
  });

  it("hver rot-heading starter ny seksjon, felter til neste heading", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("a", "decimal"),
      o("b", "text_field"),
      o("h2", "heading"),
      o("c", "integer"),
    ]);
    expect(s).toHaveLength(2);
    expect(s[0]!.overskrift?.id).toBe("h1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["a", "b"]);
    expect(s[1]!.overskrift?.id).toBe("h2");
    expect(s[1]!.felter.map((f) => f.id)).toEqual(["c"]);
  });

  it("ledende felter + påfølgende heading-seksjon", () => {
    const s = grupperMedOverskrift([o("loc", "location"), o("h1", "heading"), o("a", "decimal")]);
    expect(s).toHaveLength(2);
    expect(s[0]!.overskrift).toBeNull();
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["loc"]);
    expect(s[1]!.overskrift?.id).toBe("h1");
  });

  it("nestet heading (har parentId) er IKKE seksjonsgrense — forblir inline-felt", () => {
    const s = grupperMedOverskrift([
      o("h1", "heading"),
      o("rep", "repeater"),
      o("nested", "heading", "rep"), // barn-heading
      o("a", "decimal"),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.overskrift?.id).toBe("h1");
    expect(s[0]!.felter.map((f) => f.id)).toEqual(["rep", "nested", "a"]);
  });

  it("tom liste → ingen seksjoner", () => {
    expect(grupperMedOverskrift([])).toEqual([]);
  });
});
