import { describe, it, expect, vi } from "vitest";
import { brukerRouter } from "./bruker";

/**
 * Kolonne-rekkefølge (ORDRE 04.11): serveren bevarer `kolonner` i den rekkefølgen klienten
 * sendte, og `rekkefolge`-flagget overlever lagring. Den falske prisma-en lagrer
 * `tabelloppsett` som JSON (som jsonb-kolonnen), så rekkefølgen må overleve serialisering.
 */

function lagCtx() {
  let tabelloppsett: unknown = null;
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      user: {
        findUnique: vi.fn(async () => ({ tabelloppsett: tabelloppsett === null ? null : JSON.parse(JSON.stringify(tabelloppsett)) })),
        update: vi.fn(async ({ data }: { data: { tabelloppsett: unknown } }) => {
          tabelloppsett = JSON.parse(JSON.stringify(data.tabelloppsett));
          return {};
        }),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return ctx;
}

describe("tabelloppsett: kolonne-rekkefølge", () => {
  it("bevarer rekkefølgen og rekkefolge-flagget gjennom lagring og lesing", async () => {
    const caller = brukerRouter.createCaller(lagCtx());
    const kolonner = ["prefix", "nr", "tittel", "bygning", "ansvarlig", "status"];
    await caller.lagreTabelloppsett({ liste: "sjekklister", oppsett: { kolonner, rekkefolge: true, bredder: {}, sortering: null } });
    const lest = await caller.hentTabelloppsett({ liste: "sjekklister" });
    expect(lest?.kolonner).toEqual(kolonner);
    expect(lest?.rekkefolge).toBe(true);
  });

  it("gammelt oppsett uten flagget leses uten rekkefolge (vises i standardrekkefølge)", async () => {
    const caller = brukerRouter.createCaller(lagCtx());
    await caller.lagreTabelloppsett({ liste: "oppgaver", oppsett: { kolonner: ["status", "nr"], bredder: {}, sortering: null } });
    const lest = await caller.hentTabelloppsett({ liste: "oppgaver" });
    expect(lest?.rekkefolge).toBeUndefined();
  });

  it("listene er adskilte: oppgaver rører ikke sjekklistenes rekkefølge", async () => {
    const caller = brukerRouter.createCaller(lagCtx());
    await caller.lagreTabelloppsett({ liste: "sjekklister", oppsett: { kolonner: ["b", "a"], rekkefolge: true } });
    await caller.lagreTabelloppsett({ liste: "oppgaver", oppsett: { kolonner: ["x"], rekkefolge: true } });
    expect((await caller.hentTabelloppsett({ liste: "sjekklister" }))?.kolonner).toEqual(["b", "a"]);
  });
});
