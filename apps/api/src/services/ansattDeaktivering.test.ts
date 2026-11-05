import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * L3 — deaktivering slår gjennom (ordre 2026-11-05 (6) + svar (6a), spec-fjerning-deaktivering.md).
 *
 * Testene kjører den EKTE tjenesten (ansattDeaktivering.ts → prosjektmedlemskap.ts →
 * flytFjerning.ts) og de ekte prosedyrene (settAnsattStatus, endreFirma, hentMine) mot en
 * liten minne-Prisma som evaluerer `where` slik Prisma gjør — også `periodeSlutt`-filteret
 * og «nøyaktig lik»-sammenligningen på tidspunkt. Fjernes vilkårsfilteret eller blir
 * gjenåpningen «gjenåpne alt», blir testene røde (negativkontrollene i leveransen).
 *
 * Kjør: cd apps/api && npx vitest run src/services/ansattDeaktivering.test.ts
 */

type Rad = Record<string, unknown> & { id: string };

const db = vi.hoisted(() => {
  type R = Record<string, unknown> & { id: string };
  const tabeller: Record<string, R[]> = {};
  let teller = 0;
  const OPERATORER = ["in", "notIn", "not", "some"];

  function lik(verdi: unknown, mot: unknown): boolean {
    if (mot === null) return verdi === null || verdi === undefined;
    if (mot instanceof Date) return verdi instanceof Date && verdi.getTime() === mot.getTime();
    return verdi === mot;
  }

  function match(rad: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([nokkel, betingelse]) => {
      if (nokkel === "NOT") return !match(rad, betingelse as Record<string, unknown>);
      if (nokkel === "OR") return (betingelse as Record<string, unknown>[]).some((b) => match(rad, b));
      if (nokkel === "AND") return (betingelse as Record<string, unknown>[]).every((b) => match(rad, b));
      if (nokkel === "userId_organizationId") return match(rad, betingelse as Record<string, unknown>);
      const verdi = rad[nokkel];
      if (betingelse === null || betingelse instanceof Date || typeof betingelse !== "object") {
        return lik(verdi, betingelse);
      }
      const b = betingelse as Record<string, unknown>;
      if (!Object.keys(b).some((k) => OPERATORER.includes(k))) {
        return verdi !== null && typeof verdi === "object" && match(verdi as Record<string, unknown>, b);
      }
      if ("in" in b && !(b.in as unknown[]).some((x) => lik(verdi, x))) return false;
      if ("notIn" in b && (b.notIn as unknown[]).some((x) => lik(verdi, x))) return false;
      if ("not" in b && lik(verdi, b.not)) return false;
      if ("some" in b && !(verdi as Record<string, unknown>[]).some((r) => match(r, b.some as Record<string, unknown>))) {
        return false;
      }
      return true;
    });
  }

  /** Relasjonene tjenestene leser, slått opp fra tabellene. */
  function berik(tabell: string, rad: R): R {
    const alle = (t: string) => tabeller[t] ?? [];
    if (tabell === "project") {
      return {
        ...rad,
        projectOrganizations: alle("projectOrganization").filter((po) => po.projectId === rad.id),
        members: alle("projectMember").filter((pm) => pm.projectId === rad.id),
      };
    }
    if (tabell === "dokumentflytMedlem") {
      const pm = alle("projectMember").find((p) => p.id === rad.projectMemberId);
      return {
        ...rad,
        projectMember: pm ? { ...pm, user: alle("user").find((u) => u.id === pm.userId) ?? null } : null,
        dokumentflyt: alle("dokumentflyt").find((f) => f.id === rad.dokumentflytId) ?? null,
      };
    }
    if (tabell === "organizationMember") {
      return { ...rad, user: alle("user").find((u) => u.id === rad.userId) ?? null };
    }
    return { ...rad };
  }

  function sorter(rader: R[], orderBy: unknown): R[] {
    const regler = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) =>
      Object.entries(o as Record<string, string>),
    );
    const tall = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === "boolean" ? Number(v) : (v as number));
    return [...rader].sort((a, b) => {
      for (const [felt, retning] of regler) {
        const d = tall(a[felt]) - tall(b[felt]);
        if (d !== 0) return retning === "desc" ? -d : d;
      }
      return 0;
    });
  }

  function modell(tabell: string) {
    const rader = () => (tabeller[tabell] ??= []);
    const finn = (where?: Record<string, unknown>) =>
      rader().map((r) => berik(tabell, r)).filter((r) => match(r, where));
    const opprett = (data: Record<string, unknown>): R => {
      teller += 1;
      const rad = {
        id: `${tabell}-${teller}`,
        periodeSlutt: null,
        createdAt: new Date(Date.now() + teller),
        // Schema-default som prosedyrene lener seg på (upsert i endreFirma setter ikke status).
        ...(tabell === "organizationMember" ? { status: "aktiv" } : {}),
        ...data,
      } as R;
      if (data.payload !== undefined) rad.payload = JSON.parse(JSON.stringify(data.payload));
      rader().push(rad);
      return rad;
    };
    const oppdater = (rad: R, data: Record<string, unknown>) => Object.assign(rad, data);
    const lagret = (id: string) => rader().find((r) => r.id === id);
    return {
      findMany: async (a: { where?: Record<string, unknown>; orderBy?: unknown } = {}) => sorter(finn(a.where), a.orderBy),
      findFirst: async (a: { where?: Record<string, unknown>; orderBy?: unknown } = {}) =>
        sorter(finn(a.where), a.orderBy)[0] ?? null,
      findUnique: async (a: { where: Record<string, unknown> }) => finn(a.where)[0] ?? null,
      findUniqueOrThrow: async (a: { where: Record<string, unknown> }) => {
        const r = finn(a.where)[0];
        if (!r) throw new Error(`${tabell} ikke funnet`);
        return r;
      },
      count: async (a: { where?: Record<string, unknown> } = {}) => finn(a.where).length,
      create: async (a: { data: Record<string, unknown> }) => opprett(a.data),
      update: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const r = finn(a.where)[0];
        if (!r) throw new Error(`${tabell} ikke funnet`);
        return oppdater(lagret(r.id)!, a.data);
      },
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const treff = finn(a.where);
        for (const r of treff) oppdater(lagret(r.id)!, a.data);
        return { count: treff.length };
      },
      upsert: async (a: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const r = finn(a.where)[0];
        return r ? oppdater(lagret(r.id)!, a.update) : opprett(a.create);
      },
      delete: async (a: { where: Record<string, unknown> }) => {
        const r = finn(a.where)[0]!;
        tabeller[tabell] = rader().filter((x) => x.id !== r.id);
        return r;
      },
    };
  }

  const navn = [
    "user", "organization", "organizationMember", "project", "projectOrganization", "projectMember",
    "dokumentflyt", "dokumentflytMedlem", "faggruppeKobling", "projectGroupMember", "checklist", "task", "activity",
  ];
  const klient: Record<string, unknown> = Object.fromEntries(navn.map((n) => [n, modell(n)]));
  klient.$transaction = (cb: (tx: unknown) => unknown) => cb(klient);
  return {
    klient,
    tabeller,
    nullstill(data: Record<string, R[]>) {
      for (const n of navn) tabeller[n] = (data[n] ?? []).map((r) => ({ ...r }));
    },
  };
});

