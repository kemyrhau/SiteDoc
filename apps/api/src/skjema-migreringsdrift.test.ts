import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Vakt mot skjema-drift (hendelse 2026-10-13): et `@map("kolonne")`-felt i schema.prisma uten
 * migrering som oppretter kolonnen, fungerer på databaser som har fått kolonnen utenom
 * migreringene (db push), men feiler i prod der bare `migrate deploy` har kjørt.
 * Testen krever at hvert `@map`-kolonnenavn forekommer i minst én migrering i samme pakke.
 */
const ROT = join(__dirname, "..", "..", "..", "packages");
const PAKKER = ["db", "db-timer", "db-maskin", "db-varelager"];

function kolonnerUtenMigrering(pakke: string): string[] {
  const prismaDir = join(ROT, pakke, "prisma");
  const skjema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");
  const kolonner = new Set(
    [...skjema.matchAll(/@map\("([a-z0-9_]+)"\)/g)].map((m) => m[1]).filter((k): k is string => !!k),
  );
  const migDir = join(prismaDir, "migrations");
  const sql = readdirSync(migDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(migDir, d.name, "migration.sql"))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  return [...kolonner].filter((k) => !new RegExp(`\\b${k}\\b`).test(sql));
}

describe("skjema-migreringsdrift", () => {
  for (const pakke of PAKKER) {
    it(`${pakke}: alle @map-kolonner finnes i en migrering`, () => {
      expect(kolonnerUtenMigrering(pakke)).toEqual([]);
    });
  }
});
