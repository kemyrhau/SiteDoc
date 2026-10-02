import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * Behavioural bevis for garantien i 20261002120000_byggeplass_geofence_kilde (LAG 1 C3):
 *   CHECK (latitude IS NULL) = (geofence_kilde IS NULL) — punkt og kilde følges ALLTID ad.
 *   En byggeplass med punkt uten kilde (eller kilde uten punkt) AVVISES av DB-en.
 *
 * Dette er «stille tomhet»-krav (c): en test som FEILER når en rad har punkt uten kilde —
 * kan ALDRI oppfylles av en mocket test, derfor mot ekte Postgres.
 *
 * 🔴 Rød først: mot en throwaway-tabell UTEN constraint går den ugyldige raden inn (bevist i
 * kontroll-testen nederst). MED constraint avvises den. Speiler migreringens SQL i en
 * throwaway-tabell (samme mønster som overflate/omrade-check-constraint) — ingen app-migrering
 * nødvendig. Localhost/CI-sandkasse.
 */
const T = "byggeplass_geofence_kilde_testtabell";

describe("Byggeplass geofence-kilde DB-garanti (CHECK)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${T} (
         id text PRIMARY KEY,
         latitude double precision,
         longitude double precision,
         geofence_kilde text,
         CONSTRAINT ${T}_sammenheng
           CHECK ((latitude IS NULL) = (geofence_kilde IS NULL))
       )`,
    );
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("CHECK AVVISER punkt UTEN kilde (latitude satt, geofence_kilde NULL)", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('a', 59.91, 10.75, NULL)`),
    ).rejects.toThrow();
  });

  it("CHECK AVVISER kilde UTEN punkt (geofence_kilde satt, latitude NULL)", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('b', NULL, NULL, 'manuell')`),
    ).rejects.toThrow();
  });

  it("CHECK TILLATER punkt MED kilde", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('c', 59.91, 10.75, 'geokodet')`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='c'`);
    expect(Number(r[0]!.n)).toBe(1);
  });

  it("CHECK TILLATER byggeplass UTEN punkt (begge NULL — byggeplass i terreng, C6)", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('d', NULL, NULL, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='d'`);
    expect(Number(r[0]!.n)).toBe(1);
  });

  it("RØD-FØRST-KONTROLL: en tabell UTEN constraint slipper punkt-uten-kilde inn", async () => {
    const U = `${T}_uten`;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${U} (id text PRIMARY KEY, latitude double precision, geofence_kilde text)`,
    );
    await prisma.$executeRawUnsafe(`INSERT INTO ${U} VALUES ('x', 59.91, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${U} WHERE latitude IS NOT NULL AND geofence_kilde IS NULL`,
    );
    expect(Number(r[0]!.n)).toBe(1);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
  });
});
