import { describe, it, expect } from "vitest";
import { signerVedleggIData, signerBilder } from "./vedleggSignering";

/**
 * Kontrakt: signér ethvert `url`-felt på ethvert nivå (toppnivå-vedlegg,
 * repeater-nestede, attachments-felt), for HELE `/uploads/` (Fase 1b — var
 * tidligere kun `/uploads/privat/`), uten å mutere input. Speiler tellings-SQL-ens
 * `$.**.url`.
 */

const erSignert = (u: string) => /\?exp=\d+&sig=/.test(u);

describe("signerVedleggIData", () => {
  it("signerer toppnivå-vedlegg — både privat OG ikke-privat /uploads/ (Fase 1b)", () => {
    const data = {
      "felt-1": {
        verdi: null,
        kommentar: "",
        vedlegg: [
          { id: "a", type: "bilde", url: "/uploads/privat/x.jpg", filnavn: "x.jpg" },
          { id: "b", type: "bilde", url: "/uploads/apen.jpg", filnavn: "apen.jpg" },
        ],
      },
    };
    const ut = signerVedleggIData(data) as typeof data;
    expect(erSignert(ut["felt-1"].vedlegg[0]!.url)).toBe(true);
    expect(ut["felt-1"].vedlegg[0]!.url.startsWith("/uploads/privat/x.jpg?")).toBe(true);
    // 🔴 Fase 1b: ikke-privat signeres nå OGSÅ (var uendret før).
    expect(erSignert(ut["felt-1"].vedlegg[1]!.url)).toBe(true);
    expect(ut["felt-1"].vedlegg[1]!.url.startsWith("/uploads/apen.jpg?")).toBe(true);
  });

  it("signerer repeater-nestede vedlegg (dyp rekursjon)", () => {
    const data = {
      "repeater-1": {
        verdi: {
          "rad-1": {
            "barn-felt": {
              verdi: null,
              vedlegg: [{ id: "c", type: "bilde", url: "/uploads/privat/nested.jpg", filnavn: "n.jpg" }],
            },
          },
        },
        kommentar: "",
        vedlegg: [],
      },
    };
    const ut = signerVedleggIData(data) as typeof data;
    const url = ut["repeater-1"].verdi["rad-1"]["barn-felt"].vedlegg[0]!.url;
    expect(erSignert(url)).toBe(true);
  });

  it("signerer attachments-feltets verdi-array (Vedlegg[] i verdi)", () => {
    const data = {
      "attachments-felt": {
        verdi: [{ id: "d", type: "fil", url: "/uploads/privat/vedlegg.pdf", filnavn: "v.pdf" }],
        kommentar: "",
        vedlegg: [],
      },
    };
    const ut = signerVedleggIData(data) as typeof data;
    expect(erSignert(ut["attachments-felt"].verdi[0]!.url)).toBe(true);
  });

  it("muterer ALDRI input-objektet", () => {
    const original = {
      f: { verdi: null, kommentar: "", vedlegg: [{ id: "a", type: "bilde", url: "/uploads/privat/x.jpg", filnavn: "x.jpg" }] },
    };
    const url_for = original.f.vedlegg[0]!.url;
    signerVedleggIData(original);
    expect(original.f.vedlegg[0]!.url).toBe(url_for); // uendret
  });

  it("null/undefined/skalar returneres uendret", () => {
    expect(signerVedleggIData(null)).toBeNull();
    expect(signerVedleggIData(undefined)).toBeUndefined();
    expect(signerVedleggIData("streng")).toBe("streng");
  });
});

describe("signerBilder", () => {
  it("signerer fileUrl for både privat og ikke-privat, muterer ikke (Fase 1b)", () => {
    const bilder = [
      { id: "1", fileUrl: "/uploads/privat/a.jpg" },
      { id: "2", fileUrl: "/uploads/b.jpg" },
    ];
    const ut = signerBilder(bilder);
    expect(erSignert(ut[0]!.fileUrl)).toBe(true);
    expect(erSignert(ut[1]!.fileUrl)).toBe(true); // 🔴 ikke-privat signeres nå
    expect(bilder[0]!.fileUrl).toBe("/uploads/privat/a.jpg"); // input uendret
    expect(bilder[1]!.fileUrl).toBe("/uploads/b.jpg"); // input uendret
  });
});
