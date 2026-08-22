// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * Steg 1 (oppgave-fra-rad, bindende vedtak `domene-arbeidsflyt.md`: dokumentflyten er nøkkelen,
 * faggruppe er avledet). Fasit:
 *  1. Sjekkliste MED flyt → oppgaven ARVER den flyten. Ingen flyt-/faggruppe-velger; submit sender
 *     `dokumentflytId = sjekklistens flyt` + faggruppe LEST UT av flyten (bestiller = utfører =
 *     flytens faggruppe, via `byggOpprettInput`). Ikke en `.find(faggruppeId)`-gjetning.
 *  2. Sjekkliste FLYT-LØS → synlig mikrotekst-linje som sier HVA tilstanden er, + flyt-velger
 *     (ikke faggruppe). Submit binder til den VALGTE flyten.
 */

const { mutate, FLYT } = vi.hoisted(() => ({
  mutate: vi.fn(),
  FLYT: {
    id: "flyt-A",
    name: "Byggeledelse-flyt",
    faggruppeId: "fag-1",
    maler: [{ template: { id: "m1", name: "Avviksoppgave", category: "oppgave" } }],
  },
}));

vi.mock("@/lib/trpc", () => {
  const q = (data: unknown) => ({ useQuery: () => ({ data }) });
  return {
    trpc: {
      useUtils: () => ({ oppgave: { hentForSjekkliste: { invalidate: vi.fn() } } }),
      dokumentflyt: { hentForProsjekt: q([FLYT]) },
      medlem: { hentMineOpprettFlyter: q(["flyt-A"]) },
      mal: { hentForProsjekt: q([{ id: "m1", name: "Avviksoppgave", category: "oppgave", domain: "bygg" }]) },
      oppgave: { opprett: { useMutation: () => ({ mutate, isPending: false }) } },
    },
  };
});

// A la til useRouter i modalen (åpner ny oppgave ved opprettelse) → mock next/navigation.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OpprettOppgaveModal } from "../OpprettOppgaveModal";

// jsdom implementerer ikke <dialog>.showModal/close (Modal bruker native <dialog>).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const baseProps = {
  open: true,
  onClose: () => {},
  prosjektId: "p1",
  sjekklisteId: "sj1",
  sjekklisteFeltId: "rep:rad-1",
  sjekklisteNummer: "SJ-001",
  feltLabel: "Punkt 3",
};

describe("OpprettOppgaveModal — oppgaven arver sjekklistens dokumentflyt (steg 1)", () => {
  it("sjekkliste MED flyt: ingen flyt-velger, submit binder dokumentflytId = sjekklistens flyt + faggruppe fra flyten", () => {
    render(<OpprettOppgaveModal {...baseProps} sjekklisteFlytId="flyt-A" />);

    // Ingen fallback: verken mikrotekst eller flyt-velger.
    expect(screen.queryByText(/ikke knyttet til en dokumentflyt/i)).toBeNull();
    expect(screen.queryByLabelText("Dokumentflyt")).toBeNull();

    // Velg mal (den eneste i flyten) og opprett.
    fireEvent.change(screen.getByLabelText("Oppgavemal"), { target: { value: "m1" } });
    fireEvent.click(screen.getByText("Opprett oppgave"));

    expect(mutate).toHaveBeenCalledTimes(1);
    const arg = mutate.mock.calls[0]![0];
    expect(arg).toMatchObject({
      templateId: "m1",
      checklistId: "sj1",
      checklistFieldId: "rep:rad-1",
      dokumentflytId: "flyt-A", // ARVET — ikke utledet fra en faggruppe
      bestillerFaggruppeId: "fag-1", // LEST UT av flyten
      utforerFaggruppeId: "fag-1",
    });
  });

  it("sjekkliste FLYT-LØS: mikrotekst + flyt-velger vises, submit binder til den valgte flyten", () => {
    render(<OpprettOppgaveModal {...baseProps} sjekklisteFlytId={null} />);

    // Mikrotekst-standarden: si HVA tilstanden er.
    expect(screen.getByText(/ikke knyttet til en dokumentflyt/i)).toBeTruthy();
    // Flyt-velger (ikke faggruppe). Auto-valgt siden nøyaktig én er mulig.
    expect(screen.getByLabelText("Dokumentflyt")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Oppgavemal"), { target: { value: "m1" } });
    fireEvent.click(screen.getByText("Opprett oppgave"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({
      templateId: "m1",
      dokumentflytId: "flyt-A", // den VALGTE flyten
      bestillerFaggruppeId: "fag-1",
    });
  });

  it("funn 2: nøyaktig én oppgavemal → forhåndsvelges (submit UTEN manuelt malvalg virker)", () => {
    render(<OpprettOppgaveModal {...baseProps} sjekklisteFlytId="flyt-A" />);

    // Ingen fireEvent.change på malen — den skal være auto-valgt (flyten har kun m1).
    fireEvent.click(screen.getByText("Opprett oppgave"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({ templateId: "m1", dokumentflytId: "flyt-A" });
  });
});
