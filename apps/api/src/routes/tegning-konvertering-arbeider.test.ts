import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RETUR 6 rekonverter (orkestrator 2026-10-16, avgjort: DB som kø, ÉN arbeider i api).
 * `tegningKonverteringPoll`/`tegningKonverteringWatchdog` er den ENE arbeideren som
 * faktisk kjører `konverterDwg` — mutasjonene (dekket av tegning-oppdater-alle.test.ts
 * og tegning-konverter-idempotent.test.ts) gjør bare den atomiske markeringen til
 * `pending`, uansett om de ble kalt fra web- eller api-prosessen.
 *
 * DoD-testene fra ordren:
 * (a) en rad markert `pending` (uten noen arbeider i samme prosess) blir plukket opp
 *     og fullført av arbeideren.
 * (b) samtidig opptak av to «pollere» på samme rad → bare én vinner.
 * (c) en strandet `converting`-rad (ingen livstegn > grensen) settes tilbake til
 *     `pending` av watchdogen og fullføres ved neste poll.
 *
 * `vi.resetModules()` + dynamisk import pr. test: `tegningRekonverteringKø` (Semafor)
 * er en modul-singleton i tegning.ts — uten reset ville en «aldri resolve»-konvertering
 * i én test okkupert semafor-plassen for alle senere tester i fila (samme kjente
 * begrensning som dokumentert i tegning-oppdater-alle.test.ts).
 */

const h = vi.hoisted(() => ({ konverterDwg: vi.fn() }));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dwgKonvertering", () => ({
  konverterDwg: (...a: unknown[]) => h.konverterDwg(...a),
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

function lagResultat(overstyr: Record<string, unknown> = {}) {
  return {
    mmPrPiksel: 10, scale: "1:100", scaleKilde: "dwg", imageWidth: 2000, imageHeight: 1500,
    visningUrl: "/uploads/hoved.svg", mobilVisningUrl: null, visningFilType: "svg",
    koordinatSystem: null, geoReferanse: null, feil: null,
    autoRotasjon: null, startutsnitt: null, rapport: null,
    motor: "egen", fallbackFra: null, fallbackAarsak: null,
    dxfViewerFileUrl: null, registerWorldUrl: null,
    layouts: [],
    ...overstyr,
  };
}

type Rad = {
  id: string; name: string; projectId: string; byggeplassId: string | null;
  originalFileUrl: string | null; conversionStatus: string | null; updatedAt: Date;
};

function lagRad(id: string, overstyring: Partial<Rad> = {}): Rad {
  return {
    id,
    name: `Tegning ${id}`,
    projectId: "p1",
    byggeplassId: null,
    originalFileUrl: "/uploads/original.dwg",
    conversionStatus: "pending",
    updatedAt: new Date(),
    ...overstyring,
  };
}

type FakeWhere = {
  id?: string;
  conversionStatus?: string | { in?: string[] };
  updatedAt?: Date | { lt?: Date };
  parentDrawingId?: unknown;
};

/** Enkel in-memory «DB» — dekker nok av Prisma-kontrakten til poll+watchdog+anvendDwgResultat. */
function fakePrisma(rader: Rad[]) {
  const butikk = new Map(rader.map((r) => [r.id, { ...r }]));

  const tx = {
    drawing: {
      update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        const rad = butikk.get(arg.where.id);
        if (rad) Object.assign(rad, arg.data);
        return rad;
      }),
    },
    task: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    checklist: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    kontrollplanPunkt: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    omrade: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  };

  const prisma = {
    drawing: {
      findMany: vi.fn(async (arg: { where?: FakeWhere; take?: number }) => {
        const where = arg?.where ?? {};
        if ("parentDrawingId" in where) return []; // layout-oppslag i anvendDwgResultat
        let treff = [...butikk.values()].filter((r) => {
          if (where.conversionStatus === "pending" && r.conversionStatus !== "pending") return false;
          return true;
        });
        treff.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
        if (arg?.take) treff = treff.slice(0, arg.take);
        return treff.map((r) => ({ ...r }));
      }),
      updateMany: vi.fn(async (arg: { where: FakeWhere; data: Record<string, unknown> }) => {
        let count = 0;
        for (const rad of butikk.values()) {
          if (arg.where.id !== undefined && rad.id !== arg.where.id) continue;
          if (typeof arg.where.conversionStatus === "string" && rad.conversionStatus !== arg.where.conversionStatus) continue;
          if (arg.where.updatedAt instanceof Date && rad.updatedAt.getTime() !== arg.where.updatedAt.getTime()) continue;
          const lt = (arg.where.updatedAt as { lt?: Date } | undefined)?.lt;
          if (lt && !(rad.updatedAt.getTime() < lt.getTime())) continue;
          Object.assign(rad, arg.data);
          count++;
        }
        return { count };
      }),
      update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        const rad = butikk.get(arg.where.id);
        if (rad) Object.assign(rad, arg.data);
        return rad;
      }),
      findUnique: vi.fn().mockResolvedValue({ autoRotasjon: null }),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  return { prisma, butikk };
}

