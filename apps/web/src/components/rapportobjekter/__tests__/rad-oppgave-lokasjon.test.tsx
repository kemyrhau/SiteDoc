// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RepeaterObjekt } from "../RepeaterObjekt";

/**
 * 🔴 REPRODUKSJON (lokasjonsarv, 2026-08-23): oppgave opprettet fra en rad som HAR en
 * drawing_position mister posisjonen. Denne testen KJØRER opprettRadOppgave med et
 * drawing_position-BARN i `barneObjekter` og en rad som har fylt det, og måler hva `onOpprett`
 * faktisk får som `radPosisjon` (2. arg). Barn-modulene mockes bort — vi tester RepeaterObjekts
 * egen posisjonFraRad-utledning.
 */
vi.mock("../RapportObjektRenderer", () => ({
  RapportObjektRenderer: () => null,
  DISPLAY_TYPER: new Set<string>(),
  tilbehorVisning: () => ({ vis: false, leseModus: false }),
}));
vi.mock("../FeltDokumentasjon", () => ({ FeltDokumentasjon: () => null }));

afterEach(cleanup);

const objekt = { id: "rep", type: "repeater", label: "Rad", required: false, config: {}, sortOrder: 0, parentId: null };
// Repeateren har et drawing_position-BARN (slik en rad kan bære Z-20-01).
const posBarn = { id: "pos", type: "drawing_position", label: "Posisjon", required: false, config: {}, sortOrder: 1, parentId: "rep" };
const tekstBarn = { id: "f1", type: "text_field", label: "Tekst", required: false, config: {}, sortOrder: 2, parentId: "rep" };

it("rad med drawing_position → onOpprett får radens posisjon (ikke null)", () => {
  const onOpprett = vi.fn();
  // Rad har fylt drawing_position-barnet med Z-20-01 (samme som Kenneths test).
  const verdi = [
    {
      _radId: "rad-1",
      felter: {
        pos: { verdi: { drawingId: "d-1", positionX: 19.4, positionY: 73.7, drawingName: "Z-20-01" }, kommentar: "", vedlegg: [] },
        f1: { verdi: "A", kommentar: "", vedlegg: [] },
      },
    },
  ];

  render(
    <RepeaterObjekt
      objekt={objekt}
      verdi={verdi}
      onEndreVerdi={vi.fn()}
      barneObjekter={[posBarn, tekstBarn]}
      radOppgaver={{ finnForRad: () => [], onOpprett, onNaviger: () => {} }}
    />,
  );

  fireEvent.click(screen.getByText("Oppgave"));

  expect(onOpprett).toHaveBeenCalledTimes(1);
  const radPosisjon = onOpprett.mock.calls[0]![1];
  expect(radPosisjon).toEqual({ drawingId: "d-1", positionX: 19.4, positionY: 73.7 });
});
