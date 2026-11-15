import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresjonsvakt for migreringen 20261115130000_oppmote_overforing (POST (13) del B).
 *
 * Låser formen: additiv (ingen DROP TABLE/COLUMN, ingen DELETE), `kilde` nullable med
 * backfill bak diskriminerende WHERE, slakket fast_check og delindeksen «maks én åpen
 * midlertidig kontorperiode». Tester teksten — den ekte kjøringen (backfill feiler på
 * tom tabell, indeks og CHECK mot Postgres) står i
 * apps/api/src/routes/oppmote-overforing-migrering.integration.test.ts.
 */
const sql = readFileSync(
  join(__dirname, "migrations", "20261115130000_oppmote_overforing", "migration.sql"),
  "utf8",
);
const kjørbar = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migrering 20261115130000_oppmote_overforing", () => {
  it("legger til kilde som nullable TEXT (to-stegs-policy)", () => {
    expect(kjørbar).toMatch(/ALTER TABLE "oppmote_perioder" ADD COLUMN "kilde" TEXT;/);
    expect(kjørbar).not.toMatch(/"kilde"\s+TEXT\s+NOT NULL/i);
    expect(kjørbar).not.toMatch(/ALTER COLUMN "kilde" SET NOT NULL/i);
  });

  it("backfill til 'admin' har diskriminerende WHERE og kommer FØR default", () => {
    const update = kjørbar.match(/UPDATE "oppmote_perioder"[\s\S]*?;/)?.[0] ?? "";
    expect(update).toMatch(/SET "kilde" = 'admin' WHERE "kilde" IS NULL/);
    expect(kjørbar.indexOf("UPDATE")).toBeLessThan(kjørbar.indexOf("SET DEFAULT 'admin'"));
  });

  it("kilde er begrenset til admin | overforing", () => {
    expect(kjørbar).toMatch(/"oppmote_perioder_kilde_check" CHECK \("kilde" IS NULL OR "kilde" IN \('admin', 'overforing'\)\)/);
  });

  it("fast_check tillater åpent midlertidig kontor, fast kun for kontor", () => {
    expect(kjørbar).toMatch(/DROP CONSTRAINT "oppmote_perioder_fast_check";/);
    const ny = kjørbar.match(/ADD CONSTRAINT "oppmote_perioder_fast_check" CHECK \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(ny.replace(/\s+/g, " ").trim()).toBe(`("fast" AND "type" = 'kontor') OR (NOT "fast")`);
  });

  it("maks én åpen midlertidig kontorperiode pr. ansatt (delindeks)", () => {
    expect(kjørbar).toMatch(
      /CREATE UNIQUE INDEX "oppmote_perioder_en_apen_midlertidig_key" ON "oppmote_perioder"\("organization_member_id"\) WHERE NOT "fast" AND "type" = 'kontor' AND "til_dato" IS NULL;/,
    );
  });

  it("er ADDITIV: ingen DROP TABLE/COLUMN, ingen DELETE", () => {
    expect(kjørbar).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(kjørbar).not.toMatch(/DELETE\s+FROM/i);
  });
});
