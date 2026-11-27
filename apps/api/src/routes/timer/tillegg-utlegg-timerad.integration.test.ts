import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * Runde 6 (Kenneth 2026-11-27: «Varer, utlegg, tillegg som registreres og maskintimer, disse
 * må knyttes til menneskets timer · reisetid og knyttes til prosjekt»; «disse endringene gjelder
 * dagskort. Ikke rør prosjektkort registreringen»). Mot EKTE Postgres (lokal sandkasse, aldri
 * test/prod).
 *
 * T1: dagskort — tillegg/utlegg med arbeidsrad lagres med `sheet_timer_id`; uten avvises.
 * T2: reiserad godtas; rad på annen sedel, annet prosjekt eller erstattet avvises.
 * T3: oppdater — bytte rad virker, utelatt = urørt, null avvises i dagskort.
 * T4: prosjektkort — uten feltet som før (NULL).
 * T5: fjernTimerRad og attestantens sletting nuller koblingen; tillegg/utlegg står.
 * T6: syncBatch — utelatt beholder, oppgitt lagres, ugyldig avvises, slettet timerad → NULL.
 * T7: svar 1 — arbeidsrad bytter prosjekt (attestant): tillegget følger med samme kobling,
 *     underprosjekt nullet. Reise via pennen tar også tillegget med.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f7) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f7-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ARB = id("03");
const ATT = id("04");
const P1 = id("11");
const P2 = id("12");
const ECO1 = id("31"); // i P1
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45");

const BRUKERE = [ARB, ATT];

function ctx(userId: string) {
  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager,
    userId,
    actualUserId: userId,
    imperseringAktiv: false,
    sessionToken: null,
    tokenKilde: null,
    ipAddress: null,
    userAgent: null,
    req: { log: { info: () => {}, warn: () => {}, error: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const dag = (userId = ARB) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000);

async function nySedel(opts: { status?: string } = {}) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid, clientUuid: sid, organizationId: ORG, userId: ARB, registrertAvUserId: ARB,
      aktivitetId: AKT, dato: nyDato(), status: opts.status ?? "draft",
    },
  });
  return sid;
}

async function raArbeid(sheetId: string, f: { projectId?: string; fra?: string; til?: string; status?: string } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: f.projectId ?? P1, lonnsartId: ORD, aktivitetId: AKT,
      fraTid: f.fra ?? "07:00", tilTid: f.til ?? "11:00", timer: 4, kortId: randomUUID(),
      attestertStatus: f.status ?? "pending",
    },
  });
  return r.id;
}

async function raReise(sheetId: string) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, erReise: true,
      reiseRetning: "retur", reiseKilde: "manuell", fraTid: "15:00", tilTid: "15:35", timer: 0.58,
    },
  });
  return r.id;
}

async function settModus(modus: "dagskort" | "prosjektkort") {
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { timerRegistreringsmodus: modus } });
}

const tillegg = (rid: string) => prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: rid } });
const utlegg = (rid: string) => prismaTimer.sheetUtlegg.findUniqueOrThrow({ where: { id: rid } });

const nyttTillegg = (sheetId: string, sheetTimerId?: string | null, projectId = P1) =>
  dag().tilfoyTilleggRad({ sheetId, projectId, tilleggId: TILLEGG, antall: 1, ...(sheetTimerId !== undefined ? { sheetTimerId } : {}) });
