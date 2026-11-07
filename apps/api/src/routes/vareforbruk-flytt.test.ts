import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * ORDRE 36b «Flytt raden» — `vareforbruk.oppdater` med `projectId`.
 *
 * Prosjektbytte krever tilgang til målprosjektet (samme mekanisme som opprett) og
 * firma-grense: målet må ha samme eier-firma (varelager-eier) som linjens prosjekt.
 * Byggeplass/underprosjekt valideres mot MÅLprosjektet og nullstilles ved bytte når
 * de ikke sendes eksplisitt. Uten projectId er oppførselen uendret.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const ANNET_ORG = "99999999-9999-9999-9999-999999999999";
const BRUKER = "22222222-2222-2222-2222-222222222222";
const PROSJEKT_A = "33333333-3333-3333-3333-333333333333";
const PROSJEKT_B = "44444444-4444-4444-4444-444444444444"; // samme firma
const PROSJEKT_X = "66666666-6666-6666-6666-666666666666"; // annet firma
const LINJE = "55555555-5555-5555-5555-555555555555";
const BYGGEPLASS_A = "77777777-7777-7777-7777-777777777777"; // under PROSJEKT_A
const BYGGEPLASS_B = "88888888-8888-8888-8888-888888888888"; // under PROSJEKT_B
const SEDEL = "12121212-1212-1212-1212-121212121212";

const { projectFindUnique, activityCreate } = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  activityCreate: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    project: { findUnique: projectFindUnique, findMany: vi.fn() },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    activity: { create: activityCreate },
    user: { findUnique: vi.fn().mockResolvedValue({ role: "user" }) },
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
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { vareforbrukRouter } from "./vareforbruk";
import {
  verifiserProsjektmedlem,
  verifiserProsjekterTilhørerFirma,
} from "../trpc/tilgangskontroll";

const eierFirma: Record<string, string> = {
  [PROSJEKT_A]: ORG,
  [PROSJEKT_B]: ORG,
  [PROSJEKT_X]: ANNET_ORG,
};
const byggeplassProsjekt: Record<string, string> = {
  [BYGGEPLASS_A]: PROSJEKT_A,
  [BYGGEPLASS_B]: PROSJEKT_B,
};

function lagCtx(opts: { dagsseddelId?: string | null; timerProsjekter?: string[] } = {}) {
  const sheetTimerFindFirst = vi.fn(
    async ({ where }: { where: { sheetId: string; projectId: string } }) =>
      where.sheetId === opts.dagsseddelId && (opts.timerProsjekter ?? []).includes(where.projectId)
        ? { id: "timer-rad" }
        : null,
  );
  const update = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: where.id,
    antall: 1,
    ...data,
  }));
  const ctx = {
    userId: BRUKER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      byggeplass: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          byggeplassProsjekt[where.id] ? { projectId: byggeplassProsjekt[where.id] } : null,
        ),
      },
    },
    prismaVarelager: {
      vareforbruk: {
        findUnique: vi.fn().mockResolvedValue({
          projectId: PROSJEKT_A,
          attestertSnapshot: null,
          dagsseddelId: opts.dagsseddelId ?? null,
        }),
        update,
      },
    },
    // dailySheet → null: åpen-sjekken (krevVareforbrukLinjeAapen) hopper over.
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      sheetTimer: { findFirst: sheetTimerFindFirst },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, update, sheetTimerFindFirst };
}

beforeEach(() => {
  vi.clearAllMocks();
  activityCreate.mockResolvedValue({});
  projectFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    primaryOrganizationId: eierFirma[where.id] ?? null,
  }));
  // Firma-grensen (eier ∪ kobling): PROSJEKT_X tilhører ikke ORG.
  vi.mocked(verifiserProsjekterTilhørerFirma).mockImplementation(async (ider, org) => {
    if (ider.some((p) => eierFirma[p] !== org)) throw new TRPCError({ code: "FORBIDDEN" });
  });
});

