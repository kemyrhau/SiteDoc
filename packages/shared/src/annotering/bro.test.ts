import { describe, it, expect, vi } from "vitest";
import { postTilVert, BRO_RN_BETINGELSE, BRO_IFRAME_BETINGELSE, type BroVindu } from "./bro";
import { ANNOTERINGS_HTML } from "./annoterings-html";

/**
 * Tvilling-relasjonen HÅNDHEVES her (ikke bare dokumenteres): grenbetingelsene er
 * konstanter, HTML-en BYGGES fra dem, og testen asserterer at HTML-en inneholder
 * dem. Endres en betingelse i bro.ts, følger HTML-en automatisk; hardkodes en
 * avvikende betingelse i HTML-en, feiler includes-asserten. Samme mekanisme som
 * FABRIC_CDN_STI.
 */
describe("bro-betingelser er ÉN kilde — HTML bygges fra konstantene", () => {
  it("konstantene er pinnet til eksakt betingelsestekst (endring blir en bevisst handling)", () => {
    expect(BRO_RN_BETINGELSE).toBe("window.ReactNativeWebView && window.ReactNativeWebView.postMessage");
    expect(BRO_IFRAME_BETINGELSE).toBe("window.parent && window.parent !== window");
  });

  it("ANNOTERINGS_HTML inneholder begge betingelsene (HTML kan ikke drifte fra bro.ts)", () => {
    expect(ANNOTERINGS_HTML).toContain(BRO_RN_BETINGELSE);
    expect(ANNOTERINGS_HTML).toContain(BRO_IFRAME_BETINGELSE);
  });
});

/**
 * Grenvalget i broen VELGES av miljøet. Disse testene beviser at riktig gren
 * velges — ikke at koden er skrevet (det er string-guardens jobb). Uten dette er
 * RN-veien refaktorert og ukjørt (WebKit/Safari treffer bare web-grenen).
 */
describe("postTilVert — velger riktig vert-bro etter miljø", () => {
  it("RN-WebView til stede → RN-grenen velges, window.parent kalles IKKE", () => {
    const rnPostMessage = vi.fn();
    const parentPostMessage = vi.fn();
    const win: BroVindu = {
      ReactNativeWebView: { postMessage: rnPostMessage },
      parent: { postMessage: parentPostMessage }, // eget objekt ⇒ parent !== win
    };

    const gren = postTilVert({ type: "klar" }, win);

    expect(gren).toBe("rn");
    expect(rnPostMessage).toHaveBeenCalledWith(JSON.stringify({ type: "klar" }));
    expect(parentPostMessage).not.toHaveBeenCalled(); // 🔴 ikke begge veier
  });

  it("ingen RN-WebView (web-iframe) → window.parent-grenen velges med '*'", () => {
    const parentPostMessage = vi.fn();
    const win: BroVindu = {
      // ingen ReactNativeWebView
      parent: { postMessage: parentPostMessage },
    };

    const gren = postTilVert({ type: "ferdig", dataUrl: "x" }, win);

    expect(gren).toBe("parent");
    expect(parentPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "ferdig", dataUrl: "x" }),
      "*",
    );
  });

  it("RN-objekt finnes men uten postMessage → faller til web-grenen (ikke krasj)", () => {
    const parentPostMessage = vi.fn();
    const win: BroVindu = {
      ReactNativeWebView: {}, // ingen postMessage
      parent: { postMessage: parentPostMessage },
    };
    expect(postTilVert({ a: 1 }, win)).toBe("parent");
    expect(parentPostMessage).toHaveBeenCalledOnce();
  });

  it("verken RN eller ekte parent (parent === win) → ingen gren, ingen krasj", () => {
    const win = {} as BroVindu;
    (win as { parent: unknown }).parent = win; // topp-nivå: parent === self
    expect(postTilVert({ a: 1 }, win)).toBe("ingen");
  });
});
