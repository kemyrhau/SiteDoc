import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regresjonsvakt for migreringen 20260924120000_overflate_tabell (punktsky steg 1).
 *
 * Ny tabell `overflater` — bro mellom punktsky/LandXML og kutt/fyll. Denne testen låser
 * formen: at tabellen er additiv (ingen DROP), at malavstand_m/bakke_metode er NULLABLE
 * (ikke NOT NULL — landxml-rader har dem ikke), og at «stille tomhet»-garantiene står:
 * partial unique + CHECK som tvinger feltene for kilde="punktsky". Feiler HØYT hvis noen
 * senere fjerner en garanti eller gjør kolonnene NOT NULL. Tester teksten, ikke en DB.
 */
const sql = readFileSync(
  join(__dirname, "migrations", "20260924120000_overflate_tabell", "migration.sql"),
  "utf8",
);
const kjørbar = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migrering 20260924120000_overflate_tabell", () => {
  it("oppretter tabellen overflater med prosjektisolering", () => {
    expect(kjørbar).toMatch(/CREATE TABLE "overflater"/);
    expect(kjørbar).toMatch(/"project_id" TEXT NOT NULL/);
  });

  it("FK: project CASCADE, byggeplass + point_cloud SET NULL", () => {
    expect(kjørbar).toMatch(/"overflater_project_id_fkey"[^;]*ON DELETE CASCADE/);
    expect(kjørbar).toMatch(/"overflater_byggeplass_id_fkey"[^;]*ON DELETE SET NULL/);
    expect(kjørbar).toMatch(/"overflater_point_cloud_id_fkey"[^;]*ON DELETE SET NULL/);
  });

  it("er ADDITIV: ingen DROP, og malavstand_m/bakke_metode settes ALDRI NOT NULL", () => {
    expect(kjørbar).not.toMatch(/DROP\s/i);
    // Nullable + CHECK er hele poenget — NOT NULL ville tvunget oppdiktede verdier på landxml.
    expect(kjørbar).not.toMatch(/"malavstand_m"\s+DOUBLE PRECISION\s+NOT NULL/i);
    expect(kjørbar).not.toMatch(/"bakke_metode"\s+TEXT\s+NOT NULL/i);
  });

  it("har PARTIAL UNIQUE (point_cloud_id, malavstand_m) WHERE point_cloud_id IS NOT NULL", () => {
    // Partial: landxml-rader (NULL point_cloud_id) unntas, ellers ville de kollidert på (NULL,NULL).
    expect(kjørbar).toMatch(
      /CREATE UNIQUE INDEX "overflater_pointcloud_malavstand_key" ON "overflater"\("point_cloud_id", "malavstand_m"\) WHERE "point_cloud_id" IS NOT NULL;/,
    );
  });

  it("har CHECK: kilde=punktsky krever malavstand_m OG bakke_metode", () => {
    expect(kjørbar).toMatch(/ADD CONSTRAINT "overflater_punktsky_felt_check"/);
    expect(kjørbar).toMatch(
      /CHECK\s*\(\s*"kilde"\s*<>\s*'punktsky'\s*OR\s*\(\s*"malavstand_m"\s+IS NOT NULL\s+AND\s+"bakke_metode"\s+IS NOT NULL\s*\)\s*\)/,
    );
  });
});
