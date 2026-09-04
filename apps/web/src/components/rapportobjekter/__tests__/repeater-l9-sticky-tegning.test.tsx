// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { RepeaterObjekt } from "../RepeaterObjekt";

/**
 * L9 (2026-09-04): sticky tegning i repeater-feltpin. Når en rad UTEN tegning åpnes, skal
 * feltpin-velgeren forhåndsvelge «sist brukte» tegning i SAMME dokument — KUN tegningen, aldri pin.
 * Kildeprioritet: (1) forrige rads tegning → (2) dokumentets dokumentlokasjon-tegning → (3) ingen.
 *
 * Bevarer atferden Kenneth fredet 28.08 («rad 2 lander på rad 1s tegning») som ATFERD, men kilden
 * er nå dokument-avgrenset og forutsigbar — ikke sesjonstilstand på tvers av dokumenter.
 *
 * Vi mocker RapportObjektRenderer og fanger `stickyTegning`-propen hvert `drawing_position`-barn får.
 */
const { rendrede } = vi.hoisted(() => ({
  rendrede: [] as Array<{ type: string; feltNokkel?: string; stickyTegning: unknown }>,
}));

vi.mock("../RapportObjektRenderer", () => ({
  RapportObjektRenderer: (props: {
    objekt: { type: string };
    feltNokkel?: string;
    stickyTegning?: unknown;
  }) => {
    rendrede.push({ type: props.objekt.type, feltNokkel: props.feltNokkel, stickyTegning: props.stickyTegning });
    return null;
  },
  DISPLAY_TYPER: new Set<string>(),
  tilbehorVisning: () => ({ vis: false, leseModus: false }),
}));
vi.mock("../FeltDokumentasjon", () => ({ FeltDokumentasjon: () => null }));

const objekt = { id: "rep", type: "repeater", label: "Rad", required: false, config: {}, sortOrder: 0, parentId: null };
const posBarn = { id: "pos", type: "drawing_position", label: "Posisjon", required: false, config: {}, sortOrder: 1, parentId: "rep" };

/** Sticky-verdien feltpin-barnet i rad `radIndeks` fikk. */
function stickyForRadIndeks(radIndeks: number): unknown {
  const rad = rendrede.find((r) => r.type === "drawing_position" && r.feltNokkel === `pos:${radIndeks}`);
  return rad?.stickyTegning;
}

beforeEach(() => { rendrede.length = 0; });
afterEach(cleanup);

it("rad 2 uten tegning → sticky = rad 1s tegning (kun tegning, ingen pin)", () => {
  const verdi = [
    {
      _radId: "rad-1",
      felter: { pos: { verdi: { drawingId: "d-1", positionX: 19.4, positionY: 73.7, drawingName: "Z-20-01" }, kommentar: "", vedlegg: [] } },
    },
    { _radId: "rad-2", felter: { pos: { verdi: null, kommentar: "", vedlegg: [] } } },
  ];

  render(<RepeaterObjekt objekt={objekt} verdi={verdi} onEndreVerdi={vi.fn()} barneObjekter={[posBarn]} />);

  // Rad 2 forhåndsvelger rad 1s tegning — men KUN tegning + navn, aldri koordinater.
  expect(stickyForRadIndeks(1)).toEqual({ drawingId: "d-1", drawingName: "Z-20-01" });
  // Rad 1 har ingen forrige rad og ingen dokument-tegning → ingen default (som i dag).
  expect(stickyForRadIndeks(0)).toBeNull();
});

it("rad 1 i dokument med dokumentlokasjon-tegning → den forhåndsvelges", () => {
  const verdi = [{ _radId: "rad-1", felter: { pos: { verdi: null, kommentar: "", vedlegg: [] } } }];

  render(
    <RepeaterObjekt
      objekt={objekt}
      verdi={verdi}
      onEndreVerdi={vi.fn()}
      barneObjekter={[posBarn]}
      dokumentTegning={{ drawingId: "d-9", drawingName: "A-01" }}
    />,
  );

  expect(stickyForRadIndeks(0)).toEqual({ drawingId: "d-9", drawingName: "A-01" });
});

it("forrige rads tegning vinner over dokument-tegning (nærmeste kilde først)", () => {
  const verdi = [
    { _radId: "rad-1", felter: { pos: { verdi: { drawingId: "d-1", drawingName: "Z-20-01" }, kommentar: "", vedlegg: [] } } },
    { _radId: "rad-2", felter: { pos: { verdi: null, kommentar: "", vedlegg: [] } } },
  ];

  render(
    <RepeaterObjekt
      objekt={objekt}
      verdi={verdi}
      onEndreVerdi={vi.fn()}
      barneObjekter={[posBarn]}
      dokumentTegning={{ drawingId: "d-9", drawingName: "A-01" }}
    />,
  );

  expect(stickyForRadIndeks(1)).toEqual({ drawingId: "d-1", drawingName: "Z-20-01" });
});
