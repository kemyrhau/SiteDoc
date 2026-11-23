import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * F13c E (Kenneth 6A, 2026-11-23) — faggruppe-endringer krever prosjektadmin, og alle ID-er
 * i en endring må høre til prosjektet.
 *
 *  - Vanlig medlem avvises (FORBIDDEN) på opprett, oppdater, kopier, settAnsvarlig og slett.
 *  - Fremmed ProjectMember-ID i memberIds (opprett/kopier) avvises (BAD_REQUEST).
 *  - Ansvarlig som ikke er aktivt medlem av prosjektet (oppdater/settAnsvarlig) avvises.
 *  - Admin med gyldige ID-er slipper gjennom (vakt mot overstramming).
 *
 * Tilgangsportene er stubbet: «vanlig» passerer verifiserProsjektmedlem men ikke verifiserAdmin
 * — slik de ekte portene skiller medlem og admin. Selve portene dekkes av egne tester.
 *
 * Kjør: cd apps/api && npx vitest run src/routes/f13c-faggruppe-admin.test.ts
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn(async () => undefined),
  verifiserAdmin: vi.fn(async (userId: string) => {
    if (userId === "vanlig") {
      const { TRPCError: Feil } = await import("@trpc/server");
      throw new Feil({ code: "FORBIDDEN", message: "Kun administratorer kan utføre denne handlingen" });
    }
  }),
}));

import { faggruppeRouter } from "./faggruppe";

const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const FAGGRUPPE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const EGET_PM = "11111111-1111-1111-1111-111111111111";
const FREMMED_PM = "22222222-2222-2222-2222-222222222222";
const EGEN_BRUKER = "33333333-3333-3333-3333-333333333333";
const FREMMED_BRUKER = "44444444-4444-4444-4444-444444444444";

function lagPrisma() {
  const tx = {
    faggruppe: { create: vi.fn(async () => ({ id: FAGGRUPPE })) },
    faggruppeKobling: { createMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    tx,
    faggruppe: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: FAGGRUPPE,
        projectId: PROSJEKT,
        name: "Elektro",
        faggruppeNummer: null,
        organizationNumber: null,
        color: null,
        industry: null,
        companyName: null,
      })),
      update: vi.fn(async () => ({ id: FAGGRUPPE })),
      delete: vi.fn(async () => ({ id: FAGGRUPPE })),
    },
    projectMember: {
      // Bare EGET_PM er aktivt medlem av PROSJEKT.
      count: vi.fn(async (args: { where: { id: { in: string[] }; projectId: string } }) =>
        args.where.projectId === PROSJEKT ? args.where.id.in.filter((id) => id === EGET_PM).length : 0,
      ),
      findFirst: vi.fn(async (args: { where: { userId: string; projectId: string } }) =>
        args.where.userId === EGEN_BRUKER && args.where.projectId === PROSJEKT ? { id: EGET_PM } : null,
      ),
    },
    checklist: { count: vi.fn(async () => 0) },
    task: { count: vi.fn(async () => 0) },
    faggruppeKobling: { count: vi.fn(async () => 0) },
    dokumentflyt: { findMany: vi.fn(async () => []) },
    dokumentflytMedlem: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
}

function caller(prisma: ReturnType<typeof lagPrisma>, userId: string) {
  return faggruppeRouter.createCaller({
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
  } as unknown as Parameters<typeof faggruppeRouter.createCaller>[0]);
}

async function kode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof TRPCError ? e.code : String(e);
  }
}

describe("F13c E — vanlig medlem kan ikke endre faggrupper", () => {
  let prisma: ReturnType<typeof lagPrisma>;
  beforeEach(() => {
    prisma = lagPrisma();
  });

  it("opprett avvises", async () => {
    expect(await kode(caller(prisma, "vanlig").opprett({ projectId: PROSJEKT, name: "Prosess" }))).toBe("FORBIDDEN");
    expect(prisma.tx.faggruppe.create).not.toHaveBeenCalled();
  });
  it("oppdater avvises", async () => {
    expect(await kode(caller(prisma, "vanlig").oppdater({ id: FAGGRUPPE, name: "Nytt" }))).toBe("FORBIDDEN");
    expect(prisma.faggruppe.update).not.toHaveBeenCalled();
  });
  it("kopier avvises", async () => {
    expect(
      await kode(caller(prisma, "vanlig").kopier({ sourceFaggruppeId: FAGGRUPPE, targetProjectId: PROSJEKT })),
    ).toBe("FORBIDDEN");
  });
  it("settAnsvarlig avvises", async () => {
    expect(
      await kode(caller(prisma, "vanlig").settAnsvarlig({ faggruppeId: FAGGRUPPE, userId: EGEN_BRUKER })),
    ).toBe("FORBIDDEN");
  });
  it("slett avvises", async () => {
    expect(await kode(caller(prisma, "vanlig").slett({ id: FAGGRUPPE }))).toBe("FORBIDDEN");
    expect(prisma.faggruppe.delete).not.toHaveBeenCalled();
  });
});

describe("F13c E — fremmede ID-er avvises", () => {
  let prisma: ReturnType<typeof lagPrisma>;
  beforeEach(() => {
    prisma = lagPrisma();
  });

  it("opprett med medlem fra et annet prosjekt", async () => {
    expect(
      await kode(caller(prisma, "admin").opprett({ projectId: PROSJEKT, name: "Prosess", memberIds: [EGET_PM, FREMMED_PM] })),
    ).toBe("BAD_REQUEST");
    expect(prisma.tx.faggruppe.create).not.toHaveBeenCalled();
  });
  it("kopier med medlem fra et annet prosjekt", async () => {
    expect(
      await kode(
        caller(prisma, "admin").kopier({ sourceFaggruppeId: FAGGRUPPE, targetProjectId: PROSJEKT, memberIds: [FREMMED_PM] }),
      ),
    ).toBe("BAD_REQUEST");
    expect(prisma.tx.faggruppe.create).not.toHaveBeenCalled();
  });
  it("oppdater med ansvarlig utenfor prosjektet", async () => {
    expect(await kode(caller(prisma, "admin").oppdater({ id: FAGGRUPPE, ansvarligId: FREMMED_BRUKER }))).toBe("BAD_REQUEST");
    expect(prisma.faggruppe.update).not.toHaveBeenCalled();
  });
  it("settAnsvarlig med bruker utenfor prosjektet", async () => {
    expect(
      await kode(caller(prisma, "admin").settAnsvarlig({ faggruppeId: FAGGRUPPE, userId: FREMMED_BRUKER })),
    ).toBe("BAD_REQUEST");
    expect(prisma.faggruppe.update).not.toHaveBeenCalled();
  });
});

describe("F13c E — admin med gyldige ID-er slipper gjennom", () => {
  it("opprett, settAnsvarlig og fjerning av ansvarlig virker", async () => {
    const prisma = lagPrisma();
    const c = caller(prisma, "admin");
    expect(await kode(c.opprett({ projectId: PROSJEKT, name: "Prosess", memberIds: [EGET_PM] }))).toBe("OK");
    expect(await kode(c.settAnsvarlig({ faggruppeId: FAGGRUPPE, userId: EGEN_BRUKER }))).toBe("OK");
    expect(await kode(c.settAnsvarlig({ faggruppeId: FAGGRUPPE, userId: null }))).toBe("OK");
    expect(await kode(c.slett({ id: FAGGRUPPE }))).toBe("OK");
  });
});
