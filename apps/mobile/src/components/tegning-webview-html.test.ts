import { describe, it, expect } from "vitest";
import { byggHtml } from "./tegning-webview-html";

/**
 * RETUR 2 (2026-10-12): mobil-viseren inliner ezdxf-SVG og avgjør strekbehandling i
 * WebView-JS-en ut fra C1-formatet (`data-lw-base`), ikke motoren alene. Testen gater at
 * byggHtml-utdata bærer C1-gaten (speil av `svgHarC1Format`) og egen-grenen, slik at en
 * gammel ezdxf uten C1 aldri vises med rå strek. byggHtml er en ren strengbygger uten
 * React-Native-avhengigheter (derfor importerbar her).
 */
describe("byggHtml — C1-gate i inline-handler (RETUR 2)", () => {
  const html = byggHtml("/uploads/x.svg", [], [], null, "ingen", 0, null, /* svgInline */ true);

  it("inline-modus: #tegning er en <div> (ikke <img>) så SVG kan injiseres", () => {
    expect(html).toContain('<div id="tegning"');
    expect(html).not.toContain('<img id="tegning"');
  });

  it("speiler C1-deteksjonen (data-lw-base på roten) via SVG_ER_C1", () => {
    expect(html).toContain("SVG_ER_C1");
    expect(html).toMatch(/data-lw-base/);
  });

  it("egen-gren uten C1: injiserer dempet --egen-sw-regel (overstyrer rå stroke-width)", () => {
    expect(html).toContain("--egen-sw");
    expect(html).toContain("stroke-width:var(--egen-sw,1.5px) !important");
  });

  it("C1-gren beholder dempet --lw-skalering (--strek-skala)", () => {
    expect(html).toContain("--strek-skala");
  });

  it("ikke-inline (egen/raster): #tegning er <img>", () => {
    const imgHtml = byggHtml("/uploads/y.svg", [], [], null, "ingen", 0, null, /* svgInline */ false);
    expect(imgHtml).toContain('<img id="tegning"');
    expect(imgHtml).not.toContain('<div id="tegning"');
  });
});
