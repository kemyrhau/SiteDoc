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

  // Task 1 (Kenneth 2026-08-21): detaljutsnittet inn i cellen (koordinat + utsnitt).
  it("markør m/ injisert utsnittDataUrl → koordinat + detaljutsnitt i cella", () => {
    const html = byggRepeaterTabell(
      REPEATER,
      rader({ drawingId: "d1", positionX: 60.65, positionY: 75.2, drawingName: "Z-20-01", utsnittDataUrl: "data:image/jpeg;base64,CROP" }),
      REPEATER.label,
    );
    expect(html).toContain("Z-20-01 (60,7 %, 75,2 %)");
    expect(html).toContain("ark-celle-utsnitt");
    expect(html).toContain("data:image/jpeg;base64,CROP");
  });

  it("markør UTEN utsnittDataUrl → kun koordinat, ingen utsnitt-node", () => {
    const html = byggRepeaterTabell(
      REPEATER,
      rader({ drawingId: "d1", positionX: 10, positionY: 20, drawingName: "Z" }),
      REPEATER.label,
    );
    expect(html).toContain("Z (10,0 %, 20,0 %)");
    expect(html).not.toContain("ark-celle-utsnitt");
  });
});

// Task 3 (Kenneth 2026-08-21): repeater-celle-kommentar skrives ut (som felt.ts).
describe("byggRepeaterTabell — celle-kommentar (funn 3-følge)", () => {
  const TXT: TreObjekt = {
    id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null,
    children: [{ id: "txt", type: "text_field", label: "Beskrivelse", required: false, config: {}, sortOrder: 0, parentId: "rep", children: [] }],
  };

  it("celle med kommentar → kommer med (.kommentar)", () => {
    const html = byggRepeaterTabell(
      TXT,
      [{ txt: { verdi: "Vegg", kommentar: "Repeater 1 setter en lokasjon", vedlegg: [] } }],
      TXT.label,
    );
    expect(html).toContain('class="kommentar"');
    expect(html).toContain("Repeater 1 setter en lokasjon");
  });

  it("celle uten kommentar → ingen tom kommentar-node", () => {
    const html = byggRepeaterTabell(
      TXT,
      [{ txt: { verdi: "Vegg", kommentar: "", vedlegg: [] } }],
      TXT.label,
    );
    expect(html).not.toContain('class="kommentar"');
  });
});
