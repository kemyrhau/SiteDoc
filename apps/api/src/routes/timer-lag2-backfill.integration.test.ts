import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@sitedoc/db";
import { erReiseLonnsart, REISE_LONNSART_REGEX, type ErReiseKontekst } from "@sitedoc/shared";

/**
 * LAG 2 (ordre L2-A, gate-kriterie 4 + RETUR 1 avvik 1) — backfill + CHECK mot EKTE
 * Postgres (localhost/CI-sandkasse). «Stille-tomhet krav c kan ikke kvitteres med mock».
 *
 * 🔴 RETUR 1 avvik 1: regelen skal finnes ÉN gang, bundet av test. Derfor:
 *   1. Testen KJØRER selve migreringens backfill-blokk (lest fra migration.sql på
 *      disk, kun schema/tabellnavn byttet til throwaway-tabeller — ingen avskrift).
 *   2. For hver fixture-rad regnes forventet er_reise med `erReiseLonnsart` (shared)
 *      på samme inndata, og sammenlignes med det SQL-en faktisk satte. Da feiler
 *      testen hvis SQL-regelen og shared-regelen divergerer.
 *   3. Regex-literalen i migreringen må være lik `REISE_LONNSART_REGEX.source`.
 *
 * Rød først: endres regexen i KUN én av de tre (migration.sql, shared, eller en
 * throwaway-kopi), divergerer SQL-resultatet fra `erReiseLonnsart`-prediksjonen →
 * TS↔SQL-sammenligningen feiler, og `.source`-assertet feiler. Verifisert ved å
 * endre migreringens `~*`-literal i en engangskopi (comm -13 mot origin).
 */

const ST = "sheet_timer_lag2test";
const LA = "lonnsarter_lag2test";
const OS = "organization_settings_lag2test";
const GR = "organization_reise_grenser_lag2test";

const ORG_A = "org-a"; // HAR konfigurert reise_lonnsart_id = reise-A
const ORG_B = "org-b"; // UTEN konfigurert art, men med grensepunkt-art band-B

// Firmaenes reise-oppsett — SAMME inndata til SQL-en (tabellene) og til
// erReiseLonnsart (konteksten under). Én kilde for fixturen.
const settings: Record<string, string | null> = { [ORG_A]: "reise-A", [ORG_B]: null };
const grensepunkter: Record<string, string[]> = { [ORG_A]: [], [ORG_B]: ["band-B"] };
const lonnsarter: { id: string; org: string; navn: string }[] = [
  { id: "reise-A", org: ORG_A, navn: "Reise til prosjekt" },
  { id: "ord-A", org: ORG_A, navn: "Timelønn" },
  { id: "trans-A", org: ORG_A, navn: "Transporttillegg" }, // navne-match MEN org har konfig → false
  { id: "band-B", org: ORG_B, navn: "Avstandsbånd 25km" },
  { id: "trans-B", org: ORG_B, navn: "Transport av masser" },
  { id: "ord-B", org: ORG_B, navn: "Timelønn" },
];
// Én rad per lønnsart (id = rN), så vi kan sjekke er_reise pr. dekningspunkt.
const rader = lonnsarter.map((l, i) => ({ id: `r${i + 1}`, lonnsartId: l.id, org: l.org }));

