import { describe, it, expect } from "vitest";
import { sisteUnikeMaskiner, sorterMaskiner } from "./maskinSortering";

const m = (id: string, internNummer: string | null, navn = id) => ({ id, internNummer, navn });
const navn = (x: { navn: string }) => x.navn;

describe("ORDRE 29: sorterMaskiner", () => {
  const liste = [m("a", "10"), m("b", "2"), m("c", null, "Bobcat"), m("d", null, "Atlas"), m("e", "1")];

  it("uten sist brukt/seddel: internNummer numerisk, tomme sist etter navn (som før)", () => {
    expect(sorterMaskiner(liste, { navn }).map((x) => x.id)).toEqual(["e", "b", "a", "d", "c"]);
  });

  it("sist brukt øverst i nyeste-først-rekkefølge, foran brukt på seddelen", () => {
    const ut = sorterMaskiner(liste, { sistBrukt: ["c", "a"], bruktPaaSeddel: ["b"], navn });
    expect(ut.map((x) => x.id)).toEqual(["c", "a", "b", "e", "d"]);
  });

  it("muterer ikke input", () => {
    const kopi = liste.map((x) => x.id);
    sorterMaskiner(liste, { sistBrukt: ["d"], navn });
    expect(liste.map((x) => x.id)).toEqual(kopi);
  });
});

describe("ORDRE 29: sisteUnikeMaskiner", () => {
  it("dedupliserer og kutter til N = 5, nyeste først", () => {
    expect(sisteUnikeMaskiner(["a", "b", "a", "c", "d", "b", "e", "f", "g"])).toEqual(["a", "b", "c", "d", "e"]);
    expect(sisteUnikeMaskiner(["a", "a"], 5)).toEqual(["a"]);
  });
});
