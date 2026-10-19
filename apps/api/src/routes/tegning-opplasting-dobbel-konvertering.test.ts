import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RETUR 7 rekonverter (Kontrollør/orkestrator 2026-10-17): opplastingsveien
 * (`opprett`/`lastOppRevisjon`) satte DWG/DXF-raden til `pending` OG kalte
 * `startTegningKonvertering`, som konverterte INLINE i samme prosess UTEN å sette
 * `converting` først. Arbeideren (`tegningKonverteringPoll`, poll hvert 3 s) ser
 * samme fortsatt-`pending` rad og tar den opp — to samtidige `konverterDwg`-kjøringer
 * av samme fil. Fiksen: opplasting markerer BARE `pending`, akkurat som
 * rekonvertering/«prøv igjen» — eneste vei til `konverterDwg` er arbeideren.
 *
 * Testen simulerer produksjonsrekkefølgen: `opprett` kalles FØRST (synkront, samme
 * prosess som ville kjørt den gamle inline-veien), deretter kjører en poll-runde
 * (arbeideren som allerede går). Før fiksen: 2 kall til `konverterDwg` (inline +
 * arbeider). Etter fiksen: nøyaktig 1, og raden går pending → converting → done.
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

// Statisk import + singleton-reset i beforeEach i stedet for `vi.resetModules()` +
// dynamisk re-import pr. test: re-importen av den store `tegning.ts` tok 5+ s under
// parallell turbo-last og sprengte 5 s-testgrensen (`fix/ustabil-api-test`, 2026-10-19).
import { tegningRouter, tegningKonverteringPoll, tegningRekonverteringKø } from "./tegning";

function lagResultat(overstyr: Record<string, unknown> = {}) {
  return {
    mmPrPiksel: 10, scale: "1:100", scaleKilde: "dwg", imageWidth: 2000, imageHeight: 1500,
    visningUrl: "/uploads/hoved.svg", mobilVisningUrl: null, visningFilType: "svg",
    koordinatSystem: null, geoReferanse: null, feil: null,
    autoRotasjon: null, startutsnitt: null, rapport: null,
    motor: "egen", fallbackFra: null, fallbackAarsak: null,
    dxfViewerFileUrl: null, registerWorldUrl: null,
    layouter: [],
    layouts: [],
    ...overstyr,
  };
}

type Rad = {
  id: string; name: string; projectId: string; byggeplassId: string | null;
  originalFileUrl: string | null; conversionStatus: string | null; updatedAt: Date;
};

type FakeWhere = {
  id?: string;
  conversionStatus?: string | { in?: string[] };
  updatedAt?: Date | { lt?: Date };
  parentDrawingId?: unknown;
};

