import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * H1 + H3 (ordre H1–H3, Kenneth 2026-11-08): timer- og lønnsdata er firmaets egne.
 * Firma B er invitert inn på A sitt prosjekt. A sin leder/admin skal verken se eller
 * attestere B sine sedler (timer, lønnsart, prissnapshot); B sin firma-admin attesterer
 * B sine egne rader på A sitt prosjekt. Navn og e-post deles fortsatt (kontaktinfo).
 *
 * Ekte tilgangskontroll mot mocket kjerne-DB i minnet — rollene avgjøres av de samme
 * reglene som i prod (firmaRoller, status, ProjectMember.kanAttestere/role).
 *
 * Rød først: mot `origin/develop` 47a0875e (før fiksen) feiler de 11 første 🔴-merkede; negativkontroller
 * og vakt-testen er grønne begge veier. RETUR 1 (Kontrollør 2026-11-08) la til én 🔴 per grønn mutant
 * (M5, M7, M8, M10, M11, M13) — hver rød mot sin mutant, grønn med fiksen.
 */

const ORG_A = "a0000000-0000-0000-0000-000000000001";
const ORG_B = "b0000000-0000-0000-0000-000000000001";
const PROSJEKT_A = "a0000000-0000-0000-0000-0000000000aa";
const PROSJEKT_X = "c0000000-0000-0000-0000-0000000000cc"; // tilhører verken A eller B

const LEDER_A = "leder-a"; // ansatt i A, kanAttestere på PROSJEKT_A
const ADMIN_A = "admin-a"; // firma-admin i A (prosjekteier), ikke prosjektmedlem
const ADMIN_B = "admin-b"; // firma-admin i B, ikke prosjektmedlem
const LEDER_B = "leder-b"; // ansatt i B, prosjektadmin på PROSJEKT_A (gjest)
const ANSATT_A = "ansatt-a";
const ANSATT_B = "ansatt-b";
const LEDER_SLUTTET = "leder-sluttet"; // deaktivert i A, men fortsatt kanAttestere på PROSJEKT_A
const DOBBEL = "dobbel"; // ansatt i både A og B, med ulikt ansattnummer

const SEDEL_A = "5ede1000-0000-0000-0000-00000000000a";
const SEDEL_B = "5ede1000-0000-0000-0000-00000000000b";
const RAD_A = "4ad00000-0000-0000-0000-00000000000a";
const RAD_B = "4ad00000-0000-0000-0000-00000000000b";
const SEDEL_DOBBEL = "5ede1000-0000-0000-0000-00000000000d";

type Medlem = { userId: string; organizationId: string; status: string; firmaRoller: string[]; ansattnummer: string | null };
const ORG_MEDLEMMER: Medlem[] = [
  { userId: LEDER_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [], ansattnummer: "A-1" },
  { userId: ADMIN_A, organizationId: ORG_A, status: "aktiv", firmaRoller: ["firma_admin"], ansattnummer: "A-2" },
  { userId: ANSATT_A, organizationId: ORG_A, status: "aktiv", firmaRoller: [], ansattnummer: "A-3" },
  { userId: ADMIN_B, organizationId: ORG_B, status: "aktiv", firmaRoller: ["firma_admin"], ansattnummer: "B-1" },
  { userId: LEDER_B, organizationId: ORG_B, status: "aktiv", firmaRoller: [], ansattnummer: "B-2" },
  { userId: ANSATT_B, organizationId: ORG_B, status: "aktiv", firmaRoller: [], ansattnummer: "B-7" },
  { userId: LEDER_SLUTTET, organizationId: ORG_A, status: "deaktivert", firmaRoller: [], ansattnummer: "A-8" },
  // B-nummeret står sist: et oppslag på tvers av firma som nøkles på userId alene ender på B-9.
  { userId: DOBBEL, organizationId: ORG_A, status: "aktiv", firmaRoller: [], ansattnummer: "A-9" },
  { userId: DOBBEL, organizationId: ORG_B, status: "aktiv", firmaRoller: [], ansattnummer: "B-9" },
];
const PROSJEKT_MEDLEMMER = [
  { userId: LEDER_A, projectId: PROSJEKT_A, role: "member", kanAttestere: true },
  { userId: LEDER_B, projectId: PROSJEKT_A, role: "admin", kanAttestere: false },
  { userId: LEDER_SLUTTET, projectId: PROSJEKT_A, role: "member", kanAttestere: true },
];

