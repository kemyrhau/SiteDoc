import { describe, it, expect, vi } from "vitest";

/**
 * `bibliotek.hentStandarder` skal sortere BÅDE standarder og kapitler på `sortering`
 * med `kode` som tiebreaker (ordre tre-smaa-rettinger, sak 2). Uten tiebreakeren gir to
 * rader med samme sorteringstall en rekkefølge databasen velger fritt, og den kan endre
 * seg mellom to kall — vi traff det konkret i malrunde C (UP og UU hadde begge 2).
 *
 * Selve sorteringen delegeres til Postgres, så den EGENTLIGE rekkefølge-oppførselen kan
 * bare bevises mot en ekte DB (integrasjonstest, cowork-gatet — ekskludert fra `pnpm test`).
 * Denne enhetstesten låser det vi KAN håndheve i gaten: at spørringen ber DB-en om
 * tiebreakeren på begge nivåer. Fjernes `{ kode: "asc" }` blir den rød (verifisert
 * rød→grønn ved å fjerne tiebreakeren fra bibliotek.ts).
 */

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { bibliotekRouter } from "./bibliotek";

// Formen på findMany-argumentet vi bryr oss om (kun sorterings-nivåene).
type FinnManyArg = {
  orderBy: unknown;
  include: { kapitler: { orderBy: unknown } };
};

async function fangSpørring(): Promise<FinnManyArg> {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { bibliotekStandard: { findMany } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await bibliotekRouter.createCaller({ userId: "user-1", prisma } as any).hentStandarder();

  expect(findMany).toHaveBeenCalledTimes(1);
  const arg = findMany.mock.calls[0]?.[0] as FinnManyArg | undefined;
  if (!arg) throw new Error("hentStandarder kalte ikke bibliotekStandard.findMany");
  return arg;
}

describe("bibliotek.hentStandarder — sortering med kode som tiebreaker", () => {
  it("sorterer standarder på [sortering, kode]", async () => {
    const arg = await fangSpørring();
    expect(arg.orderBy).toEqual([{ sortering: "asc" }, { kode: "asc" }]);
  });

  it("sorterer kapitler på [sortering, kode]", async () => {
    const arg = await fangSpørring();
    expect(arg.include.kapitler.orderBy).toEqual([{ sortering: "asc" }, { kode: "asc" }]);
  });
});
