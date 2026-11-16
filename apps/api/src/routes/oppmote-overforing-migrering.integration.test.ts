import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@sitedoc/db";

/**
 * POST (13) del B — migreringen 20261115130000_oppmote_overforing mot EKTE Postgres.
 *
 * Kjører HELE migration.sql (lest fra disk, kun tabellnavnet byttet til en throwaway-
 * tabell med L1-formen) og krever:
 *   - backfill: hver rad har kilde='admin', OG antallet er > 0 — tom tabell feiler
 *     (stille tomhet er forbudt).
 *   - åpent midlertidig kontor tillates; et andre åpent for samme ansatt avvises
 *     (delindeksen); fast byggeplass avvises fortsatt; ukjent kilde avvises.
 */

const T = "oppmote_perioder_ovftest";
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  join(__dirname, "../../../../packages/db/prisma/migrations/20261115130000_oppmote_overforing/migration.sql"),
  "utf8",
);

/** Migreringen mot throwaway-tabellen (tabell-, constraint- og indeksnavn får suffiks). */
function migreringMotTest(): string[] {
  return migrationSql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .replaceAll("oppmote_perioder", T)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const fixture = [
  { id: "p1", m: "m1", type: "kontor", fast: true, fra: "2026-01-01", til: null },
  { id: "p2", m: "m1", type: "kontor", fast: false, fra: "2026-03-01", til: "2026-03-10" },
  { id: "p3", m: "m2", type: "byggeplass", fast: false, fra: "2026-02-01", til: null },
];

async function lagL1Tabell(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE ${T} (
       id text PRIMARY KEY,
       organization_member_id text NOT NULL,
       type text NOT NULL,
       fast boolean NOT NULL DEFAULT false,
       fra_dato date NOT NULL,
       til_dato date,
       CONSTRAINT ${T}_fast_check CHECK (
         (fast AND type = 'kontor') OR (NOT fast AND (type = 'byggeplass' OR til_dato IS NOT NULL))
       )
     )`,
  );
}

async function kjorMigrering(): Promise<void> {
  for (const s of migreringMotTest()) await prisma.$executeRawUnsafe(s);
}

describe("migrering oppmote_overforing (ekte Postgres, bundet til migration.sql)", () => {
  beforeAll(async () => {
    await lagL1Tabell();
    for (const r of fixture) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato) VALUES ($1, $2, $3, $4, $5::date, $6::date)`,
        r.id,
        r.m,
        r.type,
        r.fast,
        r.fra,
        r.til,
      );
    }
    await kjorMigrering();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("backfill: alle rader får kilde='admin', og tabellen er ikke tom", async () => {
    const [r] = await prisma.$queryRawUnsafe<{ total: bigint; admin: bigint }[]>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE kilde = 'admin') AS admin FROM ${T}`,
    );
    expect(Number(r!.total)).toBeGreaterThan(0);
    expect(Number(r!.admin)).toBe(Number(r!.total));
    expect(Number(r!.total)).toBe(fixture.length);
  });

  it("nye rader uten kilde får default 'admin'", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato) VALUES ('p4', 'm3', 'kontor', false, '2026-04-01', '2026-04-02')`,
    );
    const [r] = await prisma.$queryRawUnsafe<{ kilde: string }[]>(`SELECT kilde FROM ${T} WHERE id = 'p4'`);
    expect(r!.kilde).toBe("admin");
  });

  it("åpent midlertidig kontor tillates; et andre åpent for samme ansatt avvises", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato, kilde) VALUES ('o1', 'm1', 'kontor', false, '2026-05-01', NULL, 'overforing')`,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato, kilde) VALUES ('o2', 'm1', 'kontor', false, '2026-06-01', NULL, 'overforing')`,
      ),
    ).rejects.toThrow();
    // Annen ansatt kan ha sin egen åpne.
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato, kilde) VALUES ('o3', 'm2', 'kontor', false, '2026-05-01', NULL, 'overforing')`,
    );
  });

  it("fast byggeplass og ukjent kilde avvises fortsatt", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato) VALUES ('x1', 'm9', 'byggeplass', true, '2026-01-01')`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO ${T} (id, organization_member_id, type, fast, fra_dato, til_dato, kilde) VALUES ('x2', 'm9', 'kontor', false, '2026-01-01', '2026-01-02', 'gps')`,
      ),
    ).rejects.toThrow();
  });

  it("negativkontroll: på tom tabell feiler backfill-kravet", async () => {
    await lagL1Tabell();
    await kjorMigrering();
    const [r] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(`SELECT count(*) AS total FROM ${T}`);
    // Samme krav som første test (total > 0) ville feilet her.
    expect(Number(r!.total) > 0).toBe(false);
  });
});
