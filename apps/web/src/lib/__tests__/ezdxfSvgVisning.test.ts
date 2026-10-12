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

/**
 * RETUR 2 (2026-10-12): C1-gate. Markøren ALENE (motor: "ezdxf") skal ikke få viseren til
 * å beholde SVG-ens rå stil — en ezdxf-SVG konvertert før C1 (Rev. F) bærer rå inline
 * `stroke-width` (~173 viewBox-enheter) uten `data-lw-base`/`--lw` og ble vist som svarte
 * bjelker. Den skal falle til egen-behandling (strip <style> + injiser 1,5/zoom).
 */
// Rev. F: ekte ezdxf, men PRE-C1 — rå stroke-width, ingen data-lw-base/--lw.
const REV_F_SVG = `<svg xmlns="http://www.w3.org/2000/svg" data-motor="ezdxf" viewBox="0 0 100 100"><path d="M0 0 L10 10" stroke="#000" stroke-width="173"/></svg>`;

describe("tilpassEzdxfSvg — C1-gate (RETUR 2)", () => {
  it("gammel ezdxf UTEN C1 (Rev. F) + markør ezdxf → egen-behandling (erEzdxf=false)", () => {
    const { svg: ut, erEzdxf } = tilpassEzdxfSvg(REV_F_SVG, /* erEzdxfMotor */ true);
    expect(erEzdxf).toBe(false);
    // Injisert zoom-bevisst strek (1,5/zoom) overstyrer den rå 173-stroke-width-en.
    expect(ut).toContain("calc(1.5 / var(--svg-zoom");
    expect(ut).toContain("!important");
    // Den rå 173-attributten er fortsatt i markupen, men blir overstyrt av !important-CSS.
    expect(ut).toContain('stroke-width="173"');
    // SVG-ens dempet-clamp-regel skal IKKE være injisert.
    expect(ut).not.toContain("var(--strek-skala");
  });

  it("ny ezdxf MED C1 + markør ezdxf → behold stil (erEzdxf=true)", () => {
    const { svg: ut, erEzdxf } = tilpassEzdxfSvg(svg(EKTE_STYLE, true), true);
    expect(erEzdxf).toBe(true);
    expect(ut).toContain("var(--strek-skala");
    expect(ut).not.toContain("calc(1.5 / var(--svg-zoom");
  });
});