const SEDLER = [
  { id: SEDEL_A, organizationId: ORG_A, userId: ANSATT_A, status: "sent", dato: new Date("2026-11-02"), aktivitetId: null },
  { id: SEDEL_B, organizationId: ORG_B, userId: ANSATT_B, status: "sent", dato: new Date("2026-11-02"), aktivitetId: null },
];
const TIMER_RADER = [
  { id: RAD_A, sheetId: SEDEL_A, projectId: PROSJEKT_A, timer: 7.5, attestertStatus: "pending" },
  { id: RAD_B, sheetId: SEDEL_B, projectId: PROSJEKT_A, timer: 7.5, attestertStatus: "pending" },
].map((r) => ({
  ...r,
  lonnsart: { id: "l", kode: "100", navn: "Ordinær", type: "timer", prisMotKunde: null, internkostnad: null, sats: null, satsEnhet: "time" },
  aktivitet: { id: "akt", kode: "A", navn: "Arbeid" },
}));

// Matcher et Prisma-filter enkelt: verdi, { in: [...] } eller { not: ... }.
function treff(verdi: unknown, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (filter && typeof filter === "object") {
    const f = filter as { in?: unknown[]; not?: unknown };
    if (f.in) return f.in.includes(verdi);
    if ("not" in f) return verdi !== f.not;
    return true; // relasjonsfilter (timer.some) — alle radene ligger på PROSJEKT_A
  }
  return verdi === filter;
}
function filtrer<T extends Record<string, unknown>>(rader: T[], where: Record<string, unknown> = {}): T[] {
  return rader.filter((r) => Object.entries(where).every(([k, f]) => (k in r ? treff(r[k], f) : true)));
}

// Ukjente modell-metoder svarer tomt så stiene etter auth kan løpe: oppslag → null,
// lister → [], count → 0, skriving → {}.
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

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

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
        findUnique: vi.fn(async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) =>
          ORG_MEDLEMMER.find(
            (m) => m.userId === where.userId_organizationId.userId && m.organizationId === where.userId_organizationId.organizationId,
          ) ?? null,
        ),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => filtrer(ORG_MEDLEMMER, where)),
      }),
      projectMember: modell({
        findFirst: vi.fn(async ({ where }: { where: { userId: string; projectId: string } }) =>
          PROSJEKT_MEDLEMMER.find((m) => m.userId === where.userId && m.projectId === where.projectId) ?? null,
        ),
      }),
      project: modell({
        findUnique: vi.fn(async () => ({ primaryOrganizationId: ORG_A })),
        findMany: vi.fn(async () => [{ id: PROSJEKT_A, name: "A-bygg", projectNumber: "1", internalProjectNumber: null }]),
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
    // PROSJEKT_A tilhører A (eier) og B (deltaker); PROSJEKT_X ingen av dem.
    verifiserProsjekterTilhørerFirma: vi.fn(async (ider: string[]) => {
      if (ider.some((id) => id !== PROSJEKT_A)) throw new TRPCError({ code: "FORBIDDEN", message: "fremmed prosjekt" });
    }),
  };
});
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ dagsnorm: 7.5 }),
}));

import { prisma } from "@sitedoc/db";
import { dagsseddelRouter } from "./dagsseddel";
import { rapportRouter } from "./rapport";

function lagPrismaTimer() {
  return new Proxy(
    {
      dailySheet: modell({
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
          filtrer(SEDLER, where).map((s) => ({ ...s, timer: [], tillegg: [], maskiner: [], utlegg: [] })),
        ),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const s = SEDLER.find((x) => x.id === where.id);
          return s ? { ...s, timer: TIMER_RADER.filter((r) => r.sheetId === s.id) } : null;
        }),
        groupBy: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
          filtrer(SEDLER, where).map((s) => ({ userId: s.userId, _count: { _all: 1 } })),
        ),
      }),
      sheetTimer: modell({
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => TIMER_RADER.find((r) => r.id === where.id) ?? null),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => filtrer(TIMER_RADER, where)),
      }),
      tillegg: modell({ findFirst: vi.fn(async () => ({ id: "t" })) }),
      expenseCategory: modell({ findFirst: vi.fn(async () => ({ id: "k", ordning: "utlegg" })) }),
      prosjektOrdningOverstyring: modell({ findFirst: vi.fn(async () => null) }),
      sheetTillegg: modell({ findMany: vi.fn(async () => []), create: mocks.create }),
      sheetUtlegg: modell({ create: mocks.create }),
      $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    } as Record<string, unknown>,
    { get: (t, k: string) => (k in t ? t[k] : modell()) },
  );
}

