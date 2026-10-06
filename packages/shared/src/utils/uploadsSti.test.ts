import { describe, it, expect } from "vitest";
import { erRaaUploadsUrl, erForgiftetUploadsUrl, raaUploadsSti, raaVedleggIData } from "./uploadsSti";

/**
 * De to speilvendte predikatene for `/uploads/`-URL-er. `erRaaUploadsUrl` er DELT
 * av api-gaten, emisjonssigneringen og mobil-resolveren — den er ikke rørt denne
 * runden. `erForgiftetUploadsUrl` er det motsatte, bygget av samme konstant, og
 * driver skrive-vei-vakten (del B).
 */

describe("erRaaUploadsUrl", () => {
  it("true for rå /uploads/-URL uten signatur", () => {
    expect(erRaaUploadsUrl("/uploads/privat/x.jpg")).toBe(true);
    expect(erRaaUploadsUrl("/uploads/apen.jpg")).toBe(true);
  });

  it("false for signert /uploads/-URL", () => {
    expect(erRaaUploadsUrl("/uploads/privat/x.jpg?exp=1&sig=abc")).toBe(false);
  });

  it("KRAV 3 — false for ekstern/lokal/tom (ikke /uploads/)", () => {
    expect(erRaaUploadsUrl("https://ekstern.no/bilde.jpg")).toBe(false);
    expect(erRaaUploadsUrl("https://ekstern.no/uploads/x.jpg")).toBe(false); // ikke prefiks
    expect(erRaaUploadsUrl("file:///lokal/x.jpg")).toBe(false);
    expect(erRaaUploadsUrl("")).toBe(false);
    expect(erRaaUploadsUrl(null)).toBe(false);
    expect(erRaaUploadsUrl(undefined)).toBe(false);
  });
});

describe("erForgiftetUploadsUrl", () => {
  it("true KUN for signert /uploads/-URL", () => {
    expect(erForgiftetUploadsUrl("/uploads/privat/x.jpg?exp=1&sig=abc")).toBe(true);
  });

  it("KRAV 3 — false for rå /uploads/, ekstern https og file:// (ingen falsk-positiv)", () => {
    expect(erForgiftetUploadsUrl("/uploads/privat/x.jpg")).toBe(false); // rå
    expect(erForgiftetUploadsUrl("/uploads/apen.jpg")).toBe(false); // rå
    // Ekstern URL som TILFELDIGVIS har sig= i query skal IKKE regnes forgiftet:
    expect(erForgiftetUploadsUrl("https://ekstern.no/x.jpg?sig=abc")).toBe(false);
    expect(erForgiftetUploadsUrl("https://ekstern.no/uploads/x.jpg?sig=abc")).toBe(false);
    expect(erForgiftetUploadsUrl("file:///lokal/x.jpg")).toBe(false);
    expect(erForgiftetUploadsUrl("")).toBe(false);
    expect(erForgiftetUploadsUrl(null)).toBe(false);
    expect(erForgiftetUploadsUrl(undefined)).toBe(false);
  });
});

describe("raaUploadsSti — reduser signert /uploads/-URL til rå sti (skrive-vei-vaksine)", () => {
  it("stripper signatur-query fra en forgiftet /uploads/-URL", () => {
    expect(raaUploadsSti("/uploads/privat/x.jpg?exp=1&sig=abc")).toBe("/uploads/privat/x.jpg");
  });

  it("lar rå /uploads/, ekstern og file:// stå uendret (kun forgiftede røres)", () => {
    expect(raaUploadsSti("/uploads/privat/x.jpg")).toBe("/uploads/privat/x.jpg");
    expect(raaUploadsSti("https://ekstern.no/x.jpg?sig=abc")).toBe("https://ekstern.no/x.jpg?sig=abc");
    expect(raaUploadsSti("file:///lokal/x.jpg")).toBe("file:///lokal/x.jpg");
    expect(raaUploadsSti("")).toBe("");
    expect(raaUploadsSti(null)).toBe(null);
  });

  it("rå sti av en forgiftet URL matcher rå sti av den rå URL-en (re-hydrerings-matchen)", () => {
    // Effekten matcher lokal (rå) mot server (signert) via denne likheten.
    expect(raaUploadsSti("/uploads/privat/x.jpg?exp=9&sig=z")).toBe(raaUploadsSti("/uploads/privat/x.jpg"));
  });
});

describe("raaVedleggIData — NØKKEL-AGNOSTISK dyp strip (speiler emisjons-signeringen)", () => {
  it("stripper url på ethvert nivå (attachments + repeater-rader), muterer ikke input", () => {
    const inn = {
      felt1: {
        verdi: null,
        vedlegg: [{ id: "a", url: "/uploads/privat/a.jpg?exp=1&sig=x" }],
      },
      repeater: {
        verdi: [
          { felter: { bilde: { vedlegg: [{ url: "/uploads/privat/b.jpg?exp=2&sig=y" }] } } },
        ],
      },
    };
    const ut = raaVedleggIData(inn) as typeof inn;
    expect(ut.felt1.vedlegg[0]!.url).toBe("/uploads/privat/a.jpg");
    expect((ut.repeater.verdi[0]! as { felter: { bilde: { vedlegg: { url: string }[] } } }).felter.bilde.vedlegg[0]!.url)
      .toBe("/uploads/privat/b.jpg");
    // input uendret (dyp kopi)
    expect(inn.felt1.vedlegg[0]!.url).toBe("/uploads/privat/a.jpg?exp=1&sig=x");
  });

  it("KRAV — stripper også originalUrl (og enhver annen URL-nøkkel), ikke bare url", () => {
    const inn = {
      f: {
        vedlegg: [{
          url: "/uploads/privat/annotert.jpg?exp=1&sig=x",
          originalUrl: "/uploads/privat/original.jpg?exp=1&sig=y",
        }],
      },
    };
    const ut = raaVedleggIData(inn) as typeof inn;
    expect(ut.f.vedlegg[0]!.url).toBe("/uploads/privat/annotert.jpg");
    expect(ut.f.vedlegg[0]!.originalUrl).toBe("/uploads/privat/original.jpg"); // ← det ekte funnet
  });

  it("KRAV falsk-positiv — ekstern https, data: og rå /uploads/ går UENDRET gjennom", () => {
    const inn = {
      f: {
        vedlegg: [
          { url: "/uploads/privat/raa.jpg" },                    // rå → urørt
          { url: "https://ekstern.no/x.jpg?sig=abc" },           // ekstern → urørt
          { url: "data:image/png;base64,AAAA" },                 // data: → urørt
        ],
        kommentar: "sig=abc i tekst",                            // ikke /uploads/ → urørt
      },
    };
    const ut = raaVedleggIData(inn) as typeof inn;
    expect(ut.f.vedlegg[0]!.url).toBe("/uploads/privat/raa.jpg");
    expect(ut.f.vedlegg[1]!.url).toBe("https://ekstern.no/x.jpg?sig=abc");
    expect(ut.f.vedlegg[2]!.url).toBe("data:image/png;base64,AAAA");
    expect(ut.f.kommentar).toBe("sig=abc i tekst");
  });
});