/** Delt in-memory «DB» for både `opprett` (create) og arbeideren (findMany/updateMany). */
function fakePrisma() {
  const butikk = new Map<string, Rad>();
  let teller = 0;

  const prisma = {
    drawing: {
      create: vi.fn(async (arg: { data: Record<string, unknown> }) => {
        const id = `tegning-${++teller}`;
        const rad: Rad = {
          id,
          name: arg.data.name as string,
          projectId: arg.data.projectId as string,
          byggeplassId: (arg.data.byggeplassId as string | null) ?? null,
          originalFileUrl: (arg.data.originalFileUrl as string | null) ?? null,
          conversionStatus: (arg.data.conversionStatus as string | null) ?? null,
          updatedAt: new Date(),
        };
        butikk.set(id, rad);
        return { ...rad };
      }),
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
          Object.assign(rad, arg.data);
          // bump updatedAt som Prisma sitt @updatedAt ville gjort ved et faktisk skriv
          rad.updatedAt = new Date(rad.updatedAt.getTime() + 1);
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
    task: { findMany: vi.fn().mockResolvedValue([]) },
    checklist: { findMany: vi.fn().mockResolvedValue([]) },
    kontrollplanPunkt: { findMany: vi.fn().mockResolvedValue([]) },
    omrade: { findMany: vi.fn().mockResolvedValue([]) },
  };
  // anvendDwgResultat skriver hoved-oppdateringen i en $transaction (tx.drawing.update +
  // roterMarkorerVedRotasjonsendring, som selv slår opp task/checklist/kontrollplanPunkt/
  // omrade — alle tomme her). Samme `tx`-overflate som tegning-konvertering-arbeider.test.ts.
  const tx = {
    drawing: { update: prisma.drawing.update },
    task: prisma.task,
    checklist: prisma.checklist,
    kontrollplanPunkt: prisma.kontrollplanPunkt,
    omrade: prisma.omrade,
  };
  Object.assign(prisma, {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
  });
  return { prisma, butikk };
}

describe("RETUR 7 — opplasting dobbel-konverteres IKKE av arbeideren", () => {
  beforeEach(() => {
    h.konverterDwg.mockReset();
    tegningRekonverteringKø.nullstill();
  });

  it("opprett (DWG) → arbeideren plukker opp ÉN gang, pending → converting → done", async () => {
    const { prisma, butikk } = fakePrisma();
    h.konverterDwg.mockResolvedValue(lagResultat());

    const ctx = { userId: "user-1", prisma } as never;
    const svar = await tegningRouter.createCaller(ctx).opprett({
      projectId: "11111111-1111-1111-1111-111111111111",
      name: "Plan 01",
      fileUrl: "/uploads/plan01.dwg",
      fileType: "dwg",
    });

    // Opplastingen selv har IKKE startet noen konvertering — kun markert `pending`.
    expect(svar.conversionStatus).toBe("pending");
    expect(h.konverterDwg).not.toHaveBeenCalled();

    // Arbeideren (allerede i gang i produksjon) poller og tar opp SAMME rad.
    const jobber = await tegningKonverteringPoll(prisma as never);
    expect(butikk.get(svar.id)!.conversionStatus).toBe("converting");

    // Deterministisk venting på jobben (ikke `vi.waitFor` på sanntid — ustabilt under last).
    await Promise.all(jobber);
    expect(butikk.get(svar.id)!.conversionStatus).toBe("done");
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });

  it("lastOppRevisjon (DXF) → arbeideren plukker opp ÉN gang, ingen inline-konvertering", async () => {
    const { prisma, butikk } = fakePrisma();
    h.konverterDwg.mockResolvedValue(lagResultat());

    const eksisterende = {
      id: "22222222-2222-2222-2222-222222222222",
      projectId: "11111111-1111-1111-1111-111111111111",
      byggeplassId: null,
      name: "Plan 02",
      revision: "A",
      version: 1,
      fileUrl: "/uploads/gammel.dxf",
      mobilFileUrl: null,
      dxfViewerFileUrl: null,
      registerWorldUrl: null,
      originalFileUrl: "/uploads/gammel.dxf",
      fileSize: null,
      status: "utkast",
      issuedAt: null,
      scale: null,
    };
    butikk.set(eksisterende.id, {
      id: eksisterende.id,
      name: eksisterende.name,
      projectId: eksisterende.projectId,
      byggeplassId: null,
      originalFileUrl: eksisterende.fileUrl,
      conversionStatus: "done",
      updatedAt: new Date(),
    });
    (prisma.drawing as unknown as { findUniqueOrThrow: ReturnType<typeof vi.fn> }).findUniqueOrThrow =
      vi.fn().mockResolvedValue(eksisterende);
    (prisma.drawing as unknown as { drawingRevision: unknown }) ;
    const prismaMedRevisjon = Object.assign(prisma, {
      drawingRevision: { create: vi.fn().mockResolvedValue({}) },
    });

    const ctx = { userId: "user-1", prisma: prismaMedRevisjon } as never;
    const oppdatert = await tegningRouter.createCaller(ctx).lastOppRevisjon({
      drawingId: eksisterende.id,
      revision: "B",
      fileUrl: "/uploads/ny.dxf",
      fileType: "dxf",
    });

    expect(oppdatert.conversionStatus).toBe("pending");
    expect(h.konverterDwg).not.toHaveBeenCalled();

    const jobber = await tegningKonverteringPoll(prismaMedRevisjon as never);
    await Promise.all(jobber);
    expect(butikk.get(eksisterende.id)!.conversionStatus).toBe("done");
    expect(h.konverterDwg).toHaveBeenCalledOnce();
  });
});
