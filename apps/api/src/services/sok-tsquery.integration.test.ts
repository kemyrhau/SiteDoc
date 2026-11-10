import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@sitedoc/db";
import { tekstTsquery, helordTsquery } from "./sok-tsquery";

// SØK-2 punkt 6 mot ekte Postgres (norwegian-konfig): kjøres bare når DATABASE_URL finnes.
// Rører ingen tabeller — `to_tsvector` på faste strenger, så den er trygg mot enhver lokal DB.

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

async function treff(tekst: string, query: string) {
  const [rad] = await prisma!.$queryRaw<{ tekst: boolean; helord: boolean }[]>(Prisma.sql`
    SELECT to_tsvector('norwegian', ${tekst}) @@ ${tekstTsquery(query)} AS tekst,
           to_tsvector('norwegian', ${tekst}) @@ ${helordTsquery(query)} AS helord
  `);
  return rad!;
}

describe.skipIf(!prisma)("prefiks-tsquery mot ekte Postgres", () => {
  const TEKST = "Adgangskontroll ved porten. Ved forsinkelse påløper dagmulkt.";

  it("ordbegynnelse treffer, men ikke som helt ord", async () => {
    expect(await treff(TEKST, "adgangskontr")).toEqual({ tekst: true, helord: false });
  });

  it("helt ord treffer begge klasser", async () => {
    expect(await treff(TEKST, "adgangskontroll")).toEqual({ tekst: true, helord: true });
    expect(await treff(TEKST, "dagmulkt")).toEqual({ tekst: true, helord: true });
  });

  it("flere ord krever alle (&)", async () => {
    expect((await treff(TEKST, "adgangs porten")).tekst).toBe(true);
    expect((await treff(TEKST, "adgangs kaffe")).tekst).toBe(false);
  });

  it("operatorer i søket gir ikke syntaksfeil", async () => {
    await expect(treff(TEKST, "adgang & !(port | ):* '")).resolves.toBeDefined();
  });

  it("bare stoppord / korte termer feiler ikke", async () => {
    await expect(treff(TEKST, "og i")).resolves.toEqual({ tekst: false, helord: false });
  });
});
