import { describe, it, expect } from "vitest";
import { beregnLesertilstand, filtypeFraNavn, KLARGJORING_GRENSE_MS } from "../lesertilstand";

/**
 * DL-1: leseren skiller «klargjøres», «kan ikke vises her» og «feilet» i stedet for
 * én evig «ikke klar». Grensen på 10 min avgjør når et ferdig PDF/DOCX uten blokker
 * slutter å vente og regnes som feilet.
 */
const NA = Date.parse("2026-11-10T12:00:00Z");
const grunn = {
  antallBlokker: 0,
  antallSprak: 0,
  processingState: "completed",
  processingError: null,
  filnavn: "Nussir sikkerhetsinnstruks_NO.docx",
  updatedAt: new Date(NA - 60_000),
  na: NA,
};

describe("beregnLesertilstand", () => {
  it("blokker i valgt eller annet språk → innhold", () => {
    expect(beregnLesertilstand({ ...grunn, antallBlokker: 3 }).type).toBe("innhold");
    expect(beregnLesertilstand({ ...grunn, antallSprak: 1 }).type).toBe("innhold");
  });

  it("pending/processing → klargjøres, uansett filtype", () => {
    for (const s of ["pending", "processing"]) {
      expect(beregnLesertilstand({ ...grunn, processingState: s, filnavn: "a.xlsx" }).type).toBe("klargjores");
    }
  });

  it("ferdig DOCX/PDF uten blokker under grensen → klargjøres", () => {
    expect(beregnLesertilstand(grunn).type).toBe("klargjores");
    expect(beregnLesertilstand({ ...grunn, filnavn: "TEGNING.PDF" }).type).toBe("klargjores");
  });

  it("ferdig DOCX uten blokker over grensen → feilet med generisk tekst", () => {
    const t = beregnLesertilstand({ ...grunn, updatedAt: new Date(NA - KLARGJORING_GRENSE_MS - 1) });
    expect(t).toEqual({ type: "feilet", feilmelding: null });
  });

  it("nylig «Prosesser på nytt» holder klargjøres selv om serveren ikke har oppdatert ennå", () => {
    const gammel = new Date(NA - 3 * KLARGJORING_GRENSE_MS);
    expect(beregnLesertilstand({ ...grunn, updatedAt: gammel, reprosessertVed: NA - 1000 }).type).toBe(
      "klargjores",
    );
  });

  it("failed → feilet med serverens melding", () => {
    expect(
      beregnLesertilstand({ ...grunn, processingState: "failed", processingError: "Ugyldig DOCX-fil" }),
    ).toEqual({ type: "feilet", feilmelding: "Ugyldig DOCX-fil" });
  });

  it("andre filtyper ferdig → kan ikke vises her, men søkbar", () => {
    expect(beregnLesertilstand({ ...grunn, filnavn: "mengder.xlsx" })).toEqual({
      type: "kanIkkeVises",
      sokbar: true,
    });
  });

  it("unsupported → kan ikke vises, ikke søkbar", () => {
    expect(beregnLesertilstand({ ...grunn, processingState: "unsupported", filnavn: "gammel.doc" })).toEqual({
      type: "kanIkkeVises",
      sokbar: false,
    });
  });
});

describe("filtypeFraNavn", () => {
  it("små bokstaver, siste endelse, tom ved manglende", () => {
    expect(filtypeFraNavn("A.B.DOCX")).toBe(".docx");
    expect(filtypeFraNavn("uten")).toBe("");
    expect(filtypeFraNavn(null)).toBe("");
  });
});
