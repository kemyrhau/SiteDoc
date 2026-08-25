import { describe, it, expect } from "vitest";
import { samleRepeaterMarkorer } from "./tegningsmarkorer";
import type { TreObjekt, FeltVerdi } from "@sitedoc/pdf";

const obj = (id: string, type: string, children: TreObjekt[] = []): TreObjekt =>
  ({ id, type, label: id, required: false, config: {}, sortOrder: 0, parentId: null, children }) as TreObjekt;
const fv = (verdi: unknown): FeltVerdi => ({ verdi, kommentar: "", vedlegg: [] });
const markor = (drawingId: string, x: number, y: number) => fv({ drawingId, positionX: x, positionY: y, drawingName: drawingId });

describe("samleRepeaterMarkorer — rekursiv innsamling (D2b)", () => {
  it("markør + radnr (1-basert) + markorObj-referanse, flat rekkefølge", () => {
    const rep = obj("rep", "repeater", [obj("txt", "text_field"), obj("dp", "drawing_position")]);
    const data: Record<string, FeltVerdi> = {
      rep: fv([
        { txt: fv("Punkt A"), dp: markor("A", 60.7, 75.2) },
        { txt: fv("Punkt B"), dp: markor("A", 84.0, 56.6) },
      ]),
    };
    const m = samleRepeaterMarkorer([rep], data);
    expect(m.map((x) => ({ drawingId: x.drawingId, x: x.x, y: x.y, radnr: x.radnr }))).toEqual([
      { drawingId: "A", x: 60.7, y: 75.2, radnr: 1 },
      { drawingId: "A", x: 84.0, y: 56.6, radnr: 2 },
    ]);
    // markorObj peker på selve markør-verdien → injeksjon treffer data-treet.
    m[0]!.markorObj.utsnittDataUrl = "data:x";
    expect((data.rep!.verdi as Record<string, FeltVerdi>[])[0]!.dp!.verdi as Record<string, unknown>).toMatchObject({
      utsnittDataUrl: "data:x",
    });
  });

  it("REKURSIV: markør i nestet repeater fanges (radnr = nestet radindeks)", () => {
    const nested = obj("nr", "repeater", [obj("ndp", "drawing_position")]);
    const rep = obj("rep", "repeater", [obj("txt", "text_field"), nested]);
    const data: Record<string, FeltVerdi> = {
      rep: fv([{ txt: fv("ytre"), nr: fv([{ ndp: markor("C", 10, 20) }]) }]),
    };
    const m = samleRepeaterMarkorer([rep], data);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ drawingId: "C", x: 10, y: 20, radnr: 1 });
  });

  it("frittstående (topp-nivå) drawing_position samles IKKE (beholder D2-blokk)", () => {
    expect(samleRepeaterMarkorer([obj("dp", "drawing_position")], { dp: markor("A", 50, 50) })).toEqual([]);
  });

  it("tom/ufullstendig markør i rad hoppes over", () => {
    const rep = obj("rep", "repeater", [obj("dp", "drawing_position")]);
    const data = { rep: fv([{ dp: fv(null) }, { dp: fv({ drawingId: "A" }) }, { dp: markor("A", 1, 2) }]) };
    expect(samleRepeaterMarkorer([rep], data)).toHaveLength(1);
  });

  it("negativ-test: markør på tegning A (repeater); tegning B kun doc-lokasjon → samlingen gir KUN A", () => {
    const rep = obj("rep", "repeater", [obj("dp", "drawing_position")]);
    const m = samleRepeaterMarkorer([rep], { rep: fv([{ dp: markor("A", 30, 40) }]) });
    expect(m.map((x) => x.drawingId)).toEqual(["A"]);
    // B (doc-lokasjon) legges i tegning-settet via `sjekkliste.drawingId`, så BEGGE
    // tegninger havner i PDF-en (A som helside, B som dokument-lokasjon).
  });
});
