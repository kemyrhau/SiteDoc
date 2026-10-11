import { describe, it, expect } from "vitest";
import { erSvgBuffer, svgSharpOpsjoner } from "./svg-sharp";

/**
 * L7: `unlimited` settes KUN for SVG-input (løfter librsvg-grensa for store DWG-SVG),
 * aldri for brukerbilder (JPEG/PNG) — der beholdes DoS-vakten mot pikselbomber.
 */
describe("erSvgBuffer — SVG-gjenkjenning", () => {
  it("rett <svg", () => {
    expect(erSvgBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(true);
  });

  it("XML-prolog før <svg", () => {
    expect(erSvgBuffer(Buffer.from('<?xml version="1.0"?>\n<svg width="10"></svg>'))).toBe(true);
  });

  it("ledende whitespace", () => {
    expect(erSvgBuffer(Buffer.from('\n   <svg>'))).toBe(true);
  });

  it("JPEG-magic (ikke SVG)", () => {
    expect(erSvgBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe(false);
  });

  it("PNG-magic (ikke SVG)", () => {
    expect(erSvgBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(false);
  });

  it("tekst med «svg» i innhold, men ikke rot-element", () => {
    expect(erSvgBuffer(Buffer.from("en vanlig tekst som nevner svg"))).toBe(false);
  });
});

describe("svgSharpOpsjoner — unlimited kun for SVG", () => {
  it("SVG → { unlimited: true }", () => {
    expect(svgSharpOpsjoner(Buffer.from("<svg></svg>"))).toEqual({ unlimited: true });
  });

  it("ikke-SVG → {} (DoS-vakt beholdt)", () => {
    expect(svgSharpOpsjoner(Buffer.from([0xff, 0xd8, 0xff]))).toEqual({});
  });
});
