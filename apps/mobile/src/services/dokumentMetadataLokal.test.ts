import { describe, it, expect } from "vitest";
import { metadataFraLokal, metadataTilLokal } from "./dokumentMetadataLokal";

/** Metadata M-pakke: rundturen server → SQLite → DokumentRad bevarer de tre tilstandene. */
const sendt = { av: { id: "u1", navn: "Ola" }, ved: "2026-11-01T08:00:00.000Z" };

describe("metadata lokal rundtur", () => {
  it("verdier overlever", () => {
    const inn = {
      statushendelser: { sendt, godkjent: null, lukket: null },
      utfylling: { sist: sendt, alle: [sendt.av] },
    };
    expect(metadataFraLokal(metadataTilLokal(inn))).toEqual(inn);
  });

  it("utfylling null (endringslogg av) skilles fra manglende felt (eldre API)", () => {
    expect(metadataTilLokal({ utfylling: null })).toEqual({ statushendelser: null, utfylling: "null" });
    expect(metadataFraLokal(metadataTilLokal({ utfylling: null }))).toEqual({ utfylling: null });
    expect(metadataFraLokal(metadataTilLokal({}))).toEqual({});
  });

  it("ødelagt JSON gir manglende felt, ikke krasj", () => {
    expect(metadataFraLokal({ statushendelser: "{", utfylling: null })).toEqual({});
  });
});
