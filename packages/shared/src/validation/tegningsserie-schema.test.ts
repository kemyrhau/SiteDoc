import { describe, it, expect } from "vitest";
import {
  opprettTegningsserieSchema,
  oppdaterTegningsserieSchema,
  flyttTegningerTilSerieSchema,
} from "./index";

/**
 * DoD test 9 (tegning-serieopplasting-spec § 4): en tegningsserie grupperer, den
 * VERSJONERES ikke. Serien skal derfor ALDRI bære revisjon, målestokk eller status —
 * de hører til den enkelte tegningen (Kenneth 2026-10-06: «tegninger revideres enkeltvis»).
 *
 * Testen går rødt hvis noen legger revision/scale/status på serie-schemaet (feltet dukker
 * opp i `.shape`), og dokumenterer samtidig at serien HAR navn + standardverdiene fag/opphav.
 */
describe("tegningsserie-schema — serien har ikke revisjon/målestokk/status (DoD 9)", () => {
  const forbudte = ["revision", "revisjon", "scale", "scale_kilde", "scaleKilde", "status"];

  it("opprett-schemaet bærer ikke revisjon/målestokk/status", () => {
    const nøkler = Object.keys(opprettTegningsserieSchema.shape);
    for (const f of forbudte) expect(nøkler).not.toContain(f);
    // Positiv kontroll: navn + standardverdiene finnes.
    expect(nøkler).toContain("name");
    expect(nøkler).toContain("discipline");
    expect(nøkler).toContain("originator");
  });

  it("oppdater-schemaet bærer ikke revisjon/målestokk/status", () => {
    const nøkler = Object.keys(oppdaterTegningsserieSchema.shape);
    for (const f of forbudte) expect(nøkler).not.toContain(f);
  });

  it("opprett avviser en revisjon selv om noen skulle sende den (strippes, ikke lagres)", () => {
    const parset = opprettTegningsserieSchema.parse({
      projectId: "11111111-1111-1111-1111-111111111111",
      name: "ARK Multiconsult",
      // @ts-expect-error — revisjon finnes ikke på serie; sendes den, skal den strippes bort
      revision: "B",
    });
    expect("revision" in parset).toBe(false);
  });

  it("flytt-schemaet krever minst én tegning og godtar serieId = null (ta ut av serie)", () => {
    expect(
      flyttTegningerTilSerieSchema.safeParse({ drawingIds: [], serieId: null }).success,
    ).toBe(false);
    expect(
      flyttTegningerTilSerieSchema.safeParse({
        drawingIds: ["11111111-1111-1111-1111-111111111111"],
        serieId: null,
      }).success,
    ).toBe(true);
  });
});
