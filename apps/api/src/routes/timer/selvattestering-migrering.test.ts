import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * w7 (web-timeforing-plan.md § 8.5, Kenneth 2026-11-18 «Ja, (a)») — migreringen
 * 20261118120000_selvattestering_nei.
 *
 * Låser teksten, ikke en levende DB (den levende standarden testes i
 * `w7-egne-timer.integration.test.ts`):
 *  - ny standard er false (en ny rad får aldri true);
 *  - eksisterende true settes til false (UPDATE med diskriminerende WHERE);
 *  - ingenting slettes eller droppes;
 *  - schema.prisma har `@default(false)` på `tillattSelvAttestering`.
 * `bruddIMigrering` returnerer bruddene, så negativkontrollene kan vise at vakten biter.
 */
const ROT = join(__dirname, "..", "..", "..", "..", "..", "packages", "db", "prisma");
const MIGRERING = "20261118120000_selvattestering_nei";
const sql = readFileSync(join(ROT, "migrations", MIGRERING, "migration.sql"), "utf8");
const skjema = readFileSync(join(ROT, "schema.prisma"), "utf8");

function kjorbar(tekst: string): string {
  return tekst
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

export function bruddIMigrering(tekst: string): string[] {
  const k = kjorbar(tekst);
  const brudd: string[] = [];
  if (!/ALTER TABLE "organization_settings" ALTER COLUMN "tillatt_selv_attestering" SET DEFAULT false;/.test(k)) {
    brudd.push("standard ikke false");
  }
  if (
    !/UPDATE "organization_settings" SET "tillatt_selv_attestering" = false WHERE "tillatt_selv_attestering" = true;/.test(k)
  ) {
    brudd.push("eksisterende rader ikke satt til false");
  }
  if (/\bDROP\s/i.test(k)) brudd.push("DROP");
  if (/\bDELETE\s+FROM/i.test(k)) brudd.push("DELETE");
  if (/\bINSERT\s/i.test(k)) brudd.push("INSERT");
  if (/SET DEFAULT true/i.test(k)) brudd.push("standard true");
  if ((k.match(/\bUPDATE\s/gi) ?? []).length !== 1) brudd.push("annen UPDATE");
  return brudd;
}

function feltISkjema(tekst: string): string {
  return tekst.match(/^\s*tillattSelvAttestering\s+Boolean[^\n]*$/m)?.[0] ?? "";
}

describe("w7 — migrering selvattestering Nei", () => {
  it("ny standard false og eksisterende rader false, ingenting slettes", () => {
    expect(bruddIMigrering(sql)).toEqual([]);
  });

  it("schema.prisma: @default(false) på tillattSelvAttestering", () => {
    expect(feltISkjema(skjema)).toMatch(/@default\(false\) @map\("tillatt_selv_attestering"\)/);
  });

  it("negativkontroll: vakten biter på standard true, manglende UPDATE og DELETE", () => {
    expect(bruddIMigrering(sql.replace("SET DEFAULT false", "SET DEFAULT true"))).toEqual(
      expect.arrayContaining(["standard ikke false", "standard true"]),
    );
    expect(bruddIMigrering(sql.replace(/UPDATE[^;]*;/, ""))).toContain("eksisterende rader ikke satt til false");
    expect(bruddIMigrering(`${sql}\nDELETE FROM "organization_settings";`)).toContain("DELETE");
    expect(feltISkjema(skjema.replace('@default(false) @map("tillatt_selv_attestering")', '@default(true) @map("tillatt_selv_attestering")'))).not.toMatch(
      /@default\(false\)/,
    );
  });
});
