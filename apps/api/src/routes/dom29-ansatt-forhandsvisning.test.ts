import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tillegg (7b), dom (29):
 * - M2: `organisasjon.forhandsvisDeaktivering` krever at personen er ansatt i firmaet, som
 *   `settAnsattStatus`. Uten sjekken røper `hoppetOver` at personen er ansatt i et annet firma.
 * - M1: `admin.hentAlleProsjekter` teller bare aktive prosjektmedlemmer (`aktivtMedlemWhere`).
 */

const forhandsvis = vi.hoisted(() => vi.fn());

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/ansattDeaktivering", async (importActual) => ({
  ...(await importActual<typeof import("../services/ansattDeaktivering")>()),
  forhandsvisDeaktivering: forhandsvis,
}));

import { organisasjonRouter } from "./organisasjon";
import { adminRouter } from "./admin";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";

const FIRMA = "aaaaaaaa-0000-4000-8000-00000000000a";
const ANSATT = "bbbbbbbb-0000-4000-8000-00000000000b";
const ANNEN = "cccccccc-0000-4000-8000-00000000000c"; // ansatt bare i et annet firma

beforeEach(() => {
  vi.clearAllMocks();
  forhandsvis.mockResolvedValue({ prosjekter: [], hoppetOver: [] });
});

function orgCaller() {
  const prisma = {
    organizationMember: {
      findUnique: vi.fn(({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) => {
        const { userId, organizationId } = where.userId_organizationId;
        return Promise.resolve(userId === ANSATT && organizationId === FIRMA ? { id: "m1" } : null);
      }),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return organisasjonRouter.createCaller({ userId: "admin-1", prisma } as any);
}

describe("7b M2 — forhandsvisDeaktivering krever ansettelse i firmaet", () => {
  it("🔴 person som ikke er ansatt i firmaet → FORBIDDEN, ingen forhåndsvisning beregnes", async () => {
    await expect(orgCaller().forhandsvisDeaktivering({ userId: ANNEN, organizationId: FIRMA })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(forhandsvis).not.toHaveBeenCalled();
  });

  it("ansatt i firmaet → forhåndsvisning beregnes", async () => {
    await orgCaller().forhandsvisDeaktivering({ userId: ANSATT, organizationId: FIRMA });
    expect(forhandsvis).toHaveBeenCalledWith(expect.anything(), { userId: ANSATT, organizationId: FIRMA });
  });
});

describe("7b M1 — admin.hentAlleProsjekter teller bare aktive medlemmer", () => {
  it("🔴 members-utvalget filtrerer på aktivtMedlemWhere", async () => {
    const projectFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
      project: { findMany: projectFindMany },
      checklist: { groupBy: vi.fn().mockResolvedValue([]) },
      task: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await adminRouter.createCaller({ userId: "sa-1", prisma } as any).hentAlleProsjekter();
    const members = (projectFindMany.mock.calls[0]?.[0] as { include: { members: { where?: unknown } } }).include.members;
    expect(members.where).toEqual(aktivtMedlemWhere);
  });
});
