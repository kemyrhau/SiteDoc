import { describe, it, expect } from "vitest";
import { flytFaggruppeIder } from "../flyt-faggrupper";

/**
 * 4b: `company`-feltet begrenses til faggrupper som er MEDLEM av dokumentets flyt. Fasit for den
 * rene utledningen (flyt-løst → null; ellers medlemmenes faggruppeId-er, person/gruppe-ledd uten
 * faggruppe filtreres bort).
 */
describe("flytFaggruppeIder", () => {
  const flyter = [
    {
      id: "flyt-1",
      medlemmer: [
        { faggruppeId: "fag-a" },
        { faggruppeId: null }, // person-/gruppe-ledd uten faggruppe
        { faggruppeId: "fag-b" },
      ],
    },
    { id: "flyt-2", medlemmer: [{ faggruppeId: "fag-c" }] },
  ];

  it("flyt-løst dokument (ingen dokumentflytId) → null (FirmaObjekt viser alle)", () => {
    expect(flytFaggruppeIder(null, flyter)).toBeNull();
    expect(flytFaggruppeIder(undefined, flyter)).toBeNull();
  });

  it("kjent flyt → medlemmenes faggruppeId-er, null-ledd filtrert bort", () => {
    expect(flytFaggruppeIder("flyt-1", flyter)).toEqual(["fag-a", "fag-b"]);
    expect(flytFaggruppeIder("flyt-2", flyter)).toEqual(["fag-c"]);
  });

  it("flytId som ikke finnes → null (behandles som flyt-løst, ikke tom scoping)", () => {
    expect(flytFaggruppeIder("finnes-ikke", flyter)).toBeNull();
  });

  it("flyt uten medlemmer → tom liste (scopet, men ingen faggrupper å velge)", () => {
    expect(flytFaggruppeIder("tom", [{ id: "tom", medlemmer: [] }])).toEqual([]);
  });
});
