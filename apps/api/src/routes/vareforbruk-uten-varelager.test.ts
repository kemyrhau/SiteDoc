import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * O11 (§ 8.22, Kenneth 2026-11-22): en jobb flyttet til et prosjekt uten varelager tar varene
 * med (O8 D punkt 3). De varene skal kunne leses, endres og slettes der — men en ny vare kan
 * fortsatt ikke opprettes på prosjektet. Prosjekt- og firmagrensen sjekkes som før: en bruker
 * i et annet firma (ikke medlem av prosjektet) kan verken endre eller slette.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const BRUKER = "22222222-2222-2222-2222-222222222222";
const FREMMED = "99999999-9999-9999-9999-999999999999"; // bruker i et annet firma
const UTEN_VARELAGER = "33333333-3333-3333-3333-333333333333";
const MED_VARELAGER = "44444444-4444-4444-4444-444444444444";
const LINJE = "55555555-5555-5555-5555-555555555555";
const VARE = "66666666-6666-6666-6666-666666666666";

const { projectFindUnique, activityCreate, VarelagerModulIkkeAktivertError } = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  activityCreate: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    project: { findUnique: projectFindUnique, findMany: vi.fn() },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    activity: { create: activityCreate },
    user: { findUnique: vi.fn().mockResolvedValue({ id: "bruker", name: "A", email: "a@x" }) },
    projectMember: { findFirst: vi.fn().mockResolvedValue({ role: "member" }) },
  },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  aktivtMedlemWhere: { periodeSlutt: null },
  verifiserOrganisasjonTilgang: vi.fn(),
  erFirmaAdmin: vi.fn(),
  verifiserProsjekterTilhørerFirma: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  erVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError,
}));

import { vareforbrukRouter } from "./vareforbruk";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { krevVarelagerAktivert } from "../services/varelager/moduleGate";

function lagCtx(userId = BRUKER) {
  const rad = {
    id: LINJE,
    projectId: UTEN_VARELAGER,
    vareId: VARE,
    antall: 4,
    attestertSnapshot: null,
    dagsseddelId: null,
    kortId: null,
    byggeplassId: null,
    externalCostObjectId: null,
    sheetTimerId: null,
    registrertAvUserId: BRUKER,
    vare: { id: VARE, navn: "Pukk", enhet: "tonn" },
  };
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    ...rad,
    id: where.id,
    ...data,
  }));
  const del = vi.fn(async () => rad);
  const create = vi.fn();
  const ctx = {
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: { byggeplass: { findUnique: vi.fn() } },
    prismaVarelager: {
      vareforbruk: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === LINJE ? rad : null)),
        update,
        delete: del,
        create,
      },
      vare: { findUnique: vi.fn().mockResolvedValue({ id: VARE, organizationId: ORG, aktiv: true }) },
    },
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      sheetTimer: { findFirst: vi.fn(), findUnique: vi.fn() },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, update, del, create };
}

beforeEach(() => {
  vi.clearAllMocks();
  activityCreate.mockResolvedValue({});
  projectFindUnique.mockResolvedValue({ primaryOrganizationId: ORG });
  // Modulen er av på UTEN_VARELAGER, på på MED_VARELAGER.
  vi.mocked(krevVarelagerAktivert).mockImplementation(async (_org, prosjekt) => {
    if (prosjekt === UTEN_VARELAGER) throw new VarelagerModulIkkeAktivertError();
  });
  // Prosjektgrensen: bare BRUKER er medlem; en bruker i et annet firma avvises.
  vi.mocked(verifiserProsjektmedlem).mockImplementation(async (userId) => {
    if (userId !== BRUKER) throw new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem" });
  });
});

describe("O11 — vare på prosjekt uten varelager", () => {
  it("hentMedId: varen leses (vinduet kan åpnes)", async () => {
    const { ctx } = lagCtx();
    const res = await vareforbrukRouter.createCaller(ctx).hentMedId({ id: LINJE });
    expect(res).toMatchObject({ id: LINJE, projectId: UTEN_VARELAGER, erLast: false });
  });

  it("oppdater: antallet endres", async () => {
    const { ctx, update } = lagCtx();
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, antall: 6 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0]).toMatchObject({ where: { id: LINJE }, data: { antall: 6 } });
  });

  it("slett: varen slettes", async () => {
    const { ctx, del } = lagCtx();
    await expect(vareforbrukRouter.createCaller(ctx).slett({ id: LINJE })).resolves.toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith({ where: { id: LINJE } });
  });

  it("opprett: ny vare avvises fortsatt (PRECONDITION_FAILED), ingen skriving", async () => {
    const { ctx, create } = lagCtx();
    await expect(
      vareforbrukRouter
        .createCaller(ctx)
        .opprett({ projectId: UTEN_VARELAGER, dato: "2026-11-22", vareId: VARE, antall: 1 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(create).not.toHaveBeenCalled();
  });

  it("oppdater: flytting TIL prosjekt uten varelager avvises fortsatt", async () => {
    const { ctx, update } = lagCtx();
    ctx.prismaVarelager.vareforbruk.findUnique.mockResolvedValueOnce({
      projectId: MED_VARELAGER,
      attestertSnapshot: null,
      dagsseddelId: null,
      kortId: null,
      byggeplassId: null,
      externalCostObjectId: null,
      sheetTimerId: null,
      antall: 4,
    });
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: UTEN_VARELAGER }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("🔴 bruker i et annet firma kan verken lese, endre eller slette", async () => {
    const { ctx, update, del } = lagCtx(FREMMED);
    const kaller = vareforbrukRouter.createCaller(ctx);
    await expect(kaller.hentMedId({ id: LINJE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(kaller.oppdater({ id: LINJE, antall: 6 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(kaller.slett({ id: LINJE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith(FREMMED, UTEN_VARELAGER);
  });

  it("🔴 prosjekt uten eier-firma avvises som før (BAD_REQUEST), ingen skriving", async () => {
    projectFindUnique.mockResolvedValue({ primaryOrganizationId: null });
    const { ctx, update, del } = lagCtx();
    const kaller = vareforbrukRouter.createCaller(ctx);
    await expect(kaller.oppdater({ id: LINJE, antall: 6 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(kaller.slett({ id: LINJE })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
