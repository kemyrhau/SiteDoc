import { describe, it, expect } from "vitest";
import { samleSignerteVedleggUrler, resolveSignerteUrler } from "./signerteUrler";

/**
 * 🔴 Fase 1b: resolveren gjelder HELE `/uploads/`, ikke bare `privat/`.
 * Regresjonen som ellers ville oppstått: tar du et bilde i felt (ikke-privat
 * opplasting), viste mobilen en tom ramme til neste refetch fordi resolveren
 * bare byttet ut `/uploads/privat/`-URL-er. Disse testene låser den nye bredden.
 */

const SIG = "?exp=9999999999999&sig=abc";

describe("samleSignerteVedleggUrler — samler hele /uploads/ (Fase 1b)", () => {
  it("samler både privat OG ikke-privat signerte URL-er fra server-data", () => {
    const data = {
      felt: {
        vedlegg: [
          { id: "p", url: `/uploads/privat/a.jpg${SIG}` },
          { id: "o", url: `/uploads/apen.jpg${SIG}` },
        ],
      },
    };
    const ut = new Map<string, string>();
    samleSignerteVedleggUrler(data, ut);
    expect(ut.get("p")).toBe(`/uploads/privat/a.jpg${SIG}`);
    expect(ut.get("o")).toBe(`/uploads/apen.jpg${SIG}`); // 🔴 var utelatt før Fase 1b
  });

  it("samler nestede (repeater) vedlegg rekursivt", () => {
    const data = { rep: { verdi: [{ felter: { b: { vedlegg: [{ id: "n", url: `/uploads/nested.jpg${SIG}` }] } } }] } };
    const ut = new Map<string, string>();
    samleSignerteVedleggUrler(data, ut);
    expect(ut.get("n")).toBe(`/uploads/nested.jpg${SIG}`);
  });
});

describe("resolveSignerteUrler — bytter RÅ /uploads/ til signert, immutabelt (Fase 1b)", () => {
  const map = new Map<string, string>([
    ["p", `/uploads/privat/a.jpg${SIG}`],
    ["o", `/uploads/apen.jpg${SIG}`],
  ]);

  it("🔴 resolver RÅ ikke-privat /uploads/ (var uendret før Fase 1b)", () => {
    const node = { id: "o", url: "/uploads/apen.jpg" };
    const ut = resolveSignerteUrler(node, map);
    expect(ut.url).toBe(`/uploads/apen.jpg${SIG}`);
    expect(node.url).toBe("/uploads/apen.jpg"); // input uendret (immutabelt)
    expect(ut).not.toBe(node);
  });

  it("resolver RÅ privat (uendret atferd)", () => {
    const ut = resolveSignerteUrler({ id: "p", url: "/uploads/privat/a.jpg" }, map);
    expect(ut.url).toBe(`/uploads/privat/a.jpg${SIG}`);
  });

  it("lar file://, alt-signerte og ikke-/uploads/ stå (samme referanse)", () => {
    const lokal = { id: "o", url: "file:///tmp/x.jpg" };
    expect(resolveSignerteUrler(lokal, map)).toBe(lokal);
    const signert = { id: "o", url: `/uploads/apen.jpg${SIG}` };
    expect(resolveSignerteUrler(signert, map)).toBe(signert); // bærer alt sig= → urørt
    const annet = { id: "o", url: "/api/annet" };
    expect(resolveSignerteUrler(annet, map)).toBe(annet);
  });

  it("tom map → samme referanse (ingen re-render)", () => {
    const node = { id: "o", url: "/uploads/apen.jpg" };
    expect(resolveSignerteUrler(node, new Map())).toBe(node);
  });
});
