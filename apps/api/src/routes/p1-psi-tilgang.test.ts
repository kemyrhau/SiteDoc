import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * P1-2 (Kenneth «P1: ja» 2026-11-23): PSI-ens admin-prosedyrer går via felles gate
 * `verifiserAdmin()` i stedet for en egen `projectMember.findFirst({ role: "admin" })`.
 * Avviket som rettes: sitedoc_admin og firma-admin i eierfirmaet fikk FORBIDDEN i PSI
 * der de slipper inn i resten av prosjektet. Arbeiderens egen gjennomføring (QR) er uendret.
 *
 * Ekte tilgangskontroll mot mocket kjerne-DB i minnet.
 *
 * Rød først: mot `origin/develop` 64624972 (før fiksen) feiler de 🔴-merkede (13) og 🟡 (1).
 * 🟡 = tilgang som TAPES: aktiv admin-rad, men ansettelsen i eierfirmaet er deaktivert.
 */

const ORG_A = "a0000000-0000-0000-0000-000000000001";
const ORG_B = "b0000000-0000-0000-0000-000000000001";
const PROSJEKT_A = "a0000000-0000-0000-0000-0000000000aa";
const PROSJEKT_B = "b0000000-0000-0000-0000-0000000000bb";
const PROSJEKT_AVSLUTTET = "a0000000-0000-0000-0000-0000000000cc"; // eid av A, status completed

const PSI_A = "95100000-0000-0000-0000-00000000000a";
const PSI_AVSLUTTET = "95100000-0000-0000-0000-00000000000c";
const MAL_A = "3a100000-0000-0000-0000-00000000000a";
const MAL_A2 = "3a100000-0000-0000-0000-0000000000a2";
const MAL_B = "3a100000-0000-0000-0000-00000000000b";
const BYGGEPLASS_A = "b9100000-0000-0000-0000-00000000000a";

const PADM_A = "00000000-0000-0000-0000-0000000000a1"; // prosjektadmin på A, aktiv ansatt i A
const MEDLEM_A = "00000000-0000-0000-0000-0000000000a2"; // vanlig medlem på A
const FADM_A = "00000000-0000-0000-0000-0000000000a3"; // firma-admin i A, ingen ProjectMember-rad
const FADM_A_SLUTTET = "00000000-0000-0000-0000-0000000000a4"; // firma-admin i A, ansettelsen deaktivert
const PADM_A_AVSLUTTET = "00000000-0000-0000-0000-0000000000a5"; // admin-rad på A med periodeSlutt satt
const PADM_A_DEAKTIVERT = "00000000-0000-0000-0000-0000000000a6"; // aktiv admin-rad på A, ansettelsen i A deaktivert
const FADM_B = "00000000-0000-0000-0000-0000000000b1"; // firma-admin i B
const PADM_B = "00000000-0000-0000-0000-0000000000b2"; // prosjektadmin på B
const SYSADM = "00000000-0000-0000-0000-0000000000f1"; // sitedoc_admin, ikke ansatt noe sted

