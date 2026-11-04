import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Metadata M-pakke (B-2/B-3/B-4): `hentForProsjekt` beriker hver rad med
 * `statushendelser`, `utfylling` og `signatur`. Låser at transfer-spørringen er
 * avgrenset til lista og de fire statusene, at endringsloggen bare spørres for maler
 * med logg på, og at reduksjonene havner på riktig rad (sjekkliste og oppgave).
 */

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));

vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

import { sjekklisteRouter } from "./sjekkliste";
import { oppgaveRouter } from "./oppgave";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const ola = { id: "u-ola", name: "Ola" };
const kari = { id: "u-kari", name: "Kari" };

function dok(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    terminal: null,
    data: {},
    innholdsVersjon: 1,
    template: { enableChangeLog: true, objects: [] as unknown[] },
    ...over,
  };
}

function lagCtx(dokumenter: unknown[], fk: "checklistId" | "taskId") {
  const transfers = [
    { [fk]: "d1", fromStatus: "draft", toStatus: "sent", createdAt: new Date("2026-11-01T08:00:00Z"), sender: ola },
    { [fk]: "d1", fromStatus: "received", toStatus: "approved", createdAt: new Date("2026-11-02T08:00:00Z"), sender: kari },
    { [fk]: "d2", fromStatus: "draft", toStatus: "sent", createdAt: new Date("2026-11-03T08:00:00Z"), sender: kari },
  ];
  const logg = [
    { [fk]: "d1", userId: "u-ola", _max: { createdAt: new Date("2026-11-01T07:00:00Z") } },
    { [fk]: "d1", userId: "u-kari", _max: { createdAt: new Date("2026-11-01T07:30:00Z") } },
  ];
  const m = {
    dokFindMany: vi.fn().mockResolvedValue(dokumenter),
    transferFindMany: vi.fn().mockResolvedValue(transfers),
    loggGroupBy: vi.fn().mockResolvedValue(logg),
    userFindMany: vi.fn().mockResolvedValue([ola, kari]),
    rundeFindMany: vi.fn().mockResolvedValue([
      { [fk]: "d2", rundeNr: 1, avsluttetAt: new Date(), antallDeltakere: 3, signaturer: [] },
      {
        [fk]: "d2",
        rundeNr: 2,
        avsluttetAt: null,
        antallDeltakere: null,
        signaturer: [
          { signertVersjon: 1, nySignaturKrevdAt: null, bekreftetAvUserId: null },
          { signertVersjon: 1, nySignaturKrevdAt: new Date(), bekreftetAvUserId: null },
        ],
      },
    ]),
    deltakerGroupBy: vi.fn().mockResolvedValue([{ [fk]: "d2", _count: { _all: 2 } }]),
  };
  const ctx = {
    userId: "bruker-1",
    prisma: {
      checklist: { findMany: m.dokFindMany },
      task: { findMany: m.dokFindMany },
      documentTransfer: { findMany: m.transferFindMany },
      checklistChangeLog: { groupBy: m.loggGroupBy },
      taskChangeLog: { groupBy: m.loggGroupBy },
      user: { findMany: m.userFindMany },
      signaturRunde: { findMany: m.rundeFindMany },
      dokumentDeltaker: { groupBy: m.deltakerGroupBy },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, m };
}

const sjaMal = { enableChangeLog: false, objects: [{ id: "l", type: "signature_list", config: {}, parentId: null }] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  ["sjekkliste", "checklistId" as const, (ctx: unknown) => sjekklisteRouter.createCaller(ctx as never).hentForProsjekt({ projectId: PROSJEKT })],
  ["oppgave", "taskId" as const, (ctx: unknown) => oppgaveRouter.createCaller(ctx as never).hentForProsjekt({ projectId: PROSJEKT })],
])("hentForProsjekt — metadata (%s)", (_navn, fk, kall) => {
  it("transfer-spørringen er avgrenset til lista og de fire statusene", async () => {
    const { ctx, m } = lagCtx([dok("d1", { terminal: "godkjent" }), dok("d2", { template: sjaMal })], fk);
    await kall(ctx);
    expect(m.transferFindMany).toHaveBeenCalledTimes(1);
    expect(m.transferFindMany.mock.calls[0]![0].where).toEqual({
      [fk]: { in: ["d1", "d2"] },
      toStatus: { in: ["sent", "received", "approved", "closed"] },
    });
  });

  it("endringsloggen spørres bare for maler med logg på", async () => {
    const { ctx, m } = lagCtx([dok("d1"), dok("d2", { template: sjaMal })], fk);
    await kall(ctx);
    expect(m.loggGroupBy.mock.calls[0]![0].where).toEqual({ [fk]: { in: ["d1"] } });
    expect(m.loggGroupBy.mock.calls[0]![0].by).toEqual([fk, "userId"]);
  });

  it("radene får sendt/godkjent, sist utfylt av og signatur", async () => {
    const { ctx } = lagCtx([dok("d1", { terminal: "godkjent" }), dok("d2", { template: sjaMal })], fk);
    const rader = (await kall(ctx)) as unknown as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const [d1, d2] = rader;
    expect(d1!.statushendelser.sendt).toEqual({ av: { id: "u-ola", navn: "Ola" }, ved: "2026-11-01T08:00:00.000Z" });
    expect(d1!.statushendelser.godkjent?.av.id).toBe("u-kari");
    expect(d1!.utfylling.sist.av).toEqual({ id: "u-kari", navn: "Kari" });
    expect(d1!.utfylling.alle).toHaveLength(2);
    expect(d1!.signatur).toBeNull();
    expect(d2!.statushendelser.sendt?.av.id).toBe("u-kari");
    expect(d2!.statushendelser.godkjent).toBeNull();
    expect(d2!.utfylling).toBeNull();
    // SJA: bare antall signert i siste runde (nr. 2), krevd-ny teller ikke → 1, ingen «av N».
    expect(d2!.signatur).toEqual({ felt: null, sja: 1 });
  });

  it("tom liste gjør ingen ekstra spørringer", async () => {
    const { ctx, m } = lagCtx([], fk);
    await kall(ctx);
    expect(m.transferFindMany).not.toHaveBeenCalled();
    expect(m.loggGroupBy).not.toHaveBeenCalled();
  });
});
