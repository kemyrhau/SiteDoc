import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresjonsvakt for den foreldreløse UNIQUE-indeksen `psi_project_id_key`.
 *
 * Historikk (målt 2026-09-24 ved skjema-sammenligning test mot prod):
 *   - 20260403090000_psi_modul lager `CREATE UNIQUE INDEX "psi_project_id_key"` — en INDEKS,
 *     ikke en named constraint (ingen rad i pg_constraint).
 *   - 20260403120000_psi_building prøver å fjerne den med
 *     `ALTER TABLE "psi" DROP CONSTRAINT IF EXISTS "psi_project_id_key"`. Det er en STILLE
 *     no-op på et indeks-navn: DROP CONSTRAINT ser bare i pg_constraint, og IF EXISTS gjør at
 *     den ikke engang feiler. Indeksen overlevde i prod. Riktig setning er DROP INDEX.
 *   - Konsekvens i prod: PSI nr. 2 på en ANNEN byggeplass i samme prosjekt avvises (project_id
 *     tvinges unik alene). Den sammensatte garantien (project_id, byggeplass_id) skal være det
 *     eneste unike.
 *
 * Testen leser migreringstekstene (ingen live DB) og feiler HØYT hvis nettoeffekten av
 * migreringshistorikken lar `psi_project_id_key` overleve — dvs. hvis ingen migrering gjør et
 * ekte `DROP INDEX IF EXISTS "psi_project_id_key"`.
 */
const migrationsDir = join(__dirname, "migrations");

function lesKjørbar(mappe: string): string {
  const sql = readFileSync(join(migrationsDir, mappe, "migration.sql"), "utf8");
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

// Alle migreringstekster slått sammen — nettoeffekten av historikken.
const alleMigreringer = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => lesKjørbar(d.name))
  .join("\n");

describe("psi: foreldreløs unik-indeks psi_project_id_key", () => {
  it("psi_modul lager den enkle unike indeksen (opphavet)", () => {
    const modul = lesKjørbar("20260403090000_psi_modul");
    expect(modul).toMatch(/CREATE UNIQUE INDEX "psi_project_id_key" ON "psi"\("project_id"\);/);
  });

  it("psi_building forsøkte DROP CONSTRAINT (no-op på et indeks-navn) — dokumenterer bugen", () => {
    const building = lesKjørbar("20260403120000_psi_building");
    // Bug-linjen: DROP CONSTRAINT treffer ikke en CREATE UNIQUE INDEX.
    expect(building).toMatch(/DROP CONSTRAINT IF EXISTS "psi_project_id_key"/);
    // ...og den gjorde aldri det som skulle til: et ekte DROP INDEX.
    expect(building).not.toMatch(/DROP INDEX IF EXISTS "psi_project_id_key"/);
  });

  it("nettoeffekt: historikken gjør et ekte DROP INDEX IF EXISTS psi_project_id_key", () => {
    // RØD før fix/psi-unik-indeks: kun no-op-DROP-CONSTRAINT finnes, indeksen overlever.
    expect(alleMigreringer).toMatch(/DROP INDEX IF EXISTS "psi_project_id_key";/);
  });

  it("den sammensatte garantien (project_id + byggeplass/building) droppes ALDRI", () => {
    // Indeksen ble opprettet som ..._building_id_key og kolonnen renamet til byggeplass_id
    // (navnegjennomgang) uten å omdøpe indeksen. Uansett navn: den skal aldri droppes.
    expect(alleMigreringer).toMatch(
      /CREATE UNIQUE INDEX "psi_project_id_building_id_key" ON "psi"\("project_id", "building_id"\);/,
    );
    expect(alleMigreringer).not.toMatch(/DROP INDEX IF EXISTS "psi_project_id_building_id_key"/);
    expect(alleMigreringer).not.toMatch(/DROP INDEX IF EXISTS "psi_project_id_byggeplass_id_key"/);
  });
});
