import { describe, it, expect } from "vitest";
import { byggRadkort, repeaterErRik } from "./radkort";
import type { TreObjekt, FeltVerdi } from "../typer";

const barn = (id: string, type: string, label: string, sortOrder: number, children: TreObjekt[] = []): TreObjekt =>
  ({ id, type, label, required: false, config: {}, sortOrder, parentId: "rep", children }) as TreObjekt;

// BEF-002-form: rik repeater «Befaring» (drawing_position + nestet repeater → rik).
// Barn-rekkefølge = malbygger-rekkefølge (mockup 2a): Beskrivelse, Posisjon, Kantstein, Repeater.
const BEFARING: TreObjekt = {
  id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null,
  children: [
    barn("txt", "text_field", "Beskrivelse", 0),
    barn("dp", "drawing_position", "Posisjon i tegning", 1),
    barn("calc", "calculation", "Kantstein", 2),
    barn("nrep", "repeater", "Repeater", 3, [barn("x", "text_field", "X", 0)]),
  ],
} as TreObjekt;

const fv = (verdi: unknown, kommentar = "", vedlegg: unknown[] = []): FeltVerdi =>
  ({ verdi, kommentar, vedlegg }) as FeltVerdi;
const markor = (utsnitt?: string) =>
  fv({ drawingId: "d1", positionX: 60.65, positionY: 75.2, drawingName: "Z-20-01", ...(utsnitt ? { utsnittDataUrl: utsnitt } : {}) });
const bilde = (nr: number, filnavn: string) => ({ id: filnavn, type: "bilde", url: `data:image/jpeg;base64,${nr}`, filnavn, bildeNr: nr, opprettet: "2026-08-21T16:53:00Z" });

describe("repeaterErRik — formvalg", () => {
  it("drawing_position/nestet repeater/attachments → rik", () => {
    expect(repeaterErRik(BEFARING)).toBe(true);
  });
  it("helskalar → ikke rik (beholder tabell)", () => {
    const skalar: TreObjekt = { ...BEFARING, children: [barn("a", "text_field", "A", 0), barn("b", "calculation", "B", 1)] } as TreObjekt;
    expect(repeaterErRik(skalar)).toBe(false);
  });
});

describe("byggRadkort — mockup 2a (BEF-002)", () => {
  const rad1 = { txt: fv("Denne vises på print"), dp: markor("data:image/jpeg;base64,CROP1", ), calc: fv(null), nrep: fv([]) };
  // legg merknad + bilder på posisjonsfeltet i rad 1
  rad1.dp = fv({ drawingId: "d1", positionX: 60.65, positionY: 75.2, drawingName: "Z-20-01", utsnittDataUrl: "data:image/jpeg;base64,CROP1" }, "Repeater 1 setter en lokasjon", [bilde(10, "IMG_4821.jpg"), bilde(11, "IMG_4830.jpg")]);
  const rad2 = { txt: fv("repeater 2 setter en annen posisjon", "", [bilde(9, "IMG_4830.jpg")]), dp: markor("data:image/jpeg;base64,CROP2"), calc: fv(null), nrep: fv([]) };

  const html = byggRadkort(BEFARING, [rad1, rad2], "Befaring");

  it("ett kort per rad m/ header (nr + «Befaring — rad N» + markør-henvisning)", () => {
    expect(html).toContain("Befaring — rad 1");
    expect(html).toContain("Befaring — rad 2");
    expect(html).toContain("markør 1 på tegningssiden");
    expect(html).toContain("markør 2 på tegningssiden");
    expect((html.match(/ark-radkort-nr/g) ?? [])).toHaveLength(2);
    // Ingen tabell for rik repeater.
    expect(html).not.toContain("<table");
  });

  it("felt i malbygger-rekkefølge, ett per linje, med label", () => {
    const iBeskr = html.indexOf("Beskrivelse");
    const iPos = html.indexOf("Posisjon i tegning");
    const iKant = html.indexOf("Kantstein");
    expect(iBeskr).toBeGreaterThan(-1);
    expect(iPos).toBeGreaterThan(iBeskr);
    expect(iKant).toBeGreaterThan(iPos);
  });

  it("drawing_position: koordinat + detaljutsnitt + kursiv merknad", () => {
    expect(html).toContain("Z-20-01 (60,7 %, 75,2 %)");
    expect(html).toContain("ark-radkort-utsnitt");
    expect(html).toContain("data:image/jpeg;base64,CROP1");
    expect(html).toContain("Merknad: Repeater 1 setter en lokasjon");
  });

  it("tomt skalar-felt → «Ikke utfylt» (aldri utelatt); nestet repeater tom → «Ingen rader»", () => {
    expect(html).toContain("Ikke utfylt");
    expect(html).toContain("Ingen rader");
  });

  it("bilder hos SITT felt: 2×2-blokk m/ bildetekst «Bilde NN — filnavn · dato»", () => {
    expect(html).toContain("ark-radkort-bildefelt");
    expect(html).toContain("Bilde 10 — IMG_4821.jpg");
    expect(html).toMatch(/Bilde 10 — IMG_4821\.jpg · 21\.08\.2026/); // tidssone-uavhengig dato
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("tom repeater → «Ingen rader registrert»", () => {
    expect(byggRadkort(BEFARING, [], "Befaring")).toContain("Ingen rader registrert");
  });
});
