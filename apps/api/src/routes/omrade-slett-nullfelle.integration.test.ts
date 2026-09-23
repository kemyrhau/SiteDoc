import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";

/**
 * Test A (karakterisering) — dokumenterer at Postgres regner NULL som DISTINKT i
 * `@@unique([kontrollplanId, omradeId, sjekklisteMalId])` (schema.prisma:2483). Når
 * `omrade.slett` uten vakt nullstiller `omradeId` (onDelete: SetNull, :2472), kan to
 * kontrollplanpunkter med samme (kontrollplan, mal) og `omradeId = NULL` sameksistere —
 * unik-indeksen fanger dem IKKE. Det er hele grunnen til at slettevakten (Test B) finnes.
 *
 * 🔴 Denne testen tester POSTGRES' NULL-semantikk, ikke vår kode. Den står GRØNN uansett hva
 * vi bygger — både før og etter vakten. Den er IKKE overflødig: den er den kjørbare
 * begrunnelsen for vakten, MOT DATABASEN (ikke mot skjemaet). Ikke fjern den fordi den
 * «alltid passerer» — det er nettopp poenget (jf. ordre § 4, to tester, ingen skifter fortegn).
 *
 * Kjører mot en throwaway-tabell som speiler den ekte indeksen — ingen app-migrering nødvendig.
 * Localhost/CI-sandkasse (verifisert ikke test/prod), som resten av *.integration.test.ts.
 */
const T = "omrade_nullfelle_testtabell";

describe("Test A — NULL-distinctness i kontrollplan-unikindeksen", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${T} (kontrollplan_id text, omrade_id text, sjekkliste_mal_id text)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX ${T}_uniq ON ${T} (kontrollplan_id, omrade_id, sjekkliste_mal_id)`,
    );
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("kontroll: to punkter med samme (kp, OMRÅDE-SATT, mal) — indeksen FANGER", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('kp1','omr1','mal1')`);
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('kp1','omr1','mal1')`),
    ).rejects.toThrow(); // unik-brudd når omradeId er satt
    await prisma.$executeRawUnsafe(`DELETE FROM ${T}`);
  });

  it("fella: to punkter med omradeId = NULL og samme mal SAMEKSISTERER", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('kp1',NULL,'mal1')`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('kp1',NULL,'mal1')`);
    const rader = await prisma.$queryRawUnsafe<{ antall: bigint }[]>(
      `SELECT count(*) AS antall FROM ${T}`,
    );
    expect(Number(rader[0]!.antall)).toBe(2); // begge slapp gjennom — NULL er distinkt
  });
});