function kaller(userId: string) {
  const ctx = { userId, prisma, prismaTimer: lagPrismaTimer() } as never;
  return { dagsseddel: dagsseddelRouter.createCaller(ctx), rapport: rapportRouter.createCaller(ctx) };
}
const kun = (radIder: string[]) => ({ radIder: { timerIder: radIder, tilleggIder: [], maskinIder: [] } });
const FIRMAGRENSE = "Timer attesteres av firmaet den ansatte jobber for";

beforeEach(() => mocks.create.mockClear());

describe("H1 — lister følger sedelens firma", () => {
  it("🔴 A-leder ser ikke B sin sedel i prosjektets attesteringsliste", async () => {
    const sedler = await kaller(LEDER_A).dagsseddel.hentTilAttestering({ projectId: PROSJEKT_A });
    expect(sedler.map((s) => s.id)).toEqual([SEDEL_A]);
  });

  it("🔴 A-firma-admin ser ikke B sin sedel i firmavisningen", async () => {
    const sedler = await kaller(ADMIN_A).dagsseddel.hentTilAttesteringFirma({ organizationId: ORG_A });
    expect(sedler.map((s) => s.id)).toEqual([SEDEL_A]);
  });

  it("🔴 B-firma-admin ser B sin sedel på A sitt prosjekt — og ikke A sine", async () => {
    const sedler = await kaller(ADMIN_B).dagsseddel.hentTilAttesteringFirma({ organizationId: ORG_B });
    expect(sedler.map((s) => s.id)).toEqual([SEDEL_B]);
  });

  it("vakt: ansattnummer hentes fra sedelens firma, navn og e-post vises", async () => {
    const [sedel] = await kaller(LEDER_A).dagsseddel.hentTilAttestering({ projectId: PROSJEKT_A });
    expect(sedel?.ansatt).toEqual({ id: ANSATT_A, name: `Navn ${ANSATT_A}`, email: `${ANSATT_A}@firma.no`, ansattnummer: "A-3" });
  });
});

