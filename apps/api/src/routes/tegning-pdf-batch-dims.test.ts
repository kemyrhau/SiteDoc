import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PDF-batchkonvertering setter bildedimensjoner (2026-09-10).
 *
 * To veier konverterer PDF→PNG: inline ved opplasting (tegning.ts:270-274) satte
 * dims, mens batchen `rekonverterPdf` (:636-643) kun satte png+done. Samme klasse
 * som DWG-funnet: to veier til samme resultat, én manglet noe den andre hadde.
 * Konverterte-via-batch-tegninger fikk derfor null-dims og måtte etterfylles med
 * backfill-knappen. Fiksen: batchen leser dims med `hentBildeDimensjoner`, som
 * inline-veien.
 *
 * Kontrakten denne låser:
 *   - batchen skriver imageWidth/imageHeight fra den konverterte PNG-en
 *   - en avlesning som gir null ruller IKKE tilbake en vellykket konvertering
 *     (status forblir "done", dims blir null — gyldig tilstand backfill dekker)
 *
 * Fire-and-forget-IIFE-en flushes via vi.waitFor til done-oppdateringen lander.
 */

const h = vi.hoisted(() => ({
  metadata: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

// pdftoppm "lykkes" uten å kjøre — promisify(execFile) legger til callback sist.
vi.mock("node:child_process", () => ({
  execFile: (
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: (err: unknown, res: { stdout: string; stderr: string }) => void,
  ) => cb(null, { stdout: "", stderr: "" }),
}));

// sharp mockes så hentBildeDimensjoner leser fra h.metadata (satt per test).
vi.mock("sharp", () => ({
  default: () => ({ metadata: h.metadata }),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

interface Oppdatering {
  where: { id: string };
  data: Record<string, unknown>;
}

function lagCtx() {
  const oppdateringer: Oppdatering[] = [];

  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }),
    },
    drawing: {
      findMany: vi.fn().mockResolvedValue([
        { id: "tegning-1", fileUrl: "/uploads/plan.pdf", name: "Plantegning" },
      ]),
      update: vi.fn(async (arg: Oppdatering) => {
        oppdateringer.push(arg);
        return { id: arg.where.id, ...arg.data };
      }),
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

  return { ctx, oppdateringer };
}

/** Den asynkrone done-oppdateringen (ikke den synkrone "converting"-en). */
function finnDoneOppdatering(oppdateringer: Oppdatering[]) {
  return oppdateringer.find((o) => o.data.conversionStatus === "done");
}

describe("tegning.rekonverterPdf — batchen setter dimensjoner", () => {
  beforeEach(() => {
    h.metadata.mockReset();
  });

  it("skriver imageWidth/imageHeight fra konvertert PNG", async () => {
    h.metadata.mockResolvedValue({ width: 1654, height: 2339 });
    const { ctx, oppdateringer } = lagCtx();
    const caller = tegningRouter.createCaller(ctx);

    const res = await caller.rekonverterPdf({ projectId: PROSJEKT });
    expect(res.startet).toBe(1);

    await vi.waitFor(() => {
      expect(finnDoneOppdatering(oppdateringer)).toBeDefined();
    });

    const done = finnDoneOppdatering(oppdateringer)!;
    expect(done.data.fileType).toBe("png");
    expect(done.data.imageWidth).toBe(1654);
    expect(done.data.imageHeight).toBe(2339);
  });

  it("avlesning som feiler gir null-dims men ruller ikke tilbake konverteringen", async () => {
    // hentBildeDimensjoner svelger feil → null.
    h.metadata.mockRejectedValue(new Error("ugyldig bilde"));
    const { ctx, oppdateringer } = lagCtx();
    const caller = tegningRouter.createCaller(ctx);

    await caller.rekonverterPdf({ projectId: PROSJEKT });

    await vi.waitFor(() => {
      expect(finnDoneOppdatering(oppdateringer)).toBeDefined();
    });

    const done = finnDoneOppdatering(oppdateringer)!;
    expect(done.data.conversionStatus).toBe("done");
    expect(done.data.imageWidth).toBeNull();
    expect(done.data.imageHeight).toBeNull();
    // Ingen "failed"-oppdatering — konverteringen lyktes.
    expect(oppdateringer.some((o) => o.data.conversionStatus === "failed")).toBe(false);
  });
});