function ktxFor(org: string): ErReiseKontekst {
  return {
    reiseLonnsartId: settings[org] ?? null,
    grensepunktLonnsartIds: grensepunkter[org] ?? [],
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migPath = join(
  __dirname,
  "../../../../packages/db-timer/prisma/migrations/20261003120000_timer_lag2_sporbarhet/migration.sql",
);
const migrationSql = readFileSync(migPath, "utf8");

/** Hent backfill-DO-blokken (seksjon 3) fra migreringen og bytt navn til throwaway. */
function backfillSqlFraMigrering(): string {
  const start = migrationSql.indexOf("DO $$", migrationSql.indexOf("3. Backfill"));
  const end = migrationSql.indexOf("END $$;", start) + "END $$;".length;
  if (start < 0 || end < start) throw new Error("Fant ikke backfill-blokken i migration.sql");
  return migrationSql
    .slice(start, end)
    .replaceAll('"timer"."sheet_timer"', ST)
    .replaceAll('"timer"."lonnsarter"', LA)
    .replaceAll('"public"."organization_settings"', OS)
    .replaceAll('"public"."organization_reise_grenser"', GR);
}

describe("LAG 2 backfill + CHECK (ekte Postgres, bundet til migration.sql)", () => {
  beforeAll(async () => {
    for (const t of [ST, LA, OS, GR]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
    }
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${LA} (id text PRIMARY KEY, organization_id text NOT NULL, navn text NOT NULL)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${OS} (organization_id text PRIMARY KEY, reise_lonnsart_id text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${GR} (organization_id text NOT NULL, lonnsart_id text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${ST} (
         id text PRIMARY KEY,
         lonnsart_id text NOT NULL,
         er_reise boolean NOT NULL DEFAULT false,
         reise_retning text,
         reise_kjoretid_min integer,
         reise_avstand_m integer
       )`,
    );

    for (const [org, reiseLonnsartId] of Object.entries(settings)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${OS} (organization_id, reise_lonnsart_id) VALUES ($1, $2)`,
        org,
        reiseLonnsartId,
      );
    }
    for (const l of lonnsarter) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${LA} (id, organization_id, navn) VALUES ($1, $2, $3)`,
        l.id,
        l.org,
        l.navn,
      );
    }
    for (const [org, ids] of Object.entries(grensepunkter)) {
      for (const id of ids) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO ${GR} (organization_id, lonnsart_id) VALUES ($1, $2)`,
          org,
          id,
        );
      }
    }
    for (const r of rader) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${ST} (id, lonnsart_id) VALUES ($1, $2)`,
        r.id,
        r.lonnsartId,
      );
    }
  });

  afterAll(async () => {
    for (const t of [ST, LA, OS, GR]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
    }
  });

  it("regex-literalen i migreringen er lik REISE_LONNSART_REGEX.source (ett hjem)", () => {
    expect(migrationSql).toContain(`~* '${REISE_LONNSART_REGEX.source}'`);
  });

  it("migreringens backfill (kjørt fra disk) == erReiseLonnsart for hver fixture-rad", async () => {
    // Kjør DEN faktiske backfill-blokken fra migration.sql (ingen avskrift).
    await prisma.$executeRawUnsafe(backfillSqlFraMigrering());

    const dbRader = await prisma.$queryRawUnsafe<{ id: string; er_reise: boolean }[]>(
      `SELECT id, er_reise FROM ${ST} ORDER BY id`,
    );
    const dbMap = new Map(dbRader.map((r) => [r.id, r.er_reise]));

    // TS↔SQL: shared-regelen på SAMME inndata skal gi SAMME er_reise.
    for (const r of rader) {
      const navn = lonnsarter.find((l) => l.id === r.lonnsartId)!.navn;
      const forventet = erReiseLonnsart(r.lonnsartId, navn, ktxFor(r.org));
      expect(dbMap.get(r.id), `rad ${r.id} (${navn})`).toBe(forventet);
    }

    // Eksplisitt dekning av de fem påkrevde tilfellene:
    expect(dbMap.get("r1")).toBe(true); // konfigurert reise-art
    expect(dbMap.get("r4")).toBe(true); // grensepunkt-art
    expect(dbMap.get("r5")).toBe(true); // navne-match, ingen konfigurert art
    expect(dbMap.get("r3")).toBe(false); // navne-match MEN org har konfigurert art
    expect(dbMap.get("r2")).toBe(false); // ikke-reise-art
  });

  it("CHECK AVVISER er_reise=false med reise-felt; TILLATER true med felt + false uten", async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${ST} ADD CONSTRAINT ${ST}_er_reise_tom CHECK (
         er_reise = true OR (reise_retning IS NULL AND reise_kjoretid_min IS NULL AND reise_avstand_m IS NULL)
       )`,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO ${ST} (id, lonnsart_id, er_reise, reise_retning) VALUES ('bad', 'ord-A', false, 'ut')`,
      ),
    ).rejects.toThrow();
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, lonnsart_id, er_reise, reise_retning, reise_kjoretid_min, reise_avstand_m)
         VALUES ('ok-reise', 'reise-A', true, 'ut', 48, 42000)`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${ST} (id, lonnsart_id, er_reise) VALUES ('ok-arbeid', 'ord-A', false)`,
    );
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${ST} WHERE id IN ('ok-reise','ok-arbeid')`,
    );
    expect(Number(r[0]!.n)).toBe(2);
  });
});