vi.mock("@sitedoc/db", () => ({ prisma: db.klient, Prisma: {} }));
vi.mock("../services/epost", () => ({ sendInvitasjonsEpost: vi.fn() }));
vi.mock("../services/firmamodul", () => ({ hentAktiveFirmamoduler: vi.fn() }));
vi.mock("../services/autoProsjektAdmin", () => ({ autoLeggFirmaAdmins: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({
  provisjonerProsjektmedlemskap: vi.fn(),
  provisjonerNyAnsattIProsjekter: vi.fn(),
}));
vi.mock("../services/prosjektSeed", () => ({ seedStandardProsjektoppsett: vi.fn() }));
vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import type { Prisma } from "@sitedoc/db";
import { avsluttMedlemskapForPerson, forhandsvisDeaktivering, gjenapneMedlemskapFraPayload } from "./ansattDeaktivering";
import { organisasjonRouter } from "../routes/organisasjon";
import { medlemRouter } from "../routes/medlem";
import { prosjektRouter } from "../routes/prosjekt";

const tx = db.klient as unknown as Prisma.TransactionClient;

// Personer
const U = "a0000000-0000-4000-8000-000000000001"; // den som deaktiveres
const K = "a0000000-0000-4000-8000-000000000002"; // kollega i samme ledd
const ADMIN = "a0000000-0000-4000-8000-000000000003";
// Firmaer
const X = "b0000000-0000-4000-8000-00000000000a";
const Y = "b0000000-0000-4000-8000-00000000000b";
const Z = "b0000000-0000-4000-8000-00000000000c";
// Prosjekter
const P_X = "c0000000-0000-4000-8000-000000000001"; // X eier
const P_EKSTERN = "c0000000-0000-4000-8000-000000000002"; // Z eier, X er ProjectOrganization (B5)
const P_ANNET = "c0000000-0000-4000-8000-000000000003"; // Z eier, X deltar ikke
const P_XY = "c0000000-0000-4000-8000-000000000004"; // X eier, Y deltaker
const P_Y = "c0000000-0000-4000-8000-000000000005"; // Y eier, X deltaker
// Prosjektmedlemmer
const PM_U_X = "d0000000-0000-4000-8000-000000000001";
const PM_U_EKSTERN = "d0000000-0000-4000-8000-000000000002";
const PM_U_ANNET = "d0000000-0000-4000-8000-000000000003";
const PM_K_X = "d0000000-0000-4000-8000-000000000004";

const ANSATT_X = new Date("2024-01-01");
const MANUELT_AVSLUTTET = new Date("2024-06-01");

function pm(id: string, userId: string, projectId: string, createdAt = new Date("2024-02-01")): Rad {
  return { id, userId, projectId, role: "member", createdAt, periodeSlutt: null };
}
function om(id: string, organizationId: string, createdAt: Date, status = "aktiv"): Rad {
  return { id, userId: U, organizationId, status, createdAt };
}
function flytmedlem(id: string, dokumentflytId: string, projectMemberId: string, erHovedansvarlig = false): Rad {
  return {
    id, dokumentflytId, projectMemberId, rolle: "mottaker", steg: 1, groupId: null,
    erHovedansvarlig, hovedansvarligPersonId: null, periodeSlutt: null, createdAt: new Date("2024-02-01"),
  };
}
function prosjekt(id: string, name: string, eier: string): Rad {
  return { id, name, primaryOrganizationId: eier, status: "active", type: "kunde", updatedAt: new Date("2024-01-01") };
}

/**
 * Grunnverden: U er ansatt i X. I P_X står U i to flyter — F_DELT (sammen med K) og F_ALENE.
 * U har ballen på ett dokument i hver. U er også med i P_EKSTERN (X er deltaker) og P_ANNET
 * (X deltar ikke). Faggruppe- og gruppekobling i P_X, og én flytrad avsluttet manuelt før.
 */
function grunnverden(ekstra: Partial<Record<string, Rad[]>> = {}) {
  const basis: Record<string, Rad[]> = {
    user: [
      { id: U, name: "Ulla", email: "u@x.no", role: "user" },
      { id: K, name: "Kari", email: "k@x.no", role: "user" },
      { id: ADMIN, name: "Admin", email: "a@x.no", role: "user" },
    ],
    organization: [
      { id: X, name: "X AS", erKunde: true },
      { id: Y, name: "Y AS", erKunde: false },
      { id: Z, name: "Z AS", erKunde: false },
    ],
    organizationMember: [om("om-x", X, ANSATT_X)],
    project: [prosjekt(P_X, "X-prosjekt", X), prosjekt(P_EKSTERN, "Eksternt", Z), prosjekt(P_ANNET, "Annet", Z)],
    projectOrganization: [{ id: "po-1", projectId: P_EKSTERN, organizationId: X }],
    projectMember: [pm(PM_U_X, U, P_X), pm(PM_U_EKSTERN, U, P_EKSTERN), pm(PM_U_ANNET, U, P_ANNET), pm(PM_K_X, K, P_X)],
    dokumentflyt: [
      { id: "f-delt", name: "Delt flyt", projectId: P_X },
      { id: "f-alene", name: "Alene-flyt", projectId: P_X },
    ],
    dokumentflytMedlem: [
      flytmedlem("fm-u-delt", "f-delt", PM_U_X, true),
      flytmedlem("fm-k-delt", "f-delt", PM_K_X),
      flytmedlem("fm-u-alene", "f-alene", PM_U_X),
      { ...flytmedlem("fm-u-gammel", "f-delt", PM_U_X), steg: 2, periodeSlutt: MANUELT_AVSLUTTET },
    ],
    faggruppeKobling: [{ id: "fk-u", projectMemberId: PM_U_X, faggruppeId: "fg-1", periodeSlutt: null }],
    projectGroupMember: [{ id: "gm-u", projectMemberId: PM_U_X, groupId: "g-1", periodeSlutt: null }],
    checklist: [
      { id: "s-delt", dokumentflytId: "f-delt", recipientUserId: U, recipientGroupId: null, status: "sent", deletedAt: null },
      { id: "s-alene", dokumentflytId: "f-alene", recipientUserId: U, recipientGroupId: null, status: "sent", deletedAt: null },
    ],
  };
  const data: Record<string, Rad[]> = { ...basis };
  for (const [t, rader] of Object.entries(ekstra)) data[t] = [...(basis[t] ?? []), ...(rader ?? [])];
  db.nullstill(data);
}

const rad = (tabell: string, id: string) => db.tabeller[tabell]!.find((r) => r.id === id)!;
const slutt = (tabell: string, id: string) => rad(tabell, id).periodeSlutt as Date | null;

function caller<T extends { createCaller: (ctx: never) => unknown }>(r: T, userId = ADMIN) {
  return r.createCaller({
    userId,
    tokenKilde: null,
    sessionToken: null,
    ipAddress: null,
    userAgent: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: db.klient,
  } as never) as ReturnType<T["createCaller"]>;
}
const deaktiver = (userId = U) =>
  caller(organisasjonRouter).settAnsattStatus({ userId, organizationId: X, aktiv: false });
const reaktiver = (userId = U) =>
  caller(organisasjonRouter).settAnsattStatus({ userId, organizationId: X, aktiv: true });
const sisteActivity = (action: string) =>
  [...db.tabeller.activity!].reverse().find((a) => a.action === action)!;

beforeEach(() => grunnverden());

describe("L3 — deaktiver i X", () => {
  it("deaktiver i X → N rader avsluttet + payload riktig", async () => {
    await deaktiver();

    expect(rad("organizationMember", "om-x").status).toBe("deaktivert");
    const naa = slutt("projectMember", PM_U_X);
    expect(naa).toBeInstanceOf(Date);
    // Alle koblinger i P_X avsluttet med samme tidspunkt.
    for (const [t, id] of [
      ["projectMember", PM_U_EKSTERN], ["dokumentflytMedlem", "fm-u-delt"], ["dokumentflytMedlem", "fm-u-alene"],
      ["faggruppeKobling", "fk-u"], ["projectGroupMember", "gm-u"],
    ] as const) {
      expect(slutt(t, id)?.getTime(), `${t}/${id}`).toBe(naa!.getTime());
    }
    // Prosjekt X ikke deltar i, kollegaen og den manuelt avsluttede raden er urørt.
    expect(slutt("projectMember", PM_U_ANNET)).toBeNull();
    expect(slutt("projectMember", PM_K_X)).toBeNull();
    expect(slutt("dokumentflytMedlem", "fm-u-gammel")).toEqual(MANUELT_AVSLUTTET);

    const a = sisteActivity("ansatt_deaktivert");
    expect(a).toMatchObject({ targetType: "organization_member", targetId: "om-x", organizationId: X, actorUserId: ADMIN });
    const payload = a.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      targetUserId: U,
      organizationId: X,
      avsluttetVed: naa!.toISOString(),
      targetNavn: "Ulla",
      hoppetOver: [],
    });
    // M5: alle koblinger som avsluttes er navngitt.
    expect([...(payload.projectMemberIder as string[])].sort()).toEqual([PM_U_X, PM_U_EKSTERN].sort());
    expect([...(payload.flytMedlemIder as string[])].sort()).toEqual(["fm-u-alene", "fm-u-delt"]);
    expect(payload.faggruppeKoblingIder).toEqual(["fk-u"]);
    expect(payload.gruppeMedlemIder).toEqual(["gm-u"]);
  });

  it("ekstern (B5): X er ProjectOrganization i Z sitt prosjekt → avsluttet", async () => {
    await deaktiver();
    expect(slutt("projectMember", PM_U_EKSTERN)).not.toBeNull();
    expect(slutt("projectMember", PM_U_ANNET)).toBeNull();
  });

  it("ballen flyttes til første aktive i leddet, eller blir null når leddet er tomt", async () => {
    await deaktiver();
    expect(rad("checklist", "s-delt").recipientUserId).toBe(K);
    expect(rad("checklist", "s-alene").recipientUserId).toBeNull();
    expect(rad("dokumentflytMedlem", "fm-k-delt").erHovedansvarlig).toBe(true);

    const payload = sisteActivity("ansatt_deaktivert").payload as { prosjekter: Array<{ dokumentflytter: unknown[] }> };
    const flytter = payload.prosjekter.flatMap((p) => p.dokumentflytter);
    expect(flytter).toContainEqual({ id: "f-delt", medlemId: "fm-u-delt", nyHovedansvarligPmId: PM_K_X, dokumentIder: ["s-delt"] });
    expect(flytter).toContainEqual({ id: "f-alene", medlemId: "fm-u-alene", nyHovedansvarligPmId: null, dokumentIder: ["s-alene"] });
  });
});