describe("vareforbruk.oppdater — prosjektbytte (ORDRE 36b)", () => {
  it("🔴 prosjekt i et annet firma avvises med FORBIDDEN, ingen skriving", async () => {
    const { ctx, update } = lagCtx();
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_X }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });

  it("🔴 prosjekt firmaet bare er koblet til (annen varelager-eier) avvises med FORBIDDEN", async () => {
    // Koblet prosjekt: slipper gjennom eier ∪ kobling-grensen, men eies av et annet firma.
    vi.mocked(verifiserProsjekterTilhørerFirma).mockResolvedValue(undefined);
    const { ctx, update } = lagCtx();
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_X }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });

  it("🔴 byggeplass fra gammelt prosjekt ved prosjektbytte avvises", async () => {
    const { ctx, update } = lagCtx();
    await expect(
      vareforbrukRouter
        .createCaller(ctx)
        .oppdater({ id: LINJE, projectId: PROSJEKT_B, byggeplassId: BYGGEPLASS_A }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(update).not.toHaveBeenCalled();
  });

  it("gyldig bytte bevarer id, setter projectId og nullstiller byggeplass/underprosjekt", async () => {
    const { ctx, update } = lagCtx();
    const res = await vareforbrukRouter
      .createCaller(ctx)
      .oppdater({ id: LINJE, projectId: PROSJEKT_B, antall: 3 });
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: LINJE });
    expect(arg.data).toMatchObject({
      projectId: PROSJEKT_B,
      antall: 3,
      byggeplassId: null,
      externalCostObjectId: null,
    });
    expect(res.id).toBe(LINJE);
    // Tilgang sjekket på både gammelt og nytt prosjekt.
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith(BRUKER, PROSJEKT_A);
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith(BRUKER, PROSJEKT_B);
    expect(verifiserProsjekterTilhørerFirma).toHaveBeenCalledWith([PROSJEKT_B], ORG);
  });

  it("gyldig bytte med byggeplass i nytt prosjekt lagrer den", async () => {
    const { ctx, update } = lagCtx();
    await vareforbrukRouter
      .createCaller(ctx)
      .oppdater({ id: LINJE, projectId: PROSJEKT_B, byggeplassId: BYGGEPLASS_B });
    expect(update.mock.calls[0]![0].data).toMatchObject({
      projectId: PROSJEKT_B,
      byggeplassId: BYGGEPLASS_B,
    });
  });

  it("uten projectId: uendret — ingen projectId/nullstilling i data, ingen firma-sjekk", async () => {
    const { ctx, update } = lagCtx();
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, antall: 2 });
    const data = update.mock.calls[0]![0].data;
    expect(data).toEqual({ antall: 2 });
    expect(verifiserProsjekterTilhørerFirma).not.toHaveBeenCalled();
    // Kun linjens eget prosjekt sjekkes (medlem + tilgang-policy «alle-ansatte»).
    expect(vi.mocked(verifiserProsjektmedlem).mock.calls.every((c) => c[1] === PROSJEKT_A)).toBe(true);
  });

  it("uten projectId: byggeplass valideres fortsatt mot radens prosjekt", async () => {
    const { ctx, update } = lagCtx();
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, byggeplassId: BYGGEPLASS_B }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(update).not.toHaveBeenCalled();
  });

  it("projectId lik nåværende regnes ikke som bytte", async () => {
    const { ctx, update } = lagCtx();
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_A, antall: 2 });
    expect(update.mock.calls[0]![0].data).toEqual({ antall: 2 });
    expect(verifiserProsjekterTilhørerFirma).not.toHaveBeenCalled();
  });
});

describe("vareforbruk.oppdater — prosjektbytte og dagsseddel (RETUR 4)", () => {
  it("🔴 sedelen har timer-rad på målprosjektet → flyttes, dagsseddelId beholdes", async () => {
    const { ctx, update, sheetTimerFindFirst } = lagCtx({
      dagsseddelId: SEDEL,
      timerProsjekter: [PROSJEKT_A, PROSJEKT_B],
    });
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_B });
    expect(sheetTimerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sheetId: SEDEL, projectId: PROSJEKT_B } }),
    );
    const data = update.mock.calls[0]![0].data;
    expect(data.projectId).toBe(PROSJEKT_B);
    expect(data).not.toHaveProperty("dagsseddelId");
  });

  it("🔴 sedelen mangler timer-rad på målprosjektet → BAD_REQUEST, ingen skriving", async () => {
    const { ctx, update } = lagCtx({ dagsseddelId: SEDEL, timerProsjekter: [PROSJEKT_A] });
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_B }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(update).not.toHaveBeenCalled();
  });

  it("uten dagsseddel: ingen sedel-sjekk", async () => {
    const { ctx, update, sheetTimerFindFirst } = lagCtx({ dagsseddelId: null });
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, projectId: PROSJEKT_B });
    expect(sheetTimerFindFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("uten prosjektbytte: ingen sedel-sjekk (antall-endring som før)", async () => {
    const { ctx, update, sheetTimerFindFirst } = lagCtx({ dagsseddelId: SEDEL, timerProsjekter: [] });
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, antall: 3 });
    expect(sheetTimerFindFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
