import { describe, it, expect, vi } from "vitest";

/**
 * w10b (plan web-timeføring § 4.10 del D): kravene fra prosjektlista (ordre d2b-2, R13) bæres nå
 * av firmalista `hentTilAttesteringFirma` med prosjektleder-omfang (§ 4.6). Prosjektlederen
 * attesterer på P_EGET og ser sedlene med rader der:
 *  1. firmagrensen: lederen i A ser ikke B sin sedel;
 *  2. feltene tabellen trenger (prosjekt pr. rad, utlegg med kort, dagsnorm, krav);
 *  3. rader på andre prosjekter røper ikke navn eller nummer uten tilgang til prosjektet;
 *  4. `redigerTillatt` og `manglerMaskinforerbevis` følger sedelens firma.
 *
 * Tilgang til prosjekt avgjøres av `verifiserProsjektmedlem` (mocket her til en fast tabell);
 * omfanget (`attesteringsOmfang`) og firmagrensen løper ekte mot mocket kjerne-DB.
 */

const ORG_A = "a0000000-0000-0000-0000-000000000001";
const ORG_B = "b0000000-0000-0000-0000-000000000001";
const P_EGET = "a0000000-0000-0000-0000-0000000000aa"; // prosjektet som attesteres
const P_ANNET = "a0000000-0000-0000-0000-0000000000bb"; // annet prosjekt, lederen har ikke tilgang
const P_DELT = "a0000000-0000-0000-0000-0000000000cc"; // annet prosjekt, lederen har tilgang

const LEDER = "leder-a";
const ANSATT = "ansatt-a";
const ANSATT_B = "ansatt-b";
const SEDEL = "5ede1000-0000-0000-0000-00000000000a";
const SEDEL_B = "5ede1000-0000-0000-0000-00000000000b";

const PROSJEKTER = [
  { id: P_EGET, name: "Eget bygg", projectNumber: "100", internalProjectNumber: "E-1" },
  { id: P_ANNET, name: "Hemmelig bygg", projectNumber: "999", internalProjectNumber: "H-9" },
  { id: P_DELT, name: "Delt bygg", projectNumber: "200", internalProjectNumber: null },
];
const TILGANG: Record<string, string[]> = { [LEDER]: [P_EGET, P_DELT] };

const lonnsart = { type: "ordinaer", fravaerNormtak: null, navn: "Timelønn" };
const timerRad = (id: string, projectId: string, timer: number) => ({
  id,
  sheetId: SEDEL,
  projectId,
  timer,
  erReise: false,
  kortId: `kort-${projectId}`,
  attestertStatus: "pending",
  lonnsart,
});
const SEDLER = [
  {
    id: SEDEL,
    organizationId: ORG_A,
    userId: ANSATT,
    status: "sent",
    pauseMin: 30,
    dato: new Date("2026-11-16T00:00:00.000Z"),
    aktivitetId: null,
    timer: [timerRad("t-eget", P_EGET, 4), timerRad("t-annet", P_ANNET, 2), timerRad("t-delt", P_DELT, 1.5)],
    tillegg: [{ id: "ti-annet", sheetId: SEDEL, projectId: P_ANNET, kortId: null, attestertStatus: "pending" }],
    maskiner: [
      { id: "m-annet", sheetId: SEDEL, projectId: P_ANNET, vehicleId: "v1", sheetTimerId: "t-annet", kortId: `kort-${P_ANNET}`, attestertStatus: "pending" },
    ],
    utlegg: [
      { id: "u-eget", projectId: P_EGET, belop: 120, kortId: null, byggeplassId: null, externalCostObjectId: null, expenseCategory: { navn: "Parkering" } },
      { id: "u-annet", projectId: P_ANNET, belop: 80, kortId: null, byggeplassId: null, externalCostObjectId: null, expenseCategory: { navn: "Bom" } },
    ],
  },
  {
    id: SEDEL_B,
    organizationId: ORG_B,
    userId: ANSATT_B,
    status: "sent",
    pauseMin: 0,
    dato: new Date("2026-11-16T00:00:00.000Z"),
    aktivitetId: null,
    timer: [{ ...timerRad("t-b", P_EGET, 7.5), sheetId: SEDEL_B }],
    tillegg: [],
    maskiner: [],
    utlegg: [],
  },
];

function tomtSvar(metode: string): unknown {
  if (metode === "count") return 0;
  if (metode === "findMany" || metode === "groupBy") return [];
  if (metode === "findFirst" || metode === "findUnique") return null;
  return {};
}
function modell(eget: Record<string, unknown> = {}) {
  return new Proxy(eget, { get: (t, k: string) => (k in t ? t[k] : vi.fn(async () => tomtSvar(k))) });
}

