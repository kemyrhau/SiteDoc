// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * 🔴 GLUE-REPRODUKSJON (lokasjonsarv, 2026-08-23): replikerer NØYAKTIG page-glue-en som
 * enhetstestene bommet på — RepeaterObjekt.onOpprett → `setState(opprettOppgavePosisjon)` →
 * modalens `forhandsPosisjon`-prop → mutate. Hvis posisjonen forsvinner her, er det React-
 * state/timing (kandidat 2), ikke posisjonFraRad eller modalen isolert.
 */

const mutate = vi.hoisted(() => vi.fn());
const FLYT = vi.hoisted(() => ({
  id: "flyt-A",
  name: "Flyt A",
  faggruppeId: "fag-1",
  maler: [{ template: { id: "m1", name: "Avvik", category: "oppgave" } }],
}));

vi.mock("@/lib/trpc", () => {
  const q = (data: unknown) => ({ useQuery: () => ({ data }) });
  return {
    trpc: {
      useUtils: () => ({ oppgave: { hentForSjekkliste: { invalidate: vi.fn() } } }),
      dokumentflyt: { hentForProsjekt: q([FLYT]) },
      medlem: { hentMineOpprettFlyter: q(["flyt-A"]) },
      mal: { hentForProsjekt: q([{ id: "m1", name: "Avvik", category: "oppgave", domain: "bygg" }]) },
      oppgave: { opprett: { useMutation: () => ({ mutate, isPending: false }) } },
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// RepeaterObjekt sine barn-moduler — vi tester glue-en, ikke barnefelt-rendring.
vi.mock("../rapportobjekter/RapportObjektRenderer", () => ({
  RapportObjektRenderer: () => null,
  DISPLAY_TYPER: new Set<string>(),
  tilbehorVisning: () => ({ vis: false, leseModus: false }),
}));
vi.mock("../rapportobjekter/FeltDokumentasjon", () => ({ FeltDokumentasjon: () => null }));

import { RepeaterObjekt } from "../rapportobjekter/RepeaterObjekt";
import { OpprettOppgaveModal } from "../OpprettOppgaveModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});
afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const rep = { id: "rep", type: "repeater", label: "Rad", required: false, config: {}, sortOrder: 0, parentId: null };
const posBarn = { id: "pos", type: "drawing_position", label: "Posisjon", required: false, config: {}, sortOrder: 1, parentId: "rep" };

/** Speiler page-glue-en: onOpprett skriver opprettOppgavePosisjon; modalen leser den som prop. */
function Harness({ verdi, dokPos }: { verdi: unknown; dokPos: { drawingId?: string | null; positionX?: number | null; positionY?: number | null } | null }) {
  const [feltId, setFeltId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ drawingId?: string | null; positionX?: number | null; positionY?: number | null } | null>(null);
  return (
    <>
      <RepeaterObjekt
        objekt={rep}
        verdi={verdi}
        onEndreVerdi={vi.fn()}
        barneObjekter={[posBarn]}
        radOppgaver={{
          finnForRad: () => [],
          onOpprett: (nokkel, radPosisjon) => {
            setFeltId(nokkel);
            setPos(radPosisjon ?? dokPos); // ← nøyaktig page-fallbacken (radens posisjon ?? dokument)
          },
          onNaviger: () => {},
        }}
      />
      <OpprettOppgaveModal
        open={!!feltId}
        onClose={() => {}}
        prosjektId="p1"
        sjekklisteId="sj1"
        sjekklisteFeltId={feltId ?? ""}
        sjekklisteFlytId="flyt-A"
        forhandsPosisjon={pos}
      />
    </>
  );
}

describe("lokasjonsarv — full page-glue (RepeaterObjekt → state → modal → mutate)", () => {
  it("rad MED drawing_position → mutate sender posisjonen", () => {
    render(
      <Harness
        dokPos={null}
        verdi={[
          {
            _radId: "rad-1",
            felter: { pos: { verdi: { drawingId: "d-1", positionX: 19.4, positionY: 73.7 }, kommentar: "", vedlegg: [] } },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Oppgave")); // åpner modalen med forhandsPosisjon
    fireEvent.click(screen.getByText("Opprett oppgave"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({ drawingId: "d-1", positionX: 19.4, positionY: 73.7 });
  });

  it("rad UTEN posisjon, men dokumentet har lokasjon → mutate sender dokumentets posisjon (fallback)", () => {
    render(
      <Harness
        dokPos={{ drawingId: "d-dok", positionX: 50, positionY: 60 }}
        verdi={[{ _radId: "rad-1", felter: { pos: { verdi: null, kommentar: "", vedlegg: [] } } }]}
      />,
    );
    fireEvent.click(screen.getByText("Oppgave"));
    fireEvent.click(screen.getByText("Opprett oppgave"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({ drawingId: "d-dok", positionX: 50, positionY: 60 });
  });
});
