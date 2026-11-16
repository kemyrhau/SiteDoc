// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lastNedBase64 } from "../pdf-eksport-nedlasting";

/**
 * Ordre (34): blob-URL-en må leve til nettleseren har startet nedlastingen — å trekke
 * den tilbake i samme tikk som `click()` kan avbryte nedlastingen (Safari/WebKit).
 * Tomt utvalg (melding, ingen render) testes i api: `pdf-eksport-utfall.integration.test.ts`.
 */

describe("lastNedBase64", () => {
  const revoke = vi.fn();
  let klikket: HTMLAnchorElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    revoke.mockReset();
    klikket = null;
    // jsdom mangler createObjectURL/revokeObjectURL.
    (globalThis.URL as unknown as Record<string, unknown>).createObjectURL = () => "blob:falsk";
    (globalThis.URL as unknown as Record<string, unknown>).revokeObjectURL = revoke;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      klikket = this;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("klikker en lenke med filnavnet og blob-URL-en", () => {
    lastNedBase64(btoa("%PDF-1.4"), "SiteDoc-Timerapport.pdf", "application/pdf");
    expect(klikket?.download).toBe("SiteDoc-Timerapport.pdf");
    expect(klikket?.href).toBe("blob:falsk");
    expect(document.body.contains(klikket)).toBe(false);
  });

  it("trekker ikke blob-URL-en tilbake i samme tikk som klikket", () => {
    lastNedBase64(btoa("%PDF-1.4"), "x.pdf", "application/pdf");
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:falsk");
  });
});
