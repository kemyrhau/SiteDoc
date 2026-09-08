import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * medlem.registrer — én komplett registrering i ÉN transaksjon (registreringsmodell
 * fase 1). Erstatter medlem.leggTil + gruppe.leggTilMedlem.
 *
 * Dekker ordrens fire krav: (1) alle fire bindinger i én transaksjon + flyt-bindingen
 * faktisk skrevet, (2) idempotens ved dobbelttrykk, (3) feil i én binding ruller alt
 * tilbake (prosedyren propagerer feilen så Prisma aborterer tx; e-post-steget nås
 * aldri), (4) kun én invitasjons-e-post.
 *
 * Auth kjøres som sitedoc_admin (mock av @sitedoc/db-singletonen `verifiserAdminEller-
 * Firmaansvarlig` bruker) → tidlig {erAdmin:true}, så krevAktivAnsettelse/frysevakt ikke
 * trigges. ctx.prisma er en egen mock; $transaction kaller callbacken med ctx.prisma selv.
 */

const dbUserFindUnique = vi.fn();
vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => dbUserFindUnique(...a) },
  },
}));

const sendInvitasjonsEpost = vi.fn();
vi.mock("../services/epost", () => ({
  sendInvitasjonsEpost: (...a: unknown[]) => sendInvitasjonsEpost(...a),
}));

import { medlemRouter } from "./medlem";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";
const FLYT = "22222222-2222-2222-2222-222222222222";
const GRUPPE = "33333333-3333-3333-3333-333333333333";
const FAGGRUPPE = "44444444-4444-4444-4444-444444444444";
const BRUKER = "55555555-5555-5555-5555-555555555555";

// Én mock-prisma som fungerer både som ctx.prisma OG som tx (via $transaction).
function lagPrisma(overstyr: Record<string, unknown> = {}) {
  const p: Record<string, unknown> = {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: BRUKER, email: "ny@firma.no", name: "Ny Person" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Inviterer" }),
      create: vi.fn().mockResolvedValue({ id: BRUKER, email: "ny@firma.no", name: "Ny Person" }),
      update: vi.fn().mockResolvedValue({ id: BRUKER, email: "ny@firma.no", name: "Ny Person" }),
    },
    organizationMember: { upsert: vi.fn().mockResolvedValue({}) },
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "pm-1" }),
    },
    faggruppeKobling: { upsert: vi.fn().mockResolvedValue({}) },
    projectGroupMember: { upsert: vi.fn().mockResolvedValue({}) },
    dokumentflytMedlem: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "dfm-1" }),
    },
    dokumentflyt: { findMany: vi.fn().mockResolvedValue([{ id: FLYT }]) },
    projectGroup: { findMany: vi.fn().mockResolvedValue([{ id: GRUPPE }]) },
    account: { findFirst: vi.fn().mockResolvedValue(null) },
    projectInvitation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "inv-1" }),
    },
    project: { findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Prosjekt" }) },
  };
  Object.assign(p, overstyr);
  // Interaktiv tx: kall callbacken med prisma-mocken selv (tx === ctx.prisma her).
  p.$transaction = (cb: (tx: unknown) => unknown) => cb(p);
  // Sluttoppslaget (retur) skal gi en ferdig rad — overstyr findUnique til å svare det.
  (p.projectMember as { findUnique: ReturnType<typeof vi.fn> }).findUnique = vi
    .fn()
    // 1. kall inne i tx (finn eksisterende) → null; 2. kall (retur) → raden
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ id: "pm-1", user: {}, faggruppeKoblinger: [] });
  return p;
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "admin-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return medlemRouter.createCaller(ctx);
}

beforeEach(() => {
  dbUserFindUnique.mockReset();
  dbUserFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
  sendInvitasjonsEpost.mockReset();
  sendInvitasjonsEpost.mockResolvedValue(undefined);
});

