// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RepeaterObjekt } from "../RepeaterObjekt";
import { normaliserRad } from "../typer";

/**
 * 🔴 LOAD-BEARING (rad-oppgave-vedtak 2026-08-22): «onEndreVerdi(rader) FØR onOpprett» er hele
 * forskjellen mellom en varig oppgave-kobling og en foreldreløs badge etter neste reload. Et
 * dokument som aldri er redigert etter rad-id-deployen har gammel lagret form (naken Record, ingen
 * `_radId`); uten persisteringen ville neste LESING delt ut en NY uuid og oppgavens nøkkel
 * (`objekt.id:<uuid>`) blitt foreldreløs. Disse to testene er det ene punktet som betyr noe.
 *
 * Barn-modulene mockes bort — vi tester RepeaterObjekts EGEN logikk (persist + nøkkel), ikke
 * barnefelt-rendring.
 */
vi.mock("../RapportObjektRenderer", () => ({
  RapportObjektRenderer: () => null,
  DISPLAY_TYPER: new Set<string>(),
  tilbehorVisning: () => ({ vis: false, leseModus: false }),
}));
vi.mock("../FeltDokumentasjon", () => ({ FeltDokumentasjon: () => null }));

afterEach(cleanup);

const objekt = { id: "rep", type: "repeater", label: "Rad", required: false, config: {}, sortOrder: 0, parentId: null };
const barn = [{ id: "f1", type: "text_field", label: "Tekst", required: false, config: {}, sortOrder: 1, parentId: "rep" }];

function setup(verdi: unknown) {
  const onEndreVerdi = vi.fn();
  const onOpprett = vi.fn();
  render(
    <RepeaterObjekt
      objekt={objekt}
      verdi={verdi}
      onEndreVerdi={onEndreVerdi}
      barneObjekter={barn}
      radOppgaver={{ finnForRad: () => [], onOpprett, onNaviger: () => {} }}
    />,
  );
  return { onEndreVerdi, onOpprett };
}

describe("RepeaterObjekt — rad-oppgave persisterer stabil _radId ved opprettelse", () => {
  it("gammel rad UTEN lagret _radId → opprett persisterer id-en, og oppgavens nøkkel = DEN id-en (ikke en ny ved neste lesing)", () => {
    // Gammel lagret form: naken Record, ingen _radId (dokument aldri redigert etter rad-id-deploy).
    const gammel = [{ f1: { verdi: "A", kommentar: "", vedlegg: [] } }];
    const { onEndreVerdi, onOpprett } = setup(gammel);

    fireEvent.click(screen.getByText("Oppgave"));

    // 1) Persisteringen skjedde FØR opprettelse: onEndreVerdi fikk { _radId, felter }-formen.
    expect(onEndreVerdi).toHaveBeenCalledTimes(1);
    const persistert = onEndreVerdi.mock.calls[0]![0] as Array<{ _radId: string; felter: Record<string, unknown> }>;
    const persistertId = persistert[0]!._radId;
    expect(persistertId).toBeTruthy();
    expect(persistert[0]!.felter.f1).toBeTruthy(); // felt-innholdet bevart i omsluttingen

    // 2) Oppgavens nøkkel bruker DEN persisterte id-en (ikke array-indeks, ikke en annen uuid).
    expect(onOpprett).toHaveBeenCalledTimes(1);
    expect(onOpprett.mock.calls[0]![0]).toBe(`rep:${persistertId}`);
    // Funn 3: radens 1-baserte nummer sendes med (til tittelen). Første rad → 1.
    expect(onOpprett.mock.calls[0]![2]).toBe(1);

    // 3) Kjernen: neste LESING av de persisterte radene gir SAMME id → badgen matcher etter reload.
    //    (Uten persisteringen ville normaliserRad her delt ut en NY uuid og koblingen blitt foreldreløs.)
    const gjennlest = persistert.map(normaliserRad);
    expect(gjennlest[0]!._radId).toBe(persistertId);
  });

  it("idempotens: rad som allerede HAR lagret _radId → id-en endres ikke ved opprettelse", () => {
    const ny = [{ _radId: "fast-id-123", felter: { f1: { verdi: "A", kommentar: "", vedlegg: [] } } }];
    const { onEndreVerdi, onOpprett } = setup(ny);

    fireEvent.click(screen.getByText("Oppgave"));

    const persistert = onEndreVerdi.mock.calls[0]![0] as Array<{ _radId: string }>;
    expect(persistert[0]!._radId).toBe("fast-id-123"); // uendret — ingen ny uuid
    expect(onOpprett.mock.calls[0]![0]).toBe("rep:fast-id-123");
  });
});
