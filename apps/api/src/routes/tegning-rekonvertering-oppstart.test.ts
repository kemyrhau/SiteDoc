import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * RETUR 3 rekonverter (orkestrator/Kenneth 2026-10-16, rotårsak MÅLT): Feil 1 fra RETUR 2
 * («jobb 2 av 9 henger, tom logg, ingen prosess») var en API-omstart midt i «Oppdater alle
 * tegninger» (`docker inspect`: `sitedoc-test-api` startet 18:08:09Z, 41 s inn i Kenneths
 * batch trigget 18:07:28Z) — IKKE en hengende konvertering. Omstarten tømte
 * `tegningRekonverteringKø`s in-memory-tilstand og lot 7 av 9 rader stå i `pending` FOR
 * ALLTID, fordi ingenting kjørte igjen for å rette dem opp (reprodusert: samme kode, samme
 * filer, ingen omstart i veien → alle 9 ferdig på 4 min 41 s uten feil).
 *
 * Denne testen simulerer nøyaktig det: en rad som stod i `pending`/`converting` fra en død
 * prosess-generasjon (en ny prosess sin "minnekø" starter alltid tom) skal bli plukket opp og
 * fullført av `gjenopptaStrandedeRekonverteringer` — kalt fra `server.ts` ved HVER oppstart.
 */

const h = vi.hoisted(() => ({ konverterDwg: vi.fn() }));

vi.mock("../services/dwgKonvertering", () => ({
  konverterDwg: (...a: unknown[]) => h.konverterDwg(...a),
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { gjenopptaStrandedeRekonverteringer } from "./tegning";
import type { DwgKonverteringsResultat } from "../services/dwgKonvertering";

function lagResultat(overstyr: Partial<DwgKonverteringsResultat> = {}): DwgKonverteringsResultat {
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

function lagStrandetRad(id: string, originalFileUrl: string | null, conversionStatus = "pending") {
  return {
    id,
    name: `Tegning ${id}`,
    projectId: "p1",
    byggeplassId: null,
    originalFileUrl,
    conversionStatus,
  };
}

/** Samme minimale transaksjons-shape `anvendDwgResultat` krever. */
function fakePrisma(strandede: ReturnType<typeof lagStrandetRad>[]) {
  const oppdateringer: Array<{ id: string; data: Record<string, unknown> }> = [];
  const tx = {
    drawing: {
      update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        oppdateringer.push({ id: arg.where.id, data: arg.data });
        return {};
      }),
    },
    task: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    checklist: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    kontrollplanPunkt: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    omrade: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  };
  const prisma = {
    drawing: {
      findMany: vi.fn(async (arg: { where?: { conversionStatus?: unknown } }) =>
        // `anvendDwgResultat` kaller findMany på nytt for layout-forelder-oppslag
        // (where.parentDrawingId, INGEN conversionStatus-filter) — skill på det feltet.
        arg?.where?.conversionStatus !== undefined ? strandede : [],
      ),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ autoRotasjon: null }),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { prisma, oppdateringer };
}

describe("gjenopptaStrandedeRekonverteringer", () => {
  let logg: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    h.konverterDwg.mockReset();
    logg = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logg.mockRestore();
  });

  it("simulerer omstart: rad strandet i pending fra en død prosess blir done", async () => {
    const { prisma, oppdateringer } = fakePrisma([lagStrandetRad("d-strandet", "/uploads/original.dwg", "pending")]);
    h.konverterDwg.mockResolvedValue(lagResultat());

    const antall = await gjenopptaStrandedeRekonverteringer(prisma);
    expect(antall).toBe(1);

    await vi.waitFor(() => expect(oppdateringer.some((o) => o.id === "d-strandet")).toBe(true));
    const skriving = oppdateringer.find((o) => o.id === "d-strandet")!;
    expect(skriving.data.conversionStatus).toBe("done");
    expect(logg).toHaveBeenCalledWith(expect.stringContaining("gjenopptar strandet rekonvertering d-strandet"));
  });

  it("plukker opp BÅDE pending og converting, men hopper over PDF-original (ikke rekonverterbar)", async () => {
    const { prisma, oppdateringer } = fakePrisma([
      lagStrandetRad("d-pending", "/uploads/a.dwg", "pending"),
      lagStrandetRad("d-converting", "/uploads/b.dxf", "converting"),
      lagStrandetRad("d-pdf", "/uploads/c.pdf", "converting"),
    ]);
    h.konverterDwg.mockResolvedValue(lagResultat());

    const antall = await gjenopptaStrandedeRekonverteringer(prisma);
    expect(antall).toBe(2);

    await vi.waitFor(() => {
      expect(oppdateringer.some((o) => o.id === "d-pending")).toBe(true);
      expect(oppdateringer.some((o) => o.id === "d-converting")).toBe(true);
    });
    expect(h.konverterDwg).toHaveBeenCalledTimes(2);
    expect(oppdateringer.some((o) => o.id === "d-pdf")).toBe(false);
  });

  it("uten strandede rader: ingen konvertering startes", async () => {
    const { prisma } = fakePrisma([]);
    const antall = await gjenopptaStrandedeRekonverteringer(prisma);
    expect(antall).toBe(0);
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });
});
