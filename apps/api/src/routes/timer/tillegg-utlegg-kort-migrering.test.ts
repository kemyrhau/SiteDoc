import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * T1 (spec tillegg-utlegg-prosjektkort-spec.md § 9) — migreringen
 * 20261113120000_tillegg_utlegg_byggeplass_eco.
 *
 * Låser formen på teksten, ikke en levende DB:
 *  - to nullable kolonner (`byggeplass_id`, `external_cost_object_id`) på både
 *    `sheet_tillegg` og `sheet_utlegg`, og fire indekser
 *  - ADDITIV: ingen DROP/DELETE/UPDATE/INSERT og aldri NOT NULL — radantallet før
 *    = etter og alle nye kolonner er NULL (B2: ingen backfill)
 *  - schema.prisma har feltene som `String?` med `@@index` på begge modellene.
 * `bruddIMigrering` returnerer bruddene, så negativkontrollen kan vise at vakten biter.
 */
const ROT = join(__dirname, "..", "..", "..", "..", "..", "packages", "db-timer", "prisma");
const MIGRERING = "20261113120000_tillegg_utlegg_byggeplass_eco";
const sql = readFileSync(join(ROT, "migrations", MIGRERING, "migration.sql"), "utf8");
const skjema = readFileSync(join(ROT, "schema.prisma"), "utf8");

const TABELLER = ["sheet_tillegg", "sheet_utlegg"] as const;
const KOLONNER = ["byggeplass_id", "external_cost_object_id"] as const;

function kjorbar(tekst: string): string {
  return tekst
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

export function bruddIMigrering(tekst: string): string[] {
  const k = kjorbar(tekst);
  const brudd: string[] = [];
  for (const tabell of TABELLER) {
    const alter = k.match(new RegExp(`ALTER TABLE "timer"\\."${tabell}"[\\s\\S]*?;`))?.[0] ?? "";
    for (const kol of KOLONNER) {
      if (!new RegExp(`ADD COLUMN "${kol}" TEXT[,;]`).test(alter)) brudd.push(`${tabell}.${kol} mangler`);
      if (!new RegExp(`CREATE INDEX "${tabell}_${kol}_idx" ON "timer"\\."${tabell}"\\("${kol}"\\);`).test(k)) {
        brudd.push(`${tabell}_${kol}_idx mangler`);
      }
    }
  }
  if (/\bDROP\s/i.test(k)) brudd.push("DROP");
  if (/\bDELETE\s+FROM/i.test(k)) brudd.push("DELETE");
  if (/\bUPDATE\s/i.test(k)) brudd.push("UPDATE (backfill)");
  if (/\bINSERT\s/i.test(k)) brudd.push("INSERT");
  if (/NOT NULL/i.test(k)) brudd.push("NOT NULL");
  if (/\bDEFAULT\b/i.test(k)) brudd.push("DEFAULT (ikke NULL)");
  return brudd;
}

function modell(navn: string): string {
  return skjema.match(new RegExp(`model ${navn} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
}

describe("T1 — migrering tillegg/utlegg byggeplass + underprosjekt", () => {
  it("er additiv: to nullable kolonner og fire indekser, ingen backfill", () => {
    expect(bruddIMigrering(sql)).toEqual([]);
  });

  it("negativkontroll: vakten biter på backfill, NOT NULL, DROP og manglende indeks", () => {
    expect(bruddIMigrering(`${sql}\nUPDATE "timer"."sheet_tillegg" SET "byggeplass_id" = 'x';`)).toContain(
      "UPDATE (backfill)",
    );
    expect(bruddIMigrering(sql.replace(`ADD COLUMN "byggeplass_id" TEXT,`, `ADD COLUMN "byggeplass_id" TEXT NOT NULL,`))).toContain(
      "NOT NULL",
    );
    expect(bruddIMigrering(`${sql}\nDROP INDEX "x";`)).toContain("DROP");
    expect(
      bruddIMigrering(sql.replace(/CREATE INDEX "sheet_utlegg_byggeplass_id_idx"[^\n]*\n/, "")),
    ).toContain("sheet_utlegg_byggeplass_id_idx mangler");
  });

  for (const navn of ["SheetTillegg", "SheetUtlegg"]) {
    it(`schema.prisma: ${navn} har feltene nullable med indeks`, () => {
      const m = modell(navn);
      expect(m).toMatch(/byggeplassId\s+String\?\s+@map\("byggeplass_id"\)/);
      expect(m).toMatch(/externalCostObjectId\s+String\?\s+@map\("external_cost_object_id"\)/);
      expect(m).toMatch(/@@index\(\[byggeplassId\]\)/);
      expect(m).toMatch(/@@index\(\[externalCostObjectId\]\)/);
    });
  }
});
