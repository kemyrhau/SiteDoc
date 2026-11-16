import { describe, it, expect, vi } from "vitest";

/**
 * ORDRE 29 #14 — `verifiserByggeplassIProsjekt` på alle skrivende prosedyrer som tar en
 * `byggeplassId`. Før vakten kunne et prosjektmedlem skrive en byggeplass fra et ANNET prosjekt
 * (kjenner man id-en) inn på PSI, innsjekk, kontrakt, vareforbruk, tegning, område, punktsky og
 * overflate. Hver test: byggeplassen hører til et fremmed prosjekt → BAD_REQUEST med vaktens
 * melding, og ingen skriving.
 *
 * Enhetsnivå: `router.createCaller` med mocket ctx (samme mønster som `omrade-slett-vakt.test.ts`).
 * Tilgangssjekkene mockes til å passere — testen gjelder byggeplass-isolasjonen.
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import { psiRouter } from "./psi";
import { mannskapRouter } from "./mannskap";
import { kontraktRouter } from "./kontrakt";
import { vareforbrukRouter } from "./vareforbruk";
import { tegningRouter } from "./tegning";
import { omradeRouter } from "./omrade";
import { punktskyRouter } from "./punktsky";
import { overflateRouter } from "./overflate";

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const FREMMED_BP = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const AVVIST = { code: "BAD_REQUEST", message: "Byggeplassen hører til et annet prosjekt." };

/** Ctx der byggeplassen alltid hører til FREMMED. `skriv` fanger enhver skriving. */
function lagCtx(ekstra: Record<string, unknown> = {}, varelager: Record<string, unknown> = {}) {
  const skriv = vi.fn();
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      byggeplass: { findUnique: vi.fn().mockResolvedValue({ projectId: FREMMED, name: "Fremmed" }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue({ id: "m1" }) },
      psi: { create: skriv, findUnique: vi.fn().mockResolvedValue(null) },
      reportTemplate: { create: skriv },
      psiTilstedevarelse: { create: skriv, findFirst: vi.fn().mockResolvedValue(null) },
      ftdKontrakt: { create: skriv, update: skriv },
      drawing: { create: skriv, update: skriv },
      omrade: { create: skriv, aggregate: vi.fn().mockResolvedValue({ _max: { sortering: 0 } }) },
      pointCloud: { create: skriv },
      overflate: { create: skriv },
      ...ekstra,
    },
    prismaVarelager: { vareforbruk: { create: skriv, update: skriv, findUnique: vi.fn() }, ...varelager },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, skriv };
}

describe("ORDRE 29 #14: skrivende prosedyrer avviser byggeplass fra annet prosjekt", () => {
  it("psi.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      psiRouter.createCaller(ctx).opprett({ projectId: PROSJEKT, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("psi.kopier", async () => {
    const { ctx, skriv } = lagCtx({
      psi: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          projectId: PROSJEKT,
          template: { objects: [] },
          byggeplass: { name: "Kilde" },
        }),
      },
    });
    await expect(
      psiRouter.createCaller(ctx).kopier({ psiId: ID, targetByggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
    expect(ctx.prisma.psi.create).not.toHaveBeenCalled();
  });

  it("mannskap.sjekkInn", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      mannskapRouter.createCaller(ctx).sjekkInn({ projectId: PROSJEKT, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("kontrakt.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      kontraktRouter.createCaller(ctx).opprett({ projectId: PROSJEKT, navn: "K", byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("kontrakt.oppdater", async () => {
    const { ctx, skriv } = lagCtx();
    ctx.prisma.ftdKontrakt.findUniqueOrThrow = vi.fn().mockResolvedValue({ projectId: PROSJEKT });
    await expect(
      kontraktRouter.createCaller(ctx).oppdater({ id: ID, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("vareforbruk.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      vareforbrukRouter.createCaller(ctx).opprett({
        projectId: PROSJEKT,
        dato: "2026-11-06",
        vareId: ID,
        antall: 1,
        byggeplassId: FREMMED_BP,
      }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("vareforbruk.oppdater", async () => {
    const { ctx, skriv } = lagCtx();
    ctx.prismaVarelager.vareforbruk.findUnique = vi
      .fn()
      .mockResolvedValue({ projectId: PROSJEKT, attestertSnapshot: null });
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: ID, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("tegning.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      tegningRouter.createCaller(ctx).opprett({
        projectId: PROSJEKT,
        byggeplassId: FREMMED_BP,
        name: "T",
        fileUrl: "/uploads/x.pdf",
        fileType: "pdf",
      }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("tegning.oppdater", async () => {
    const { ctx, skriv } = lagCtx();
    ctx.prisma.drawing.findUniqueOrThrow = vi.fn().mockResolvedValue({ projectId: PROSJEKT });
    await expect(
      tegningRouter.createCaller(ctx).oppdater({ id: ID, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("tegning.tilknyttByggeplass", async () => {
    const { ctx, skriv } = lagCtx();
    ctx.prisma.drawing.findUniqueOrThrow = vi.fn().mockResolvedValue({ projectId: PROSJEKT });
    await expect(
      tegningRouter.createCaller(ctx).tilknyttByggeplass({ drawingId: ID, byggeplassId: FREMMED_BP }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("omrade.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      omradeRouter.createCaller(ctx).opprett({ projectId: PROSJEKT, byggeplassId: FREMMED_BP, navn: "Sone" }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("punktsky.opprett", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      punktskyRouter.createCaller(ctx).opprett({
        projectId: PROSJEKT,
        byggeplassId: FREMMED_BP,
        name: "P",
        fileUrl: "/uploads/x.las",
        fileType: "las",
      }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });

  it("overflate.opprettFraPunktsky", async () => {
    const { ctx, skriv } = lagCtx();
    ctx.prisma.pointCloud.findUniqueOrThrow = vi.fn();
    await expect(
      overflateRouter.createCaller(ctx).opprettFraPunktsky({
        projectId: PROSJEKT,
        pointCloudId: ID,
        byggeplassId: FREMMED_BP,
        navn: "O",
      }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
    expect(ctx.prisma.pointCloud.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("overflate.lagreLandXML", async () => {
    const { ctx, skriv } = lagCtx();
    await expect(
      overflateRouter.createCaller(ctx).lagreLandXML({
        projectId: PROSJEKT,
        byggeplassId: FREMMED_BP,
        navn: "O",
        fileUrl: "/uploads/x.xml",
      }),
    ).rejects.toMatchObject(AVVIST);
    expect(skriv).not.toHaveBeenCalled();
  });
});
