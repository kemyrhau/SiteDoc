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

/**
 * Krav (c) del 1 (statisk): 20260926120000 lukker prosjektnivå-hullet i SAMME migrering som
 * DROP INDEX — atomisk, så det aldri finnes et vindu der begge garantiene mangler (Kenneth-vedtak
 * 2026-09-27: utvid den develop-mergede migreringen, ikke lag en ny på toppen).
 */
describe("psi: prosjektnivå-unikhet lukkes i drop-migreringen", () => {
  const FIX = "20260926120000_psi_drop_stale_unik_indeks";

  it("legger til partiell UNIK indeks psi_prosjektniva_unik WHERE byggeplass_id IS NULL", () => {
    const fix = lesKjørbar(FIX);
    expect(fix).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "psi_prosjektniva_unik" ON "psi"\("project_id"\) WHERE "byggeplass_id" IS NULL;/,
    );
  });

  it("partiell CREATE kommer ETTER DROP INDEX (atomisk lukking, intet åpent vindu)", () => {
    const fix = lesKjørbar(FIX);
    const dropPos = fix.indexOf('DROP INDEX IF EXISTS "psi_project_id_key"');
    const createPos = fix.indexOf("psi_prosjektniva_unik");
    expect(dropPos).toBeGreaterThanOrEqual(0);
    expect(createPos).toBeGreaterThan(dropPos);
  });
});

/**
 * Krav (c) del 2 (kontrakt): den regelen som avviser en ANDRE PSI på prosjektnivå i samme
 * prosjekt. Kenneth 2026-09-27: `@@unique([projectId, byggeplassId])` hindrer IKKE to
 * (project_id, NULL)-rader — Postgres regner NULL-er som ULIKE. Den PARTIELLE indeksen
 * `WHERE byggeplass_id IS NULL` er DEN ENESTE håndheveren: `psi.opprett` (psi.ts:203) har ingen
 * app-guard, og `psiWhere` (psi.ts:8) er definert men ubrukt. Uten en nåbar Postgres i
 * vitest-miljøet (ingen DATABASE_URL/.env i db-pakken) kan vi ikke drive `psi.opprett` end-to-end;
 * vi låser i stedet DDL-kontrakten som ER regelen, og premisset (nullable kolonne) den hviler på.
 * En behavioral integrasjonstest mot `psi.opprett` hører hjemme i api-harnessen når en test-DB er
 * koblet — anbefalt oppfølger.
 */
describe("psi: to PSI på prosjektnivå i samme prosjekt er umulig (NULL-hullet)", () => {
  it("net-migreringen håndhever ≤1 prosjektnivå-PSI via partiell UNIK indeks", () => {
    expect(alleMigreringer).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "psi_prosjektniva_unik" ON "psi"\("project_id"\) WHERE "byggeplass_id" IS NULL;/,
    );
  });

  it("premiss: byggeplassId er nullable i schema — derfor er den partielle indeksen nødvendig", () => {
    const schema = readFileSync(join(__dirname, "schema.prisma"), "utf8");
    expect(schema).toMatch(/byggeplassId\s+String\?\s+@map\("byggeplass_id"\)/);
  });
});
