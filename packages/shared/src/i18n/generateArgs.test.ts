import { describe, it, expect } from "vitest";
import { parseOnlyFlag, finnUkjenteOnlyNokler } from "./generateArgs";

describe("parseOnlyFlag", () => {
  it("flagg ikke gitt → null (dagens oppførsel)", () => {
    expect(parseOnlyFlag(["node", "generate.ts"])).toBeNull();
    expect(parseOnlyFlag(["node", "generate.ts", "--force"])).toBeNull();
  });

  it("--only a,b → liste med to nøkler", () => {
    expect(parseOnlyFlag(["node", "g", "--only", "seksjon.a,seksjon.b"])).toEqual([
      "seksjon.a",
      "seksjon.b",
    ]);
  });

  it("--only=a,b (likhetstegn) → samme resultat", () => {
    expect(parseOnlyFlag(["node", "g", "--only=seksjon.a,seksjon.b"])).toEqual([
      "seksjon.a",
      "seksjon.b",
    ]);
  });

  it("nøstede nøkler med punktum treffer full sti (én enkelt nøkkel)", () => {
    expect(parseOnlyFlag(["node", "g", "--only", "oppgave.kommentarSendFeilet"])).toEqual([
      "oppgave.kommentarSendFeilet",
    ]);
  });

  it("trimmer mellomrom og dropper tomme ledd", () => {
    expect(parseOnlyFlag(["node", "g", "--only", " a.b , , c.d "])).toEqual(["a.b", "c.d"]);
  });

  it("--only uten verdi → tom liste (kalleren feiler høyt)", () => {
    expect(parseOnlyFlag(["node", "g", "--only"])).toEqual([]);
    expect(parseOnlyFlag(["node", "g", "--only", "--force"])).toEqual([]);
    expect(parseOnlyFlag(["node", "g", "--only="])).toEqual([]);
  });
});

describe("finnUkjenteOnlyNokler", () => {
  const en = { "a.x": "X", "a.y": "Y" };
  const nb = { "a.x": "X", "a.y": "Y" };

  it("alle nøkler finnes → begge lister tomme", () => {
    expect(finnUkjenteOnlyNokler(["a.x", "a.y"], en, nb)).toEqual({
      manglerEn: [],
      manglerNb: [],
    });
  });

  it("ukjent nøkkel navngis (mangler i begge)", () => {
    expect(finnUkjenteOnlyNokler(["a.x", "finnes.ikke"], en, nb)).toEqual({
      manglerEn: ["finnes.ikke"],
      manglerNb: ["finnes.ikke"],
    });
  });

  it("nøkkel kun i en, ikke nb → fanges av nb-lista (ville blitt stille droppet ved sortering)", () => {
    const enKunX = { "a.x": "X", "a.z": "Z" };
    const nbUtenZ = { "a.x": "X" };
    expect(finnUkjenteOnlyNokler(["a.z"], enKunX, nbUtenZ)).toEqual({
      manglerEn: [],
      manglerNb: ["a.z"],
    });
  });

  it("filtrering er på full sti, ikke seksjon", () => {
    // «a» som seksjon finnes, men «a» som full nøkkel gjør ikke → ukjent.
    expect(finnUkjenteOnlyNokler(["a"], en, nb)).toEqual({
      manglerEn: ["a"],
      manglerNb: ["a"],
    });
  });
});
