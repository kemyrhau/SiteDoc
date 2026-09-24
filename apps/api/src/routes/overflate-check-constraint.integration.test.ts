import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * Behavioural bevis for garantiene i 20260924120000_overflate_tabell:
 *   1. CHECK: en punktsky-overflate UTEN målavstand/bakkemetode AVVISES av DB-en («stille
 *      tomhet»-krav (c) — kan ALDRI oppfylles av en mocket test).
 *   2. PARTIAL UNIQUE (point_cloud_id, malavstand_m) WHERE point_cloud_id IS NOT NULL:
 *      samme sky + samme målavstand avvises, MEN to landxml-rader (NULL) kolliderer ikke.
 *
 * 🔴 Rød først: mot en throwaway-tabell UTEN constraint går de ugyldige radene inn (bevist i
 * kontroll-testen nederst). MED constraint avvises de. Speiler migreringens SQL i en
 * throwaway-tabell (samme mønster som omrade-check-constraint) — ingen app-migrering nødvendig.
 * Localhost/CI-sandkasse.
 */
const T = "overflate_constraint_testtabell";

describe("Overflate DB-garantier (CHECK + partial unique)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${T} (
         id text PRIMARY KEY,
         kilde text NOT NULL,
         point_cloud_id text,
         malavstand_m double precision,
         bakke_metode text,
         CONSTRAINT ${T}_punktsky_felt_check
           CHECK (kilde <> 'punktsky' OR (malavstand_m IS NOT NULL AND bakke_metode IS NOT NULL))
       )`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX ${T}_pc_mal_key ON ${T} (point_cloud_id, malavstand_m) WHERE point_cloud_id IS NOT NULL`,
    );
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("CHECK AVVISER punktsky UTEN malavstand/bakkemetode", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('a', 'punktsky', 'pc-1', NULL, NULL)`),
    ).rejects.toThrow();
  });

  it("CHECK TILLATER punktsky MED begge felt", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('b', 'punktsky', 'pc-2', 0.15, 'minZ')`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='b'`);
    expect(Number(r[0]!.n)).toBe(1);
  });

  it("CHECK TILLATER landxml UTEN målavstand/bakkemetode (feltene er punktsky-spesifikke)", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('c', 'landxml', NULL, NULL, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='c'`);
    expect(Number(r[0]!.n)).toBe(1);
  });

  it("PARTIAL UNIQUE AVVISER samme (point_cloud_id, malavstand_m)", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('d', 'punktsky', 'pc-9', 0.15, 'klasse2')`);
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('e', 'punktsky', 'pc-9', 0.15, 'minZ')`),
    ).rejects.toThrow();
    // Samme sky, ANNEN målavstand går fint
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('f', 'punktsky', 'pc-9', 0.20, 'klasse2')`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE point_cloud_id='pc-9'`);
    expect(Number(r[0]!.n)).toBe(2);
  });

  it("PARTIAL UNIQUE lar to landxml-rader (point_cloud_id NULL) sameksistere", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('g', 'landxml', NULL, NULL, NULL)`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('h', 'landxml', NULL, NULL, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${T} WHERE point_cloud_id IS NULL`,
    );
    // c + g + h = 3 landxml-rader med NULL — ingen kollisjon
    expect(Number(r[0]!.n)).toBeGreaterThanOrEqual(3);
  });

  it("RØD-FØRST-KONTROLL: en tabell UTEN constraint slipper den ugyldige raden inn", async () => {
    const U = `${T}_uten`;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${U} (id text PRIMARY KEY, kilde text, point_cloud_id text, malavstand_m double precision, bakke_metode text)`,
    );
    await prisma.$executeRawUnsafe(`INSERT INTO ${U} VALUES ('x', 'punktsky', 'pc-1', NULL, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${U} WHERE kilde='punktsky' AND malavstand_m IS NULL`,
    );
    expect(Number(r[0]!.n)).toBe(1);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
  });
});
