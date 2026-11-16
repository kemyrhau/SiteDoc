import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ORDRE 33 — server-vakt for vareforbruk på en dagsseddel.
 *
 * Eieren kan legge til/endre/slette linjer kun mens sedelen er åpen
 * (`draft`/`returned`). Andre — og eieren etter innsending — trenger
 * sitedoc_admin, prosjektadmin eller firma_admin i SEDELENS firma.
 * Linjer uten dagsseddel er uberørt. Idempotent replay (samme id) returnerer
 * eksisterende rad før vakten, så en kø-sending etter innsending ikke avvises.
 */

const { userFindUnique, projectMemberFindFirst, activityCreate } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  projectMemberFindFirst: vi.fn(),
  activityCreate: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: "11111111-1111-1111-1111-111111111111" }),
    },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    activity: { create: activityCreate },
    user: { findUnique: userFindUnique },
    projectMember: { findFirst: projectMemberFindFirst },
  },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  aktivtMedlemWhere: { periodeSlutt: null },
  verifiserOrganisasjonTilgang: vi.fn(),
  erFirmaAdmin: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  erVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { vareforbrukRouter } from "./vareforbruk";
import { erFirmaAdmin } from "../trpc/tilgangskontroll";

const ORG = "11111111-1111-1111-1111-111111111111"; // prosjektets eier-firma
const SEDEL_ORG = "99999999-9999-9999-9999-999999999999"; // sedelens firma (UE)
const BRUKER = "22222222-2222-2222-2222-222222222222";
const ANNEN = "77777777-7777-7777-7777-777777777777";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const VARE = "44444444-4444-4444-4444-444444444444";
const LINJE = "55555555-5555-5555-5555-555555555555";
const SEDEL = "88888888-8888-8888-8888-888888888888";

const SENDT = { code: "FORBIDDEN", message: "vareforbruk.feil.sedelSendt" };
const ANNENS = { code: "FORBIDDEN", message: "vareforbruk.feil.annensSedel" };

type Roller = { sitedocAdmin?: boolean; prosjektAdmin?: boolean; firmaAdminI?: string };

function settRoller(r: Roller) {
  userFindUnique.mockResolvedValue({ role: r.sitedocAdmin ? "sitedoc_admin" : "user" });
  projectMemberFindFirst.mockResolvedValue({ role: r.prosjektAdmin ? "admin" : "member" });
  vi.mocked(erFirmaAdmin).mockImplementation(async (_u, org) => org === r.firmaAdminI);
}

function lagCtx(opts: { sedel: { userId: string; status: string }; rad?: Record<string, unknown> }) {
  const rader = new Map<string, Record<string, unknown>>();
  if (opts.rad) rader.set(LINJE, { id: LINJE, ...opts.rad });
  const lager = {
    vare: { findUnique: vi.fn().mockResolvedValue({ organizationId: ORG, aktiv: true }) },
    vareforbruk: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rader.get(where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? "ny" })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, antall: 1 })),
      delete: vi.fn(async () => ({})),
    },
  };
  const dailySheetFindUnique = vi.fn().mockResolvedValue({
    ...opts.sedel,
    organizationId: SEDEL_ORG,
    timer: [{ id: "t1" }],
  });
  const ctx = {
    userId: BRUKER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prismaVarelager: lager,
    prismaTimer: { dailySheet: { findUnique: dailySheetFindUnique } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, lager, dailySheetFindUnique };
}

const input = { id: LINJE, projectId: PROSJEKT, dato: "2026-11-07", vareId: VARE, antall: 2, dagsseddelId: SEDEL };

beforeEach(() => {
  activityCreate.mockReset().mockResolvedValue({});
  settRoller({});
});

