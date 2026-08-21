import { describe, it, expect } from "vitest";
import { samleRepeaterMarkorer } from "./tegningsmarkorer";
import type { TreObjekt, FeltVerdi } from "@sitedoc/pdf";

// Minimal tre-/data-byggere.
const obj = (id: string, type: string, children: TreObjekt[] = []): TreObjekt =>
  ({ id, type, label: id, required: false, config: {}, sortOrder: 0, parentId: null, children }) as TreObjekt;
const fv = (verdi: unknown): FeltVerdi => ({ verdi, kommentar: "", vedlegg: [] });
const markor = (drawingId: string, x: number, y: number) => fv({ drawingId, positionX: x, positionY: y, drawingName: drawingId });

describe("samleRepeaterMarkorer — rekursiv innsamling (D2b)", () => {
  it("repeater-rader: markør + punkttekst fra søsken-tekstfelt, flat rekkefølge", () => {
    const rep = obj("rep", "repeater", [obj("txt", "text_field"), obj("dp", "drawing_position")]);
    const data: Record<string, FeltVerdi> = {
      rep: fv([
        { txt: fv("Punkt A"), dp: markor("A", 60.7, 75.2) },
        { txt: fv("Punkt B"), dp: markor("A", 84.0, 56.6) },
      ]),
    };
    const m = samleRepeaterMarkorer([rep], data);
    expect(m).toEqual([
      { drawingId: "A", x: 60.7, y: 75.2, punkttekst: "Punkt A", resultat: null },
      { drawingId: "A", x: 84.0, y: 56.6, punkttekst: "Punkt B", resultat: null },
    ]);
  });

  it("REKURSIV: markør i nestet repeater fanges", () => {
    const nested = obj("nr", "repeater", [obj("ndp", "drawing_position")]);
    const rep = obj("rep", "repeater", [obj("txt", "text_field"), nested]);
    const data: Record<string, FeltVerdi> = {
      rep: fv([{ txt: fv("ytre"), nr: fv([{ ndp: markor("C", 10, 20) }]) }]),
    };
    const m = samleRepeaterMarkorer([rep], data);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ drawingId: "C", x: 10, y: 20 });
  });

  it("frittstående (topp-nivå) drawing_position samles IKKE (beholder D2-blokk)", () => {
    const tre = [obj("dp", "drawing_position")];
    const data = { dp: markor("A", 50, 50) };
    expect(samleRepeaterMarkorer(tre, data)).toEqual([]);
  });

  it("tom/ufullstendig markør i rad hoppes over", () => {
    const rep = obj("rep", "repeater", [obj("dp", "drawing_position")]);
    const data = { rep: fv([{ dp: fv(null) }, { dp: fv({ drawingId: "A" }) }, { dp: markor("A", 1, 2) }]) };
    expect(samleRepeaterMarkorer([rep], data)).toHaveLength(1);
  });

  it("resultat fra traffic_light-kolonne når den finnes", () => {
    const rep = obj("rep", "repeater", [obj("st", "traffic_light"), obj("dp", "drawing_position")]);
    const data = { rep: fv([{ st: fv("avvik"), dp: markor("A", 1, 2) }]) };
    expect(samleRepeaterMarkorer([rep], data)[0]!.resultat).toBe("avvik");
  });

  it("negativ-test: markør på tegning A i repeater; tegning B kun doc-lokasjon → samlingen gir KUN A (B kommer via checklist.drawingId)", () => {
    const rep = obj("rep", "repeater", [obj("dp", "drawing_position")]);
    const data = { rep: fv([{ dp: markor("A", 30, 40) }]) };
    const m = samleRepeaterMarkorer([rep], data);
    expect(m.map((x) => x.drawingId)).toEqual(["A"]);
    // B (doc-lokasjon) er IKKE en repeater-markør → ikke her; den legges i
    // tegning-settet via `sjekkliste.drawingId` i sammenstillingen, så BEGGE
    // tegninger havner i PDF-en (A som helside, B som dokument-lokasjon).
  });
});