describe("L3 — reaktiver i X", () => {
  it("reaktiver i X → nøyaktig de samme radene gjenåpnet; en rad avsluttet manuelt før deaktivering står", async () => {
    await deaktiver();
    await reaktiver();

    expect(rad("organizationMember", "om-x").status).toBe("aktiv");
    for (const [t, id] of [
      ["projectMember", PM_U_X], ["projectMember", PM_U_EKSTERN], ["dokumentflytMedlem", "fm-u-delt"],
      ["dokumentflytMedlem", "fm-u-alene"], ["faggruppeKobling", "fk-u"], ["projectGroupMember", "gm-u"],
    ] as const) {
      expect(slutt(t, id), `${t}/${id}`).toBeNull();
    }
    expect(slutt("dokumentflytMedlem", "fm-u-gammel")).toEqual(MANUELT_AVSLUTTET);
    expect(sisteActivity("ansatt_aktivert").payload).toMatchObject({
      gjenapnet: expect.arrayContaining([P_X, P_EKSTERN]),
      hoppetOver: [],
    });
  });

  it("reaktivering der én payload-rad er endret i mellomtiden → den raden står urørt", async () => {
    await deaktiver();
    // Prosjektadmin la U inn igjen i P_EKSTERN og fjernet U på nytt senere.
    const senere = new Date(Date.now() + 60_000);
    rad("projectMember", PM_U_EKSTERN).periodeSlutt = senere;
    // Og noen fjernet en av flytradene i P_X på nytt med eget tidspunkt.
    rad("dokumentflytMedlem", "fm-u-alene").periodeSlutt = senere;

    await reaktiver();

    expect(slutt("projectMember", PM_U_X)).toBeNull();
    expect(slutt("projectMember", PM_U_EKSTERN)).toEqual(senere);
    expect(slutt("dokumentflytMedlem", "fm-u-alene")).toEqual(senere);
    expect(slutt("dokumentflytMedlem", "fm-u-delt")).toBeNull();
    expect(sisteActivity("ansatt_aktivert").payload).toMatchObject({
      hoppetOver: [{ projectId: P_EKSTERN, grunn: "endret_siden" }],
    });
  });

  it("eldre deaktivering uten L3-payload → ingenting gjenåpnes, ingen feil", async () => {
    rad("organizationMember", "om-x").status = "deaktivert";
    db.tabeller.activity!.push({
      id: "gammel", targetType: "organization_member", targetId: "om-x", action: "ansatt_deaktivert",
      payload: { targetUserId: U }, createdAt: new Date("2025-01-01"),
    });
    rad("projectMember", PM_U_X).periodeSlutt = MANUELT_AVSLUTTET;
    await reaktiver();
    expect(slutt("projectMember", PM_U_X)).toEqual(MANUELT_AVSLUTTET);
  });
});

