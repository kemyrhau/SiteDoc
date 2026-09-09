import { describe, it, expect, vi } from "vitest";

/**
 * Brukerminne på server (Kenneth-gate 2026-09-09). Låser kontrakten:
 *   - global (projectId=null) og prosjektnær (projectId satt) er ADSKILTE rader
 *   - sist-skrevne vinner (updateMany-så-create → én rad, oppdatert verdi)
 *   - en bruker ser ALDRI en annens innstillinger (userId-scoping)
 *   - ukjent nøkkel / førstegangsbruk → tomt
 *   - verifiserProsjektmedlem kalles KUN når projectId er satt
 *
 * Drives via router.createCaller med mocket ctx (samme mønster som
 * bilde-idempotens.test.ts). Den falske prisma-en modellerer de to partielle unike
 * indeksene: unik på (userId, projectId, nokkel) der NULL-projectId er sitt eget rom.
 */

const verifiserProsjektmedlem = vi.fn().mockResolvedValue(undefined);
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: (...args: unknown[]) => verifiserProsjektmedlem(...args),
}));

import { brukerinnstillingRouter } from "./brukerinnstilling";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

interface Rad {
  id: string;
  userId: string;
  projectId: string | null;
  nokkel: string;
  verdi: unknown;
  oppdatert: number;
}

/** In-memory `bruker_innstilling` som speiler de to partielle unike indeksene. */
function lagStore() {
  const lager: Rad[] = [];
  let idTeller = 0;
  let klokke = 0;

  const match = (r: Rad, w: { userId: string; projectId: string | null; nokkel?: string }) =>
    r.userId === w.userId &&
    r.projectId === (w.projectId ?? null) &&
    (w.nokkel === undefined || r.nokkel === w.nokkel);

  return {
    lager,
    brukerInnstilling: {
      findMany: vi.fn(async ({ where, select: _select }: { where: { userId: string; projectId?: string }; select?: unknown }) =>
        lager
          .filter((r) =>
            r.userId === where.userId &&
            (where.projectId === undefined || r.projectId === where.projectId),
          )
          .map((r) => ({ nokkel: r.nokkel, verdi: r.verdi, projectId: r.projectId, oppdatert: r.oppdatert })),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; projectId: string | null; nokkel: string }; data: { verdi: unknown } }) => {
        const traff = lager.filter((r) => match(r, where));
        traff.forEach((r) => {
          r.verdi = data.verdi;
          r.oppdatert = klokke++;
        });
        return { count: traff.length };
      }),
      create: vi.fn(async ({ data }: { data: { userId: string; projectId: string | null; nokkel: string; verdi: unknown } }) => {
        // Håndhev de partielle unike indeksene: dupliserer (userId, projectId, nokkel) → P2002.
        const finnes = lager.some((r) => match(r, { userId: data.userId, projectId: data.projectId ?? null, nokkel: data.nokkel }));
        if (finnes) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const rad: Rad = {
          id: `bi-${idTeller++}`,
          userId: data.userId,
          projectId: data.projectId ?? null,
          nokkel: data.nokkel,
          verdi: data.verdi,
          oppdatert: klokke++,
        };
        lager.push(rad);
        return rad;
      }),
    },
  };
}

function lagCtx(userId: string) {
  const store = lagStore();
  const ctx = {
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: { brukerInnstilling: store.brukerInnstilling },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, store };
}

describe("brukerinnstilling", () => {
  it("førstegangsbruk → tomt", async () => {
    const { ctx } = lagCtx("user-1");
    const caller = brukerinnstillingRouter.createCaller(ctx);
    expect(await caller.hent()).toEqual([]);
  });

  it("global og prosjektnær er adskilte rader under samme nøkkel", async () => {
    const { ctx, store } = lagCtx("user-1");
    const caller = brukerinnstillingRouter.createCaller(ctx);

    await caller.sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("global-verdi") });
    await caller.sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("prosjekt-verdi"), projectId: PROSJEKT });

    expect(store.lager).toHaveLength(2);
    const global = store.lager.find((r) => r.projectId === null);
    const prosjekt = store.lager.find((r) => r.projectId === PROSJEKT);
    expect(global?.verdi).toBe("global-verdi");
    expect(prosjekt?.verdi).toBe("prosjekt-verdi");
  });

  it("sist-skrevne vinner — samme nøkkel to ganger gir ÉN rad", async () => {
    const { ctx, store } = lagCtx("user-1");
    const caller = brukerinnstillingRouter.createCaller(ctx);

    await caller.sett({ nokkel: "sistTegning", verdi: JSON.stringify({ a: 1 }) });
    await caller.sett({ nokkel: "sistTegning", verdi: JSON.stringify({ a: 2 }) });

    expect(store.lager).toHaveLength(1);
    expect(store.lager[0]!.verdi).toEqual({ a: 2 });
    // Andre skriv traff eksisterende rad → ingen ny create.
    expect(store.brukerInnstilling.create).toHaveBeenCalledTimes(1);
  });

  it("hent er scopet til innlogget bruker — A ser ikke Bs innstillinger", async () => {
    // B skriver en innstilling.
    const b = lagCtx("user-B");
    // Del lager mellom A og B for å bevise scoping (samme prisma-instans).
    const delt = b.store;
    const ctxA = { ...lagCtx("user-A").ctx, prisma: { brukerInnstilling: delt.brukerInnstilling } };
    await brukerinnstillingRouter.createCaller(b.ctx).sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("hemmelig-B") });

    const aSer = await brukerinnstillingRouter.createCaller(ctxA).hent();
    expect(aSer).toEqual([]); // A ser ingenting av Bs
    const bSer = await brukerinnstillingRouter.createCaller(b.ctx).hent();
    expect(bSer).toHaveLength(1);
  });

  it("ukjent nøkkel returneres ikke — hent gir kun det som er skrevet", async () => {
    const { ctx } = lagCtx("user-1");
    const caller = brukerinnstillingRouter.createCaller(ctx);
    await caller.sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("x") });
    const alle = await caller.hent();
    expect(alle.map((r) => r.nokkel)).toEqual(["sistByggeplass"]);
    expect(alle.find((r) => r.nokkel === "finnesIkke")).toBeUndefined();
  });

  it("verifiserProsjektmedlem kalles KUN når projectId er satt", async () => {
    const { ctx } = lagCtx("user-1");
    const caller = brukerinnstillingRouter.createCaller(ctx);
    verifiserProsjektmedlem.mockClear();

    await caller.sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("global") });
    expect(verifiserProsjektmedlem).not.toHaveBeenCalled();

    await caller.sett({ nokkel: "sistByggeplass", verdi: JSON.stringify("prosjekt"), projectId: PROSJEKT });
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith("user-1", PROSJEKT);

    await caller.hent({ projectId: PROSJEKT_B });
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith("user-1", PROSJEKT_B);
  });
});