describe("H1 — attestering krever rett i sedelens firma", () => {
  it("🔴 A-leder kan ikke attestere, returnere eller åpne B sin sedel", async () => {
    const { dagsseddel } = kaller(LEDER_A);
    await expect(dagsseddel.attesterRader(kun([RAD_B]))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dagsseddel.returnerRader({ ...kun([RAD_B]), kommentar: "nei" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dagsseddel.returner({ id: SEDEL_B, kommentar: "nei" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dagsseddel.hentForAttestering({ id: SEDEL_B })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 A-firma-admin (prosjekteier) kan ikke attestere B sin rad", async () => {
    await expect(kaller(ADMIN_A).dagsseddel.attesterRader(kun([RAD_B]))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 gjest-prosjektadmin fra B kan ikke attestere A sin rad", async () => {
    await expect(kaller(LEDER_B).dagsseddel.attesterRader(kun([RAD_A]))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 blandet utvalg (egen + fremmed rad) avvises i sin helhet", async () => {
    await expect(kaller(LEDER_A).dagsseddel.attesterRader(kun([RAD_A, RAD_B]))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 B-firma-admin attesterer B sin egen rad på A sitt prosjekt", async () => {
    await expect(kaller(ADMIN_B).dagsseddel.attesterRader(kun([RAD_B]))).resolves.toMatchObject({ antallAttestert: 1 });
  });

  // Meldingen (ikke bare FORBIDDEN) sikrer at avvisningen kommer fra firmagrensen.
  it("🔴 A-leder kan ikke gjenåpne B sin godkjente sedel (M10)", async () => {
    SEDLER[1]!.status = "accepted";
    try {
      await expect(kaller(LEDER_A).dagsseddel.gjenaapneAttestering({ sheetId: SEDEL_B })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: FIRMAGRENSE,
      });
    } finally {
      SEDLER[1]!.status = "sent";
    }
  });

  it("🔴 A-leder kan ikke flytte ECO på B sin rad (M11)", async () => {
    await expect(
      kaller(LEDER_A).dagsseddel.flyttTimerRadEco({ timerRadId: RAD_B, externalCostObjectId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: FIRMAGRENSE });
  });

  it("🔴 A-leder kan ikke attestere B sin sedel via det gamle endepunktet (M13)", async () => {
    await expect(kaller(LEDER_A).dagsseddel.attester({ id: SEDEL_B } as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: FIRMAGRENSE,
    });
  });

  it("🔴 deaktivert leder med kanAttestere kan ikke attestere i det gamle firmaet (M5)", async () => {
    await expect(kaller(LEDER_SLUTTET).dagsseddel.attesterRader(kun([RAD_A]))).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: FIRMAGRENSE,
    });
  });

  it("negativkontroll: A-leder med kanAttestere attesterer fortsatt A sin rad", async () => {
    await expect(kaller(LEDER_A).dagsseddel.attesterRader(kun([RAD_A]))).resolves.toMatchObject({ antallAttestert: 1 });
  });

  it("negativkontroll: A-firma-admin attesterer fortsatt A sin rad", async () => {
    await expect(kaller(ADMIN_A).dagsseddel.attesterRader(kun([RAD_A]))).resolves.toMatchObject({ antallAttestert: 1 });
  });
});

describe("Ansattnummer på tvers av firma (H2 utgått — kontaktinfo deles)", () => {
  it("🔴 A-admin får B sin ansatt med navn og e-post, men uten B sitt ansattnummer", async () => {
    const ansatte = await kaller(ADMIN_A).rapport.hentFirmaAnsatteMedTimer({ organizationId: ORG_A });
    expect(ansatte.find((a) => a.id === ANSATT_B)).toEqual({
      id: ANSATT_B,
      name: `Navn ${ANSATT_B}`,
      email: `${ANSATT_B}@firma.no`,
      ansattnummer: null,
    });
    expect(ansatte.find((a) => a.id === ANSATT_A)?.ansattnummer).toBe("A-3");
  });
});

describe("Ansattnummer for ansatt i to firma følger sedelens firma", () => {
  beforeEach(() => {
    SEDLER.push({ id: SEDEL_DOBBEL, organizationId: ORG_A, userId: DOBBEL, status: "sent", dato: new Date("2026-11-02"), aktivitetId: null });
    return () => {
      SEDLER.pop();
    };
  });

  it("🔴 attesteringslista viser A-nummeret på A-sedelen (M7)", async () => {
    const sedler = await kaller(LEDER_A).dagsseddel.hentTilAttestering({ projectId: PROSJEKT_A });
    expect(sedler.find((s) => s.id === SEDEL_DOBBEL)?.ansatt?.ansattnummer).toBe("A-9");
  });

  it("🔴 A sin ansattoversikt viser A-nummeret (M8)", async () => {
    const ansatte = await kaller(ADMIN_A).rapport.hentFirmaAnsatteMedTimer({ organizationId: ORG_A });
    expect(ansatte.find((a) => a.id === DOBBEL)?.ansattnummer).toBe("A-9");
  });
});

describe("H3 — tillegg og utlegg holdes innenfor firmaets prosjekter", () => {
  // Radene legges på arbeiderens egen kladd.
  beforeEach(() => {
    SEDLER[0]!.status = "draft";
    return () => {
      SEDLER[0]!.status = "sent";
    };
  });
  const sedelKladd = () => kaller(ANSATT_A).dagsseddel;

  it("🔴 tilfoyTilleggRad mot fremmed prosjekt avvises uten å skrive", async () => {
    await expect(
      sedelKladd().tilfoyTilleggRad({ sheetId: SEDEL_A, projectId: PROSJEKT_X, tilleggId: RAD_A, antall: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("🔴 tilfoyUtleggRad mot fremmed prosjekt avvises uten å skrive", async () => {
    await expect(
      sedelKladd().tilfoyUtleggRad({ sheetId: SEDEL_A, projectId: PROSJEKT_X, expenseCategoryId: RAD_A, belop: 100 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("negativkontroll: tillegg og utlegg på eget firmas prosjekt skrives", async () => {
    const d = sedelKladd();
    await d.tilfoyTilleggRad({ sheetId: SEDEL_A, projectId: PROSJEKT_A, tilleggId: RAD_A, antall: 1 });
    await d.tilfoyUtleggRad({ sheetId: SEDEL_A, projectId: PROSJEKT_A, expenseCategoryId: RAD_A, belop: 100 });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});
