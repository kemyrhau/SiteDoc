import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * W2 — snitt på PC. Scenen krever WebGL og kan ikke kjøres i node; vakten låser
 * de to koblingene i kilden. Gesten verifiseres av Kenneth på test.
 */
const kilde = readFileSync(resolve(__dirname, "../tred-viewer-kontekst.tsx"), "utf8");

describe("W2 (1) raycaster opprettes ved oppsett", () => {
  it("Raycasters.get(world) kalles etter clipper.setup, før første dobbeltklikk", () => {
    const oppsett = kilde.indexOf("clipper.setup();");
    const raycaster = kilde.indexOf("components.get(OBC.Raycasters).get(world);");
    const dblklikk = kilde.indexOf('rendererDom.addEventListener("dblclick", handleDblKlikk);');
    expect(oppsett).toBeGreaterThan(-1);
    expect(raycaster).toBeGreaterThan(oppsett);
    expect(dblklikk).toBeGreaterThan(raycaster);
  });
});

describe("W2 (2) ingen objektvalg i snitt-modus", () => {
  it("handleKlikk returnerer tidlig når Snitt-knappen er på", () => {
    const start = kilde.indexOf("async function handleKlikk(event: MouseEvent) {");
    const sperre = kilde.indexOf("if (klippModusRef.current) return;", start);
    const raycast = kilde.indexOf("await resetHighlight();", start);
    expect(start).toBeGreaterThan(-1);
    expect(sperre).toBeGreaterThan(start);
    expect(raycast).toBeGreaterThan(sperre);
  });

  it("sperren følger klippModus, ikke clipper.enabled (etasjeklipp i tegning-3d beholder objektvalg)", () => {
    expect(kilde).toContain("klippModusRef.current = klippModus;");
    const start = kilde.indexOf("async function handleKlikk(event: MouseEvent) {");
    const slutt = kilde.indexOf("rendererDom.addEventListener(\"click\", handleKlikk);");
    expect(kilde.slice(start, slutt)).not.toContain("clipper.enabled");
  });
});
