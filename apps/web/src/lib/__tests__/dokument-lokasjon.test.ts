import { describe, it, expect } from "vitest";
import {
  byggeplassByttInput,
  byggeplassForLokasjon,
  filtrerOmrader,
  lesDokumentLokasjon,
} from "../dokument-lokasjon";

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
      lokasjonFritekst: null,
      omradeId: null,
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
      lokasjonFritekst: null,
      omradeId: null,
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
      lokasjonFritekst: null,
      omradeId: null,
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
      lokasjonFritekst: null,
      omradeId: null,
    });
  });

  it("tegning uten byggeplass (ukonvertert) → bygningNavn null, resten hentes", () => {
    const raa = { drawingId: "d-2", positionX: 1, positionY: 2, drawing: { name: "T", byggeplass: null } };
    expect(lesDokumentLokasjon(raa)).toMatchObject({ tegningId: "d-2", bygningNavn: null, positionX: 1 });
  });

  it("omfang=omrade (steg 2b) → omradeId hentes fra RÅ-formen", () => {
    expect(lesDokumentLokasjon({ lokasjonOmfang: "omrade", omradeId: "omr-9" })).toMatchObject({
      lokasjonOmfang: "omrade",
      omradeId: "omr-9",
    });
  });

  it("🔴 ORDRE 28: dokumentets egen byggeplass vinner over tegningens; tegningens er reserve", () => {
    expect(
      lesDokumentLokasjon({ byggeplass: { name: "Egen" }, drawing: { name: "T", byggeplass: { name: "Tegningens" } } })
        .bygningNavn,
    ).toBe("Egen");
    // Egen uten tegning (oppgave opprettet på aktiv byggeplass, ingen standardtegning).
    expect(lesDokumentLokasjon({ byggeplass: { name: "Egen" } }).bygningNavn).toBe("Egen");
    // Eldre rad uten egen verdi → tegningens.
    expect(lesDokumentLokasjon({ byggeplass: null, drawing: { name: "T", byggeplass: { name: "Tegningens" } } }).bygningNavn)
      .toBe("Tegningens");
  });
});

describe("ORDRE 29 #1: filtrerOmrader", () => {
  const omrader = [
    { id: "o1", byggeplassId: "bp1" },
    { id: "o2", byggeplassId: "bp2" },
    { id: "o3", byggeplassId: "bp1" },
  ];
  it("🔴 viser bare områdene på valgt byggeplass", () => {
    expect(filtrerOmrader(omrader, "bp1").map((o) => o.id)).toEqual(["o1", "o3"]);
  });
  it("uten valgt byggeplass («Alle») vises alle", () => {
    expect(filtrerOmrader(omrader, "").map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
    expect(filtrerOmrader(omrader, null)).toHaveLength(3);
  });
});

describe("ORDRE 29 #1/#5: byggeplassForLokasjon", () => {
  it("🔴 valgt byggeplass i velgeren går foran dokumentets og aktiv", () => {
    expect(byggeplassForLokasjon({ valgt: "bp1", dokument: "bp2", aktiv: "bp3" })).toBe("bp1");
  });
  it("🔴 dokumentets byggeplass før toppbarens aktive", () => {
    expect(byggeplassForLokasjon({ valgt: "", dokument: "bp2", aktiv: "bp3" })).toBe("bp2");
    expect(byggeplassForLokasjon({ dokument: null, aktiv: "bp3" })).toBe("bp3");
  });
  it("🔴 aldri null — undefined lar serveren beholde dokumentets byggeplass", () => {
    expect(byggeplassForLokasjon({ valgt: "", dokument: null, aktiv: null })).toBeUndefined();
  });
});

describe("ORDRE 29 #6: byggeplassByttInput", () => {
  it("🔴 område-omfang nullstilles sammen med området", () => {
    expect(byggeplassByttInput("omrade", "bp2")).toEqual({
      byggeplassId: "bp2",
      drawingId: null,
      positionX: null,
      positionY: null,
      omradeId: null,
      lokasjonOmfang: null,
    });
  });
  it("🔴 punkt-omfang mister tegningen og nullstilles", () => {
    expect(byggeplassByttInput("punkt", "bp2").lokasjonOmfang).toBeNull();
  });
  it("hele byggeplassen beholdes (gjelder den nye byggeplassen)", () => {
    const ut = byggeplassByttInput("byggeplass", null);
    expect(ut).not.toHaveProperty("lokasjonOmfang");
    expect(ut).toMatchObject({ byggeplassId: null, omradeId: null, drawingId: null });
  });
});