describe("vareforbruk.opprett — sedel-vakt", () => {
  it("V1 egen sedel i draft → opprettes", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "draft" } });
    await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });

  it("V2 egen sedel i returned → opprettes", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "returned" } });
    await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });

  it("V3 egen sedel i sent → FORBIDDEN sedelSendt, INGEN skriving", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "sent" } });
    await expect(vareforbrukRouter.createCaller(ctx).opprett(input)).rejects.toMatchObject(SENDT);
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("V4 egen sedel i accepted → FORBIDDEN sedelSendt", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "accepted" } });
    await expect(vareforbrukRouter.createCaller(ctx).opprett(input)).rejects.toMatchObject(SENDT);
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("V5 annens sedel i draft, vanlig medlem → FORBIDDEN annensSedel", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: ANNEN, status: "draft" } });
    await expect(vareforbrukRouter.createCaller(ctx).opprett(input)).rejects.toMatchObject(ANNENS);
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("V6 annens sendte sedel, prosjektadmin → opprettes", async () => {
    settRoller({ prosjektAdmin: true });
    const { ctx, lager } = lagCtx({ sedel: { userId: ANNEN, status: "sent" } });
    await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });

  it("V7 firma_admin i sedelens firma → opprettes", async () => {
    settRoller({ firmaAdminI: SEDEL_ORG });
    const { ctx, lager } = lagCtx({ sedel: { userId: ANNEN, status: "sent" } });
    await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });

  it("V8 firma_admin kun i prosjektets firma → FORBIDDEN", async () => {
    settRoller({ firmaAdminI: ORG });
    const { ctx, lager } = lagCtx({ sedel: { userId: ANNEN, status: "sent" } });
    await expect(vareforbrukRouter.createCaller(ctx).opprett(input)).rejects.toMatchObject(ANNENS);
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("V9 sitedoc_admin → opprettes", async () => {
    settRoller({ sitedocAdmin: true });
    const { ctx, lager } = lagCtx({ sedel: { userId: ANNEN, status: "accepted" } });
    await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });

  it("V10 idempotent replay etter innsending → eksisterende rad, ingen avvisning", async () => {
    const { ctx, lager } = lagCtx({
      sedel: { userId: BRUKER, status: "sent" },
      rad: { registrertAvUserId: BRUKER, dagsseddelId: SEDEL },
    });
    const res = await vareforbrukRouter.createCaller(ctx).opprett(input);
    expect(res.id).toBe(LINJE);
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("uten dagsseddel → uberørt (ingen sedel-oppslag)", async () => {
    const { ctx, lager, dailySheetFindUnique } = lagCtx({ sedel: { userId: ANNEN, status: "sent" } });
    const { dagsseddelId: _d, ...utenSedel } = input;
    await vareforbrukRouter.createCaller(ctx).opprett(utenSedel);
    expect(dailySheetFindUnique).not.toHaveBeenCalled();
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
  });
});

describe("vareforbruk.oppdater/slett — sedel-vakt", () => {
  const radPaaSedel = { projectId: PROSJEKT, vareId: VARE, attestertSnapshot: null, dagsseddelId: SEDEL };

  it("V11 oppdater linje på sendt sedel: eier → FORBIDDEN, INGEN skriving", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "sent" }, rad: radPaaSedel });
    await expect(
      vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, antall: 3 }),
    ).rejects.toMatchObject(SENDT);
    expect(lager.vareforbruk.update).not.toHaveBeenCalled();
  });

  it("V11 oppdater linje på sendt sedel: prosjektadmin → lagres", async () => {
    settRoller({ prosjektAdmin: true });
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "sent" }, rad: radPaaSedel });
    await vareforbrukRouter.createCaller(ctx).oppdater({ id: LINJE, antall: 3 });
    expect(lager.vareforbruk.update).toHaveBeenCalledTimes(1);
  });

  it("V12 slett linje på sendt sedel: eier → FORBIDDEN, INGEN sletting", async () => {
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "sent" }, rad: radPaaSedel });
    await expect(vareforbrukRouter.createCaller(ctx).slett({ id: LINJE })).rejects.toMatchObject(SENDT);
    expect(lager.vareforbruk.delete).not.toHaveBeenCalled();
  });

  it("V12 slett linje på sendt sedel: firma_admin i sedelens firma → slettes", async () => {
    settRoller({ firmaAdminI: SEDEL_ORG });
    const { ctx, lager } = lagCtx({ sedel: { userId: BRUKER, status: "sent" }, rad: radPaaSedel });
    await vareforbrukRouter.createCaller(ctx).slett({ id: LINJE });
    expect(lager.vareforbruk.delete).toHaveBeenCalledTimes(1);
  });

  it("oppdater/slett linje uten dagsseddel → uberørt", async () => {
    const { ctx, lager, dailySheetFindUnique } = lagCtx({
      sedel: { userId: ANNEN, status: "sent" },
      rad: { ...radPaaSedel, dagsseddelId: null },
    });
    const kaller = vareforbrukRouter.createCaller(ctx);
    await kaller.oppdater({ id: LINJE, antall: 3 });
    await kaller.slett({ id: LINJE });
    expect(dailySheetFindUnique).not.toHaveBeenCalled();
    expect(lager.vareforbruk.update).toHaveBeenCalledTimes(1);
    expect(lager.vareforbruk.delete).toHaveBeenCalledTimes(1);
  });
});
