import { describe, it, expect, vi } from "vitest";
import {
  invaliderEtterSlett,
  invaliderEtterRekonverter,
  invaliderEtterRedigerDetaljer,
  byggRedigerTegningInput,
  slettFeilTekst,
  type RedigerTegningFelt,
  type TegningUtils,
} from "../tegningMutasjonEffekter";

const PROSJEKT = "p-1";
const TEGNING = "t-1";

function lagUtils() {
  const bygning = vi.fn();
  const detalj = vi.fn();
  const utils = {
    bygning: { hentForProsjekt: { invalidate: bygning } },
    tegning: { hentMedId: { invalidate: detalj } },
  } as unknown as TegningUtils;
  return { utils, bygning, detalj };
}

describe("invaliderEtterSlett", () => {
  // RØD FØRST: fjernes invalideringen i helperen, faller denne — lista ville stått med den
  // slettede raden og neste klikk krasjet på findUniqueOrThrow.
  it("invaliderer tegninglista (bygning.hentForProsjekt) med projectId", () => {
    const { utils, bygning } = lagUtils();
    invaliderEtterSlett(utils, PROSJEKT);
    expect(bygning).toHaveBeenCalledWith({ projectId: PROSJEKT });
    expect(bygning).toHaveBeenCalledTimes(1);
  });
});

describe("invaliderEtterRekonverter", () => {
  it("invaliderer BÅDE detaljen (banner) og lista (søsken-status)", () => {
    const { utils, bygning, detalj } = lagUtils();
    invaliderEtterRekonverter(utils, PROSJEKT, TEGNING);
    expect(detalj).toHaveBeenCalledWith({ id: TEGNING });
    expect(bygning).toHaveBeenCalledWith({ projectId: PROSJEKT });
  });
});

describe("invaliderEtterRedigerDetaljer", () => {
  // RØD FØRST (Krav 2, ordre 2026-09-30): fjernes lista-invalideringen, faller denne — en
  // tegning som får `floor` blir stående i «Uten etasje» selv om mutasjonen lyktes.
  it("invaliderer BÅDE detaljen og lista (så raden flytter seg ut av «Uten etasje»)", () => {
    const { utils, bygning, detalj } = lagUtils();
    invaliderEtterRedigerDetaljer(utils, PROSJEKT, TEGNING);
    expect(detalj).toHaveBeenCalledWith({ id: TEGNING });
    expect(bygning).toHaveBeenCalledWith({ projectId: PROSJEKT });
  });
});

describe("byggRedigerTegningInput", () => {
  const fullt: RedigerTegningFelt = {
    name: "  Plan 1. etasje  ",
    drawingNumber: " ARK-P-101 ",
    discipline: "ARK",
    drawingType: "plan",
    floor: " 1. etasje ",
    originator: " Rambøll ",
    description: "Uendret beskrivelse",
  };

  it("dekker nøyaktig de sju flate-feltene + id, ingenting mer", () => {
    const input = byggRedigerTegningInput(TEGNING, fullt);
    expect(Object.keys(input).sort()).toEqual(
      ["description", "discipline", "drawingNumber", "drawingType", "floor", "id", "name", "originator"].sort(),
    );
    // Ingen scale/scaleKilde/status/issuedAt/byggeplassId/revision — de er bevisst utelatt.
    expect(input).not.toHaveProperty("scale");
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("revision");
  });

  it("trimmer tekstfelt og sender gyldige enum-verdier", () => {
    const input = byggRedigerTegningInput(TEGNING, fullt);
    expect(input).toMatchObject({
      id: TEGNING,
      name: "Plan 1. etasje",
      drawingNumber: "ARK-P-101",
      discipline: "ARK",
      drawingType: "plan",
      floor: "1. etasje",
      originator: "Rambøll",
    });
  });

  it("tom `floor` sendes som tom streng → flytter raden til «Uten etasje»", () => {
    const input = byggRedigerTegningInput(TEGNING, { ...fullt, floor: "   " });
    expect(input.floor).toBe("");
  });

  it("ugyldig/tom enum blir undefined (Zod-enum avviser «»)", () => {
    const input = byggRedigerTegningInput(TEGNING, { ...fullt, discipline: "", drawingType: "tulletype" });
    expect(input.discipline).toBeUndefined();
    expect(input.drawingType).toBeUndefined();
  });
});

describe("slettFeilTekst", () => {
  it("BAD_REQUEST + melding → viser vaktens lesbare melding", () => {
    const melding = "Tegningen brukes av 2 oppgaver og kan ikke slettes. …";
    expect(slettFeilTekst({ message: melding, data: { code: "BAD_REQUEST" } }, "generisk")).toBe(melding);
  });

  it("ukjent feilkode → generisk (rå Prisma-tekst lekker ikke)", () => {
    const prisma = "Invalid `prisma.drawing.findUniqueOrThrow()` invocation: … No record was found";
    expect(slettFeilTekst({ message: prisma, data: { code: "INTERNAL_SERVER_ERROR" } }, "generisk")).toBe("generisk");
  });

  it("ingen kode / ingen data → generisk", () => {
    expect(slettFeilTekst({ message: "noe", data: null }, "generisk")).toBe("generisk");
    expect(slettFeilTekst({ message: "noe" }, "generisk")).toBe("generisk");
  });

  it("BAD_REQUEST uten melding → generisk (ikke tom streng)", () => {
    expect(slettFeilTekst({ data: { code: "BAD_REQUEST" } }, "generisk")).toBe("generisk");
  });
});