const PROSJEKTER = [
  { id: PROSJEKT_A, primaryOrganizationId: ORG_A, status: "active", type: "kunde" },
  { id: PROSJEKT_B, primaryOrganizationId: ORG_B, status: "active", type: "kunde" },
  { id: PROSJEKT_AVSLUTTET, primaryOrganizationId: ORG_A, status: "completed", type: "kunde" },
];
const ORG_MEDLEMMER = [
  { userId: PADM_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[] },
  { userId: MEDLEM_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[] },
  { userId: FADM_A, organizationId: ORG_A, status: "aktiv", firmaRoller: ["firma_admin"] },
  { userId: FADM_A_SLUTTET, organizationId: ORG_A, status: "deaktivert", firmaRoller: ["firma_admin"] },
  { userId: PADM_A_DEAKTIVERT, organizationId: ORG_A, status: "deaktivert", firmaRoller: [] as string[] },
  { userId: FADM_B, organizationId: ORG_B, status: "aktiv", firmaRoller: ["firma_admin"] },
  { userId: PADM_B, organizationId: ORG_B, status: "aktiv", firmaRoller: [] as string[] },
];
const SLUTT = new Date("2026-10-01T00:00:00.000Z");
const PROSJEKT_MEDLEMMER = [
  { userId: PADM_A, projectId: PROSJEKT_A, role: "admin", periodeSlutt: null as Date | null },
  { userId: PADM_A, projectId: PROSJEKT_AVSLUTTET, role: "admin", periodeSlutt: null as Date | null },
  { userId: MEDLEM_A, projectId: PROSJEKT_A, role: "member", periodeSlutt: null as Date | null },
  { userId: PADM_A_AVSLUTTET, projectId: PROSJEKT_A, role: "admin", periodeSlutt: SLUTT },
  { userId: PADM_A_DEAKTIVERT, projectId: PROSJEKT_A, role: "admin", periodeSlutt: null as Date | null },
  { userId: PADM_B, projectId: PROSJEKT_B, role: "admin", periodeSlutt: null as Date | null },
];
const PSIER = [
  { id: PSI_A, projectId: PROSJEKT_A, byggeplassId: null, templateId: MAL_A, version: 1, languages: [] as string[], guestMessage: null, active: true },
  { id: PSI_AVSLUTTET, projectId: PROSJEKT_AVSLUTTET, byggeplassId: null, templateId: MAL_A, version: 1, languages: [] as string[], guestMessage: null, active: true },
];
const MALER = [
  { id: MAL_A, projectId: PROSJEKT_A },
  { id: MAL_A2, projectId: PROSJEKT_A },
  { id: MAL_B, projectId: PROSJEKT_B },
];

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

const { psiUpdate } = vi.hoisted(() => ({
  psiUpdate: vi.fn(async (args?: { where: { id: string }; data: Record<string, unknown> }) => ({ ...args?.data })),
}));

