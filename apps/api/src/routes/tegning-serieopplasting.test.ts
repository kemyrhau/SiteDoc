import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T1 serieopplasting (spec `tegning-serieopplasting-spec.md § 4`):
 *  - Test 4 (R3): `opprett` SKRIVER ikke `drawingNumber`/`drawingType` fra forslaget
 *    — det returneres som `metadataForslag` og raden forblir uten verdiene.
 *  - Test 8 (R8): `lastOppRevisjon` starter konvertering for ny fil på samme vei som
 *    `opprett` (setter conversionStatus + originalFileUrl, og lander til slutt en
 *    done-oppdatering med ny PNG) — aldri stående på gammel PNG.
 */

const h = vi.hoisted(() => ({
  metadata: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

// pdftoppm/pdfinfo/pdftotext "lykkes" uten å kjøre — promisify(execFile) legger
// callback sist. Tom stdout → ingen Title/tittelfelt/målestokk (forslag fra filnavn).
vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: (err: unknown, res: { stdout: string; stderr: string }) => void,
  ) => cb(null, { stdout: "", stderr: "" }),
}));

vi.mock("sharp", () => ({
  default: () => ({ metadata: h.metadata }),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TEGNING = "dddddddd-dddd-dddd-dddd-dddddddddddd";

interface Oppdatering {
  where: { id: string };
  data: Record<string, unknown>;
}

function lagCtx(eksisterende?: Record<string, unknown>) {
  const oppdateringer: Oppdatering[] = [];
  const opprettelser: { data: Record<string, unknown> }[] = [];

  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
    drawing: {
      findUnique: vi.fn().mockResolvedValue(eksisterende ?? null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(eksisterende),
      // DWG-2/D6: lastOppRevisjon arkiverer gjeldende layouts (ingen her → tom liste).
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async (arg: { data: Record<string, unknown> }) => {
        opprettelser.push(arg);
        return { id: "ny-tegning", ...arg.data };
      }),
      update: vi.fn(async (arg: Oppdatering) => {
        oppdateringer.push(arg);
        return { id: arg.where.id, ...arg.data };
      }),
    },
    drawingRevision: {
      create: vi.fn().mockResolvedValue({ id: "rev-1" }),
    },
  };

  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { ctx, oppdateringer, opprettelser };
}

describe("tegning.opprett — R3: forslag returneres, skrives ikke (spec-test 4)", () => {
  beforeEach(() => h.metadata.mockReset());

  it("returnerer metadataForslag fra filnavn UTEN å skrive nummer/type på raden", async () => {
    h.metadata.mockResolvedValue({ width: 800, height: 600 });
    const { ctx, opprettelser } = lagCtx();
    const caller = tegningRouter.createCaller(ctx);

    // Bildetype (png) → ingen PDF-konvertering; forslag kun fra filnavn.
    const res = await caller.opprett({
      projectId: PROSJEKT,
      name: "A-20-101 Plan 1 etg",
      fileUrl: "/uploads/a.png",
      fileType: "png",
    });

    // Forslaget er returnert …
    expect(res.metadataForslag.drawingNumber).toBe("A-20-101");
    expect(res.metadataForslag.drawingType).toBe("plan");
    // … men raden ble opprettet UTEN nummer/type (R3: skrives ikke før bruker lagrer).
    expect(opprettelser).toHaveLength(1);
    expect(opprettelser[0]!.data.drawingNumber).toBeUndefined();
    expect(opprettelser[0]!.data.drawingType).toBeUndefined();
  });

  it("to ulike nummer i filnavn → tomt forslag", async () => {
    h.metadata.mockResolvedValue({ width: 800, height: 600 });
    const { ctx } = lagCtx();
    const caller = tegningRouter.createCaller(ctx);
    const res = await caller.opprett({
      projectId: PROSJEKT,
      name: "A-20-101 og ARK-P-102",
      fileUrl: "/uploads/b.png",
      fileType: "png",
    });
    expect(res.metadataForslag.drawingNumber).toBeNull();
  });
});

describe("tegning.lastOppRevisjon — R8: starter konvertering (spec-test 8)", () => {
  beforeEach(() => h.metadata.mockReset());

  it("PDF-revisjon setter conversionStatus=converting + originalFileUrl, og lander done med ny PNG", async () => {
    h.metadata.mockResolvedValue({ width: 1654, height: 2339 });
    const { ctx, oppdateringer } = lagCtx({
      id: TEGNING,
      projectId: PROSJEKT,
      name: "Plantegning",
      byggeplassId: null,
      revision: "A",
      version: 1,
      scale: null,
      fileUrl: "/uploads/gammel.png",
      fileSize: 100,
      status: "utkast",
      issuedAt: null,
    });
    const caller = tegningRouter.createCaller(ctx);

    await caller.lastOppRevisjon({
      drawingId: TEGNING,
      revision: "B",
      fileUrl: "/uploads/ny.pdf",
      fileType: "pdf",
    });

    // Synkron revisjons-oppdatering: går inn i konverteringsveien (ikke stående på gammel PNG).
    const revOppd = oppdateringer.find((o) => o.data.revision === "B")!;
    expect(revOppd).toBeDefined();
    expect(revOppd.data.conversionStatus).toBe("converting");
    expect(revOppd.data.originalFileUrl).toBe("/uploads/ny.pdf");
    expect(revOppd.data.fileType).toBe("pdf");

    // Asynkron konvertering lander en done-oppdatering med NY png-fil.
    await vi.waitFor(() => {
      expect(oppdateringer.some((o) => o.data.conversionStatus === "done")).toBe(true);
    });
    const done = oppdateringer.find((o) => o.data.conversionStatus === "done")!;
    expect(done.data.fileType).toBe("png");
    expect(String(done.data.fileUrl)).toMatch(/\/uploads\/.*\.png$/);
    expect(done.data.fileUrl).not.toBe("/uploads/gammel.png");
  });
});
