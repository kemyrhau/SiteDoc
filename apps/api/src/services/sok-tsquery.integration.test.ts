import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@sitedoc/db";
import { prefiksTsquery, helordTsquery } from "./sok-tsquery";

// SØK-2 punkt 6 mot ekte Postgres (norwegian-konfig): kjøres bare når DATABASE_URL finnes.
// Rører ingen tabeller — `to_tsvector` på faste strenger, så den er trygg mot enhver lokal DB.

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

/** `prefiks` = false når søket ikke gir noen prefiks-tsquery (ingen term lang nok). */
async function treff(tekst: string, query: string) {
  const p = prefiksTsquery(query) ?? Prisma.sql`''::tsquery`;
  const [rad] = await prisma!.$queryRaw<{ helord: boolean; prefiks: boolean }[]>(Prisma.sql`
    SELECT to_tsvector('norwegian', ${tekst}) @@ ${helordTsquery(query)} AS helord,
           to_tsvector('norwegian', ${tekst}) @@ ${p} AS prefiks
  `);
  return rad!;
}

describe.skipIf(!prisma)("prefiks-tsquery mot ekte Postgres", () => {
  const TEKST = "Adgangskontroll ved porten. Ved forsinkelse påløper dagmulkt.";

  it("ordbegynnelse treffer, men ikke som helt ord", async () => {
    expect(await treff(TEKST, "adgangskontr")).toEqual({ helord: false, prefiks: true });
  });

  it("helt ord treffer i første trinn", async () => {
    expect((await treff(TEKST, "adgangskontroll")).helord).toBe(true);
    expect((await treff(TEKST, "dagmulkt")).helord).toBe(true);
  });

  it("flere ord krever alle (&)", async () => {
    expect((await treff(TEKST, "adgangs porten")).prefiks).toBe(true);
    expect((await treff(TEKST, "adgangs kaffe")).prefiks).toBe(false);
  });

  it("operatorer i søket gir ikke syntaksfeil", async () => {
    await expect(treff(TEKST, "adgang & !(port | ):* '")).resolves.toBeDefined();
  });

  it("bare stoppord / korte termer feiler ikke", async () => {
    await expect(treff(TEKST, "og i")).resolves.toEqual({ helord: false, prefiks: false });
  });
});
