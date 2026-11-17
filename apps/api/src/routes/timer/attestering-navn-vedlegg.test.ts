import { describe, it, expect, vi } from "vitest";

/**
 * Ordre d2b-3 (prosjektkort-kortid-spec.md § 12.6.0):
 *  - Tilgangssjekk: `hentForAttestering` og `hentTilAttestering` sender ikke navn på andre
 *    prosjekter, underprosjekter eller byggeplasser til en bruker uten tilgang til prosjektet
 *    (`verifiserProsjektmedlem`, mocket her). Firma-admin i sedelens firma ser alt, som i
 *    firmalista. Id-ene og feltene for brukere med tilgang er uendret.
 *  - Vedlegg på utlegg: bare på rader brukeren kan attestere, og alltid med signert URL.
 *  - Dagsnorm på detaljen: fra `hentEffektivArbeidstid` (firmaets innstillinger).
 */

const ORG_A = "a0000000-0000-0000-0000-000000000001";
const P_EGET = "a0000000-0000-0000-0000-0000000000aa";
const P_ANNET = "a0000000-0000-0000-0000-0000000000bb";

const LEDER = "leder-a";
const FADMIN = "fadmin-a";
const ANSATT = "ansatt-a";
const SEDEL = "5ede1000-0000-0000-0000-00000000000a";

const PROSJEKTER = [
  { id: P_EGET, name: "Eget bygg", projectNumber: "100", internalProjectNumber: "E-1" },
  { id: P_ANNET, name: "Hemmelig bygg", projectNumber: "999", internalProjectNumber: "H-9" },
];
const BYGGEPLASSER = [
  { id: "bp-eget", name: "Synlig plass" },
  { id: "bp-annet", name: "Hemmelig plass" },
];
const ECO = [
  { id: "eco-eget", kortNavn: "Synlig UP", proAdmId: "11" },
  { id: "eco-annet", kortNavn: "Hemmelig UP", proAdmId: "77" },
];
const TILGANG: Record<string, string[]> = { [LEDER]: [P_EGET] };

const lonnsart = { type: "ordinaer", fravaerNormtak: null, navn: "Timelønn" };
const timerRad = (id: string, projectId: string, timer: number, sted: "eget" | "annet") => ({
  id,
  sheetId: SEDEL,
  projectId,
  timer,
  erReise: false,
  kortId: `kort-${projectId}`,
  attestertStatus: "pending",
  byggeplassId: `bp-${sted}`,
  externalCostObjectId: `eco-${sted}`,
  lonnsartId: null,
  lonnsart,
});
const TIMER = [timerRad("t-eget", P_EGET, 4, "eget"), timerRad("t-annet", P_ANNET, 2, "annet")];
const TILLEGG = [
  { id: "ti-annet", sheetId: SEDEL, projectId: P_ANNET, kortId: null, attestertStatus: "pending", byggeplassId: "bp-annet", externalCostObjectId: "eco-annet" },
];
const MASKINER = [
  { id: "m-annet", sheetId: SEDEL, projectId: P_ANNET, vehicleId: "v1", sheetTimerId: "t-annet", kortId: `kort-${P_ANNET}`, attestertStatus: "pending", byggeplassId: "bp-annet", externalCostObjectId: "eco-annet" },
];
const UTLEGG = [
  { id: "u-eget", projectId: P_EGET, belop: 120, kommentar: null, kortId: null, byggeplassId: null, externalCostObjectId: null, expenseCategory: { navn: "Parkering" } },
  { id: "u-annet", projectId: P_ANNET, belop: 80, kommentar: null, kortId: null, byggeplassId: null, externalCostObjectId: null, expenseCategory: { navn: "Bom" } },
];
const VEDLEGG = [
  { id: "v-eget", sheetUtleggId: "u-eget", fileName: "kvittering.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/privat/kvittering.jpg", createdAt: new Date() },
  { id: "v-annet", sheetUtleggId: "u-annet", fileName: "bom.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/privat/bom.jpg", createdAt: new Date() },
];
const SHEET = {
  id: SEDEL,
  organizationId: ORG_A,
  userId: ANSATT,
  status: "sent",
  pauseMin: 30,
  dato: new Date("2026-11-16T00:00:00.000Z"),
  aktivitetId: null,
  byggeplassId: null,
};

function tomtSvar(metode: string): unknown {
  if (metode === "count") return 0;
  if (metode === "findMany" || metode === "groupBy") return [];
  if (metode === "findFirst" || metode === "findUnique") return null;
  return {};
}
function modell(eget: Record<string, unknown> = {}) {
  return new Proxy(eget, { get: (t, k: string) => (k in t ? t[k] : vi.fn(async () => tomtSvar(k))) });
}
type MedIn = { where: { id: { in: string[] } } };

