import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@sitedoc/db";

/**
 * V20-S2 (TILLEGG 1 til V20-W) — backfill av matpause-bæreren der HODET ER 0.
 *
 * Kenneths test på test.sitedoc.no etter V20-S: mandag 05.10 har raden 07:00–16:00,
 * 8,50 t, avkrysning tom, rad.pause_min = 0, hodet «Pause 0 min». Timetallet beviser
 * at 30 min er trukket, men S-migreringen tok bare kandidater med hode > 0.
 *
 * Mønster fra LAG 2 (timer-lag2-backfill.integration.test.ts): testen KJØRER selve
 * migreringens DO-blokk (lest fra migration.sql på disk, kun schema/tabellnavn byttet
 * til throwaway-tabeller — ingen avskrift). Rød → grønn demonstreres i samme test:
 * FØR blokken er rad.pause_min = 0 og hode = 0 (feilen), ETTER er bæreren 30 og
 * hode = Σ rad. Endres bevis-regelen i migreringen divergerer resultatet og testen
 * feiler.
 */

const DS = "daily_sheets_v20s2test";
const ST = "sheet_timer_v20s2test";
const LA = "lonnsarter_v20s2test";
const OS = "organization_settings_v20s2test";

const ORG = "org-s2"; // standard_start_tid 07:00, pause_etter 4t, pause_min 30 → vindu 11:00–11:30

const __dirname = dirname(fileURLToPath(import.meta.url));
const migPath = join(
  __dirname,
  "../../../../packages/db-timer/prisma/migrations/20261007120000_v20_s2_pause_backfill/migration.sql",
);
const migrationSql = readFileSync(migPath, "utf8");

/** Hent DO-blokken fra migreringen og bytt skjema.tabell til throwaway-tabeller. */
function backfillSqlFraMigrering(): string {
  const start = migrationSql.indexOf("DO $$");
  const end = migrationSql.indexOf("END $$;", start) + "END $$;".length;
  if (start < 0 || end < start) throw new Error("Fant ikke DO-blokken i migration.sql");
  return migrationSql
    .slice(start, end)
    .replaceAll("timer.daily_sheets", DS)
    .replaceAll("timer.sheet_timer", ST)
    .replaceAll("timer.lonnsarter", LA)
    .replaceAll("public.organization_settings", OS);
}

async function kjorBackfill() {
  await prisma.$executeRawUnsafe(backfillSqlFraMigrering());
}

async function radPause(id: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ pause_min: number }[]>(
    `SELECT pause_min FROM ${ST} WHERE id = $1`,
    id,
  );
  return Number(r[0]!.pause_min);
}
async function radTimer(id: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ timer: string }[]>(
    `SELECT timer FROM ${ST} WHERE id = $1`,
    id,
  );
  return Number(r[0]!.timer);
}
async function hodePause(id: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ pause_min: number }[]>(
    `SELECT pause_min FROM ${DS} WHERE id = $1`,
    id,
  );
  return Number(r[0]!.pause_min);
}

describe("V20-S2 backfill (ekte Postgres, bundet til migration.sql)", () => {
  beforeEach(async () => {
    for (const t of [ST, DS, LA, OS]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
    }
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${OS} (organization_id text PRIMARY KEY, standard_start_tid text,
         standard_pause_etter_timer double precision, standard_pause_min int)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${LA} (id text PRIMARY KEY, sats_enhet text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${DS} (id text PRIMARY KEY, organization_id text NOT NULL,
         pause_min int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${ST} (id text PRIMARY KEY, sheet_id text NOT NULL, lonnsart_id text NOT NULL,
         fra_tid text, til_tid text, timer numeric(6,2) NOT NULL,
         pause_min int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`,
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO ${OS} (organization_id, standard_start_tid, standard_pause_etter_timer, standard_pause_min)
         VALUES ($1, '07:00', 4.0, 30)`,
      ORG,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${LA} (id, sats_enhet) VALUES ('ord', 'per_time'), ('km', 'per_km')`,
    );

    // S1 = Kenneths 05.10-sedel: hode 0, rad 07–16, timer 8,50, pause 0 (skjult fradrag).
    await prisma.$executeRawUnsafe(`INSERT INTO ${DS} (id, organization_id, pause_min) VALUES ('S1', $1, 0)`, ORG);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, sheet_id, lonnsart_id, fra_tid, til_tid, timer, pause_min)
         VALUES ('r1', 'S1', 'ord', '07:00', '16:00', 8.50, 0)`,
    );

    // S2 = rad 07–16 med 9,00 t → fullt spenn, ingen skjult pause → skal IKKE røres.
    await prisma.$executeRawUnsafe(`INSERT INTO ${DS} (id, organization_id, pause_min) VALUES ('S2', $1, 0)`, ORG);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, sheet_id, lonnsart_id, fra_tid, til_tid, timer, pause_min)
         VALUES ('r2', 'S2', 'ord', '07:00', '16:00', 9.00, 0)`,
    );

    // S3 = km-rad med tider og timer som «matcher» → sats_enhet-filteret skal utelukke den.
    await prisma.$executeRawUnsafe(`INSERT INTO ${DS} (id, organization_id, pause_min) VALUES ('S3', $1, 0)`, ORG);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, sheet_id, lonnsart_id, fra_tid, til_tid, timer, pause_min)
         VALUES ('r3', 'S3', 'km', '07:00', '16:00', 8.50, 0)`,
    );
  });

  afterAll(async () => {
    for (const t of [ST, DS, LA, OS]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
    }
  });

  it("FØR (rød): det skjulte fradraget — rad.pause_min=0 og hode=0 mens timer=8,50", async () => {
    expect(await radPause("r1")).toBe(0);
    expect(await hodePause("S1")).toBe(0);
    expect(await radTimer("r1")).toBeCloseTo(8.5, 2);
  });

  it("ETTER (grønn): Kenneths sak — bærer 30, hode 30, timer 8,50 urørt", async () => {
    await kjorBackfill();
    expect(await radPause("r1")).toBe(30);
    expect(await hodePause("S1")).toBe(30);
    expect(await radTimer("r1")).toBeCloseTo(8.5, 2); // timer ALDRI endret
  });

  it("rad 07–16 med 9,00 t røres ikke (ingen skjult pause, uavklart)", async () => {
    await kjorBackfill();
    expect(await radPause("r2")).toBe(0);
    expect(await hodePause("S2")).toBe(0);
    expect(await radTimer("r2")).toBeCloseTo(9.0, 2);
  });

  it("km-rad utelukkes av sats_enhet-filteret (ikke bærer)", async () => {
    await kjorBackfill();
    expect(await radPause("r3")).toBe(0);
    expect(await hodePause("S3")).toBe(0);
  });

  it("idempotent: kjøres to ganger, samme resultat", async () => {
    await kjorBackfill();
    const etter1 = {
      r1: await radPause("r1"),
      s1: await hodePause("S1"),
      t1: await radTimer("r1"),
    };
    await kjorBackfill();
    expect(await radPause("r1")).toBe(etter1.r1);
    expect(await hodePause("S1")).toBe(etter1.s1);
    expect(await radTimer("r1")).toBeCloseTo(etter1.t1, 2);
    // uavklarte står fortsatt urørt etter andre kjøring
    expect(await radPause("r2")).toBe(0);
    expect(await hodePause("S2")).toBe(0);
  });
});
