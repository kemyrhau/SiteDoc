import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * POST 2026-11-15 (12) D: oppmøtested med perioder — firmagrense og vakter.
 * Kjører UTEN DB (mocket prisma), samme mønster som oppmotested-avstand.test.ts.
 *
 *  - Firmaisolasjon: ansatt/oppmøtested/prosjekt i annet firma → NOT_FOUND,
 *    ingenting skrives; ikke-medlem får ikke lese egne perioder i firma B.
 *  - Ansatt kan IKKE overskrive et eksisterende fast sted (FORBIDDEN).
 *  - Nytt fast sted lukker det forrige (tilDato = ny fraDato − 1).
 *  - Overlapp avvises (CONFLICT), ingenting skrives.
 *  - Ett aktivt kontor → fast sted settes automatisk; to → trengerValg.
 *  - Sletting av oppmøtested i bruk → «I bruk — deaktiver i stedet».
 */

const m = vi.hoisted(() => ({
  medlemFindUnique: vi.fn(),
  medlemFindFirst: vi.fn(),
  stedFindFirst: vi.fn(),
  stedFindMany: vi.fn(),
  stedDelete: vi.fn(),
  prosjektFindFirst: vi.fn(),
  periodeFindMany: vi.fn(),
  periodeFindFirst: vi.fn(),
  periodeCreate: vi.fn(),
  periodeUpdate: vi.fn(),
  periodeDelete: vi.fn(),
  userFindMany: vi.fn(),
  admin: vi.fn(),
}));

const prismaMock = vi.hoisted(() => {
  const p: Record<string, unknown> = {
    organizationMember: {
      findUnique: (...a: unknown[]) => m.medlemFindUnique(...a),
      findFirst: (...a: unknown[]) => m.medlemFindFirst(...a),
    },
    oppmotested: {
      findFirst: (...a: unknown[]) => m.stedFindFirst(...a),
      findMany: (...a: unknown[]) => m.stedFindMany(...a),
      delete: (...a: unknown[]) => m.stedDelete(...a),
    },
    project: { findFirst: (...a: unknown[]) => m.prosjektFindFirst(...a) },
    oppmotePeriode: {
      findMany: (...a: unknown[]) => m.periodeFindMany(...a),
      findFirst: (...a: unknown[]) => m.periodeFindFirst(...a),
      create: (...a: unknown[]) => m.periodeCreate(...a),
      update: (...a: unknown[]) => m.periodeUpdate(...a),
      delete: (...a: unknown[]) => m.periodeDelete(...a),
    },
    user: { findMany: (...a: unknown[]) => m.userFindMany(...a) },
  };
  p.$transaction = (fn: (tx: unknown) => unknown) => fn(p);
  return p;
});

const PrismaFeil = vi.hoisted(
  () =>
    class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.code = code;
      }
    },
);

vi.mock("@sitedoc/db", () => ({
  prisma: prismaMock,
  Prisma: { PrismaClientKnownRequestError: PrismaFeil },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: (...a: unknown[]) => m.admin(...a),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/rute-service", () => ({ geokodAdresse: vi.fn(), sokAdresser: vi.fn() }));
vi.mock("../services/reisetidMatrise", () => ({
  MANUELL_KILDE: "manuell",
  recomputeMatrise: vi.fn(),
  recomputeMatriseIBakgrunn: vi.fn(),
}));

import { oppmotePeriodeRouter, dagenFor } from "./oppmotePeriode";
import { oppmotestedRouter } from "./oppmotested";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "99999999-9999-9999-9999-999999999999";
const MEDLEM = "22222222-2222-2222-2222-222222222222";
const NARVIK = "33333333-3333-3333-3333-333333333333";
const RAMSUND = "44444444-4444-4444-4444-444444444444";
const PROSJEKT = "55555555-5555-5555-5555-555555555555";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = { userId: "u1", prisma: prismaMock } as any;
const caller = () => oppmotePeriodeRouter.createCaller(ctx);

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rad = (o: Partial<Record<string, unknown>>) => ({
  id: "p-ny",
  type: "kontor",
  fast: true,
  oppmotestedId: NARVIK,
  projectId: null,
  fraDato: d("2026-01-01"),
  tilDato: null,
  ...o,
});

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.admin.mockResolvedValue(undefined);
  m.medlemFindUnique.mockResolvedValue({ id: MEDLEM, status: "aktiv", createdAt: d("2026-03-10") });
  m.medlemFindFirst.mockResolvedValue({ id: MEDLEM });
  m.stedFindFirst.mockResolvedValue({ id: NARVIK });
  m.stedFindMany.mockResolvedValue([{ id: NARVIK }, { id: RAMSUND }]);
  m.prosjektFindFirst.mockResolvedValue({ id: PROSJEKT });
  m.periodeFindMany.mockResolvedValue([]);
  m.periodeFindFirst.mockResolvedValue(null);
  m.periodeCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => rad(a.data));
  m.periodeUpdate.mockResolvedValue({});
  m.periodeDelete.mockResolvedValue({});
  m.userFindMany.mockResolvedValue([]);
});

