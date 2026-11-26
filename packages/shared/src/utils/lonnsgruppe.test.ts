import { describe, it, expect } from "vitest";
import { filtrerForLonnsgruppe, gjelderLonnsgruppe } from "./lonnsgruppe";

// L1 (spec-lonnsgrupper.md § 2 «stille tomhet» + § 3): tom kobling er en LOVLIG verdi.
// Testen er derfor todelt: uten koblinger er utvalget likt dagens, og med kobling er
// arten borte for alle utenfor gruppa.

const ORDINAER = "g-ordinaer";
const LAERLING = "g-laerling";

const katalog = [
  { id: "170", navn: "Overtid 50%", lonnsgruppeIder: [] as string[] },
  { id: "172", navn: "OT lærling 50%", lonnsgruppeIder: [] as string[] },
  { id: "142", navn: "Skifttillegg lærling 30%", lonnsgruppeIder: [] as string[] },
];

describe("L1 lønnsgruppe — del 1: uten koblinger er utvalget likt dagens", () => {
  it("alle i «Ordinær» og alle lærlinger ser hele katalogen, i samme rekkefølge", () => {
    expect(filtrerForLonnsgruppe(katalog, ORDINAER)).toEqual(katalog);
    expect(filtrerForLonnsgruppe(katalog, LAERLING)).toEqual(katalog);
  });

  it("tom gruppeliste gjelder alle", () => {
    expect(gjelderLonnsgruppe([], ORDINAER)).toBe(true);
    expect(gjelderLonnsgruppe([], "hvilken-som-helst")).toBe(true);
  });
});

describe("L1 lønnsgruppe — del 2: med kobling er arten borte for alle utenfor gruppa", () => {
  const merket = katalog.map((r) =>
    r.id === "172" || r.id === "142" ? { ...r, lonnsgruppeIder: [LAERLING] } : r,
  );

  it("🔴 «Ordinær» ser ikke lærlingartene", () => {
    expect(filtrerForLonnsgruppe(merket, ORDINAER).map((r) => r.id)).toEqual(["170"]);
  });

  it("lærlingen ser sine egne og det som gjelder alle", () => {
    expect(filtrerForLonnsgruppe(merket, LAERLING).map((r) => r.id)).toEqual(["170", "172", "142"]);
  });

  it("en art merket bare «Ordinær» er skjult for lærlingen", () => {
    const bareOrdinaer = merket.map((r) => (r.id === "170" ? { ...r, lonnsgruppeIder: [ORDINAER] } : r));
    expect(filtrerForLonnsgruppe(bareOrdinaer, LAERLING).map((r) => r.id)).toEqual(["172", "142"]);
    expect(filtrerForLonnsgruppe(bareOrdinaer, ORDINAER).map((r) => r.id)).toEqual(["170"]);
  });

  it("en art merket med flere grupper gjelder hver av dem", () => {
    expect(gjelderLonnsgruppe([ORDINAER, LAERLING], LAERLING)).toBe(true);
    expect(gjelderLonnsgruppe([ORDINAER, LAERLING], ORDINAER)).toBe(true);
    expect(gjelderLonnsgruppe([ORDINAER, LAERLING], "g-prosjektleder")).toBe(false);
  });
});
