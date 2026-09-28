import { describe, it, expect } from "vitest";
import { erRaaUploadsUrl, erForgiftetUploadsUrl } from "./uploadsSti";

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