describe("L3 — Kenneths vilkår", () => {
  it("Vilkår 1: deaktiver i X → ansatt i Y → lagt til i Y-prosjekt → reaktiver og deaktiver i X igjen → Y-raden er urørt", async () => {
    await deaktiver();
    // Ansatt i Y (ny e-post-uavhengig bruker = samme person) og lagt til i Y sitt prosjekt, der X også deltar.
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date(Date.now() - 1000)));
    db.tabeller.project!.push(prosjekt(P_Y, "Y-prosjekt", Y));
    db.tabeller.projectOrganization!.push({ id: "po-y", projectId: P_Y, organizationId: X });
    db.tabeller.projectMember!.push(pm("pm-u-y", U, P_Y, new Date()));

    await reaktiver();
    expect(slutt("projectMember", "pm-u-y")).toBeNull();
    await deaktiver();

    expect(slutt("projectMember", "pm-u-y")).toBeNull();
    // Den gamle X-raden (fra før Y) avsluttes som vanlig.
    expect(slutt("projectMember", PM_U_X)).not.toBeNull();
    expect(sisteActivity("ansatt_deaktivert").payload).toMatchObject({
      hoppetOver: [{ projectId: P_Y, grunn: "annet_firma_deltar" }],
    });
  });

  it("Vilkår 2: firmabytte via endreFirma X→Y → rader i prosjekter der Y er eier eller deltaker, er urørte", async () => {
    db.tabeller.project!.push(prosjekt(P_XY, "X+Y", X), prosjekt(P_Y, "Y-eid", Y));
    db.tabeller.projectOrganization!.push(
      { id: "po-xy", projectId: P_XY, organizationId: Y },
      { id: "po-yx", projectId: P_Y, organizationId: X },
    );
    db.tabeller.projectMember!.push(pm("pm-u-xy", U, P_XY), pm("pm-u-yeid", U, P_Y));

    await caller(medlemRouter).endreFirma({
      projectId: P_X, projectMemberId: PM_U_X, fraOrganizationId: X, tilOrganizationId: Y, modus: "firmabytte",
    });

    expect(rad("organizationMember", "om-x").status).toBe("deaktivert");
    expect(slutt("projectMember", "pm-u-xy")).toBeNull();
    expect(slutt("projectMember", "pm-u-yeid")).toBeNull();
    expect(slutt("projectMember", PM_U_X)).not.toBeNull();
    const a = sisteActivity("ansatt_deaktivert");
    expect(a).toMatchObject({ targetId: "om-x", organizationId: X, projectId: P_X });
    expect(a.payload).toMatchObject({
      aarsak: "firmabytte",
      tilOrganizationId: Y,
      hoppetOver: expect.arrayContaining([
        { projectId: P_XY, grunn: "annet_firma_deltar" },
        { projectId: P_Y, grunn: "annet_firma_deltar" },
      ]),
    });
  });

  it("Vilkår 3: X-prosjekt der Y også er deltaker, og personen er aktiv i Y → raden er urørt", async () => {
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date("2023-01-01")));
    db.tabeller.projectOrganization!.push({ id: "po-xy", projectId: P_X, organizationId: Y });

    await deaktiver();

    expect(slutt("projectMember", PM_U_X)).toBeNull();
    expect(slutt("dokumentflytMedlem", "fm-u-delt")).toBeNull();
    expect(rad("checklist", "s-delt").recipientUserId).toBe(U);
    expect(slutt("projectMember", PM_U_EKSTERN)).not.toBeNull();
  });

  it("(b) Y nyere enn X: rad opprettet etter ansettelsen i Y står urørt", async () => {
    const ansattY = new Date("2025-06-01");
    db.tabeller.organizationMember!.push(om("om-y", Y, ansattY));
    rad("projectMember", PM_U_X).createdAt = new Date("2025-07-01");

    await deaktiver();

    expect(slutt("projectMember", PM_U_X)).toBeNull();
    expect(slutt("projectMember", PM_U_EKSTERN)).not.toBeNull(); // opprettet 2024-02, før Y
    expect(sisteActivity("ansatt_deaktivert").payload).toMatchObject({
      hoppetOver: [{ projectId: P_X, grunn: "opprettet_etter_nytt_firma" }],
    });
  });

  it("multi-firma der Y er eldre enn X: X-raden avsluttes", async () => {
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date("2023-01-01")));
    rad("projectMember", PM_U_X).createdAt = new Date("2025-07-01");

    await deaktiver();

    expect(slutt("projectMember", PM_U_X)).not.toBeNull();
  });

  it("reaktivering vurderer (a) på nytt: Y ble deltaker i prosjektet i mellomtiden → raden røres ikke", async () => {
    await deaktiver();
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date()));
    db.tabeller.projectOrganization!.push({ id: "po-xy", projectId: P_X, organizationId: Y });
    const avsluttet = slutt("projectMember", PM_U_X);

    await reaktiver();

    expect(slutt("projectMember", PM_U_X)).toEqual(avsluttet);
    expect(slutt("projectMember", PM_U_EKSTERN)).toBeNull();
  });
});