vi.mock("@sitedoc/db", () => {
  const prisma = new Proxy(
    {
      user: modell({
        findUnique: vi.fn(async () => ({ role: "user" })),
        findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id, name: `Navn ${id}`, email: `${id}@firma.no` })),
        ),
      }),
      organizationMember: modell({
        // Omfanget: LEDER er aktiv ansatt i A uten firma-admin.
        findUnique: vi.fn(async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) => {
          const { userId, organizationId } = where.userId_organizationId;
          return userId === LEDER && organizationId === ORG_A ? { status: "aktiv", firmaRoller: [] } : null;
        }),
        findMany: vi.fn(async ({ where }: { where: { userId?: string | { in: string[] } } }) => {
          const alle = [
            { userId: LEDER, organizationId: ORG_A, status: "aktiv", firmaRoller: [], ansattnummer: "A-1", avdelingId: null },
            { userId: ANSATT, organizationId: ORG_A, status: "aktiv", firmaRoller: [], ansattnummer: "A-3", avdelingId: "avd-1" },
            { userId: ANSATT_B, organizationId: ORG_B, status: "aktiv", firmaRoller: [], ansattnummer: "B-7", avdelingId: null },
          ];
          const u = where.userId;
          return alle.filter((m) => (typeof u === "string" ? m.userId === u : u ? u.in.includes(m.userId) : true));
        }),
      }),
      projectMember: modell({
        findFirst: vi.fn(async ({ where }: { where: { userId: string; projectId: string } }) =>
          where.userId === LEDER && where.projectId === P_EGET ? { role: "member", kanAttestere: true } : null,
        ),
        // Omfanget: prosjektene der LEDER kan attestere.
        findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
          where.userId === LEDER ? [{ projectId: P_EGET }] : [],
        ),
      }),
      project: modell({
        findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          PROSJEKTER.filter((p) => where.id.in.includes(p.id)),
        ),
      }),
      organizationSetting: modell({
        findUnique: vi.fn(async ({ where }: { where: { organizationId: string } }) =>
          where.organizationId === ORG_A
            ? { dagsnorm: 7.5, tillattRedigerVedAttestering: true, tidsrundingMinutter: null }
            : null,
        ),
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
    // ANSATT mangler bevis i ORG_A.
    harGyldigMaskinforerbevisBatch: vi.fn(async (ider: string[]) => new Map(ider.map((id) => [id, false]))),
  };
});

import { prisma } from "@sitedoc/db";
import { dagsseddelRouter } from "./dagsseddel";

const klient = () => new Proxy({}, { get: () => modell() });
function prismaTimer() {
  return new Proxy(
    {
      dailySheet: modell({
        findMany: vi.fn(async ({ where }: { where: { organizationId?: string } }) =>
          SEDLER.filter((s) => !where.organizationId || where.organizationId === s.organizationId),
        ),
      }),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Løs = any;
async function liste(userId = LEDER): Promise<Løs[]> {
  const ctx = { userId, prisma, prismaTimer: prismaTimer(), prismaMaskin: klient(), prismaVarelager: klient() } as never;
  return (await dagsseddelRouter.createCaller(ctx).hentTilAttesteringFirma({ organizationId: ORG_A })) as Løs[];
}

describe("w10b — firmalista med prosjektleder-omfang (krav fra d2b-2 R13)", () => {
  it("firmagrensen: lederen i A ser ikke B sin sedel", async () => {
    expect((await liste()).map((s) => s.id)).toEqual([SEDEL]);
  });

  it("feltene tabellen trenger", async () => {
    const [s] = await liste();
    const ansatt = { id: ANSATT, name: `Navn ${ANSATT}`, email: `${ANSATT}@firma.no`, ansattnummer: "A-3", avdelingId: "avd-1" };
    expect(s.ansatt).toEqual(ansatt);
    expect(s).toMatchObject({
      id: SEDEL,
      status: "sent",
      pauseMin: 30,
      totaltimer: 7.5,
      antallRader: 4,
      fravaerKanAttesteres: false,
      fravaerNormtakBrudd: null,
      varer: [],
      ukeAvvikRadIder: [],
      ansatt,
      mineProsjektIder: [P_EGET],
    });
    expect(s.timer.map((r: Løs) => r.id)).toEqual(["t-eget", "t-annet", "t-delt"]);
    expect(s.maskiner.map((r: Løs) => r.id)).toEqual(["m-annet"]);
  });

  it("utlegg med kort, dagsnorm, tilleggskrav, sedelens prosjekt", async () => {
    const [s] = await liste();
    expect(s.utlegg.map((u: Løs) => u.id)).toEqual(["u-eget", "u-annet"]);
    expect(s.utlegg.every((u: Løs) => "kortId" in u)).toBe(true);
    expect(s.dagsnorm).toBe(7.5);
    expect(s.tilleggHarKrav).toBe(true);
    expect(s.prosjekt).toMatchObject({ id: P_EGET, name: "Eget bygg" });
  });

  it("🔴 rader på prosjekt uten tilgang røper ikke navn eller nummer", async () => {
    const [s] = await liste();
    const rad = (id: string) => s.timer.find((r: Løs) => r.id === id);
    expect(rad("t-annet").projectId).toBe(P_ANNET);
    expect(rad("t-annet").project).toBeNull();
    expect(s.tillegg[0].project).toBeNull();
    expect(s.maskiner[0].project).toBeNull();
    expect(s.utlegg.find((u: Løs) => u.id === "u-annet").project).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/Hemmelig bygg|"999"|H-9/);
  });

  it("negativkontroll: eget prosjekt og prosjekt med tilgang har navn og nummer", async () => {
    const [s] = await liste();
    const rad = (id: string) => s.timer.find((r: Løs) => r.id === id);
    expect(rad("t-eget").project).toEqual(PROSJEKTER[0]);
    expect(rad("t-delt").project).toEqual(PROSJEKTER[2]);
    expect(s.utlegg.find((u: Løs) => u.id === "u-eget").project).toEqual(PROSJEKTER[0]);
  });

  it("redigerTillatt og manglerMaskinforerbevis følger sedelens firma", async () => {
    const [s] = await liste();
    expect(s.redigerTillatt).toBe(true);
    expect(s.manglerMaskinforerbevis).toBe(true);
  });
});
