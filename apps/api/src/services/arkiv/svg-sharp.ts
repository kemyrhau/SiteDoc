/**
 * L7 (2026-10-11): librsvg-grense ved store DWG-SVG-er i arkiv-rendring.
 *
 * sharp/librsvg (libvips `svgload`) arver libxml2-grensa `XML_MAX_TEXT_LENGTH`
 * (~10 MB) pr. node/attributt. En ezdxf- eller egen-tegnet DWG-SVG kan ha ett
 * enkelt `d`-attributt (mega-path) over den grensa → `sharp()` kaster
 * «Resource limit exceeded … try XML_PARSE_HUGE», og arkiv-PDF-en med DWG-tegning
 * feiler. `{ unlimited: true }` setter `XML_PARSE_HUGE` og løfter pikseltaket.
 *
 * Målt (sharp 0.34.5): ett `d`-attributt > ~10 MB feiler uten flagget, lykkes med.
 * Flere små paths (39k × ~5 MB totalt) er IKKE problemet — grensa er pr. node.
 *
 * `{ unlimited: true }` løfter også DoS-vakten mot pikselbomber, så vi setter det
 * KUN når inputen faktisk er en SVG. Arkiv-SVG-ene er VÅRE egne konverterte filer
 * (tegnet av egen/ezdxf fra `/uploads/`), ikke rå kundeopplasting — men brukerbilder
 * (JPEG/PNG) i samme rør beholder vakten.
 */

import sharp from "sharp";

/** Er bufferen (XML-) SVG? Ser etter `<svg` i de første ~1 KB, forbi BOM/XML-prolog/whitespace. */
export function erSvgBuffer(bytes: Buffer): boolean {
  const start = bytes.subarray(0, 1024).toString("utf-8").trimStart();
  // Enten rett på <svg, eller en XML-prolog/kommentar/doctype før rot-elementet.
  return /^<svg[\s>]/i.test(start) || /^<\?xml[\s\S]*?<svg[\s>]/i.test(start);
}

/** sharp-input-opsjoner: `{ unlimited: true }` KUN for SVG (løft librsvg-grensa), ellers `{}`. */
export function svgSharpOpsjoner(bytes: Buffer): sharp.SharpOptions {
  return erSvgBuffer(bytes) ? { unlimited: true } : {};
}

/** Åpne en bilde-buffer med sharp, trygt for store DWG-SVG-er (L7). */
export function aapneBilde(bytes: Buffer): sharp.Sharp {
  return sharp(bytes, svgSharpOpsjoner(bytes));
}
