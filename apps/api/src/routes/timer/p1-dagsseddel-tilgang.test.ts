import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * P1-1 (Kenneth «P1: ja» 2026-11-23): tilgang til en ANNENS dagsseddel går via én firma-gate —
 * sitedoc_admin, eller firma-admin i sedelens firma med ansettelse som ikke er deaktivert
 * (`erFirmaAdmin`). Før fiksen leste `list`, `hentDagstotal` og `hentEgenDagsseddel` (36
 * kallesteder: hentMedId, slett, send, rad-skriving m.m.) `firmaRoller` uten status.
 *
 * Ekte tilgangskontroll mot mocket kjerne-DB i minnet.
 *
 * Rød først: mot `origin/develop` 1bb2d5e6 (før fiksen) feiler de 🔴-merkede. `list` og
 * `hentDagstotal` var i praksis allerede tettet av `resolverOrgFraInput` (bare aktiv ansettelse
 * løser firmaet) — testene der er vakter, grønne begge veier.
 */

const ORG_A = "a0000000-0000-0000-0000-000000000001";
const ORG_B = "b0000000-0000-0000-0000-000000000001";
const PROSJEKT_A = "a0000000-0000-0000-0000-0000000000aa";

const ANSATT_A = "00000000-0000-0000-0000-0000000000a1"; // eier av SEDEL_A
const ADMIN_A = "00000000-0000-0000-0000-0000000000a2"; // aktiv firma-admin i A
const ADMIN_A_SLUTTET = "00000000-0000-0000-0000-0000000000a3"; // firma-admin i A, ansettelsen deaktivert
const ADMIN_B = "00000000-0000-0000-0000-0000000000b2"; // aktiv firma-admin i B
const LEDER_A = "00000000-0000-0000-0000-0000000000a4"; // aktiv ansatt i A, kanAttestere på PROSJEKT_A
const SYSADM = "00000000-0000-0000-0000-0000000000f1"; // sitedoc_admin, ikke ansatt noe sted

const SEDEL_A = "5ede1000-0000-0000-0000-00000000000a";
const DATO = "2026-11-02";

const ORG_MEDLEMMER = [
  { userId: ANSATT_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[] },
  { userId: ADMIN_A, organizationId: ORG_A, status: "aktiv", firmaRoller: ["firma_admin"] },
  { userId: ADMIN_A_SLUTTET, organizationId: ORG_A, status: "deaktivert", firmaRoller: ["firma_admin"] },
  { userId: ADMIN_B, organizationId: ORG_B, status: "aktiv", firmaRoller: ["firma_admin"] },
  { userId: LEDER_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[] },
];
const PROSJEKT_MEDLEMMER = [{ userId: LEDER_A, projectId: PROSJEKT_A, role: "member", kanAttestere: true }];

const SEDLER = [
  {
    id: SEDEL_A,
    clientUuid: SEDEL_A,
    organizationId: ORG_A,
    userId: ANSATT_A,
    status: "sent",
    dato: new Date(`${DATO}T00:00:00.000Z`),
    aktivitetId: null,
    createdAt: new Date(`${DATO}T00:00:00.000Z`),
  },
];
const TIMER_RADER = [{ id: "rad-a", sheetId: SEDEL_A, projectId: PROSJEKT_A, timer: 7.5 }];

function treff(verdi: unknown, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (filter instanceof Date) return verdi instanceof Date && verdi.getTime() === filter.getTime();
  if (filter && typeof filter === "object") return true; // relasjons-/periodefilter
  return verdi === filter;
}
function filtrer<T extends Record<string, unknown>>(rader: T[], where: Record<string, unknown> = {}): T[] {
  return rader.filter((r) => Object.entries(where).every(([k, f]) => (k in r ? treff(r[k], f) : true)));
}
function tomtSvar(metode: string): unknown {
  if (metode === "count") return 0;
  if (metode === "findMany" || metode === "groupBy") return [];
  if (metode === "findFirst" || metode === "findUnique") return null;
  return {};
}
function modell(eget: Record<string, unknown> = {}) {
  return new Proxy(eget, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn(async () => tomtSvar(k))),
  });
}

vi.mock("@sitedoc/db", () => {
  const prisma = new Proxy(
    {
      user: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          role: where.id === SYSADM ? "sitedoc_admin" : "user",
        })),
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({
          role: where.id === SYSADM ? "sitedoc_admin" : "user",
        })),
      }),
      organizationMember: modell({
        findUnique: vi.fn(
          async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) =>
            ORG_MEDLEMMER.find(
              (m) =>
                m.userId === where.userId_organizationId.userId &&
                m.organizationId === where.userId_organizationId.organizationId,
            ) ?? null,
        ),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => filtrer(ORG_MEDLEMMER, where)),
      }),
      projectMember: modell({
        findFirst: vi.fn(
          async ({ where }: { where: { userId: string; projectId: string } }) =>
            PROSJEKT_MEDLEMMER.find((m) => m.userId === where.userId && m.projectId === where.projectId) ?? null,
        ),
      }),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
  return { prisma };
});
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ dagsnorm: 7.5 }),
}));