vi.mock("@sitedoc/db", () => {
  const medlemmer = () => [
    { userId: LEDER, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[], ansattnummer: "A-1", avdelingId: null },
    { userId: FADMIN, organizationId: ORG_A, status: "aktiv", firmaRoller: ["firma_admin"], ansattnummer: "A-2", avdelingId: null },
    { userId: ANSATT, organizationId: ORG_A, status: "aktiv", firmaRoller: [] as string[], ansattnummer: "A-3", avdelingId: null },
  ];
  const prisma = new Proxy(
    {
      user: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, role: "user", name: `Navn ${where.id}`, email: `${where.id}@firma.no` })),
        findMany: vi.fn(async ({ where }: MedIn) => where.id.in.map((id) => ({ id, name: `Navn ${id}`, email: `${id}@firma.no` }))),
      }),
      organizationMember: modell({
        findMany: vi.fn(async ({ where }: { where: { userId?: string | { in: string[] } } }) => {
          const u = where.userId;
          return medlemmer().filter((m) => (typeof u === "string" ? m.userId === u : u ? u.in.includes(m.userId) : true));
        }),
        findUnique: vi.fn(async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) => {
          const k = where.userId_organizationId;
          return medlemmer().find((m) => m.userId === k.userId && m.organizationId === k.organizationId) ?? null;
        }),
        findFirst: vi.fn(async ({ where }: { where: { userId: string; organizationId?: string } }) =>
          medlemmer().find((m) => m.userId === where.userId && (!where.organizationId || m.organizationId === where.organizationId)) ?? null,
        ),
      }),
      projectMember: modell({
        findFirst: vi.fn(async ({ where }: { where: { userId: string; projectId: string } }) =>
          where.userId === LEDER && where.projectId === P_EGET ? { role: "member", kanAttestere: true } : null,
        ),
      }),
      project: modell({
        findMany: vi.fn(async ({ where }: MedIn) => PROSJEKTER.filter((p) => where.id.in.includes(p.id))),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => PROSJEKTER.find((p) => p.id === where.id) ?? null),
      }),
      byggeplass: modell({ findMany: vi.fn(async ({ where }: MedIn) => BYGGEPLASSER.filter((b) => where.id.in.includes(b.id))) }),
      externalCostObject: modell({ findMany: vi.fn(async ({ where }: MedIn) => ECO.filter((e) => where.id.in.includes(e.id))) }),
      organizationSetting: modell({
        findMany: vi.fn(async () => [{ organizationId: ORG_A, tillattRedigerVedAttestering: true }]),
        findUnique: vi.fn(async () => ({ tillattRedigerVedAttestering: true, arbeidstidVarselTimer: 13 })),
      }),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
  return { prisma };
});

vi.mock("../../trpc/tilgangskontroll", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("../../trpc/tilgangskontroll")>();
  const { TRPCError } = await import("@trpc/server");
  return {
    ...ekte,
    verifiserProsjektmedlem: vi.fn(async (userId: string, projectId: string) => {
      if (!(TILGANG[userId] ?? []).includes(projectId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du er ikke medlem av dette prosjektet" });
      }
    }),
  };
});
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ dagsnorm: 7.5 }),
}));
vi.mock("../../services/kompetanse/maskinforerbevis", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("../../services/kompetanse/maskinforerbevis")>();
  return {
    ...ekte,
    harGyldigMaskinforerbevis: vi.fn(async () => true),
    harGyldigMaskinforerbevisBatch: vi.fn(async (ider: string[]) => new Map(ider.map((id) => [id, true]))),
  };
});
vi.mock("../../utils/hmac", async (importOriginal) => {
  const ekte = await importOriginal<typeof import("../../utils/hmac")>();
  return {
    ...ekte,
    // Idempotent som den ekte (en signert URL står uendret).
    signerHvisPrivat: (url: string | null | undefined) => (url && !url.includes("sig=") ? `${url}?sig=test` : url),
  };
});

import { prisma } from "@sitedoc/db";
import { dagsseddelRouter } from "./dagsseddel";

