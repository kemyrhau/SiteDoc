import { describe, it, expect } from "vitest";
import { settUrlPaaVedlegg, finnVedleggFilnavn } from "./vedleggUrl";

// Delt kjerne for `sjekkliste.settVedleggUrl` og `oppgave.settVedleggUrl` (funn C).
// Samme form for Checklist.data og Task.data — repeater-formen ({ _radId, felter })
// testes FØRST: det var den fire bilder gjemte seg bak i to døgn.
describe("settUrlPaaVedlegg", () => {
  it("bytter URL på et vedlegg nestet i en repeater-rad ({ _radId, felter })", () => {
    const data: Record<string, unknown> = {
      rep1: {
        verdi: [
          {
            _radId: "r1",
            felter: {
              bilde: {
                vedlegg: [
                  { id: "v1", type: "bilde", url: "file:///IMG_1.jpg" },
                  { id: "v2", type: "bilde", url: "file:///IMG_2.jpg" },
                ],
              },
            },
          },
        ],
      },
    };
    const truffet = settUrlPaaVedlegg(data, "v2", "/uploads/privat/IMG_2.jpg", "IMG_2.jpg");
    expect(truffet).toBe(true);
    const rad = (data.rep1 as { verdi: Array<{ felter: { bilde: { vedlegg: Array<{ id: string; url: string; filnavn?: string }> } } }> }).verdi[0]!;
    const v2 = rad.felter.bilde.vedlegg.find((v) => v.id === "v2")!;
    expect(v2.url).toBe("/uploads/privat/IMG_2.jpg");
    expect(v2.filnavn).toBe("IMG_2.jpg");
    // v1 er urørt.
    expect(rad.felter.bilde.vedlegg.find((v) => v.id === "v1")!.url).toBe("file:///IMG_1.jpg");
  });

  it("bytter URL på et topp-nivå-vedlegg (flat form)", () => {
    const data: Record<string, unknown> = {
      felt1: { verdi: null, vedlegg: [{ id: "v1", type: "bilde", url: "file:///a.jpg" }] },
    };
    const truffet = settUrlPaaVedlegg(data, "v1", "/uploads/privat/a.jpg", undefined);
    expect(truffet).toBe(true);
    expect((data.felt1 as { vedlegg: Array<{ url: string }> }).vedlegg[0]!.url).toBe("/uploads/privat/a.jpg");
  });

  it("lar filnavn stå urørt når det ikke oppgis", () => {
    const data: Record<string, unknown> = {
      felt1: { vedlegg: [{ id: "v1", url: "file:///a.jpg", filnavn: "gammelt.jpg" }] },
    };
    settUrlPaaVedlegg(data, "v1", "/uploads/privat/a.jpg", undefined);
    expect((data.felt1 as { vedlegg: Array<{ filnavn: string }> }).vedlegg[0]!.filnavn).toBe("gammelt.jpg");
  });

  it("returnerer false uten å mutere når vedlegget ikke finnes", () => {
    const data: Record<string, unknown> = {
      felt1: { vedlegg: [{ id: "v1", url: "file:///a.jpg" }] },
    };
    const truffet = settUrlPaaVedlegg(data, "ukjent", "/uploads/privat/x.jpg", undefined);
    expect(truffet).toBe(false);
    expect((data.felt1 as { vedlegg: Array<{ url: string }> }).vedlegg[0]!.url).toBe("file:///a.jpg");
  });

  it("treffer alle forekomster av samme vedleggId (retry-safe idempotens)", () => {
    const data: Record<string, unknown> = {
      a: { vedlegg: [{ id: "v1", url: "file:///a.jpg" }] },
      b: { vedlegg: [{ id: "v1", url: "file:///a.jpg" }] },
    };
    const truffet = settUrlPaaVedlegg(data, "v1", "/uploads/privat/a.jpg", undefined);
    expect(truffet).toBe(true);
    expect((data.a as { vedlegg: Array<{ url: string }> }).vedlegg[0]!.url).toBe("/uploads/privat/a.jpg");
    expect((data.b as { vedlegg: Array<{ url: string }> }).vedlegg[0]!.url).toBe("/uploads/privat/a.jpg");
  });
});

// Godkjent-lås (Kenneth-vedtak 2026-10-21): settVedleggUrl skiller NYTT vedlegg (null) og
// ERSTATNING (endret filnavn) fra en ren URL-fullføring (samme filnavn) via dette oppslaget.
describe("finnVedleggFilnavn", () => {
  it("finner filnavnet på et topp-nivå-vedlegg", () => {
    const data = { felt1: { vedlegg: [{ id: "v1", url: "/u/a", filnavn: "foto.jpg" }] } };
    expect(finnVedleggFilnavn(data, "v1")).toBe("foto.jpg");
  });
  it("finner filnavnet nestet i en repeater-rad", () => {
    const data = {
      rep: { verdi: [{ _radId: "r1", felter: { b: { vedlegg: [{ id: "v9", url: "/u/r", filnavn: "r.jpg" }] } } }] },
    };
    expect(finnVedleggFilnavn(data, "v9")).toBe("r.jpg");
  });
  it("null når vedlegget ikke finnes (→ nytt vedlegg, forbudt på godkjent)", () => {
    const data = { felt1: { vedlegg: [{ id: "v1", url: "/u/a", filnavn: "foto.jpg" }] } };
    expect(finnVedleggFilnavn(data, "ukjent")).toBeNull();
  });
  it("tom streng når vedlegget finnes uten filnavn", () => {
    const data = { felt1: { vedlegg: [{ id: "v1", url: "/u/a" }] } };
    expect(finnVedleggFilnavn(data, "v1")).toBe("");
  });
});
