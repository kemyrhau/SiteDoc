import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliserteAdresseVarianter, sokAdresser } from "./rute-service";

/**
 * TILLEGG 2026-11-15 (13) L2 del C: `sokAdresser` prøver normaliserte varianter
 * når første søk gir 0 treff. Geonorge mockes (ingen eksterne kall).
 * Målt i posten: «sommerfeldtsgate 65 tromsø» → 0 treff, «sommerfeldts gate 65 tromsø» → 1.
 */

const TREFF = {
  adresser: [
    {
      adressetekst: "Sommerfeldts gate 65",
      postnummer: "9013",
      poststed: "TROMSØ",
      representasjonspunkt: { lat: 69.65, lon: 18.95 },
    },
  ],
};

function mockGeonorge(svar: (sok: string) => unknown) {
  const kall: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const sok = new URL(url).searchParams.get("sok") ?? "";
      kall.push(sok);
      return { ok: true, json: async () => svar(sok) } as Response;
    }),
  );
  return kall;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normaliserteAdresseVarianter", () => {
  it("splitter sammenskrevet «…sgate»", () => {
    expect(normaliserteAdresseVarianter("sommerfeldtsgate 65 tromsø")).toContain(
      "sommerfeldts gate 65 tromsø",
    );
  });

  it("«…sveien» → «…s veien»", () => {
    expect(normaliserteAdresseVarianter("Olavsveien 2")).toContain("Olavs veien 2");
  });

  it("forkortelser gt/gt./vn/vn. → gate/veien", () => {
    expect(normaliserteAdresseVarianter("Kongens gt 3")).toContain("Kongens gate 3");
    expect(normaliserteAdresseVarianter("Kongens gt. 3")).toContain("Kongens gate 3");
    expect(normaliserteAdresseVarianter("Hamn vn 2")).toContain("Hamn veien 2");
    expect(normaliserteAdresseVarianter("Storgt. 5 Tromsø")).toContain("Storgate 5 Tromsø");
  });

  it("fjerner avsluttende «norge» og komma", () => {
    expect(normaliserteAdresseVarianter("Strandvegen 1, Tromsø, Norge")).toContain(
      "Strandvegen 1 Tromsø",
    );
  });

  it("ingen varianter når adressen alt er normalisert", () => {
    expect(normaliserteAdresseVarianter("Sommerfeldts gate 65")).toEqual([]);
    expect(normaliserteAdresseVarianter("Kirkegata 1")).toEqual([]);
  });
});

describe("sokAdresser — normalisert nytt forsøk ved 0 treff", () => {
  it("0 treff på original → prøver «sommerfeldts gate» og returnerer treffet", async () => {
    const kall = mockGeonorge((sok) =>
      sok === "sommerfeldts gate 65 tromsø" ? TREFF : { adresser: [] },
    );
    const treff = await sokAdresser("sommerfeldtsgate 65 tromsø");
    expect(kall).toEqual(["sommerfeldtsgate 65 tromsø", "sommerfeldts gate 65 tromsø"]);
    expect(treff).toEqual([
      { lat: 69.65, lng: 18.95, label: "Sommerfeldts gate 65, 9013 TROMSØ" },
    ]);
  });

  it("treff på original → ingen ekstra kall", async () => {
    const kall = mockGeonorge(() => TREFF);
    await sokAdresser("sommerfeldtsgate 65 tromsø");
    expect(kall).toHaveLength(1);
  });

  it("0 treff på alle varianter → tom liste, kaster ikke", async () => {
    const kall = mockGeonorge(() => ({ adresser: [] }));
    expect(await sokAdresser("Storgt. 5, Tromsø, Norge")).toEqual([]);
    expect(kall.length).toBe(1 + normaliserteAdresseVarianter("Storgt. 5, Tromsø, Norge").length);
  });
});