const klient = () => new Proxy({}, { get: () => modell() });
function prismaTimer() {
  return new Proxy(
    {
      dailySheet: modell({
        findUnique: vi.fn(async () => SHEET),
        findMany: vi.fn(async () => [{ ...SHEET, timer: TIMER, tillegg: TILLEGG, maskiner: MASKINER, utlegg: UTLEGG }]),
      }),
      // Bare detaljens oppslag pr. sedel; ukeoppslagene (ukeavvik/overtid) får tom uke.
      sheetTimer: modell({ findMany: vi.fn(async ({ where }: { where: { sheetId?: string } }) => (where.sheetId ? TIMER : [])) }),
      sheetTillegg: modell({ findMany: vi.fn(async () => TILLEGG) }),
      sheetMachine: modell({ findMany: vi.fn(async () => MASKINER) }),
      sheetUtlegg: modell({ findMany: vi.fn(async () => UTLEGG) }),
      sheetUtleggVedlegg: modell({
        findMany: vi.fn(async ({ where }: { where: { sheetUtleggId: { in: string[] } } }) =>
          VEDLEGG.filter((v) => where.sheetUtleggId.in.includes(v.sheetUtleggId)),
        ),
      }),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Løs = any;
const kaller = (userId: string) =>
  dagsseddelRouter.createCaller({ userId, prisma, prismaTimer: prismaTimer(), prismaMaskin: klient(), prismaVarelager: klient() } as never);
const detalj = async (userId: string): Promise<Løs> => kaller(userId).hentForAttestering({ id: SEDEL });
const liste = async (userId: string): Promise<Løs> => (await kaller(userId).hentTilAttestering({ projectId: P_EGET }))[0];

const HEMMELIG = /Hemmelig|"999"|H-9|"77"/;
const rad = (s: Løs, liste: "timer" | "tillegg" | "maskiner" | "utlegg", id: string) =>
  s[liste].find((r: Løs) => r.id === id);

describe("d2b-3 — navn på andre prosjekter i attesteringen", () => {
  it("🔴 detaljen: prosjektlederen uten tilgang får ingen navn på prosjekt, underprosjekt eller byggeplass", async () => {
    const s = await detalj(LEDER);
    for (const [l, id] of [["timer", "t-annet"], ["tillegg", "ti-annet"], ["maskiner", "m-annet"]] as const) {
      expect(rad(s, l, id)).toMatchObject({ projectId: P_ANNET, project: null, byggeplassNavn: null, underprosjekt: null });
      expect(rad(s, l, id).byggeplassId).toBe("bp-annet");
    }
    expect(rad(s, "utlegg", "u-annet").project).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(HEMMELIG);
  });

  it("🔴 prosjektlista: samme regel for underprosjekt og byggeplass", async () => {
    const s = await liste(LEDER);
    expect(rad(s, "timer", "t-annet")).toMatchObject({ project: null, byggeplassNavn: null, underprosjekt: null });
    expect(JSON.stringify(s)).not.toMatch(HEMMELIG);
  });

  it("negativkontroll: rader med tilgang beholder navnene", async () => {
    for (const s of [await detalj(LEDER), await liste(LEDER)]) {
      expect(rad(s, "timer", "t-eget")).toMatchObject({
        project: PROSJEKTER[0],
        byggeplassNavn: "Synlig plass",
        underprosjekt: { proAdmId: "11", kortNavn: "Synlig UP", navn: "11 · Synlig UP" },
      });
    }
  });

  it("firma-admin i sedelens firma ser alle navnene, som i firmalista", async () => {
    const s = await detalj(FADMIN);
    expect(rad(s, "timer", "t-annet")).toMatchObject({
      project: PROSJEKTER[1],
      byggeplassNavn: "Hemmelig plass",
      underprosjekt: { navn: "77 · Hemmelig UP" },
    });
    expect(rad(s, "utlegg", "u-annet").project).toEqual(PROSJEKTER[1]);
  });
});

describe("d2b-3 — kvitteringer på utlegg i attesteringen", () => {
  it("bare på rader brukeren kan attestere, med signert URL", async () => {
    for (const s of [await detalj(LEDER), await liste(LEDER)]) {
      expect(rad(s, "utlegg", "u-eget").vedlegg).toEqual([
        { id: "v-eget", fileName: "kvittering.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/privat/kvittering.jpg?sig=test" },
      ]);
      expect(rad(s, "utlegg", "u-annet").vedlegg).toEqual([]);
      expect(JSON.stringify(s)).not.toMatch(/bom\.jpg/);
    }
  });

  it("firma-admin får kvitteringene på alle sedelens utlegg", async () => {
    const s = await detalj(FADMIN);
    expect(rad(s, "utlegg", "u-annet").vedlegg.map((v: Løs) => v.id)).toEqual(["v-annet"]);
  });

  it("ingen usignert /uploads/-sti i svaret", async () => {
    const tekst = JSON.stringify(await detalj(FADMIN));
    expect(tekst.match(/\/uploads\/[^"]*/g)?.every((u) => u.includes("sig="))).toBe(true);
  });
});

describe("d2b-3 — dagsnorm på detaljen", () => {
  it("fra firmaets innstillinger (hentEffektivArbeidstid), og tilleggskravet", async () => {
    const s = await detalj(LEDER);
    expect(s.dagsnorm).toBe(7.5);
    expect(s.tilleggHarKrav).toBe(true);
  });
});
