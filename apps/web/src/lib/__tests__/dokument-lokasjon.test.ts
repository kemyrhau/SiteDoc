import { describe, it, expect } from "vitest";
import { lesDokumentLokasjon } from "../dokument-lokasjon";

/**
 * 🔴 Regresjonsvakt (2026-08-23): oppgave-detaljsiden viste «Ikke satt» fordi den leste lokasjon fra
 * det OMFORMEDE `oppgave`-objektet (useOppgaveSkjema), som dropper drawing/position. Denne testen
 * beviser at helperen henter feltene fra RÅ-formen (hentMedId) — og at den omformede formen (uten
 * `drawing`/positionX) gir alt null (nettopp buggen).
 */
describe("lesDokumentLokasjon", () => {
  it("RÅ hentMedId-form (drawing-relasjon + posisjon) → alle felt hentes", () => {
    const raa = {
      drawingId: "d-1",
      positionX: 19.36,
      positionY: 73.7,
      lokasjonOmfang: "punkt",
      drawing: { name: "Z-20-01", byggeplass: { name: "900512 Røstbakken" } },
    };
    expect(lesDokumentLokasjon(raa)).toEqual({
      tegningId: "d-1",
      tegningNavn: "Z-20-01",
      bygningNavn: "900512 Røstbakken",
      positionX: 19.36,
      positionY: 73.7,
      lokasjonOmfang: "punkt",
    });
  });

  it("lokasjonOmfang=byggeplass (uten tegning) → omfang hentes, resten null", () => {
    expect(lesDokumentLokasjon({ lokasjonOmfang: "byggeplass" })).toEqual({
      tegningId: null,
      tegningNavn: null,
      bygningNavn: null,
      positionX: null,
      positionY: null,
      lokasjonOmfang: "byggeplass",
    });
  });

  it("OMFORMET skjema-form (uten drawing/positionX/positionY) → alt null (= buggen)", () => {
    const omformet = { id: "o1", title: "Avvik", status: "draft", template: { id: "t" } };
    expect(lesDokumentLokasjon(omformet)).toEqual({
      tegningId: null,
      tegningNavn: null,
      bygningNavn: null,
      positionX: null,
      positionY: null,
      lokasjonOmfang: null,
    });
  });

  it("undefined (query ikke lastet) → alt null, ingen kast", () => {
    expect(lesDokumentLokasjon(undefined)).toEqual({
      tegningId: null,
      tegningNavn: null,
      bygningNavn: null,
      positionX: null,
      positionY: null,
      lokasjonOmfang: null,
    });
  });

  it("tegning uten byggeplass (ukonvertert) → bygningNavn null, resten hentes", () => {
    const raa = { drawingId: "d-2", positionX: 1, positionY: 2, drawing: { name: "T", byggeplass: null } };
    expect(lesDokumentLokasjon(raa)).toMatchObject({ tegningId: "d-2", bygningNavn: null, positionX: 1 });
  });
});
