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

  it("bilder hos SITT felt: 2×2-blokk m/ bildetekst «Bilde NN · dato», UTEN internt filnavn", () => {
    expect(html).toContain("ark-radkort-bildefelt");
    expect(html).toMatch(/Bilde 10 · 21\.08\.2026/); // null-padet løpenr + tidssone-uavhengig dato
    // Filnavnet er internt og utgår (vedtak 2026-08-16) — skal ALDRI i PDF-en.
    // IMG_<epoch>.jpg er kilden til «13-sifret tall»-funnet (Kenneth, bygg 51).
    expect(html).not.toContain("IMG_4821.jpg");
    expect(html).not.toContain(".jpg");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("løpenr null-pades til to siffer og filnavnets talldel lekker aldri", () => {
    const rad = { txt: fv("x"), dp: markor(), calc: fv(null), nrep: fv([]) };
    rad.txt = fv("x", "", [bilde(3, "IMG_1788458160749.jpg")]);
    const h = byggRadkort(BEFARING, [rad], "Befaring");
    expect(h).toContain("Bilde 03");
    expect(h).not.toContain("1788458160749");
  });

  it("tom repeater → «Ingen rader registrert»", () => {
    expect(byggRadkort(BEFARING, [], "Befaring")).toContain("Ingen rader registrert");
  });
});

describe("funn 2026-09-04 — navnløs feltlabel («_») vises aldri rått", () => {
  // Malbyggeren lagrer tom feltlabel som «_». Rått gir det en naken understrek som feltnavn.
  const MEDNAVNLOS: TreObjekt = {
    id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null,
    children: [
      barn("txt", "text_field", "Beskrivelse", 0),
      barn("blank", "text_field", "_", 1),
      barn("dp", "drawing_position", "Posisjon i tegning", 2),
    ],
  } as TreObjekt;

  it("navnløst felt MED verdi → verdien ALENE, ingen etikettlinje, aldri understrek", () => {
    const rad = { txt: fv("A"), blank: fv("En verdi som må bevares"), dp: fv(null) };
    const html = byggRadkort(MEDNAVNLOS, [rad], "Befaring");
    // Understreken skal ikke stå som label (strengen «_»).
    expect(html).not.toContain(`>_</div>`);
    // Ingen påført etikett — brukeren valgte navnet bort bevisst.
    expect(html).not.toContain("Felt 2");
    // Verdien tapes ALDRI (ikke datatap i byggherre-leveransen).
    expect(html).toContain("En verdi som må bevares");
    // Feltet finnes fortsatt (verdi-node), bare uten label-node for dette feltet.
    const kropp = html.slice(html.indexOf("ark-radkort-kropp"));
    const labels = (kropp.match(/ark-radkort-label/g) ?? []).length;
    // Kun «Beskrivelse» og «Posisjon i tegning» har label — det navnløse har ingen.
    expect(labels).toBe(2);
  });

  it("navnløst felt MED merknad (uten verdi) beholdes — merknaden er innhold", () => {
    const rad = { txt: fv("A"), blank: fv(null, "En merknad bærer informasjon"), dp: fv(null) };
    const html = byggRadkort(MEDNAVNLOS, [rad], "Befaring");
    expect(html).toContain("En merknad bærer informasjon");
    expect(html).not.toContain(`>_</div>`);
  });

  it("navnløst OG tomt felt → utelates helt (ingen «_», ingen tom «Ikke utfylt»-støy)", () => {
    const rad = { txt: fv("A"), blank: fv(null), dp: fv(null) };
    const html = byggRadkort(MEDNAVNLOS, [rad], "Befaring");
    expect(html).not.toContain(`>_</div>`);
    // Kontroll: navngitte tomme felt vises fortsatt (Posisjon i tegning).
    expect(html).toContain("Posisjon i tegning");
    // Det navnløse tomme feltet gir verken label eller verdi-node utover de navngitte.
    const kropp = html.slice(html.indexOf("ark-radkort-kropp"));
    expect((kropp.match(/ark-radkort-label/g) ?? []).length).toBe(2);
  });

  it("navngitt tomt felt påvirkes ikke (vises som før)", () => {
    // «Beskrivelse» har navn og er tom → skal fortsatt vises med «Ikke utfylt».
    const rad = { txt: fv(null), blank: fv("x"), dp: fv(null) };
    const html = byggRadkort(MEDNAVNLOS, [rad], "Befaring");
    expect(html).toContain("Beskrivelse");
  });
});

describe("funn #4 (hull 1) — skalar-rad-kommentar rendres (var tapt i radkort)", () => {
  it("skalar-felt med kommentar → «Merknad: …» under verdien", () => {
    const rad = { txt: fv("En verdi", "Skalar-kommentar her"), dp: fv(null), calc: fv(null), nrep: fv([]) };
    const html = byggRadkort(BEFARING, [rad], "Befaring");
    expect(html).toContain("En verdi");
    expect(html).toContain("Merknad: Skalar-kommentar her");
  });

  it("calculation-felt (skalar-gren) med kommentar → merknad rendres òg", () => {
    const rad = { txt: fv("V"), dp: fv(null), calc: fv(42, "Kalk-kommentar"), nrep: fv([]) };
    expect(byggRadkort(BEFARING, [rad], "Befaring")).toContain("Merknad: Kalk-kommentar");
  });

  it("skalar-felt UTEN kommentar → ingen tom merknad-node", () => {
    const rad = { txt: fv("Bare verdi"), dp: fv(null), calc: fv(null), nrep: fv([]) };
    const html = byggRadkort(BEFARING, [rad], "Befaring");
    expect(html).not.toContain("Merknad:");
    expect(html).not.toContain("ark-radkort-merknad");
  });

  it("ÉN kilde: drawing_position-merknaden er byte-identisk uendret (låst plass, mockup 2a)", () => {
    // Samme rad som mockup-testen: merknaden står inne i posisjon-tekst-kolonnen, under koordinaten.
    const rad = {
      txt: fv("x"), calc: fv(null), nrep: fv([]),
      dp: fv({ drawingId: "d1", positionX: 60.65, positionY: 75.2, drawingName: "Z-20-01", utsnittDataUrl: "data:image/jpeg;base64,C" }, "På låst plass"),
    };
    const html = byggRadkort(BEFARING, [rad], "Befaring");
    // merknaden ligger fortsatt INNE i posisjon-tekst (mellom koord og blokk-slutt), ikke etter hele feltet
    expect(html).toContain(`<div class="ark-celle-koord">Z-20-01 (60,7 %, 75,2 %)</div><div class="ark-radkort-merknad">Merknad: På låst plass</div></div></div>`);
  });
});
