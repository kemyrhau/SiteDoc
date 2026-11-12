import { describe, expect, it } from "vitest";
import { forsteRadUtenBeskrivelse, raderForDag } from "./dagsoversiktRader";

const rad = (id: string, projectId: string, fraTid: string | null, timer = 2) => ({ id, projectId, fraTid, timer });

describe("raderForDag (radform 2026-11-12)", () => {
  it("rader i tidsrekkefølge, rader uten fra-tid sist i innkommende orden", () => {
    const d = raderForDag({
      timer: [rad("c", "p1", "12:00"), rad("x", "p1", null), rad("a", "p2", "07:00"), rad("y", "p1", null), rad("b", "p1", "09:30")],
      maskin: [],
      varer: [],
    });
    expect(d.rader.map((b) => b.rad.id)).toEqual(["a", "b", "c", "x", "y"]);
  });

  it("slår aldri sammen rader — to like rader på samme prosjekt gir to bokser", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00", 4), rad("r2", "p1", "07:00", 4)],
      maskin: [],
      varer: [],
    });
    expect(d.rader).toHaveLength(2);
    expect(d.rader.map((b) => b.rad.timer)).toEqual([4, 4]);
  });

  it("maskin og vare med kobling havner under sin rad", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00"), rad("r2", "p2", "11:00")],
      maskin: [{ id: "m1", projectId: "p2", sheetTimerId: "r2" }],
      varer: [{ id: "v1", projectId: "p1", sheetTimerId: "r1" }],
    });
    expect(d.rader[0]!.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(d.rader[1]!.maskin.map((m) => m.id)).toEqual(["m1"]);
    expect(d.utenRad).toEqual({ maskin: [], varer: [] });
  });

  it("gammel vare uten kobling havner under «Uten rad» — aldri skjult", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [{ id: "m1", projectId: "p1", sheetTimerId: null }],
      varer: [{ id: "v1", projectId: "p1" }],
    });
    expect(d.rader[0]!.varer).toEqual([]);
    expect(d.rader[0]!.maskin).toEqual([]);
    expect(d.utenRad.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(d.utenRad.maskin.map((m) => m.id)).toEqual(["m1"]);
  });

  it("kobling til rad på annet prosjekt eller ukjent rad → «Uten rad» (ingen skjønnsplassering)", () => {
    const d = raderForDag({
      timer: [rad("r1", "p1", "07:00")],
      maskin: [],
      varer: [
        { id: "v1", projectId: "p2", sheetTimerId: "r1" },
        { id: "v2", projectId: "p1", sheetTimerId: "slettet" },
      ],
    });
    expect(d.rader[0]!.varer).toEqual([]);
    expect(d.utenRad.varer.map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});

describe("forsteRadUtenBeskrivelse", () => {
  const r = (id: string, beskrivelse: string | null, erReise = false) => ({ id, beskrivelse, erReise });
  it("finner første arbeidsrad uten beskrivelse; blanke teller som mangler", () => {
    expect(forsteRadUtenBeskrivelse([r("a", "Støp"), r("b", "  "), r("c", null)])?.id).toBe("b");
  });
  it("reise krever ikke beskrivelse; alle utfylt → null", () => {
    expect(forsteRadUtenBeskrivelse([r("a", null, true), r("b", "Forskaling")])).toBeNull();
  });
});
