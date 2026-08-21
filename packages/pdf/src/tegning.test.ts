import { describe, it, expect } from "vitest";
import { byggTegningPosisjon, byggDetaljUtsnitt } from "./tegning";

/**
 * Gate 4 (fabel 2026-08-21): `byggDetaljUtsnitt` er en REN ekstraksjon ut av
 * `byggTegningPosisjon`. tegning.ts deles med den gamle PDF-veien (sjekkliste.ts),
 * så den gamle kallstien må være BIT-FOR-BIT uendret. GOLDEN er den beviste
 * pre-ekstraksjon-outputen (diffet mot origin/develop → byte-identisk 2026-08-21).
 */
const GOLDEN = "\n<div style=\"font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;\">Z-20-01</div>\n<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;\">\n  <!-- Oversiktsbilde med markør — SVG med korrekt aspect ratio -->\n  <div style=\"border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;\">\n    <svg width=\"100%\" viewBox=\"0 0 177.77777777777777 100\" preserveAspectRatio=\"xMidYMid meet\" style=\"display:block;\">\n      <image href=\"data:img/x\" x=\"0\" y=\"0\" width=\"177.77777777777777\" height=\"100\" preserveAspectRatio=\"none\"/>\n      <circle cx=\"107.82222222222221\" cy=\"75.2\" r=\"2.666666666666666\" fill=\"#ef4444\" stroke=\"white\" stroke-width=\"0.7111111111111111\"/>\n      <rect x=\"85.6\" y=\"62.7\" width=\"44.44444444444444\" height=\"25\" fill=\"none\" stroke=\"#f87171\" stroke-width=\"0.5333333333333333\"/>\n    </svg>\n    <div style=\"font-size:9px;color:#6b7280;padding:2px 4px;\">Oversikt</div>\n  </div>\n\n  <!-- Detalj-utsnitt -->\n  <div style=\"position:relative;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:260px;\">\n    <img src=\"data:img/x\" alt=\"Detalj\" style=\"width:100%;height:100%;object-fit:cover;transform-origin:60.65% 75.2%;transform:scale(4);\" />\n    <div style=\"position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;transform:translate(-50%,-50%);z-index:2;\"></div>\n    <div style=\"position:absolute;bottom:4px;left:4px;background:rgba(255,255,255,0.8);padding:1px 6px;border-radius:3px;font-size:9px;font-weight:500;color:#6b7280;\">Detalj</div>\n  </div>\n</div>";

const INPUT = {
  tegningBildeUrl: "data:img/x",
  tegningNavn: "Z-20-01",
  positionX: 60.65,
  positionY: 75.2,
  imageWidth: 1600,
  imageHeight: 900,
};

describe("byggTegningPosisjon — byte-identisk gammel kallsti (ren ekstraksjon)", () => {
  it("output er bit-for-bit lik golden (ingen adferdsendring i ekstraksjonen)", () => {
    expect(byggTegningPosisjon(INPUT)).toBe(GOLDEN);
  });

  it("detaljpanelet er nøyaktig byggDetaljUtsnitt(hoydePx=260, zoom=4)", () => {
    const detalj = byggDetaljUtsnitt({ url: INPUT.tegningBildeUrl, x: INPUT.positionX, y: INPUT.positionY, hoydePx: 260, zoom: 4 });
    expect(byggTegningPosisjon(INPUT)).toContain(detalj);
  });
});

describe("byggDetaljUtsnitt — parameterisert målstørrelse (Gate 4)", () => {
  it("hoydePx og zoom er parametre (ny form ≠ 260/4-formen)", () => {
    const arkiv = byggDetaljUtsnitt({ url: "data:img/x", x: 60.65, y: 75.2, hoydePx: 96, zoom: 4 });
    expect(arkiv).toContain("height:96px;");
    expect(arkiv).toContain("transform:scale(4);");
    expect(arkiv).toContain("transform-origin:60.65% 75.2%;");
    expect(arkiv).not.toMatch(/https?:\/\//);
  });
});
