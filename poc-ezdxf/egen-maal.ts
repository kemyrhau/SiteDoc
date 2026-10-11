/**
 * PoC-harness: kjør den EKSISTERENDE motoren (egen) på hver DXF og dump
 * metadata + SVG-mål. Gir "egen"-siden for krav 6-sammenligning og mater
 * extents/rotasjon inn i ezdxf-motoren.
 *
 * Kjør:  apps/api/node_modules/.bin/tsx poc-ezdxf/egen-maal.ts <dxf> <filnavn> <ut-dir>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { konverterDwg, dxfTilSvg, beregnExtents } from "../apps/api/src/services/dwgKonvertering";

async function main() {
  const [dxf, filnavn, utDir] = process.argv.slice(2);
  if (!dxf || !filnavn || !utDir) {
    console.error("bruk: egen-maal.ts <dxf> <filnavn> <ut-dir>");
    process.exit(1);
  }
  const før = new Set(readdirSync(utDir));
  const res = await konverterDwg(dxf, filnavn, utDir, "dxf");

  // dxfTilSvg direkte for vbW/vbH (ikke i konverterDwg-resultatet)
  const dxfInnhold = readFileSync(dxf, "latin1");
  const system = res.koordinatSystem;
  const svgRes = dxfTilSvg(dxfInnhold, undefined, { ingenAutoRotasjon: !!system });
  const extents = beregnExtents(dxfInnhold);

  // finn ny SVG-fil
  const etter = readdirSync(utDir).filter((f) => !før.has(f) && f.endsWith(".svg"));
  const hoved = etter.map((f) => ({ f, sz: statSync(`${utDir}/${f}`).size })).sort((a, b) => b.sz - a.sz)[0];
  let svgTxt = "";
  if (hoved) svgTxt = readFileSync(`${utDir}/${hoved.f}`, "utf8");

  const ut = {
    motor: "egen",
    fil: dxf,
    filnavn,
    koordinatSystem: res.koordinatSystem,
    autoRotasjon: res.autoRotasjon,
    startutsnitt: res.startutsnitt,
    mmPrPiksel: res.mmPrPiksel,
    scale: res.scale,
    scaleKilde: res.scaleKilde,
    imageWidth: res.imageWidth,
    imageHeight: res.imageHeight,
    geoReferanse: res.geoReferanse,
    vbW: svgRes?.vbW,
    vbH: svgRes?.vbH,
    width: svgRes?.width,
    height: svgRes?.height,
    beregnExtents: extents,
    svg_bytes: svgTxt ? Buffer.byteLength(svgTxt) : null,
    path_noder: (svgTxt.match(/<path/g) || []).length,
    line_noder: (svgTxt.match(/<line/g) || []).length,
    polyline_noder: (svgTxt.match(/<polyline/g) || []).length,
    polygon_noder: (svgTxt.match(/<polygon/g) || []).length,
    circle_noder: (svgTxt.match(/<circle/g) || []).length,
    ellipse_noder: (svgTxt.match(/<ellipse/g) || []).length,
    text_noder: (svgTxt.match(/<text/g) || []).length,
    noder_total:
      (svgTxt.match(/<(path|line|polyline|polygon|circle|ellipse|text)\b/g) || []).length,
    rapport: res.rapport,
    svgFil: hoved?.f,
  };
  console.log(JSON.stringify(ut, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