import { prisma } from "@sitedoc/db";
import { dagsseddelRouter } from "./dagsseddel";

const transaksjon = vi.fn(async () => ({}));

function lagPrismaTimer() {
  return new Proxy(
    {
      dailySheet: modell({
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
          filtrer(SEDLER, where).map((s) => ({
            ...s,
            timer: TIMER_RADER.filter((r) => r.sheetId === s.id),
            tillegg: [],
            maskiner: [],
          })),
        ),
        findUnique: vi.fn(async ({ where }: { where: { id?: string; clientUuid?: string } }) =>
          SEDLER.find((s) => s.id === where.id || s.clientUuid === where.clientUuid) ?? null,
        ),
      }),
      sheetTimer: modell({
        findMany: vi.fn(async ({ where }: { where: { sheetId?: string } }) =>
          TIMER_RADER.filter((r) => r.sheetId === where.sheetId),
        ),
      }),
      $transaction: transaksjon,
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
}

function kaller(userId: string) {
  return dagsseddelRouter.createCaller({ userId, prisma, prismaTimer: lagPrismaTimer() } as never);
}

beforeEach(() => transaksjon.mockClear());

describe("P1-1 — hentEgenDagsseddel: annens sedel krever ikke-deaktivert firma-admin", () => {
  it("🔴 deaktivert firma-admin får ikke lese en ansatts sedel (hentMedId)", async () => {
    await expect(kaller(ADMIN_A_SLUTTET).hentMedId({ id: SEDEL_A })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("🔴 deaktivert firma-admin får ikke slette en ansatts sedel (skrivesti)", async () => {
    await expect(kaller(ADMIN_A_SLUTTET).slett({ id: SEDEL_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(transaksjon).not.toHaveBeenCalled();
  });

  it("vakt: aktiv firma-admin, sitedoc_admin og eieren leser sedelen som før", async () => {
    for (const bruker of [ADMIN_A, SYSADM, ANSATT_A]) {
      const sedel = await kaller(bruker).hentMedId({ id: SEDEL_A });
      expect(sedel.id).toBe(SEDEL_A);
    }
  });

  it("firma-isolasjon: firma-admin i B får ikke lese A sin sedel", async () => {
    await expect(kaller(ADMIN_B).hentMedId({ id: SEDEL_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("vakt: attestant uten firma-admin leser ikke annens sedel via hentMedId (uendret)", async () => {
    await expect(kaller(LEDER_A).hentMedId({ id: SEDEL_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("P1-1 — list og hentDagstotal: felles gate, firma-isolasjon", () => {
  it("aktiv firma-admin i A ser A-ansattes sedler og dagstotal", async () => {
    const sedler = await kaller(ADMIN_A).list({ userId: ANSATT_A });
    expect(sedler.map((s) => s.id)).toEqual([SEDEL_A]);
    const total = await kaller(ADMIN_A).hentDagstotal({ userId: ANSATT_A, dato: DATO });
    expect(total.antallSedler).toBe(1);
    expect(total.totalTimer).toBe(7.5);
  });

  it("firma-isolasjon: firma-admin i B ser aldri A sine sedler", async () => {
    // Uten firmavalg løses B (eget firma) — A-ansattes sedler ligger ikke der.
    expect(await kaller(ADMIN_B).list({ userId: ANSATT_A })).toEqual([]);
    expect((await kaller(ADMIN_B).hentDagstotal({ userId: ANSATT_A, dato: DATO })).antallSedler).toBe(0);
    // Med A som firmavalg: nektes.
    await expect(kaller(ADMIN_B).list({ userId: ANSATT_A, organizationId: ORG_A })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      kaller(ADMIN_B).hentDagstotal({ userId: ANSATT_A, dato: DATO, organizationId: ORG_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deaktivert firma-admin nektes list og hentDagstotal for andres sedler", async () => {
    await expect(
      kaller(ADMIN_A_SLUTTET).list({ userId: ANSATT_A, organizationId: ORG_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      kaller(ADMIN_A_SLUTTET).hentDagstotal({ userId: ANSATT_A, dato: DATO, organizationId: ORG_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("vakt: attestant uten firma-admin nektes andres liste (uendret)", async () => {
    await expect(kaller(LEDER_A).list({ userId: ANSATT_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("vakt: sitedoc_admin ser sedlene i valgt firma", async () => {
    const sedler = await kaller(SYSADM).list({ userId: ANSATT_A, organizationId: ORG_A });
    expect(sedler.map((s) => s.id)).toEqual([SEDEL_A]);
  });
});