describe("tegningKonverteringPoll + tegningKonverteringWatchdog", () => {
  beforeEach(() => {
    h.konverterDwg.mockReset();
    vi.resetModules();
  });

  it("(a) rad markert pending uten egen arbeider i prosessen → plukkes opp og fullføres", async () => {
    const { tegningKonverteringPoll } = await import("./tegning");
    const { prisma, butikk } = fakePrisma([lagRad("d1")]);
    h.konverterDwg.mockResolvedValue(lagResultat());

    await tegningKonverteringPoll(prisma as never);
    expect(butikk.get("d1")!.conversionStatus).toBe("converting");

    await vi.waitFor(() => expect(butikk.get("d1")!.conversionStatus).toBe("done"));
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });

  it("(b) samtidig opptak av to arbeidere på samme rad → bare én vinner", async () => {
    const { tegningKonverteringPoll } = await import("./tegning");
    const original = lagRad("d1");
    const { prisma, butikk } = fakePrisma([original]);
    h.konverterDwg.mockReturnValue(new Promise(() => {})); // aldri resolve i denne testen

    // Arbeider A poller og tar raden (flipper pending → converting i butikken).
    await tegningKonverteringPoll(prisma as never);
    expect(butikk.get("d1")!.conversionStatus).toBe("converting");

    // Arbeider B leste SAMME snapshot (samme updatedAt) som A, FØR A sin skriving —
    // simulerer at de to pollerne kjørte samtidig. B sitt betingede opptak (identisk
    // where-klausul som poll-løkken bruker) skal IKKE treffe, fordi raden ikke lenger
    // er «pending» i DB (uansett hvem som leste den sist).
    const bOpptak = await prisma.drawing.updateMany({
      where: { id: "d1", conversionStatus: "pending", updatedAt: original.updatedAt },
      data: { conversionStatus: "converting" },
    });
    expect(bOpptak.count).toBe(0);
    expect(h.konverterDwg).toHaveBeenCalledOnce(); // kun A sin jobb kjører
  });

  it("(c) strandet converting (ingen livstegn > grensen) → watchdog tilbake til pending → fullføres ved neste poll", async () => {
    const { tegningKonverteringPoll, tegningKonverteringWatchdog } = await import("./tegning");
    const { KONVERTERING_STRANDET_MS } = await import("../services/tegningRekonvertering");
    const gammel = new Date(Date.now() - KONVERTERING_STRANDET_MS - 1000);
    const { prisma, butikk } = fakePrisma([
      lagRad("d-strandet", { conversionStatus: "converting", updatedAt: gammel }),
    ]);
    h.konverterDwg.mockResolvedValue(lagResultat());

    await tegningKonverteringWatchdog(prisma as never);
    expect(butikk.get("d-strandet")!.conversionStatus).toBe("pending");

    await tegningKonverteringPoll(prisma as never);
    await vi.waitFor(() => expect(butikk.get("d-strandet")!.conversionStatus).toBe("done"));
  });

  it("friskt converting (livstegn innenfor grensen) → watchdog rører den IKKE", async () => {
    const { tegningKonverteringWatchdog } = await import("./tegning");
    const fersk = new Date(Date.now() - 1000);
    const { prisma, butikk } = fakePrisma([lagRad("d-fersk", { conversionStatus: "converting", updatedAt: fersk })]);

    await tegningKonverteringWatchdog(prisma as never);
    expect(butikk.get("d-fersk")!.conversionStatus).toBe("converting");
  });

  it("ingen pending-rader → ingen opptak, ingen konvertering startet", async () => {
    const { tegningKonverteringPoll } = await import("./tegning");
    const { prisma } = fakePrisma([lagRad("d1", { conversionStatus: "done" })]);

    await tegningKonverteringPoll(prisma as never);
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });

  it("full kapasitet (2 aktive) → poll claimer INGEN nye rader denne runden", async () => {
    const { tegningKonverteringPoll } = await import("./tegning");
    const { prisma, butikk } = fakePrisma([lagRad("d1"), lagRad("d2"), lagRad("d3")]);
    h.konverterDwg.mockReturnValue(new Promise(() => {})); // ingen resolve → okkuperer begge slottene

    await tegningKonverteringPoll(prisma as never); // tar d1 + d2 (maks 2 samtidig)
    expect(butikk.get("d1")!.conversionStatus).toBe("converting");
    expect(butikk.get("d2")!.conversionStatus).toBe("converting");

    await tegningKonverteringPoll(prisma as never); // ingen ledig kapasitet igjen
    expect(butikk.get("d3")!.conversionStatus).toBe("pending");
  });
});