describe("L3 — forhåndsvisning og lister", () => {
  it("forhandsvisDeaktivering viser berørte prosjekter, flytledd, ledd der personen er alene og hvorfor rader hoppes over", async () => {
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date("2023-01-01")));
    db.tabeller.projectOrganization!.push({ id: "po-y-ekstern", projectId: P_EKSTERN, organizationId: Y });

    const svar = await forhandsvisDeaktivering(tx, { userId: U, organizationId: X });

    expect(svar.prosjekter).toEqual([{ id: P_X, navn: "X-prosjekt" }]);
    expect(svar.antallFlytledd).toBe(2);
    expect(svar.alene).toEqual([{ prosjektNavn: "X-prosjekt", flytNavn: "Alene-flyt", rolle: "mottaker" }]);
    expect(svar.hoppetOver).toEqual([{ id: P_EKSTERN, navn: "Eksternt", grunn: "annet_firma_deltar" }]);
    // Forhåndsvisningen skriver ingenting.
    expect(slutt("projectMember", PM_U_X)).toBeNull();
  });

  it("hentMine utelater prosjektet etter deaktivering", async () => {
    const mine = () => caller(prosjektRouter, U).hentMine();
    expect((await mine()).map((p) => p.id).sort()).toEqual([P_X, P_EKSTERN, P_ANNET].sort());

    await deaktiver();

    // P_X: X eier og raden er avsluttet. P_EKSTERN: raden avsluttet. P_ANNET: urørt.
    expect((await mine()).map((p) => p.id)).toEqual([P_ANNET]);
  });

  it("hentMine utelater X-eid prosjekt selv når raden er skånet (status er porten)", async () => {
    db.tabeller.organizationMember!.push(om("om-y", Y, new Date("2023-01-01")));
    db.tabeller.projectOrganization!.push({ id: "po-xy", projectId: P_X, organizationId: Y });

    await deaktiver();

    expect(slutt("projectMember", PM_U_X)).toBeNull();
    expect((await caller(prosjektRouter, U).hentMine()).map((p) => p.id)).not.toContain(P_X);
  });
});

