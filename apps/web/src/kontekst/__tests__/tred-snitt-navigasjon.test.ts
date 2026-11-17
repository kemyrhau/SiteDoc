import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * GATE (79) V1 — klippModus lever i TreDViewerProvider, som prosjekt-layouten deler
 * mellom 3d-visning og tegning-3d. Står Snitt på når brukeren går til tegning-3d,
 * sperrer W2-sperren objektvalg der (ingen Snitt-knapp å slå av). 3d-visning må derfor
 * slå av snittet når siden avmonteres. Kildevakt (scenen krever WebGL).
 */
const side = readFileSync(
  resolve(__dirname, "../../app/dashbord/[prosjektId]/3d-visning/page.tsx"),
  "utf8",
);
const kontekst = readFileSync(resolve(__dirname, "../tred-viewer-kontekst.tsx"), "utf8");

function fane3DModell(): string {
  const start = side.indexOf("function Fane3DModell() {");
  const tidligRetur = side.indexOf("if (lasterTegninger || lasterPunktskyer) {", start);
  expect(start).toBeGreaterThan(-1);
  expect(tidligRetur).toBeGreaterThan(start);
  // Hooken må stå før tidlig retur (hook-reglene)
  return side.slice(start, tidligRetur);
}

describe("V1 — snitt nullstilles når 3d-visning forlates", () => {
  it("premiss: sperren i scenen leser klippModus", () => {
    expect(kontekst).toContain("if (klippModusRef.current) return;");
  });

  it("Fane3DModell har en avmonterings-cleanup som slår av snittet som «Fjern alle»", () => {
    const kropp = fane3DModell();
    const effekt = kropp.indexOf("useEffect(() => {");
    expect(effekt).toBeGreaterThan(-1);
    const cleanup = kropp.slice(effekt);
    expect(cleanup).toContain("return () => {");
    expect(cleanup).toContain("viewerRef.current?.fjernAlleKlippeplan();");
    expect(cleanup).toContain("setKlippModus(false);");
    expect(cleanup).toContain("}, [viewerRef, setKlippModus]);");
  });
});