vi.mock("@sitedoc/db", () => {
  const prisma = new Proxy(
    {
      user: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          role: where.id === SYSADM ? "sitedoc_admin" : "user",
        })),
      }),
      project: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => PROSJEKTER.find((p) => p.id === where.id) ?? null),
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
      }),
      projectMember: modell({
        // Honorerer userId, projectId, role og periodeSlutt: null (aktivt medlem).
        findFirst: vi.fn(
          async ({ where }: { where: { userId: string; projectId: string; role?: string; periodeSlutt?: null } }) =>
            PROSJEKT_MEDLEMMER.find(
              (m) =>
                m.userId === where.userId &&
                m.projectId === where.projectId &&
                (where.role === undefined || m.role === where.role) &&
                (!("periodeSlutt" in where) || m.periodeSlutt === null),
            ) ?? null,
        ),
      }),
      psi: modell({
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
          const psi = PSIER.find((p) => p.id === where.id);
          if (!psi) throw new Error("ikke funnet");
          return { ...psi, template: { id: psi.templateId, name: "PSI", prefix: null, objects: [] }, byggeplass: null };
        }),
        update: psiUpdate,
      }),
      reportTemplate: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => MALER.find((m) => m.id === where.id) ?? null),
      }),
      psiSignatur: modell({
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "sig-1", progress: 0, ...data })),
      }),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
  return { prisma };
});
vi.mock("../services/tegningVakt", () => ({ verifiserByggeplassIProsjekt: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/oversettelse-service", () => ({ oversettFritekst: vi.fn() }));

import { prisma } from "@sitedoc/db";
import { psiRouter } from "./psi";

function kaller(userId: string) {
  return psiRouter.createCaller({ userId, prisma } as never);
}
type Kaller = ReturnType<typeof kaller>;

/** De ti admin-prosedyrene — alle mot PSI_A / PROSJEKT_A. */
const ADMIN_PROSEDYRER: Array<[string, (k: Kaller) => Promise<unknown>]> = [
  ["opprett", (k) => k.opprett({ projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_A })],
  ["bumpVersjon", (k) => k.bumpVersjon({ psiId: PSI_A })],
  ["byttMal", (k) => k.byttMal({ psiId: PSI_A, templateId: MAL_A2 })],
  ["deaktiver", (k) => k.deaktiver({ psiId: PSI_A })],
  ["reaktiver", (k) => k.reaktiver({ psiId: PSI_A })],
  ["oppdaterGjesteBeskjed", (k) => k.oppdaterGjesteBeskjed({ psiId: PSI_A, guestMessage: "Meld deg i brakka" })],
  ["oppdaterSpraak", (k) => k.oppdaterSpraak({ psiId: PSI_A, languages: ["en"] })],
  ["oversettInnhold", (k) => k.oversettInnhold({ psiId: PSI_A })],
  ["hentSignaturer", (k) => k.hentSignaturer({ psiId: PSI_A })],
  ["kopier", (k) => k.kopier({ psiId: PSI_A, targetByggeplassId: BYGGEPLASS_A })],
];

/** Kom forbi tilgangsporten: enten lykkes kallet, eller det feiler av en annen grunn enn FORBIDDEN. */
async function kommerForbiPorten(kall: Promise<unknown>): Promise<boolean> {
  try {
    await kall;
    return true;
  } catch (e) {
    return (e as { code?: string }).code !== "FORBIDDEN";
  }
}

beforeEach(() => psiUpdate.mockClear());

describe("P1-2 — sitedoc_admin og firma-admin i eierfirmaet slipper inn (avviket rettet)", () => {
  for (const [navn, kall] of ADMIN_PROSEDYRER) {
    it(`🔴 ${navn}: sitedoc_admin og aktiv firma-admin i A kommer forbi porten`, async () => {
      expect(await kommerForbiPorten(kall(kaller(SYSADM)))).toBe(true);
      expect(await kommerForbiPorten(kall(kaller(FADM_A)))).toBe(true);
    });
  }

  it("🔴 firma-admin i A deaktiverer PSI-en (skriving når DB)", async () => {
    await kaller(FADM_A).deaktiver({ psiId: PSI_A });
    expect(psiUpdate).toHaveBeenCalledWith({ where: { id: PSI_A }, data: { active: false } });
  });
});

describe("P1-2 — uendret: prosjektadmin inn, andre ut", () => {
  for (const [navn, kall] of ADMIN_PROSEDYRER) {
    it(`${navn}: aktiv prosjektadmin inn; medlem, avsluttet rad, deaktivert firma-admin og fremmede ut`, async () => {
      expect(await kommerForbiPorten(kall(kaller(PADM_A)))).toBe(true);
      for (const bruker of [MEDLEM_A, PADM_A_AVSLUTTET, FADM_A_SLUTTET, FADM_B, PADM_B]) {
        await expect(kall(kaller(bruker))).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    });
  }

  it("🔴 frosset prosjekt: prosjektadmin nektes som før; firma-admin i eierfirmaet slipper (gjenåpner)", async () => {
    await expect(kaller(PADM_A).bumpVersjon({ psiId: PSI_AVSLUTTET })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await kommerForbiPorten(kaller(FADM_A).bumpVersjon({ psiId: PSI_AVSLUTTET }))).toBe(true);
  });
});

describe("P1-2 — tilgangsendring: aktiv admin-rad, men ansettelsen i eierfirmaet er deaktivert", () => {
  it("🟡 nektes nå PSI-administrasjon, likt alle andre verifiserAdmin-ruter (tap, meldt — § 8q)", async () => {
    await expect(kaller(PADM_A_DEAKTIVERT).bumpVersjon({ psiId: PSI_A })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("P1-2 — prosjektisolasjon i byttMal", () => {
  it("🔴 mal fra et annet prosjekt avvises, PSI-en røres ikke", async () => {
    await expect(kaller(PADM_A).byttMal({ psiId: PSI_A, templateId: MAL_B })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(psiUpdate).not.toHaveBeenCalled();
  });

  it("mal fra samme prosjekt byttes og versjonen bumpes", async () => {
    await kaller(PADM_A).byttMal({ psiId: PSI_A, templateId: MAL_A2 });
    expect(psiUpdate).toHaveBeenCalledWith({ where: { id: PSI_A }, data: { templateId: MAL_A2, version: 2 } });
  });
});

describe("P1-2 — arbeiderens egen gjennomføring er uendret", () => {
  it("vanlig medlem leser PSI-en og starter gjennomføring", async () => {
    const psi = await kaller(MEDLEM_A).hentMedObjekter({ psiId: PSI_A });
    expect(psi.id).toBe(PSI_A);
    const start = await kaller(MEDLEM_A).startGjennomforing({ psiId: PSI_A });
    expect(start.psiVersjon).toBe(1);
  });

  it("firma-isolasjon: medlem av B får ikke lese A sin PSI", async () => {
    await expect(kaller(PADM_B).hentMedObjekter({ psiId: PSI_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
