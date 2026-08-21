import { describe, it, expect } from "vitest";
import { byggRepeaterTabell } from "./repeater";
import type { TreObjekt } from "../typer";

// Repeater med ett drawing_position-barn (funn 2a: cellen skal ikke dumpe JSON).
const REPEATER: TreObjekt = {
  id: "rep",
  type: "repeater",
  label: "Observasjoner",
  required: false,
  config: {},
  sortOrder: 0,
  parentId: null,
  children: [
    {
      id: "dp",
      type: "drawing_position",
      label: "Posisjon i tegning",
      required: false,
      config: {},
      sortOrder: 0,
      parentId: "rep",
      children: [],
    },
  ],
};

const rader = (dpVerdi: unknown) => [
  { dp: { verdi: dpVerdi, kommentar: "", vedlegg: [] } },
];

describe("byggRepeaterTabell — drawing_position-celle (funn 2a)", () => {
  it("komplett markør → «<tegningsnavn> (X,X %, Y,Y %)», ALDRI rå JSON", () => {
    const html = byggRepeaterTabell(
      REPEATER,
      rader({
        drawingId: "c0822581-aaaa",
        positionX: 75.17,
        positionY: 35.22,
        drawingName: "Skjermbilde 2026-03-05 kl. 17.19.35",
      }),
      REPEATER.label,
    );
    expect(html).toContain("Skjermbilde 2026-03-05 kl. 17.19.35 (75,2 %, 35,2 %)");
    // Rotårsaken: ingen rå koordinat-JSON i cellen.
    expect(html).not.toContain("drawingId");
    expect(html).not.toContain("positionX");
    expect(html).not.toContain("{");
  });

  it("uten drawingName → faller til «Tegning»", () => {
    const html = byggRepeaterTabell(
      REPEATER,
      rader({ drawingId: "d1", positionX: 10, positionY: 20 }),
      REPEATER.label,
    );
    expect(html).toContain("Tegning (10,0 %, 20,0 %)");
    expect(html).not.toContain("drawingId");
  });

  it("ufullstendig markør (position null) → «Ikke utfylt», ikke JSON", () => {
    const html = byggRepeaterTabell(
      REPEATER,
      rader({ drawingId: "d1", positionX: null, positionY: null }),
      REPEATER.label,
    );
    expect(html).toContain("Ikke utfylt");
    expect(html).not.toContain("drawingId");
    expect(html).not.toContain("{");
  });

  it("tom celle (ingen markør) → «Ikke utfylt»", () => {
    const html = byggRepeaterTabell(REPEATER, rader(null), REPEATER.label);
    expect(html).toContain("Ikke utfylt");
  });
});