describe("L3 — tjenesten direkte", () => {
  it("avslutt + gjenåpne med samme payload er symmetrisk", async () => {
    const naa = new Date("2026-11-05T10:00:00Z");
    const payload = await avsluttMedlemskapForPerson(tx, { userId: U, organizationId: X }, naa);
    expect(payload.avsluttetVed).toBe(naa.toISOString());
    expect(slutt("faggruppeKobling", "fk-u")).toEqual(naa);

    const svar = await gjenapneMedlemskapFraPayload(tx, payload);
    expect([...svar.gjenapnet].sort()).toEqual([P_X, P_EKSTERN].sort());
    expect(slutt("faggruppeKobling", "fk-u")).toBeNull();
    expect(slutt("projectGroupMember", "gm-u")).toBeNull();
  });
});

describe("M3 — restdokumenter hos personen går til innsender", () => {
  const E = "a0000000-0000-4000-8000-000000000004"; // tidligere innsender, ute av prosjektet
  const iX = { template: { projectId: P_X } };
  /** U har ballen utenom en personflyt: tre sjekklister uten flyt og én oppgave på et faggruppe-ledd. */
  function restverden() {
    grunnverden({
      user: [{ id: E, name: "Eva", email: "e@x.no", role: "user" }],
      projectMember: [{ ...pm("pm-e-x", E, P_X), periodeSlutt: MANUELT_AVSLUTTET }],
      checklist: [
        { id: "s-fri", dokumentflytId: null, recipientUserId: U, bestillerUserId: K, status: "sent", deletedAt: null, ...iX },
        { id: "s-egen", dokumentflytId: null, recipientUserId: U, bestillerUserId: U, status: "sent", deletedAt: null, ...iX },
        { id: "s-ex", dokumentflytId: null, recipientUserId: U, bestillerUserId: E, status: "sent", deletedAt: null, ...iX },
        { id: "s-lukket", dokumentflytId: null, recipientUserId: U, bestillerUserId: K, status: "closed", deletedAt: null, ...iX },
        { id: "s-annet", dokumentflytId: null, recipientUserId: U, bestillerUserId: K, status: "sent", deletedAt: null, template: { projectId: P_ANNET } },
      ],
      task: [
        { id: "t-ledd", dokumentflytId: "f-faggruppe", recipientUserId: U, bestillerUserId: K, status: "sent", deletedAt: null, bestillerFaggruppe: { projectId: P_X } },
      ],
    });
    // Flytdokumentene ligger også i prosjektet — B7 flytter dem, M3 skal ikke telle dem.
    Object.assign(rad("checklist", "s-delt"), { bestillerUserId: K, ...iX });
    Object.assign(rad("checklist", "s-alene"), { bestillerUserId: K, ...iX });
  }
  const mottaker = (tabell: string, id: string) => rad(tabell, id).recipientUserId;
  const fjernU = () => caller(medlemRouter).fjern({ id: PM_U_X, projectId: P_X });

  it("🔴 uten flyt → innsender; innsender er personen selv → null; innsender er ute av prosjektet → null", async () => {
    restverden();
    await fjernU();
    expect(mottaker("checklist", "s-fri")).toBe(K);
    expect(mottaker("task", "t-ledd")).toBe(K);
    expect(mottaker("checklist", "s-egen")).toBeNull();
    expect(mottaker("checklist", "s-ex")).toBeNull();
  });

  it("lukkede dokumenter og dokumenter i andre prosjekter røres ikke", async () => {
    restverden();
    await fjernU();
    expect(mottaker("checklist", "s-lukket")).toBe(U);
    expect(mottaker("checklist", "s-annet")).toBe(U);
  });

  it("Activity-payload bærer hvilke dokumenter som gikk til innsender og hvilke som står uten mottaker", async () => {
    restverden();
    await fjernU();
    expect(sisteActivity("prosjektmedlem_avsluttet").payload).toMatchObject({
      mottaker: { tilInnsender: ["s-fri", "t-ledd"], utenMottaker: ["s-egen", "s-ex"] },
    });
    restverden();
    await deaktiver();
    const p = sisteActivity("ansatt_deaktivert").payload as { prosjekter: Array<{ projectId: string; mottaker?: unknown }> };
    expect(p.prosjekter.find((x) => x.projectId === P_X)!.mottaker).toEqual({
      tilInnsender: ["s-fri", "t-ledd"],
      utenMottaker: ["s-egen", "s-ex"],
    });
  });

  it("🔴 forhåndsvisningen teller dokumentene som går til innsender — ikke flytdokumentene B7 flytter", async () => {
    restverden();
    const svar = await forhandsvisDeaktivering(tx, { userId: U, organizationId: X });
    expect(svar.antallTilInnsender).toBe(4); // s-fri, s-egen, s-ex, t-ledd
    expect(mottaker("checklist", "s-fri")).toBe(U); // forhåndsvisningen skriver ingenting
  });

  it("🔴 e-post: varsling på dokumentene etter avslutningen når aldri det tidligere medlemmet", async () => {
    restverden();
    await fjernU();
    const { hentMottakerEposter } = await vi.importActual<typeof import("./epost")>("./epost");
    const klient = db.klient as unknown as Parameters<typeof hentMottakerEposter>[0];
    for (const [tabell, id] of [["checklist", "s-fri"], ["checklist", "s-egen"], ["checklist", "s-ex"], ["task", "t-ledd"]]) {
      const eposter = await hentMottakerEposter(klient, {
        recipientUserId: mottaker(tabell!, id!) as string | null,
        ekskluderUserId: ADMIN,
      });
      expect(eposter).not.toContain("u@x.no");
    }
  });
});
