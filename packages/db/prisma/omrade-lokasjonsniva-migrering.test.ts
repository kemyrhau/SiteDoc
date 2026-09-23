import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresjonsvakt for migreringen 20260923120000_omrade_lokasjonsniva (steg 2b).
 *
 * Migreringen legger til `omrade_id` på checklists og tasks — ADDITIVT og NULLABLE, med FK
 * ON DELETE SET NULL. To-stegs-policyen (CLAUDE.md) krever at steg 1 KUN legger til nullable:
 * ingen NOT NULL, ingen DROP. Denne testen låser den formen — den feiler HØYT hvis noen senere
 * redigerer migreringen til å droppe en kolonne eller sette NOT NULL (som ville brutt policyen
 * og kunne feilet mot eksisterende data). Tester teksten i migreringen, ikke en levende DB.
 */
const sql = readFileSync(
  join(__dirname, "migrations", "20260923120000_omrade_lokasjonsniva", "migration.sql"),
  "utf8",
);
// Kun kjørbar SQL (dropp kommentar-linjer) — så «DROP COLUMN» nevnt i en forklarende kommentar
// ikke gir falsk treff på additiv-sjekken under.
const kjørbar = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migrering 20260923120000_omrade_lokasjonsniva", () => {
  it("legger til omrade_id på BEGGE tabeller (checklists + tasks)", () => {
    expect(sql).toMatch(/ALTER TABLE "checklists" ADD COLUMN "omrade_id" TEXT;/);
    expect(sql).toMatch(/ALTER TABLE "tasks" ADD COLUMN "omrade_id" TEXT;/);
  });

  it("FK er ON DELETE SET NULL på begge (som KontrollplanPunkt) — sletting nullstiller, kaskaderer ikke", () => {
    const fkLinjer = sql.match(/ADD CONSTRAINT "\w+_omrade_id_fkey"[^;]*ON DELETE SET NULL/g) ?? [];
    expect(fkLinjer.length).toBe(2);
  });

  it("indekserer omrade_id på begge tabeller", () => {
    expect(sql).toMatch(/CREATE INDEX "checklists_omrade_id_idx" ON "checklists"\("omrade_id"\);/);
    expect(sql).toMatch(/CREATE INDEX "tasks_omrade_id_idx" ON "tasks"\("omrade_id"\);/);
  });

  it("er ADDITIV: ingen DROP, og omrade_id settes ALDRI NOT NULL (to-stegs-policy, steg 1)", () => {
    expect(kjørbar).not.toMatch(/DROP\s/i);
    expect(kjørbar).not.toMatch(/"omrade_id"\s+TEXT\s+NOT NULL/i);
  });
});
