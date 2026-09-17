import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";
import { naabarhet, registrerPushToken } from "../services/pushVarsel";

/**
 * Pushvarsel runde A (2026-09-17, Kenneth-gatet). Går DIREKTE mot databasen for å bevise de
 * tre leddene i «stille tomhet» som bare en ekte DB kan vise:
 *
 *   (b) UNIK på token — to rader med samme token → P2002. Samme telefon kan aldri gi
 *       dobbelt varsel. FEILER HØYT ved duplikat (tilsiktet).
 *   (c) KRAV 2c — en bruker uten token regnes IKKE som nåbar. Denne testen var RØD først
 *       (bevist mot en bug-variant der naabarhet talte alle valgte userIds — se rapport),
 *       og GRØNN mot riktig implementasjon. Uten den vet vi ikke at tallet er sant: en
 *       formann skal ikke tro at 50 mann fikk beskjed når 12 gjorde det.
 *
 * Dekker også registrerPushTokens upsert-semantikk: delt telefon (samme token, ny bruker
 * overtar) og ny telefon (ny token, samme bruker → to rader).
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 */

const TOK_1 = "ExponentPushToken[11111111111111111111aa]";
const TOK_2 = "ExponentPushToken[22222222222222222222bb]";
const TOK_3 = "ExponentPushToken[33333333333333333333cc]";

const ids = {
  medToken: "",
  utenToken: "",
  delt: "",
  tokenIds: [] as string[],
};

async function opprettBruker(navn: string): Promise<string> {
  const u = await prisma.user.create({
    data: { name: navn, email: `${navn}-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.push` },
  });
  return u.id;
}

beforeAll(async () => {
  ids.medToken = await opprettBruker("push-med-token");
  ids.utenToken = await opprettBruker("push-uten-token");
  ids.delt = await opprettBruker("push-delt-telefon");
});

afterAll(async () => {
  await prisma.pushToken.deleteMany({
    where: { userId: { in: [ids.medToken, ids.utenToken, ids.delt] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.medToken, ids.utenToken, ids.delt] } },
  });
});

describe("push_tokens — unik-garanti (krav 2b)", () => {
  it("nekter to rader med samme token (P2002)", async () => {
    await registrerPushToken(ids.medToken, TOK_1, "ios");

    // Andre rad med SAMME token via rå create (omgår upsert-veien) → indeksen skal bite.
    await expect(
      prisma.pushToken.create({
        data: { userId: ids.delt, token: TOK_1, plattform: "android", sistSett: new Date() },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it("upsert på delt telefon: ny bruker overtar samme token-rad (ingen duplikat)", async () => {
    // Samme token (TOK_1) — nå logger «delt»-brukeren inn på samme enhet.
    await registrerPushToken(ids.delt, TOK_1, "android");
    const rader = await prisma.pushToken.findMany({ where: { token: TOK_1 } });
    expect(rader).toHaveLength(1); // fortsatt én rad
    expect(rader[0]!.userId).toBe(ids.delt); // siste innlogging vant
    expect(rader[0]!.plattform).toBe("android");
  });

  it("ny telefon: samme bruker får en ny token-rad", async () => {
    await registrerPushToken(ids.medToken, TOK_1, "ios"); // tilbake til medToken på enhet 1
    await registrerPushToken(ids.medToken, TOK_2, "ios"); // enhet 2
    const rader = await prisma.pushToken.findMany({ where: { userId: ids.medToken } });
    expect(rader.map((r) => r.token).sort()).toEqual([TOK_1, TOK_2].sort());
  });
});

describe("naabarhet (krav 4 + 2c)", () => {
  it("teller KUN brukere som har et token — tokenløs bruker er ikke nåbar (krav 2c, sett rød først)", async () => {
    const res = await naabarhet([ids.medToken, ids.utenToken]);
    expect(res.valgt).toBe(2);
    expect(res.naabare).toBe(1); // kun medToken
    expect(res.utenToken).toEqual([ids.utenToken]);
  });

  it("teller hver bruker én gang selv med flere enheter", async () => {
    // medToken har TOK_1 + TOK_2; delt får TOK_3.
    await registrerPushToken(ids.delt, TOK_3, "ios");
    const res = await naabarhet([ids.medToken, ids.delt, ids.utenToken]);
    expect(res.valgt).toBe(3);
    expect(res.naabare).toBe(2); // medToken + delt (ikke 4 for de fire radene)
    expect(res.utenToken).toEqual([ids.utenToken]);
  });

  it("tom input gir null nåbare uten DB-treff", async () => {
    expect(await naabarhet([])).toEqual({ valgt: 0, naabare: 0, utenToken: [] });
  });
});
