import { describe, it, expect, vi } from "vitest";
import {
  invaliderEtterSlett,
  invaliderEtterRekonverter,
  slettFeilTekst,
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
