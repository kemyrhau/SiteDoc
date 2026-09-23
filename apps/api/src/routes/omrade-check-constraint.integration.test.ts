import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * Behavioural bevis for CHECK-en i 20260923120000_omrade_lokasjonsniva: DB-en selv AVVISER
 * kombinasjonen lokasjonOmfang="omrade" MED omradeId=null (den navngivbare tvetydigheten
 * «område er valgt, men ingen område»). CHECK-en er backstop for app-vaktene (DoD 12) og for
 * den femte skriveveien som ennå ikke finnes.
 *
 * 🔴 Rød først: kjørt mot en throwaway-tabell UTEN CHECK går den ugyldige raden inn (bevist via
 * psql + speilet i test «uten CHECK»-varianten under). MED CHECK avvises den. Kjører mot en
 * throwaway-tabell som speiler CHECK-en — ingen app-migrering nødvendig. Localhost/CI-sandkasse.
 */
const T = "omrade_check_testtabell";

describe("CHECK: omfang=omrade krever omradeId (DB-garanti)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${T} (
         id text PRIMARY KEY,
         lokasjon_omfang text,
         omrade_id text,
         CONSTRAINT ${T}_omrade_omfang_check
           CHECK (lokasjon_omfang <> 'omrade' OR omrade_id IS NOT NULL)
       )`,
    );
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("AVVISER omfang='omrade' + omrade_id=NULL (tvetydigheten)", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('a', 'omrade', NULL)`),
    ).rejects.toThrow();
  });

  it("TILLATER omfang='omrade' + omrade_id satt", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('b', 'omrade', 'omr-1')`);
    const rader = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${T} WHERE id='b'`,
    );
    expect(Number(rader[0]!.n)).toBe(1);
  });

  it("TILLATER omfang='byggeplass'/'punkt'/NULL uten omrade_id (koblingen er valgfri)", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('c', 'byggeplass', NULL)`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('d', 'punkt', NULL)`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('e', NULL, NULL)`);
    const rader = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${T} WHERE id IN ('c','d','e')`,
    );
    expect(Number(rader[0]!.n)).toBe(3);
  });

  it("RØD-FØRST-KONTROLL: en tabell UTEN CHECK slipper den ugyldige raden inn", async () => {
    const U = `${T}_uten_check`;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${U} (id text PRIMARY KEY, lokasjon_omfang text, omrade_id text)`,
    );
    // Uten CHECK går tvetydigheten rett inn — det er nettopp det CHECK-en (og denne runden) hindrer.
    await prisma.$executeRawUnsafe(`INSERT INTO ${U} VALUES ('x', 'omrade', NULL)`);
    const rader = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${U} WHERE lokasjon_omfang='omrade' AND omrade_id IS NULL`,
    );
    expect(Number(rader[0]!.n)).toBe(1);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
  });
});
