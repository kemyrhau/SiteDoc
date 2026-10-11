// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { svgMarkupErTrygg } from "@sitedoc/shared";

const EKTE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" data-motor="ezdxf" data-lw-base="1" ' +
  'viewBox="0 0 100 100" width="100%" height="auto" style="display:block">' +
  '<style>path[style*="--lw"]{stroke-width:clamp(0px,calc(var(--lw) * 1px),calc(var(--lw) * 1e9 * 1px))}</style>' +
  '<rect x="0" y="0" width="100" height="100" fill="#fff"/>' +
  '<g stroke-linecap="round"><path d="M0 0 L1 1" stroke="#000" stroke-width="1" style="--lw:1"/>' +
  '<text x="1" y="2" font-size="2">Rom 101</text></g></svg>';

describe("svgMarkupErTrygg — allowlist før innerHTML (mobil-WebView)", () => {
  it("godtar ekte render.py-SVG (rect, path, style, text)", () => {
    expect(svgMarkupErTrygg(EKTE_SVG)).toBe(true);
  });

  it("REGRESJON: lagnavn med «onload=»/«<svg» i html-escapet data-layer skal IKKE avvises", () => {
    // render.py skriver et ondsinnet lagnavn som ESCAPET verdi i data-layer. DOM-parsing
    // ser at data-layer er et dataattributt (ikke en handler), så SVG-en er trygg.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<path d="M0 0 L1 1" stroke="#000" data-layer="&quot;&gt;&lt;svg onload=alert(1)&gt;"/></svg>';
    expect(svgMarkupErTrygg(svg)).toBe(true);
  });

  it("avviser <script>", () => {
    expect(svgMarkupErTrygg("<svg><script>alert(1)</script></svg>")).toBe(false);
  });

  it("avviser <foreignObject>", () => {
    expect(svgMarkupErTrygg("<svg><foreignObject><div>x</div></foreignObject></svg>")).toBe(false);
  });

  it("avviser ekte event-handler-attributter", () => {
    expect(svgMarkupErTrygg('<svg onload="alert(1)"><path/></svg>')).toBe(false);
    expect(svgMarkupErTrygg('<svg><rect onclick="x"/></svg>')).toBe(false);
  });

  it("avviser href/xlink:href (javascript:/data:-smugling)", () => {
    expect(svgMarkupErTrygg('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false);
    expect(svgMarkupErTrygg('<svg><use xlink:href="data:x"/></svg>')).toBe(false);
  });

  it("avviser farlig CSS i <style> og i style-attributt", () => {
    expect(svgMarkupErTrygg("<svg><style>*{background:url(http://evil/x)}</style></svg>")).toBe(false);
    expect(svgMarkupErTrygg('<svg><path style="background:url(http://evil/x)"/></svg>')).toBe(false);
  });

  it("avviser <image> (ressurs-henting)", () => {
    expect(svgMarkupErTrygg('<svg><image href="http://evil/x"/></svg>')).toBe(false);
  });
});
