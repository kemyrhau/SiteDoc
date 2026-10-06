import { describe, it, expect } from "vitest";
import { samleSignerteVedleggUrler, resolveSignerteUrler } from "./signerteUrler";

/**
 * 🔴 Fase 1b: resolveren gjelder HELE `/uploads/`, ikke bare `privat/`.
 * 🔴 Herding 2026-09-30 (speiler web-fiksen 29.09): to akser låst her —
 *   Krav 1 (nøkkel-agnostisk): enhver `/uploads/`-streng leges, uansett nøkkelnavn
 *     (`url`, `originalUrl`, en framtidig tredje) — ikke via en nøkkelliste.
 *   Krav 2 (utløpt ≠ rå): en signert URL med `exp` i fortid leges også; en GYLDIG
 *     signert står urørt (idempotens, ellers faller koalesceringen fra `4ef039fd`).
 *   Innsamling og resolusjon nøkler begge på RÅ STI, så rå og utløpt-signert av samme
 *   fil finner den ferske.
 */

const NAA = 1_000_000;
const GYLDIG = "?exp=2000000&sig=fersk"; // exp > NAA → gyldig
const UTLOPT = "?exp=500000&sig=gammel"; // exp <= NAA → utløpt

describe("samleSignerteVedleggUrler — nøkkel-agnostisk, rå-sti-nøkkel", () => {
  it("samler enhver /uploads/-streng uansett nøkkelnavn (url OG originalUrl)", () => {
    const data = {
      felt: {
        vedlegg: [
          {
            id: "p",
            url: `/uploads/privat/a.jpg${GYLDIG}`,
            originalUrl: `/uploads/orig-p.jpg${GYLDIG}`, // 🔴 annet nøkkelnavn — skal likevel samles
          },
          { id: "o", url: `/uploads/apen.jpg${GYLDIG}` },
        ],
      },
    };
    const ut = new Map<string, string>();
    samleSignerteVedleggUrler(data, ut);
    expect(ut.get("/uploads/privat/a.jpg")).toBe(`/uploads/privat/a.jpg${GYLDIG}`);
    expect(ut.get("/uploads/orig-p.jpg")).toBe(`/uploads/orig-p.jpg${GYLDIG}`); // 🔴 originalUrl dekket
    expect(ut.get("/uploads/apen.jpg")).toBe(`/uploads/apen.jpg${GYLDIG}`);
  });

  it("samler nestede (repeater) vedlegg rekursivt", () => {
    const data = { rep: { verdi: [{ felter: { b: { vedlegg: [{ id: "n", url: `/uploads/nested.jpg${GYLDIG}` }] } } }] } };
    const ut = new Map<string, string>();
    samleSignerteVedleggUrler(data, ut);
    expect(ut.get("/uploads/nested.jpg")).toBe(`/uploads/nested.jpg${GYLDIG}`);
  });
});

describe("resolveSignerteUrler — legger RÅ + UTLØPT til fersk signert, immutabelt", () => {
  const map = new Map<string, string>([
    ["/uploads/privat/a.jpg", `/uploads/privat/a.jpg${GYLDIG}`],
    ["/uploads/apen.jpg", `/uploads/apen.jpg${GYLDIG}`],
    ["/uploads/original.jpg", `/uploads/original.jpg${GYLDIG}`],
  ]);

  it("resolver RÅ ikke-privat /uploads/", () => {
    const node = { id: "o", url: "/uploads/apen.jpg" };
    const ut = resolveSignerteUrler(node, map, NAA);
    expect(ut.url).toBe(`/uploads/apen.jpg${GYLDIG}`);
    expect(node.url).toBe("/uploads/apen.jpg"); // input uendret (immutabelt)
    expect(ut).not.toBe(node);
  });

  it("resolver RÅ privat", () => {
    const ut = resolveSignerteUrler({ id: "p", url: "/uploads/privat/a.jpg" }, map, NAA);
    expect(ut.url).toBe(`/uploads/privat/a.jpg${GYLDIG}`);
  });

  it("🔴 KRAV 1: nøkkel-agnostisk — originalUrl leges uten at nøkkelen nevnes", () => {
    const node = { id: "x", url: "/uploads/apen.jpg", originalUrl: "/uploads/original.jpg" };
    const ut = resolveSignerteUrler(node, map, NAA);
    expect(ut.url).toBe(`/uploads/apen.jpg${GYLDIG}`);
    expect(ut.originalUrl).toBe(`/uploads/original.jpg${GYLDIG}`); // 🔴 var død før herdingen
  });

  it("🔴 KRAV 2: utløpt signert URL leges til den ferske", () => {
    const node = { id: "o", url: `/uploads/apen.jpg${UTLOPT}` };
    const ut = resolveSignerteUrler(node, map, NAA);
    expect(ut.url).toBe(`/uploads/apen.jpg${GYLDIG}`); // 🔴 Funn C: sto død før herdingen
    expect(ut).not.toBe(node);
  });

  it("🔴 KRAV 2-idempotens: GYLDIG signert URL står urørt (samme referanse)", () => {
    const node = { id: "o", url: `/uploads/apen.jpg${GYLDIG}` };
    // Gyldig signatur skal ikke byttes — ellers skifter URL-en identitet ved hver visning.
    expect(resolveSignerteUrler(node, map, NAA)).toBe(node);
  });

  it("lar file:// og ikke-/uploads/ stå (samme referanse)", () => {
    const lokal = { id: "o", url: "file:///tmp/x.jpg" };
    expect(resolveSignerteUrler(lokal, map, NAA)).toBe(lokal);
    const annet = { id: "o", url: "/api/annet" };
    expect(resolveSignerteUrler(annet, map, NAA)).toBe(annet);
  });

  it("RÅ /uploads/ uten treff i kartet står uendret (samme referanse)", () => {
    const node = { id: "z", url: "/uploads/ukjent.jpg" };
    expect(resolveSignerteUrler(node, map, NAA)).toBe(node);
  });

  it("tom map → samme referanse (ingen re-render)", () => {
    const node = { id: "o", url: "/uploads/apen.jpg" };
    expect(resolveSignerteUrler(node, new Map(), NAA)).toBe(node);
  });
});
