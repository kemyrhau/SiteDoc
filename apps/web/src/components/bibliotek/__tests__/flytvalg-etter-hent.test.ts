import { describe, it, expect } from "vitest";
import {
  FLYTVALG_UTGANGER,
  flytvalgHandling,
  skalTilbyFlytvalg,
} from "../flytvalg-etter-hent";

/**
 * Flytvalg etter «Hent fra arkiv». Kjernekravet fra Kenneth: to LIKESTILTE utganger,
 * der «Hopp over» aldri må forsvinne — malen skal kunne hentes uten å tvinge en kobling.
 */

describe("flytvalg etter hent — «Hopp over» er alltid en vei ut", () => {
  it("«hoppOver» er en av utgangene (fjernes den, faller dette)", () => {
    expect(FLYTVALG_UTGANGER).toContain("hoppOver");
  });

  it("«hoppOver» knytter ALDRI — uansett hva som var forhåndsvalgt", () => {
    expect(flytvalgHandling("hoppOver", [])).toEqual({ knytt: false, workflowIds: [] });
    expect(flytvalgHandling("hoppOver", ["flyt-1", "flyt-2"])).toEqual({
      knytt: false,
      workflowIds: [],
    });
  });

  it("«velg» knytter de valgte flytene", () => {
    expect(flytvalgHandling("velg", ["flyt-1"])).toEqual({
      knytt: true,
      workflowIds: ["flyt-1"],
    });
  });

  it("«velg» uten utvalg knytter ingenting (eksplisitt, men tomt)", () => {
    expect(flytvalgHandling("velg", [])).toEqual({ knytt: false, workflowIds: [] });
  });
});

describe("skalTilbyFlytvalg — når vises steget", () => {
  it("skjuler steget når prosjektet ikke har noen flyt ennå", () => {
    expect(skalTilbyFlytvalg({ antallFlyter: 0, kategori: "oppgave" })).toBe(false);
  });

  it("skjuler steget for HMS-maler (flyt-løse)", () => {
    expect(skalTilbyFlytvalg({ antallFlyter: 3, kategori: "hms" })).toBe(false);
  });

  it("viser steget for oppgave/sjekkliste når minst én flyt finnes", () => {
    expect(skalTilbyFlytvalg({ antallFlyter: 1, kategori: "oppgave" })).toBe(true);
    expect(skalTilbyFlytvalg({ antallFlyter: 2, kategori: "sjekkliste" })).toBe(true);
  });
});