describe("dagenFor", () => {
  it("krysser måned og år", () => {
    expect(dagenFor("2027-01-01")).toBe("2026-12-31");
    expect(dagenFor("2026-03-01")).toBe("2026-02-28");
  });
});

describe("hentMine", () => {
  it("ikke-medlem i firma B → FORBIDDEN, leser ingenting", async () => {
    m.medlemFindUnique.mockResolvedValue(null);
    await expect(caller().hentMine({ organizationId: ORG_B })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.periodeFindMany).not.toHaveBeenCalled();
  });

  it("deaktivert medlem → FORBIDDEN", async () => {
    m.medlemFindUnique.mockResolvedValue({ id: MEDLEM, status: "deaktivert", createdAt: d("2026-03-10") });
    await expect(caller().hentMine({ organizationId: ORG_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("filtrerer på eget medlemskap OG firma", async () => {
    await caller().hentMine({ organizationId: ORG_A });
    expect(m.periodeFindMany.mock.calls[0]![0]).toMatchObject({
      where: { organizationMemberId: MEDLEM, organizationId: ORG_A },
    });
  });

  it("to kontorer, ingen fast → trengerValg, ingen automatisk innsetting", async () => {
    const r = await caller().hentMine({ organizationId: ORG_A });
    expect(r.trengerValg).toBe(true);
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("ett kontor, ingen fast → settes automatisk med fraDato = medlemskapets dato", async () => {
    m.stedFindMany.mockResolvedValue([{ id: NARVIK }]);
    m.periodeFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([rad({ fraDato: d("2026-03-10") })]);
    const r = await caller().hentMine({ organizationId: ORG_A });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({
      fast: true,
      oppmotestedId: NARVIK,
      fraDato: d("2026-03-10"),
      organizationMemberId: MEDLEM,
      organizationId: ORG_A,
    });
    expect(r.perioder[0]).toMatchObject({ fast: true, oppmotestedId: NARVIK, fraDato: "2026-03-10" });
    expect(r.trengerValg).toBe(false);
  });

  it("ett kontor, samtidig kall (unik-brudd) → idempotent, ingen feil", async () => {
    m.stedFindMany.mockResolvedValue([{ id: NARVIK }]);
    m.periodeCreate.mockRejectedValue(new PrismaFeil("P2002"));
    await expect(caller().hentMine({ organizationId: ORG_A })).resolves.toBeTruthy();
  });
});

describe("settMittFaste", () => {
  it("første gang → fast sted med fraDato = medlemskapets dato", async () => {
    await caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({
      fast: true,
      oppmotestedId: NARVIK,
      fraDato: d("2026-03-10"),
    });
  });

  it("finnes et fast sted fra før → FORBIDDEN, ingenting skrives (negativkontroll)", async () => {
    m.periodeFindFirst.mockResolvedValue({ id: "eksisterende" });
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: RAMSUND })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("kappløp (unik-brudd) → også FORBIDDEN", async () => {
    m.periodeCreate.mockRejectedValue(new PrismaFeil("P2002"));
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("oppmøtested i annet firma → NOT_FOUND", async () => {
    m.stedFindFirst.mockResolvedValue(null);
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(m.stedFindFirst.mock.calls[0]![0]).toMatchObject({ where: { organizationId: ORG_A, aktiv: true } });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
});

const FAST_INPUT = {
  organizationId: ORG_A,
  organizationMemberId: MEDLEM,
  type: "kontor" as const,
  fast: true,
  oppmotestedId: RAMSUND,
  fraDato: "2026-09-01",
};

describe("opprett (firmaadmin)", () => {
  it("ikke admin i firmaet → FORBIDDEN, ingenting skrives", async () => {
    m.admin.mockRejectedValue(Object.assign(new Error("x"), { code: "FORBIDDEN" }));
    await expect(caller().opprett(FAST_INPUT)).rejects.toBeTruthy();
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("ansatt i annet firma → NOT_FOUND, ingenting skrives", async () => {
    m.medlemFindFirst.mockResolvedValue(null);
    await expect(caller().opprett(FAST_INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.medlemFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: MEDLEM, organizationId: ORG_A } });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("oppmøtested i annet firma → NOT_FOUND", async () => {
    m.stedFindFirst.mockResolvedValue(null);
    await expect(caller().opprett(FAST_INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("prosjekt i annet firma → NOT_FOUND", async () => {
    m.prosjektFindFirst.mockResolvedValue(null);
    await expect(
      caller().opprett({ ...FAST_INPUT, type: "byggeplass", fast: false, oppmotestedId: null, projectId: PROSJEKT, tilDato: "2026-10-01" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.prosjektFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: PROSJEKT, primaryOrganizationId: ORG_A },
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("nytt fast sted lukker det forrige (tilDato = fraDato − 1)", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "narvik-fast" })]);
    await caller().opprett(FAST_INPUT);
    expect(m.periodeUpdate).toHaveBeenCalledWith({ where: { id: "narvik-fast" }, data: { tilDato: d("2026-08-31") } });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({ fast: true, oppmotestedId: RAMSUND, sattAvUserId: "u1" });
  });

  it("midlertidig rører ikke det faste stedet", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "narvik-fast" })]);
    await caller().opprett({ ...FAST_INPUT, fast: false, tilDato: "2026-09-30" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeCreate).toHaveBeenCalled();
  });

  it("overlappende midlertidig → CONFLICT, ingenting skrives", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "m1", fast: false, fraDato: d("2026-09-15"), tilDato: d("2026-10-15") })]);
    await expect(caller().opprett({ ...FAST_INPUT, fast: false, tilDato: "2026-09-30" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("midlertidig uten sluttdato avvises av Zod", async () => {
    await expect(caller().opprett({ ...FAST_INPUT, fast: false })).rejects.toBeTruthy();
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
});

describe("oppdater / slett (firmaadmin)", () => {
  it("periode i annet firma → NOT_FOUND (filtrerer på organizationId)", async () => {
    await expect(
      caller().oppdater({ id: MEDLEM, organizationId: ORG_A, fraDato: "2026-09-01", tilDato: "2026-09-30" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: MEDLEM, organizationId: ORG_A } });
    await expect(caller().slett({ id: MEDLEM, organizationId: ORG_A })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  it("fast sted kan ikke oppdateres direkte", async () => {
    m.periodeFindFirst.mockResolvedValue({ ...rad({}), organizationMemberId: MEDLEM });
    await expect(
      caller().oppdater({ id: MEDLEM, organizationId: ORG_A, fraDato: "2026-09-01" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("slett gjeldende fast → forrige faste gjenåpnes", async () => {
    m.periodeFindFirst
      .mockResolvedValueOnce({ ...rad({ id: "ramsund", oppmotestedId: RAMSUND, fraDato: d("2026-09-01") }), organizationMemberId: MEDLEM })
      .mockResolvedValueOnce({ id: "narvik" });
    await caller().slett({ id: MEDLEM, organizationId: ORG_A });
    expect(m.periodeFindFirst.mock.calls[1]![0]).toMatchObject({ where: { fast: true, tilDato: d("2026-08-31") } });
    expect(m.periodeUpdate).toHaveBeenCalledWith({ where: { id: "narvik" }, data: { tilDato: null } });
  });
});

const IKKE_ADMIN = () => m.admin.mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Ikke firmaadmin" }));
const MIDL = { ...rad({ id: "m1", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-09-01"), tilDato: d("2026-09-30") }), organizationMemberId: MEDLEM };
const ENDRE = { id: MEDLEM, organizationId: ORG_A, fraDato: "2026-09-05", tilDato: "2026-09-20" };

describe("regel 10 — gate POST (29) A", () => {
  it("hentForFirma: vanlig ansatt → FORBIDDEN, leser ingenting", async () => {
    IKKE_ADMIN();
    await expect(caller().hentForFirma({ organizationId: ORG_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.admin).toHaveBeenCalledWith("u1", ORG_A);
    expect(m.periodeFindMany).not.toHaveBeenCalled();
  });

  it("hentForFirma: filtrerer på eget firma — annet firmas perioder returneres aldri", async () => {
    const annet = { ...rad({ id: "fra-b" }), organizationMemberId: "b", sattAvUserId: "u9", sattVed: d("2026-01-01"), oppmotested: null, project: null };
    const eget = { ...rad({ id: "fra-a" }), organizationMemberId: MEDLEM, sattAvUserId: "u1", sattVed: d("2026-01-01"), oppmotested: null, project: null };
    // Mocken etterligner DB-en: rader filtreres på where.organizationId.
    m.periodeFindMany.mockImplementation(async (a: { where: { organizationId?: string } }) =>
      [
        { ...eget, organizationId: ORG_A },
        { ...annet, organizationId: ORG_B },
      ].filter((r) => r.organizationId === a.where.organizationId),
    );
    const r = await caller().hentForFirma({ organizationId: ORG_A });
    expect(r.map((x) => x.id)).toEqual(["fra-a"]);
  });

  it("oppdater: vanlig ansatt → FORBIDDEN, ingenting skrives", async () => {
    IKKE_ADMIN();
    m.periodeFindFirst.mockResolvedValue(MIDL);
    await expect(caller().oppdater(ENDRE)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });

  it("slett: vanlig ansatt → FORBIDDEN, ingenting slettes", async () => {
    IKKE_ADMIN();
    m.periodeFindFirst.mockResolvedValue(MIDL);
    await expect(caller().slett({ id: MEDLEM, organizationId: ORG_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  it("oppdater: overlapp med annen midlertidig → CONFLICT, ingenting skrives", async () => {
    m.periodeFindFirst.mockResolvedValue(MIDL);
    m.periodeFindMany.mockResolvedValue([rad({ id: "m2", fast: false, fraDato: d("2026-09-15"), tilDato: d("2026-10-15") })]);
    await expect(caller().oppdater(ENDRE)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });

  it("oppdater: oppmøtested i annet firma → NOT_FOUND, ingenting skrives", async () => {
    m.periodeFindFirst.mockResolvedValue(MIDL);
    m.stedFindFirst.mockResolvedValue(null);
    await expect(caller().oppdater({ ...ENDRE, oppmotestedId: NARVIK })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.stedFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: NARVIK, organizationId: ORG_A } });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });

  it("oppdater: prosjekt i annet firma → NOT_FOUND, ingenting skrives", async () => {
    m.periodeFindFirst.mockResolvedValue({ ...MIDL, type: "byggeplass", oppmotestedId: null, projectId: PROSJEKT });
    m.prosjektFindFirst.mockResolvedValue(null);
    await expect(caller().oppdater({ ...ENDRE, projectId: PROSJEKT })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.prosjektFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: PROSJEKT, primaryOrganizationId: ORG_A } });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });
});

describe("slett lukket fast sted — gate POST (29) B", () => {
  it("lukket fast (tilDato satt) → BAD_REQUEST med i18n-nøkkel, ingenting slettes", async () => {
    m.periodeFindFirst.mockResolvedValue({ ...rad({ id: "a2", tilDato: d("2026-08-31") }), organizationMemberId: MEDLEM });
    await expect(caller().slett({ id: MEDLEM, organizationId: ORG_A })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "firma.ansatte.oppmote.feil.lukketFast",
    });
    expect(m.periodeDelete).not.toHaveBeenCalled();
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });

  it("midlertidig med tilDato kan fortsatt slettes", async () => {
    m.periodeFindFirst.mockResolvedValue(MIDL);
    await caller().slett({ id: MEDLEM, organizationId: ORG_A });
    expect(m.periodeDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

describe("opprett — kappløp om fast sted", () => {
  it("unik-brudd (P2002) → CONFLICT, ikke 500", async () => {
    m.periodeCreate.mockRejectedValue(new PrismaFeil("P2002"));
    await expect(caller().opprett(FAST_INPUT)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("oppmotested.slett — i bruk", () => {
  it("FK Restrict (P2003) → CONFLICT «I bruk — deaktiver i stedet»", async () => {
    m.stedDelete.mockRejectedValue(new PrismaFeil("P2003"));
    await expect(
      oppmotestedRouter.createCaller(ctx).slett({ id: NARVIK, organizationId: ORG_A }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "I bruk — deaktiver i stedet" });
  });
});

// ── POST 2026-11-15 (13) del B — overforing (reise-kortet) ──────────────────
describe("overforing (del B)", () => {
  const ID = "66666666-6666-6666-6666-666666666666";
  const TROMSO = "77777777-7777-7777-7777-777777777777";
  const fastNarvik = rad({ id: "p-fast", fast: true, oppmotestedId: NARVIK, kilde: "admin" });
  const apenOvf = (o: Partial<Record<string, unknown>> = {}) =>
    rad({ id: "p-ovf", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-11-10"), kilde: "overforing", ...o });
  const start = (o: Partial<Record<string, unknown>> = {}) =>
    caller().overforing({ id: ID, organizationId: ORG_A, handling: "start", oppmotestedId: TROMSO, dato: "2026-11-15", ...o });
  const slutt = (dato = "2026-11-20") =>
    caller().overforing({ id: ID, organizationId: ORG_A, handling: "slutt", dato });

  beforeEach(() => {
    m.stedFindFirst.mockResolvedValue({ id: TROMSO });
    m.periodeFindMany.mockResolvedValue([fastNarvik]);
  });

  it("start: oppretter åpen kontor-periode, fast=false, kilde='overforing', klient-id, eget medlem", async () => {
    const r = await start();
    expect(r.utfall).toBe("opprettet");
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({
      id: ID,
      organizationId: ORG_A,
      organizationMemberId: MEDLEM,
      type: "kontor",
      fast: false,
      oppmotestedId: TROMSO,
      tilDato: null,
      kilde: "overforing",
    });
    expect(m.stedFindFirst.mock.calls[0]![0].where).toMatchObject({ id: TROMSO, organizationId: ORG_A, aktiv: true });
  });

  it("🔴 (i) fremmed firma → FORBIDDEN, ingen rad", async () => {
    m.medlemFindUnique.mockResolvedValue(null);
    await expect(start({ organizationId: ORG_B })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });

  it("🔴 (ii) kontor i annet firma (eller inaktivt) → NOT_FOUND, ingen rad", async () => {
    m.stedFindFirst.mockResolvedValue(null);
    await expect(start()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("🔴 (iii) slutt leser KUN eget medlemskap — en annen ansatts periode røres ikke", async () => {
    // DB-en (mocket) svarer kun med det som matcher where; annen ansatts åpne
    // overføring finnes, men spørringen er låst til eget medlem → ingen endring.
    m.periodeFindMany.mockImplementation(async (a: { where: { organizationMemberId: string } }) =>
      a.where.organizationMemberId === MEDLEM ? [fastNarvik] : [apenOvf({ id: "annen" })],
    );
    const r = await slutt();
    expect(r.utfall).toBe("ingen");
    expect(m.periodeFindMany.mock.calls[0]![0].where).toMatchObject({ organizationMemberId: MEDLEM, organizationId: ORG_A });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  it("🔴 (iv) slutt på admin-periode eller fast sted → ingen endring", async () => {
    m.periodeFindMany.mockResolvedValue([
      fastNarvik,
      rad({ id: "p-admin", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-11-01"), tilDato: null, kilde: "admin" }),
    ]);
    const r = await slutt();
    expect(r.utfall).toBe("ingen");
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  it("🔴 (v) strict input: fast/type/kilde/organizationMemberId avvises", async () => {
    for (const ekstra of [{ fast: true }, { type: "kontor" }, { kilde: "admin" }, { organizationMemberId: MEDLEM }]) {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        caller().overforing({ id: ID, organizationId: ORG_A, handling: "start", oppmotestedId: TROMSO, dato: "2026-11-15", ...ekstra } as any),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("🔴 (vi) samme id to ganger → én rad", async () => {
    await start();
    m.periodeFindFirst.mockResolvedValue(apenOvf({ id: ID, oppmotestedId: TROMSO, fraDato: d("2026-11-15") }));
    const r = await start();
    expect(r.utfall).toBe("opprettet");
    expect(r.periode?.id).toBe(ID);
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
    expect(m.periodeFindFirst.mock.calls[0]![0].where).toMatchObject({ id: ID, organizationMemberId: MEDLEM });
  });

  it("🔴 (vii) konflikt med admin-periode → CONFLICT, ingen rad", async () => {
    m.periodeFindMany.mockResolvedValue([
      fastNarvik,
      rad({ id: "p-admin", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-12-01"), tilDato: d("2026-12-10"), kilde: "admin" }),
    ]);
    await expect(start()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("🔴 (vii-b) åpen admin-satt midlertidig periode → CONFLICT, admin-perioden urørt", async () => {
    m.periodeFindMany.mockResolvedValue([
      fastNarvik,
      rad({ id: "p-admin", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-11-01"), tilDato: null, kilde: "admin" }),
    ]);
    await expect(start()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  // ── O16 S3/R1: «Til og med» og egne perioder med sluttdato ──
  it("O16: start med tilDato skriver sluttdatoen; uten tilDato er perioden åpen", async () => {
    await start({ tilDato: "2026-11-30" });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({ fraDato: d("2026-11-15"), tilDato: d("2026-11-30"), kilde: "overforing" });
  });
  it("O16: tilDato før dato → BAD_REQUEST; lik dato godtas", async () => {
    await expect(start({ tilDato: "2026-11-14" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
    await start({ tilDato: "2026-11-15" });
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
  });
  it("O16: tilDato på slutt → BAD_REQUEST (gjelder bare ny periode)", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller().overforing({ id: ID, organizationId: ORG_A, handling: "slutt", dato: "2026-11-20", tilDato: "2026-11-30" } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
  });
  it("O16 R3: overlapp med firmaadmins periode med sluttdato → CONFLICT (serverens reserve)", async () => {
    m.periodeFindMany.mockResolvedValue([
      fastNarvik,
      rad({ id: "p-admin", fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-11-01"), tilDato: d("2026-11-20"), kilde: "admin" }),
    ]);
    await expect(start()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
  it("O16 V1: mobilens kall (uten medSluttdato) inne i en egen lukket periode → CONFLICT som før", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf({ tilDato: d("2026-11-25") })]);
    await expect(start()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
  it("O16 R1/V1: web (medSluttdato) inne i en egen lukket periode forkorter den", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf({ tilDato: d("2026-11-25") })]);
    const r = await start({ medSluttdato: true });
    expect(r.utfall).toBe("opprettet");
    expect(m.periodeUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: "p-ovf" }, data: { tilDato: d("2026-11-14") } });
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
  });
  it("O16 R1: en senere egen periode røres ikke når den nye slutter før den", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf({ fraDato: d("2026-11-20"), tilDato: d("2026-11-30") })]);
    const r = await start({ tilDato: "2026-11-18", medSluttdato: true });
    expect(r.utfall).toBe("opprettet");
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  // ── O16 V2: `slutt` med `periodeId` (web) virker på nettopp perioden boksen navngir ──
  describe("O16 V2 — slutt med periodeId", () => {
    const A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const ADM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const A = apenOvf({ id: A_ID, fraDato: d("2026-11-02"), tilDato: d("2026-11-02") });
    const B = apenOvf({ id: B_ID, oppmotestedId: TROMSO, fraDato: d("2026-11-04"), tilDato: null });
    const sluttB = (dato: string) =>
      caller().overforing({ id: ID, organizationId: ORG_A, handling: "slutt", dato, periodeId: B_ID });
    beforeEach(() => m.periodeFindMany.mockResolvedValue([fastNarvik, A, B]));

    for (const dato of ["2026-11-02", "2026-11-01"]) {
      it(`A 02–02, B 04–∞: «Siste dag»/«Avslutt» ${dato} sletter B, A urørt`, async () => {
        const r = await sluttB(dato);
        expect(r.utfall).toBe("slettet");
        expect(m.periodeDelete).toHaveBeenCalledTimes(1);
        expect(m.periodeDelete.mock.calls[0]![0]).toMatchObject({ where: { id: B_ID } });
        expect(m.periodeUpdate).not.toHaveBeenCalled();
      });
    }
    it("A 02–02, B 04–∞: 06 lukker B på 06, A urørt", async () => {
      m.periodeUpdate.mockResolvedValue({ ...B, tilDato: d("2026-11-06") });
      const r = await sluttB("2026-11-06");
      expect(r.utfall).toBe("lukket");
      expect(m.periodeUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: B_ID }, data: { tilDato: d("2026-11-06") } });
      expect(m.periodeDelete).not.toHaveBeenCalled();
    });
    it("mobilen (uten periodeId) 01: dagens regel — den åpne (B) slettes, A urørt", async () => {
      const r = await slutt("2026-11-01");
      expect(r.utfall).toBe("slettet");
      expect(m.periodeDelete.mock.calls[0]![0]).toMatchObject({ where: { id: B_ID } });
    });
    it("periode som ikke er medlemmets i firmaet → NOT_FOUND, ingenting skrives", async () => {
      await expect(
        caller().overforing({ id: ID, organizationId: ORG_A, handling: "slutt", dato: "2026-11-06", periodeId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(m.periodeFindMany.mock.calls[0]![0].where).toMatchObject({ organizationMemberId: MEDLEM, organizationId: ORG_A });
      expect(m.periodeUpdate).not.toHaveBeenCalled();
      expect(m.periodeDelete).not.toHaveBeenCalled();
    });
    it("firmaadmins periode (kilde ≠ overforing) → FORBIDDEN, ingenting skrives", async () => {
      m.periodeFindMany.mockResolvedValue([
        fastNarvik,
        rad({ id: ADM_ID, fast: false, oppmotestedId: RAMSUND, fraDato: d("2026-11-01"), tilDato: null, kilde: "admin" }),
      ]);
      await expect(
        caller().overforing({ id: ID, organizationId: ORG_A, handling: "slutt", dato: "2026-11-06", periodeId: ADM_ID }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(m.periodeUpdate).not.toHaveBeenCalled();
      expect(m.periodeDelete).not.toHaveBeenCalled();
    });
    it("periodeId på start → BAD_REQUEST; medSluttdato må være true", async () => {
      await expect(start({ periodeId: B_ID })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(start({ medSluttdato: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(m.periodeCreate).not.toHaveBeenCalled();
    });
  });

  it("ny Tur mens overføring er åpen: lukker den gamle (dato − 1) og oppretter ny", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf()]);
    const r = await start();
    expect(r.utfall).toBe("opprettet");
    expect(m.periodeUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: "p-ovf" }, data: { tilDato: d("2026-11-14") } });
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
  });

  it("ny Tur samme dag som den åpne startet: den gamle slettes (tom), ny opprettes", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf({ fraDato: d("2026-11-15") })]);
    await start();
    expect(m.periodeDelete).toHaveBeenCalledWith({ where: { id: "p-ovf" } });
    expect(m.periodeCreate).toHaveBeenCalledTimes(1);
  });

  it("Tur til eget faste kontor: ingen periode", async () => {
    m.stedFindFirst.mockResolvedValue({ id: NARVIK });
    const r = await start({ oppmotestedId: NARVIK });
    expect(r.utfall).toBe("ingen");
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("slutt: setter tilDato på egen åpne overføring", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf()]);
    m.periodeUpdate.mockImplementation(async (a: { data: Record<string, unknown> }) => apenOvf(a.data));
    const r = await slutt("2026-11-20");
    expect(r.utfall).toBe("lukket");
    expect(m.periodeUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: "p-ovf" }, data: { tilDato: d("2026-11-20") } });
  });

  it("slutt før start (angre / «Avslutt» samme dag) → perioden slettes", async () => {
    m.periodeFindMany.mockResolvedValue([fastNarvik, apenOvf()]);
    const r = await slutt("2026-11-09");
    expect(r.utfall).toBe("slettet");
    expect(m.periodeDelete).toHaveBeenCalledWith({ where: { id: "p-ovf" } });
  });

  it("start krever oppmotestedId", async () => {
    await expect(
      caller().overforing({ id: ID, organizationId: ORG_A, handling: "start", dato: "2026-11-15" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