describe("medlem.registrer — alle fire bindinger i én transaksjon", () => {
  it("oppretter bruker + medlem + faggruppe + gruppe + flyt-rolle, og flyt-bindingen skrives", async () => {
    const p = lagPrisma();
    const caller = lagCaller(p);

    await caller.registrer({
      projectId: PROSJEKT,
      email: "ny@firma.no",
      firstName: "Ny",
      lastName: "Person",
      faggruppeIder: [FAGGRUPPE],
      gruppeIder: [GRUPPE],
      flytBindinger: [{ dokumentflytId: FLYT, rolle: "utforer", steg: 1 }],
    });

    // Bruker + medlem opprettet
    expect((p.user as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledOnce();
    expect((p.projectMember as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledOnce();
    // Faggruppe-kobling
    expect((p.faggruppeKobling as { upsert: ReturnType<typeof vi.fn> }).upsert).toHaveBeenCalledOnce();
    // Brukergruppe
    expect((p.projectGroupMember as { upsert: ReturnType<typeof vi.fn> }).upsert).toHaveBeenCalledOnce();
    // Flyt-rollen FAKTISK skrevet med riktig medlem + rolle + steg
    const dfmCreate = (p.dokumentflytMedlem as { create: ReturnType<typeof vi.fn> }).create;
    expect(dfmCreate).toHaveBeenCalledOnce();
    expect(dfmCreate.mock.calls[0]![0]).toMatchObject({
      data: { dokumentflytId: FLYT, projectMemberId: "pm-1", rolle: "utforer", steg: 1 },
    });
  });

  it("validerer at flyt og gruppe hører til prosjektet (kryss-prosjekt-vern)", async () => {
    const p = lagPrisma({ dokumentflyt: { findMany: vi.fn().mockResolvedValue([]) } });
    const caller = lagCaller(p);

    await expect(
      caller.registrer({
        projectId: PROSJEKT,
        email: "ny@firma.no",
        firstName: "Ny",
        lastName: "Person",
        flytBindinger: [{ dokumentflytId: FLYT, rolle: "utforer", steg: 1 }],
      }),
    ).rejects.toThrow(/[Uu]kjent dokumentflyt/);
  });
});

describe("medlem.registrer — idempotens ved dobbelttrykk", () => {
  it("eksisterende medlem + eksisterende flyt-ledd → ingen ny rad, ingen feil", async () => {
    const p = lagPrisma({
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: BRUKER, email: "finnes@firma.no", name: "Finnes", phone: "1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Inviterer" }),
        create: vi.fn(),
        update: vi.fn(),
      },
      projectMember: {
        create: vi.fn(),
      },
      dokumentflytMedlem: {
        findFirst: vi.fn().mockResolvedValue({ id: "finnes-dfm" }),
        create: vi.fn(),
      },
      account: { findFirst: vi.fn().mockResolvedValue({ id: "acc-1" }) },
    });
    // projectMember.findUnique: 1. (i tx) finnes → {id}; 2. (retur) → raden
    (p.projectMember as { findUnique: ReturnType<typeof vi.fn> }).findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "pm-1" })
      .mockResolvedValue({ id: "pm-1", user: {}, faggruppeKoblinger: [] });
    const caller = lagCaller(p);

    await caller.registrer({
      projectId: PROSJEKT,
      email: "finnes@firma.no",
      firstName: "Finnes",
      lastName: "Person",
      flytBindinger: [{ dokumentflytId: FLYT, rolle: "utforer", steg: 1 }],
    });

    expect((p.user as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    expect((p.projectMember as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    expect((p.dokumentflytMedlem as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
  });
});

describe("medlem.registrer — rollback: feil i én binding ruller alt tilbake", () => {
  it("gruppe-upsert feiler → prosedyren avvises OG ingen e-post sendes", async () => {
    const p = lagPrisma({
      projectGroupMember: { upsert: vi.fn().mockRejectedValue(new Error("DB-feil i gruppe-binding")) },
    });
    const caller = lagCaller(p);

    await expect(
      caller.registrer({
        projectId: PROSJEKT,
        email: "ny@firma.no",
        firstName: "Ny",
        lastName: "Person",
        gruppeIder: [GRUPPE],
      }),
    ).rejects.toThrow(/DB-feil i gruppe-binding/);

    // Steg 7 (invitasjon + e-post) ligger ETTER tx → skal aldri nås når tx kaster.
    expect((p.projectInvitation as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    expect(sendInvitasjonsEpost).not.toHaveBeenCalled();
  });
});

describe("medlem.registrer — kun én invitasjons-e-post", () => {
  it("ny bruker uten konto → nøyaktig én e-post", async () => {
    const p = lagPrisma();
    const caller = lagCaller(p);

    await caller.registrer({
      projectId: PROSJEKT,
      email: "ny@firma.no",
      firstName: "Ny",
      lastName: "Person",
    });

    expect(sendInvitasjonsEpost).toHaveBeenCalledOnce();
  });

  it("ventende invitasjon finnes alt → ingen ny e-post (dedup)", async () => {
    const p = lagPrisma({
      projectInvitation: {
        findFirst: vi.fn().mockResolvedValue({ id: "finnes-inv" }),
        create: vi.fn(),
      },
    });
    const caller = lagCaller(p);

    await caller.registrer({
      projectId: PROSJEKT,
      email: "ny@firma.no",
      firstName: "Ny",
      lastName: "Person",
    });

    expect((p.projectInvitation as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    expect(sendInvitasjonsEpost).not.toHaveBeenCalled();
  });
});