const nyttUtlegg = (sheetId: string, sheetTimerId?: string | null) =>
  dag().tilfoyUtleggRad({ sheetId, projectId: P1, expenseCategoryId: KATEGORI, belop: 120, ...(sheetTimerId !== undefined ? { sheetTimerId } : {}) });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "r6-arbeider@sitedoc.test", name: "Ola", role: "user" },
      { id: ATT, email: "r6-attestant@sitedoc.test", name: "Attestant", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "r6-firma" } });
  await prisma.organizationMember.createMany({
    data: BRUKERE.map((u) => ({ userId: u, organizationId: ORG, status: "aktiv" })),
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((m) => ({ organizationId: ORG, moduleSlug: m, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: {
      organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true,
      tillattSelvAttestering: false, timerRegistreringsmodus: "dagskort",
    },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "R6-1", name: "r6 P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "R6-2", name: "r6 P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [P1, P2].flatMap((p) => [
      { userId: ARB, projectId: p, role: "member" },
      { userId: ATT, projectId: p, role: "member", kanAttestere: true },
    ]),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.externalCostObject.create({
    data: { id: ECO1, organizationId: ORG, projectId: P1, proAdmId: "R6-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ATT },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const avvist = { code: "BAD_REQUEST" };

describe("runde 6 — T1 føring i dagskort", () => {
  it("tillegg og utlegg med arbeidsrad lagres med sheet_timer_id", async () => {
    const sid = await nySedel();
    const t = await raArbeid(sid);
    const tl = await nyttTillegg(sid, t);
    const ut = await nyttUtlegg(sid, t);
    expect((await tillegg(tl.id)).sheetTimerId).toBe(t);
    expect((await utlegg(ut.id)).sheetTimerId).toBe(t);
  });

  it("uten timerad avvises begge, ingenting skrevet", async () => {
    const sid = await nySedel();
    await raArbeid(sid);
    await expect(nyttTillegg(sid)).rejects.toMatchObject(avvist);
    await expect(nyttUtlegg(sid, null)).rejects.toMatchObject(avvist);
    expect(await prismaTimer.sheetTillegg.count({ where: { sheetId: sid } })).toBe(0);
    expect(await prismaTimer.sheetUtlegg.count({ where: { sheetId: sid } })).toBe(0);
  });
});

describe("runde 6 — T2 hvilken timerad", () => {
  it("reiserad godtas", async () => {
    const sid = await nySedel();
    const r = await raReise(sid);
    const tl = await nyttTillegg(sid, r);
    expect((await tillegg(tl.id)).sheetTimerId).toBe(r);
  });

  it("rad på annen sedel, annet prosjekt eller erstattet avvises", async () => {
    const sid = await nySedel();
    const annen = await raArbeid(await nySedel());
    const iP2 = await raArbeid(sid, { projectId: P2, fra: "11:00", til: "15:00" });
    const erstattet = await raArbeid(sid, { status: "erstattet" });
    await expect(nyttTillegg(sid, annen)).rejects.toMatchObject(avvist);
    await expect(nyttTillegg(sid, iP2)).rejects.toMatchObject(avvist);
    await expect(nyttTillegg(sid, erstattet)).rejects.toMatchObject(avvist);
    await expect(nyttUtlegg(sid, iP2)).rejects.toMatchObject(avvist);
  });
});

describe("runde 6 — T3 oppdatering", () => {
  it("bytte rad virker, utelatt er urørt, null avvises i dagskort", async () => {
    const sid = await nySedel();
    const a = await raArbeid(sid);
    const b = await raArbeid(sid, { fra: "11:00", til: "15:00" });
    const tl = await nyttTillegg(sid, a);
    const ut = await nyttUtlegg(sid, a);

    await dag().oppdaterTilleggRad({ id: tl.id, sheetTimerId: b });
    await dag().oppdaterUtleggRad({ id: ut.id, sheetTimerId: b });
    expect((await tillegg(tl.id)).sheetTimerId).toBe(b);
    expect((await utlegg(ut.id)).sheetTimerId).toBe(b);

    await dag().oppdaterTilleggRad({ id: tl.id, antall: 2 });
    await dag().oppdaterUtleggRad({ id: ut.id, belop: 200 });
    expect((await tillegg(tl.id)).sheetTimerId).toBe(b);
    expect((await utlegg(ut.id)).sheetTimerId).toBe(b);

    await expect(dag().oppdaterTilleggRad({ id: tl.id, sheetTimerId: null })).rejects.toMatchObject(avvist);
    await expect(dag().oppdaterUtleggRad({ id: ut.id, sheetTimerId: null })).rejects.toMatchObject(avvist);
    expect((await tillegg(tl.id)).sheetTimerId).toBe(b);
  });
});

describe("runde 6 — T4 prosjektkort er urørt", () => {
  it("uten feltet lagres tillegg og utlegg med NULL", async () => {
    await settModus("prosjektkort");
    try {
      const sid = await nySedel();
      await raArbeid(sid);
      const tl = await nyttTillegg(sid);
      const ut = await nyttUtlegg(sid);
      expect((await tillegg(tl.id)).sheetTimerId).toBeNull();
      expect((await utlegg(ut.id)).sheetTimerId).toBeNull();
    } finally {
      await settModus("dagskort");
    }
  });
});

describe("runde 6 — T5 sletting nuller koblingen", () => {
  it("fjernTimerRad: tillegg og utlegg står, uten kobling", async () => {
    const sid = await nySedel();
    const t = await raArbeid(sid);
    const tl = await nyttTillegg(sid, t);
    const ut = await nyttUtlegg(sid, t);
    await dag().fjernTimerRad({ id: t });
    expect((await tillegg(tl.id)).sheetTimerId).toBeNull();
    expect((await utlegg(ut.id)).sheetTimerId).toBeNull();
  });

  it("attestantens sletting av timeraden: tillegget står, uten kobling", async () => {
    const sid = await nySedel();
    const a = await raArbeid(sid);
    const b = await raArbeid(sid, { fra: "11:00", til: "15:00" });
    const tl = await nyttTillegg(sid, a);
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "sent" } });
    await dag(ATT).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [{ originalId: b, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "11:00", tilTid: "15:00", timer: 4, pauseMin: 0 }],
        tillegg: [{ originalId: tl.id, projectId: P1, tilleggId: TILLEGG, antall: 1 }],
        maskin: [],
      },
    });
    expect((await tillegg(tl.id)).sheetTimerId).toBeNull();
    expect(await prismaTimer.sheetTimer.count({ where: { id: a } })).toBe(0);
  });
});

describe("runde 6 — T6 syncBatch", () => {
  const syncTimer = (rid: string, fra: string, til: string) => ({
    id: rid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 4, fraTid: fra, tilTid: til, pauseMin: 0,
  });
  const syncTillegg = (rid: string, ekstra: Record<string, unknown> = {}) => ({
    id: rid, projectId: P1, tilleggId: TILLEGG, antall: 1, ...ekstra,
  });
  const syncUtlegg = (rid: string, ekstra: Record<string, unknown> = {}) => ({
    id: rid, projectId: P1, expenseCategoryId: KATEGORI, belop: 50, ordningVedFoering: "utlegg",
    foertVed: new Date().toISOString(), ...ekstra,
  });
  async function sync(clientUuid: string, dato: string, del: Record<string, unknown>) {
    const sedel = {
      clientUuid, projectId: P1, aktivitetId: AKT, dato, status: "draft", pauseMin: 0,
      timer: [], tillegg: [], maskiner: [], utlegg: [], ...del,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await dag().syncBatch({ sedler: [sedel as any] })).resultater[0]!;
  }

  it("oppgitt lagres; utelatt beholder; slettet timerad gir NULL; ugyldig avvises", async () => {
    const cu = randomUUID();
    const dato = nyDato().toISOString().slice(0, 10);
    const a = randomUUID();
    const b = randomUUID();
    const tl = randomUUID();
    const ut = randomUUID();
    const timer = [syncTimer(a, "07:00", "11:00"), syncTimer(b, "11:00", "15:00")];

    await sync(cu, dato, { timer, tillegg: [syncTillegg(tl, { sheetTimerId: a })], utlegg: [syncUtlegg(ut, { sheetTimerId: b })] });
    expect((await tillegg(tl)).sheetTimerId).toBe(a);
    expect((await utlegg(ut)).sheetTimerId).toBe(b);

    // Eldre klient: feltet utelatt → koblingen beholdes.
    await sync(cu, dato, { timer, tillegg: [syncTillegg(tl)], utlegg: [syncUtlegg(ut)] });
    expect((await tillegg(tl)).sheetTimerId).toBe(a);
    expect((await utlegg(ut)).sheetTimerId).toBe(b);

    // Timerad b slettes → utlegget står uten kobling.
    await sync(cu, dato, { timer: [timer[0]], tillegg: [syncTillegg(tl)], utlegg: [syncUtlegg(ut)], slettedeIder: { timer: [b], tillegg: [], maskiner: [], utlegg: [] } });
    expect((await utlegg(ut)).sheetTimerId).toBeNull();
    expect((await tillegg(tl)).sheetTimerId).toBe(a);

    // Oppgitt kobling til en rad som ikke finnes → avvist.
    const svar = await sync(cu, dato, { timer: [timer[0]], tillegg: [syncTillegg(tl, { sheetTimerId: randomUUID() })], utlegg: [] });
    expect(svar.resultat).not.toBe("ok");
    expect((await tillegg(tl)).sheetTimerId).toBe(a);
  });
});

describe("runde 6 — T7 svar 1: timeraden bytter prosjekt", () => {
  it("attestant flytter arbeidsraden til P2: tillegg og utlegg følger, samme kobling, underprosjekt nullet", async () => {
    const sid = await nySedel();
    const a = await raArbeid(sid);
    const tl = await dag().tilfoyTilleggRad({ sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1, externalCostObjectId: ECO1, sheetTimerId: a });
    const ut = await nyttUtlegg(sid, a);
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "sent" } });

    await dag(ATT).rettRadFelt({ radType: "timer", radId: a, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: null } });

    const etterT = await tillegg(tl.id);
    const etterU = await utlegg(ut.id);
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: a } })).projectId).toBe(P2);
    expect(etterT.projectId).toBe(P2);
    expect(etterT.sheetTimerId).toBe(a);
    expect(etterT.externalCostObjectId).toBeNull();
    expect(etterU.projectId).toBe(P2);
    expect(etterU.sheetTimerId).toBe(a);
  });

  it("eier flytter reisen til P2 med pennen: tillegget følger", async () => {
    const sid = await nySedel();
    await raArbeid(sid, { projectId: P2, fra: "07:00", til: "11:00" });
    const r = await raReise(sid);
    const tl = await nyttTillegg(sid, r);
    await dag().oppdaterTimerRad({ id: r, fraTid: "15:00", tilTid: "15:35", projectId: P2, byggeplassId: null, externalCostObjectId: null });
    const etter = await tillegg(tl.id);
    expect(etter.projectId).toBe(P2);
    expect(etter.sheetTimerId).toBe(r);
  });
});
