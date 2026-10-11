import { describe, it, expect } from "vitest";
import { tilpassEzdxfSvg } from "../ezdxfSvgVisning";

const EKTE_STYLE =
  '<style>path[style*="--lw"]{stroke-width:clamp(var(--strek-min,0px),' +
  "calc(var(--lw) * var(--strek-skala,1) * 1px),calc(var(--lw) * var(--strek-maks-k,1e9) * 1px))}</style>";

function svg(style: string, motorAttr = true): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${motorAttr ? ' data-motor="ezdxf"' : ""} ` +
    `data-lw-base="1" viewBox="0 0 100 100" width="2000" height="1500">${style}` +
    '<path d="M0 0 L1 1" stroke="#000" stroke-width="1" style="--lw:1"/></svg>'
  );
}

describe("tilpassEzdxfSvg — motorvalg fra server-markør (ikke data-motor i fila)", () => {
  it("FORFALSKET: data-motor i fila men ingen server-markør → behandles som egen, <style> strippes", () => {
    // Angriper laster opp en SVG med data-motor='ezdxf' + ondsinnet <style>.
    const skitten = svg('<style>body{background:url(http://evil/x)}</style>', true);
    const { svg: ut, erEzdxf } = tilpassEzdxfSvg(skitten, /* erEzdxfMotor */ false);
    expect(erEzdxf).toBe(false);
    expect(ut).not.toContain("url(");
    expect(ut).not.toContain("http://evil");
  });

  it("EKTE ezdxf (server-markør) med trygg render.py-<style> → beholdes", () => {
    const { svg: ut, erEzdxf } = tilpassEzdxfSvg(svg(EKTE_STYLE, true), true);
    expect(erEzdxf).toBe(true);
    expect(ut).toContain("var(--strek-skala");
  });

  it("CSS-VERN: ezdxf-markør men ondsinnet <style> (url()) → farlig <style> strippes", () => {
    const skitten = svg('<style>*{behavior:url(x.htc)}</style>' + EKTE_STYLE, true);
    const { svg: ut } = tilpassEzdxfSvg(skitten, true);
    expect(ut).not.toContain("behavior:");
    expect(ut).not.toContain("url(");
    // den trygge regelen overlever
    expect(ut).toContain("var(--strek-skala");
  });

  it("fjerner faste width/height og setter width=100%", () => {
    const { svg: ut } = tilpassEzdxfSvg(svg(EKTE_STYLE, true), true);
    expect(ut).toMatch(/<svg[^>]*width="100%"/);
    expect(ut).not.toMatch(/<svg[^>]*width="2000"/);
    expect(ut).toContain('data-motor="ezdxf"');
    expect(ut).toContain('data-lw-base="1"');
  });
});
