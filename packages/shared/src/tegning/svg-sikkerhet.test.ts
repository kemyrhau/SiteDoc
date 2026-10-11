import { describe, it, expect } from "vitest";
import { farligCss, EZDXF_TILLATTE_TAGGER } from "./svg-sikkerhet";

// svgMarkupErTrygg er DOM-basert (DOMParser) og testes i web-pakken (jsdom-miljø):
// apps/web/src/lib/__tests__/svgMarkupErTrygg.test.ts. Node-miljøet her har ingen DOM.

describe("farligCss — aktive CSS-konstruksjoner", () => {
  it("avviser url(), @import, expression() og behavior:", () => {
    expect(farligCss("background:url(http://evil/x)")).toBe(true);
    expect(farligCss("@import 'http://evil/x.css'")).toBe(true);
    expect(farligCss("width:expression(alert(1))")).toBe(true);
    expect(farligCss("behavior:url(x.htc)")).toBe(true);
  });

  it("tåler mellomrom og store bokstaver", () => {
    expect(farligCss("URL (x)")).toBe(true);
    expect(farligCss("EXPRESSION ( alert(1) )")).toBe(true);
    expect(farligCss("BEHAVIOR : url(x)")).toBe(true);
  });

  it("slipper gjennom render.py sin faste clamp-regel", () => {
    const trygg =
      'path[style*="--lw"]{stroke-width:clamp(var(--strek-min,0px),' +
      "calc(var(--lw) * var(--strek-skala,1) * 1px),calc(var(--lw) * var(--strek-maks-k,1e9) * 1px))}";
    expect(farligCss(trygg)).toBe(false);
  });

  it("slipper gjennom tom/ufarlig CSS", () => {
    expect(farligCss("")).toBe(false);
    expect(farligCss("stroke-width:2px;pointer-events:stroke")).toBe(false);
  });
});

describe("EZDXF_TILLATTE_TAGGER", () => {
  it("dekker elementene render.py emitterer, uten script/foreignObject", () => {
    expect(EZDXF_TILLATTE_TAGGER).toContain("path");
    expect(EZDXF_TILLATTE_TAGGER).toContain("style");
    expect(EZDXF_TILLATTE_TAGGER).toContain("text");
    expect(EZDXF_TILLATTE_TAGGER).not.toContain("script");
    expect(EZDXF_TILLATTE_TAGGER).not.toContain("foreignObject");
  });
});
