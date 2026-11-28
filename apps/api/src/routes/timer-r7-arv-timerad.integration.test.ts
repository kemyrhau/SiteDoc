import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { vareforbrukRouter } from "./vareforbruk";
import { sikreKortId } from "../services/timer/kortId";

/**
 * Runde 7 timer. Kenneth 2026-11-27: «Ja, arv timeraden» + «vi må kunne dele opp et
 * underprosjekt til det opprinnelige og til et annet underprosjekt …» («2 ja»: deling på
 * jobbnivå). Maskin og vare som er koblet til en timerad, har alltid timeradens underprosjekt
 * — i begge moduser; serveren utleder (avviser ikke). Webens dagskortvindu sender
 * `krevTimerad`: vare uten gyldig timerad avvises da. Mot EKTE Postgres.
 *
 * All data lages her med faste id-er (prefiks 5a5e0007) og ryddes i afterAll.
 */

const id = (n: string) => `5a5e0007-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const USER2 = id("03");
const ADMIN = id("04");
const P1 = id("11");
const P2 = id("12");
const BYGGEPLASS_1 = id("21");
const ECO_1 = id("31");
const ECO_2 = id("32");
const ECO_P2 = id("33");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45");
const MASKIN = id("51");
const DOEGN = id("52");
const VARE = id("61");

const BRUKERE = [USER, USER2, ADMIN];

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
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({
    where: { userId: { in: BRUKERE } },
    select: { id: true },
  });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of [
      "sheet_timer_forslag",
      "sheet_rad_historikk",
      "sheet_machines",
      "sheet_tillegg",
      "sheet_utlegg",
      "sheet_timer",
    ]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [MASKIN, DOEGN] } } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO_1, ECO_2, ECO_P2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: BYGGEPLASS_1 } });
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
      { id: USER, email: "r7-arv-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "r7-arv-2@sitedoc.test", name: "Arbeider To", role: "user" },
      { id: ADMIN, email: "r7-arv-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "R7 arv-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: USER2, organizationId: ORG, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "varelager", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "R7-1", name: "R7 arv P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "R7-2", name: "R7 arv P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [USER, USER2].flatMap((u) => [
      { userId: u, projectId: P1, role: "member" },
      { userId: u, projectId: P2, role: "member" },
    ]),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].flatMap((p) => [
      { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: p, moduleSlug: "varelager", organizationId: ORG, status: "aktiv" },
    ]),
  });
  await prisma.byggeplass.create({ data: { id: BYGGEPLASS_1, projectId: P1, name: "R7 arv B1" } });
  await prisma.externalCostObject.createMany({
    data: [
      { id: ECO_1, organizationId: ORG, projectId: P1, proAdmId: "R7-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: ECO_2, organizationId: ORG, projectId: P1, proAdmId: "R7-E2", kortNavn: "Vei", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: ECO_P2, organizationId: ORG, projectId: P2, proAdmId: "R7-E3", kortNavn: "B12", kilde: "manuell", opprettetAvUserId: ADMIN },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({
    data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" },
  });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", utleieEnhet: "time" },
      { id: DOEGN, organizationId: ORG, kategori: "anleggsmaskin", type: "hoppetusse", utleieEnhet: "doegn" },
    ],
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));
const vare = (userId = USER) => vareforbrukRouter.createCaller(ctx(userId));

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Sedel med to arbeidsrader i P1 på ECO_1 (r1 07–11, r2 11:30–15:30) i ett kort, en rad i
 * P1 på ECO_2 (r3, eget kort), maskin m1 koblet til r1 og en arbeidsrad i P2.
 */
async function oppsett(status: "draft" | "sent" = "draft") {
  const sid = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER,
      aktivitetId: AKT, dato: new Date(dato), status,
    },
  });
  const rad = (f: { fra: string; til: string; projectId?: string; eco?: string | null }) =>
    prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid, projectId: f.projectId ?? P1, lonnsartId: ORD, aktivitetId: AKT,
        fraTid: f.fra, tilTid: f.til, timer: 4, attestertStatus: "pending",
        externalCostObjectId: f.eco === undefined ? ECO_1 : f.eco,
      },
    });
  const r1 = await rad({ fra: "07:00", til: "11:00" });
  const r2 = await rad({ fra: "11:30", til: "15:30" });
  const r3 = await rad({ fra: "16:00", til: "20:00", eco: ECO_2 });
  const rP2 = await rad({ fra: "20:00", til: "23:59", projectId: P2, eco: null });
  await sikreKortId(prismaTimer, sid);
  const kortA = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r1.id } })).kortId!;
  const kortB = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r3.id } })).kortId!;
  const m1 = await prismaTimer.sheetMachine.create({
    data: {
      sheetId: sid, sheetTimerId: r1.id, vehicleId: MASKIN, projectId: P1,
      externalCostObjectId: ECO_1, timer: 2, kortId: kortA, attestertStatus: "pending",
    },
  });
  return { sid, dato, r1: r1.id, r2: r2.id, r3: r3.id, rP2: rP2.id, m1: m1.id, kortA, kortB };
}
type Oppsett = Awaited<ReturnType<typeof oppsett>>;

const maskinEco = async (mid: string) =>
  (await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: mid } })).externalCostObjectId;
const vareRad = (vid: string) => prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: vid } });
const radEco = async (tid: string) =>
  (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: tid } })).externalCostObjectId;
const nyVare = (o: Oppsett, over: Record<string, unknown> = {}) =>
  vare().opprett({
    projectId: P1, dato: o.dato, vareId: VARE, antall: 3, externalCostObjectId: ECO_2,
    dagsseddelId: o.sid, sheetTimerId: o.r1, ...over,
  });

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–3 i testpanelet, runde 6+7) — Kenneth 2026-11-27: «Ja, arv timeraden» — maskin (punkt 1)", () => {
  it("maskin.tilfoy koblet til r1 (ECO_1) med ECO_2 i input → lagres med ECO_1", async () => {
    const o = await oppsett();
    const m = await dag().maskin.tilfoy({
      sheetId: o.sid, projectId: P1, vehicleId: MASKIN, timer: 1, externalCostObjectId: ECO_2, sheetTimerId: o.r1,
    });
    expect(m.externalCostObjectId).toBe(ECO_1);
    expect(await maskinEco(m.id)).toBe(ECO_1);
  });

  it("maskin.tilfoy uten timerad (kobles automatisk) arver også timeradens underprosjekt", async () => {
    const o = await oppsett();
    const m = await dag().maskin.tilfoy({
      sheetId: o.sid, projectId: P1, vehicleId: MASKIN, timer: 1, externalCostObjectId: null, kortId: o.kortA,
    });
    expect(m.sheetTimerId).toBeTruthy();
    expect(await maskinEco(m.id)).toBe(await radEco(m.sheetTimerId!));
  });

  it("døgnmaskin uten timerad beholder eget valg (ingen timerad å arve fra)", async () => {
    const o = await oppsett();
    const m = await dag().maskin.tilfoy({
      sheetId: o.sid, projectId: P1, vehicleId: DOEGN, timer: 1, externalCostObjectId: ECO_2, sheetTimerId: null,
    });
    expect(m.sheetTimerId).toBeNull();
    expect(await maskinEco(m.id)).toBe(ECO_2);
  });

  it("maskin.oppdater koblet: ECO_2 i input → står på timeradens ECO_1", async () => {
    const o = await oppsett();
    await dag().maskin.oppdater({ id: o.m1, externalCostObjectId: ECO_2 });
    expect(await maskinEco(o.m1)).toBe(ECO_1);
  });
});

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–3 i testpanelet, runde 6+7) — Kenneth 2026-11-27: «Ja, arv timeraden» — vare (punkt 1 og 2)", () => {
  it("vareforbruk.opprett koblet til r1 med ECO_2 → lagres med ECO_1", async () => {
    const o = await oppsett();
    const v = await nyVare(o);
    expect((await vareRad(v.id)).externalCostObjectId).toBe(ECO_1);
  });

  it("vareforbruk.oppdater koblet: ECO_2 i input → står på ECO_1", async () => {
    const o = await oppsett();
    const v = await nyVare(o, { externalCostObjectId: ECO_1 });
    await vare().oppdater({ id: v.id, externalCostObjectId: ECO_2 });
    expect((await vareRad(v.id)).externalCostObjectId).toBe(ECO_1);
  });

  it("krevTimerad (webens dagskortvindu) uten timerad → avvist med melding", async () => {
    const o = await oppsett();
    await expect(nyVare(o, { sheetTimerId: null, krevTimerad: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("krevTimerad med timerad i et annet prosjekt → avvist", async () => {
    const o = await oppsett();
    await expect(nyVare(o, { sheetTimerId: o.rP2, krevTimerad: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("uten krevTimerad (telefonens kø) → lagres uten timerad med eget underprosjekt, som før", async () => {
    const o = await oppsett();
    const v = await nyVare(o, { sheetTimerId: null });
    const lagret = await vareRad(v.id);
    expect(lagret.sheetTimerId).toBeNull();
    expect(lagret.externalCostObjectId).toBe(ECO_2);
  });
});

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–3 i testpanelet, runde 6+7) — Kenneth 2026-11-27: «Ja, arv timeraden» — attestanten flytter én timerad", () => {
  it("flyttTimerRadEco (enkeltrad) → koblet maskin og vare følger; attestert maskin står", async () => {
    const o = await oppsett();
    const v = await nyVare(o, { externalCostObjectId: ECO_1 });
    const attestert = await prismaTimer.sheetMachine.create({
      data: {
        sheetId: o.sid, sheetTimerId: o.r1, vehicleId: MASKIN, projectId: P1,
        externalCostObjectId: ECO_1, timer: 1, kortId: o.kortA, attestertStatus: "attestert",
      },
    });
    await prismaTimer.dailySheet.update({ where: { id: o.sid }, data: { status: "sent" } });
    await dag(ADMIN).flyttTimerRadEco({ timerRadId: o.r1, externalCostObjectId: ECO_2 });
    expect(await radEco(o.r1)).toBe(ECO_2);
    expect(await maskinEco(o.m1)).toBe(ECO_2);
    expect((await vareRad(v.id)).externalCostObjectId).toBe(ECO_2);
    expect(await maskinEco(attestert.id)).toBe(ECO_1);
  });
});

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–3 i testpanelet, runde 6+7) — Kenneth 2026-11-27: «Del opp maskin» deler bare timer (punkt 3, C)", () => {
  it("splittRadEier maskin med ECO_2 og null på delene → begge får timeradens ECO_1", async () => {
    const o = await oppsett();
    await dag().splittRadEier({
      radType: "maskin",
      radId: o.m1,
      nyeRader: [
        { projectId: P1, vehicleId: MASKIN, timer: 1, externalCostObjectId: ECO_2 },
        { projectId: P1, vehicleId: MASKIN, timer: 1, externalCostObjectId: null },
      ],
    });
    const deler = await prismaTimer.sheetMachine.findMany({ where: { sheetId: o.sid } });
    expect(deler).toHaveLength(2);
    for (const d of deler) {
      expect(d.sheetTimerId).toBe(o.r1);
      expect(d.externalCostObjectId).toBe(ECO_1);
    }
  });
});

describe("Kenneth 2026-11-27: «vi må kunne dele opp et underprosjekt …» — deling på jobbnivå (B, uendret)", () => {
  /** Koblet maskin og vare står med sin timerads underprosjekt. */
  async function holderRegelen(sid: string) {
    const [maskiner, varer, rader] = await Promise.all([
      prismaTimer.sheetMachine.findMany({ where: { sheetId: sid, sheetTimerId: { not: null } } }),
      prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: sid, sheetTimerId: { not: null } } }),
      prismaTimer.sheetTimer.findMany({ where: { sheetId: sid } }),
    ]);
    const eco = new Map(rader.map((r) => [r.id, r.externalCostObjectId ?? null]));
    for (const m of maskiner) expect(m.externalCostObjectId ?? null).toBe(eco.get(m.sheetTimerId!));
    for (const v of varer) expect(v.externalCostObjectId ?? null).toBe(eco.get(v.sheetTimerId!));
    return { maskiner, varer };
  }

  it("«Del opp» (delJobb) til ECO_2: koblet maskin og vare står med sin timerads underprosjekt", async () => {
    const o = await oppsett("sent");
    const m2 = await prismaTimer.sheetMachine.create({
      data: { sheetId: o.sid, sheetTimerId: o.r2, vehicleId: MASKIN, projectId: P1, externalCostObjectId: ECO_1, timer: 2, kortId: o.kortA, attestertStatus: "pending" },
    });
    const v2 = await prismaVarelager.vareforbruk.create({
      data: { dato: new Date(o.dato), projectId: P1, vareId: VARE, antall: 2, registrertAvUserId: USER, dagsseddelId: o.sid, sheetTimerId: o.r2, externalCostObjectId: ECO_1, kortId: o.kortA },
    });
    await dag(ADMIN).delJobb({ sheetId: o.sid, kortId: o.kortA, kl: "11:15", externalCostObjectIdB: ECO_2 });
    // Maskin og vare fordeles etter arbeidet i A og B (O15) — regelen sjekkes, ikke fordelingen.
    expect(await radEco(o.r2)).toBe(ECO_2);
    const { maskiner, varer } = await holderRegelen(o.sid);
    expect(maskiner.map((m) => m.id)).toEqual(expect.arrayContaining([o.m1, m2.id]));
    expect(varer.map((v) => v.id)).toContain(v2.id);
  });

  it("«Flytt linje» (flyttLinjeTilKort): maskin flyttet til kortet med ECO_2 står med ECO_2", async () => {
    const o = await oppsett("sent");
    await dag(ADMIN).flyttLinjeTilKort({ sheetId: o.sid, radType: "maskin", radId: o.m1, tilKortId: o.kortB });
    const { maskiner } = await holderRegelen(o.sid);
    expect(maskiner.every((m) => m.externalCostObjectId === ECO_2)).toBe(true);
  });
});

describe("Kenneth 2026-11-27: «La den følge» — ukoblet førermaskin i attestantens veier (A7b)", () => {
  /**
   * Innsendt sedel: r1 07–11 og r2 11:30–15:30 på ECO_1 i ett kort. m1 koblet til r1; i kortet
   * står også ukoblet førermaskin over r1 (fører1) og over r2 (fører2), en ukoblet døgnmaskin
   * og en attestert ukoblet førermaskin.
   */
  async function oppsettA7b() {
    const sid = randomUUID();
    await prismaTimer.dailySheet.create({
      data: {
        id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER,
        aktivitetId: AKT, dato: new Date(nyDato()), status: "sent",
      },
    });
    const rad = (fra: string, til: string) =>
      prismaTimer.sheetTimer.create({
        data: {
          sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: fra, tilTid: til,
          timer: 4, attestertStatus: "pending", externalCostObjectId: ECO_1,
        },
      });
    const r1 = await rad("07:00", "11:00");
    const r2 = await rad("11:30", "15:30");
    await sikreKortId(prismaTimer, sid);
    const kortA = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r1.id } })).kortId!;
    const maskin = (f: { vehicleId?: string; sheetTimerId?: string; fra: string; til: string; status?: string }) =>
      prismaTimer.sheetMachine.create({
        data: {
          sheetId: sid, sheetTimerId: f.sheetTimerId ?? null, vehicleId: f.vehicleId ?? MASKIN, projectId: P1,
          externalCostObjectId: ECO_1, timer: 1, fraTid: f.fra, tilTid: f.til, kortId: kortA,
          attestertStatus: f.status ?? "pending",
        },
      });
    const m1 = await maskin({ sheetTimerId: r1.id, fra: "08:00", til: "09:00" });
    const forer1 = await maskin({ fra: "07:00", til: "08:00" });
    const forer2 = await maskin({ fra: "12:00", til: "13:00" });
    const doegn = await maskin({ vehicleId: DOEGN, fra: "07:00", til: "08:00" });
    const attestert = await maskin({ fra: "09:00", til: "10:00", status: "attestert" });
    return { sid, r1: r1.id, r2: r2.id, m1: m1.id, forer1: forer1.id, forer2: forer2.id, doegn: doegn.id, attestert: attestert.id };
  }
  const m = (mid: string) => prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: mid } });

  const veier = [
    {
      navn: "flyttTimerRadEco (enkeltrad)",
      flytt: (o: Awaited<ReturnType<typeof oppsettA7b>>) =>
        dag(ADMIN).flyttTimerRadEco({ timerRadId: o.r1, externalCostObjectId: ECO_2 }),
      byggeplass: null as string | null,
    },
    {
      navn: "rettRadFelt (underprosjekt og byggeplass)",
      flytt: (o: Awaited<ReturnType<typeof oppsettA7b>>) =>
        dag(ADMIN).rettRadFelt({
          radType: "timer", radId: o.r1, felter: { externalCostObjectId: ECO_2, byggeplassId: BYGGEPLASS_1 },
        }),
      byggeplass: BYGGEPLASS_1 as string | null,
    },
  ];

  /** Koblet vare på r1, attestert vare på r1 (snapshot) og ukoblet vare — alle på ECO_1. */
  async function varer(o: Awaited<ReturnType<typeof oppsettA7b>>) {
    const lag = (over: Record<string, unknown>) =>
      prismaVarelager.vareforbruk.create({
        data: {
          dato: new Date(), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: USER,
          dagsseddelId: o.sid, externalCostObjectId: ECO_1, ...over,
        },
      });
    const koblet = await lag({ sheetTimerId: o.r1 });
    const attestert = await lag({ sheetTimerId: o.r1, attestertSnapshot: { navn: "Pukk 6-32" } });
    const ukoblet = await lag({ sheetTimerId: null });
    return { koblet: koblet.id, attestert: attestert.id, ukoblet: ukoblet.id };
  }

  for (const v of veier) {
    it(`${v.navn}: ukoblet førermaskin over raden kobles og følger; koblet følger`, async () => {
      const o = await oppsettA7b();
      await v.flytt(o);
      const kort = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: o.r1 } })).kortId;
      for (const mid of [o.m1, o.forer1]) {
        expect(await m(mid)).toMatchObject({
          sheetTimerId: o.r1, externalCostObjectId: ECO_2, byggeplassId: v.byggeplass, kortId: kort,
        });
      }
      // Velger raden r2 (overlapp), står den — med r2 i kortet.
      expect(await m(o.forer2)).toMatchObject({ sheetTimerId: null, externalCostObjectId: ECO_1 });
    });

    it(`${v.navn}: døgnmaskin uten timerad og attestert maskin står`, async () => {
      const o = await oppsettA7b();
      const [doegnFoer, attFoer] = await Promise.all([m(o.doegn), m(o.attestert)]);
      await v.flytt(o);
      expect(await m(o.doegn)).toMatchObject({
        sheetTimerId: null, externalCostObjectId: ECO_1, byggeplassId: doegnFoer.byggeplassId,
      });
      expect(await m(o.attestert)).toMatchObject({
        sheetTimerId: null, externalCostObjectId: ECO_1, kortId: attFoer.kortId, attestertStatus: "attestert",
      });
    });

    it(`${v.navn}: koblet vare følger underprosjektet; attestert og ukoblet vare står`, async () => {
      const o = await oppsettA7b();
      const vr = await varer(o);
      await v.flytt(o);
      expect((await vareRad(vr.koblet)).externalCostObjectId).toBe(ECO_2);
      expect((await vareRad(vr.attestert)).externalCostObjectId).toBe(ECO_1);
      expect((await vareRad(vr.ukoblet)).externalCostObjectId).toBe(ECO_1);
    });
  }

  // ── Tillegg 2 (Kenneth 2026-11-28: «Ja, la den følge»): prosjektbytte ─────────────────
  /** Hele sedelens ventende rader som `redigerSedelRader`-input, med r1 flyttet til P2/ECO_P2. */
  type Sted = { projectId: string; externalCostObjectId: string | null; byggeplassId: string | null };
  async function redigerInput(
    o: Awaited<ReturnType<typeof oppsettA7b>>,
    sted: Sted = { projectId: P2, externalCostObjectId: ECO_P2, byggeplassId: null },
    radId: string = o.r1,
  ) {
    const [timer, maskin] = await Promise.all([
      prismaTimer.sheetTimer.findMany({ where: { sheetId: o.sid, attestertStatus: "pending" } }),
      prismaTimer.sheetMachine.findMany({ where: { sheetId: o.sid, attestertStatus: "pending" } }),
    ]);
    return {
      sheetId: o.sid,
      nyeRader: {
        timer: timer.map((r) => ({
          originalId: r.id, projectId: r.id === radId ? sted.projectId : r.projectId, lonnsartId: r.lonnsartId!,
          aktivitetId: r.aktivitetId!, externalCostObjectId: r.id === radId ? sted.externalCostObjectId : r.externalCostObjectId,
          byggeplassId: r.id === radId ? sted.byggeplassId : r.byggeplassId, fraTid: r.fraTid, tilTid: r.tilTid,
          timer: Number(r.timer), pauseMin: r.pauseMin, vehicleId: r.vehicleId,
        })),
        tillegg: [],
        maskin: maskin.map((r) => ({
          originalId: r.id, projectId: r.projectId, externalCostObjectId: r.externalCostObjectId,
          vehicleId: r.vehicleId, byggeplassId: r.byggeplassId, fraTid: r.fraTid, tilTid: r.tilTid,
          timer: Number(r.timer), mengde: r.mengde === null ? null : Number(r.mengde), enhet: r.enhet,
        })),
      },
    };
  }
  const prosjektVeier = [
    {
      navn: "rettRadFelt",
      flytt: (o: Awaited<ReturnType<typeof oppsettA7b>>) =>
        dag(ADMIN).rettRadFelt({
          radType: "timer", radId: o.r1, felter: { projectId: P2, byggeplassId: null, externalCostObjectId: ECO_P2 },
        }),
    },
    {
      navn: "redigerSedelRader",
      flytt: async (o: Awaited<ReturnType<typeof oppsettA7b>>) => dag(ADMIN).redigerSedelRader(await redigerInput(o)),
    },
  ];

  for (const v of prosjektVeier) {
    it(`prosjektbytte (${v.navn}): koblet og ukoblet førermaskin og koblet vare følger til P2 med radens underprosjekt og kort`, async () => {
      const o = await oppsettA7b();
      const vr = await varer(o);
      await v.flytt(o);
      const r1 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: o.r1 } });
      expect(r1).toMatchObject({ projectId: P2, externalCostObjectId: ECO_P2 });
      for (const mid of [o.m1, o.forer1]) {
        expect(await m(mid)).toMatchObject({
          sheetTimerId: o.r1, projectId: P2, externalCostObjectId: ECO_P2, byggeplassId: null, kortId: r1.kortId,
        });
      }
      expect(await vareRad(vr.koblet)).toMatchObject({
        sheetTimerId: o.r1, projectId: P2, externalCostObjectId: ECO_P2, kortId: r1.kortId,
      });
      // Velger r2: står i P1.
      expect(await m(o.forer2)).toMatchObject({ sheetTimerId: null, projectId: P1, externalCostObjectId: ECO_1 });
    });

    it(`prosjektbytte (${v.navn}): døgnmaskin, attestert maskin og attestert/ukoblet vare står i P1`, async () => {
      const o = await oppsettA7b();
      const vr = await varer(o);
      const attKoblet = await prismaTimer.sheetMachine.create({
        data: {
          sheetId: o.sid, sheetTimerId: o.r1, vehicleId: MASKIN, projectId: P1, externalCostObjectId: ECO_1,
          timer: 1, fraTid: "10:00", tilTid: "11:00", kortId: (await m(o.m1)).kortId, attestertStatus: "attestert",
        },
      });
      await v.flytt(o);
      expect(await m(o.doegn)).toMatchObject({ sheetTimerId: null, projectId: P1, externalCostObjectId: ECO_1 });
      expect(await m(o.attestert)).toMatchObject({ sheetTimerId: null, projectId: P1, attestertStatus: "attestert" });
      // Attestert koblet maskin står i P1 og mister koblingen (som tillegget, runde 6).
      expect(await m(attKoblet.id)).toMatchObject({ sheetTimerId: null, projectId: P1, externalCostObjectId: ECO_1 });
      expect(await vareRad(vr.attestert)).toMatchObject({ sheetTimerId: null, projectId: P1, externalCostObjectId: ECO_1 });
      expect(await vareRad(vr.ukoblet)).toMatchObject({ sheetTimerId: null, projectId: P1, externalCostObjectId: ECO_1 });
    });
  }

  // RETUR 1 vilkår 1 (Kontrollør): S5-filteret i stedgrenen (`stedEndretTimer`).
  const stedVeier = [
    {
      navn: "rettRadFelt",
      flytt: (o: Awaited<ReturnType<typeof oppsettA7b>>) =>
        dag(ADMIN).rettRadFelt({ radType: "timer", radId: o.r1, felter: { externalCostObjectId: ECO_2, byggeplassId: BYGGEPLASS_1 } }),
    },
    {
      navn: "redigerSedelRader",
      flytt: async (o: Awaited<ReturnType<typeof oppsettA7b>>) =>
        dag(ADMIN).redigerSedelRader(
          await redigerInput(o, { projectId: P1, externalCostObjectId: ECO_2, byggeplassId: BYGGEPLASS_1 }),
        ),
    },
  ];
  for (const v of stedVeier) {
    it(`nytt underprosjekt og byggeplass (${v.navn}): koblet attestert og erstattet maskin på r1 står (S5)`, async () => {
      const o = await oppsettA7b();
      const kortId = (await m(o.m1)).kortId;
      const laast = await Promise.all(
        (["attestert", "erstattet"] as const).map((status, i) =>
          prismaTimer.sheetMachine.create({
            data: {
              sheetId: o.sid, sheetTimerId: o.r1, vehicleId: MASKIN, projectId: P1, externalCostObjectId: ECO_1,
              timer: 0.5, fraTid: i === 0 ? "10:00" : "10:30", tilTid: i === 0 ? "10:30" : "11:00", kortId,
              attestertStatus: status,
            },
          }),
        ),
      );
      await v.flytt(o);
      expect(await m(o.m1)).toMatchObject({ externalCostObjectId: ECO_2, byggeplassId: BYGGEPLASS_1 });
      for (const [i, status] of (["attestert", "erstattet"] as const).entries()) {
        expect(await m(laast[i]!.id)).toMatchObject({
          sheetTimerId: o.r1, externalCostObjectId: ECO_1, byggeplassId: null, attestertStatus: status,
        });
      }
    });
  }

  // A7c («LØSNING GODKJENT (a)»: en reise med koblet maskin eller vare bytter ikke prosjekt):
  // `redigerSedelRader` sperrer som `oppdaterTimerRad` og `rettRadFelt`. Uten kobling går reisen.
  it("A7c (redigerSedelRader): reise med koblet maskin og vare som bytter prosjekt avvises; ingenting endres", async () => {
    const o = await oppsettA7b();
    const reise = await prismaTimer.sheetTimer.create({
      data: {
        sheetId: o.sid, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, fraTid: "16:00", tilTid: "17:00",
        timer: 1, erReise: true, reiseRetning: "hjem", attestertStatus: "pending", externalCostObjectId: ECO_1,
      },
    });
    const kortId = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: o.r1 } })).kortId;
    const dm = await prismaTimer.sheetMachine.create({
      data: {
        sheetId: o.sid, sheetTimerId: reise.id, vehicleId: DOEGN, projectId: P1, externalCostObjectId: ECO_1,
        timer: 1, kortId, attestertStatus: "pending",
      },
    });
    const vr = await prismaVarelager.vareforbruk.create({
      data: {
        dato: new Date(), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: USER,
        dagsseddelId: o.sid, sheetTimerId: reise.id, externalCostObjectId: ECO_1,
      },
    });
    const flytt = async () =>
      dag(ADMIN).redigerSedelRader(
        await redigerInput(o, { projectId: P2, externalCostObjectId: ECO_P2, byggeplassId: null }, reise.id),
      );
    await expect(flytt()).rejects.toThrow("Reisen har maskinen");
    expect(await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise.id } })).toMatchObject({
      projectId: P1, externalCostObjectId: ECO_1,
    });
    expect(await m(dm.id)).toMatchObject({ sheetTimerId: reise.id, projectId: P1, externalCostObjectId: ECO_1 });
    expect(await vareRad(vr.id)).toMatchObject({ sheetTimerId: reise.id, projectId: P1, externalCostObjectId: ECO_1 });
    // Uten kobling er sperren stille: reisen bytter prosjekt.
    await prismaTimer.sheetMachine.delete({ where: { id: dm.id } });
    await prismaVarelager.vareforbruk.delete({ where: { id: vr.id } });
    await flytt();
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise.id } })).projectId).toBe(P2);
  });

  it("arbeiderens vei: arbeid kan ikke bytte prosjekt, og reise med koblet vare avvises (begge sperrer står)", async () => {
    const o = await oppsettA7b();
    await prismaTimer.dailySheet.update({ where: { id: o.sid }, data: { status: "draft" } });
    await expect(dag().oppdaterTimerRad({ id: o.r1, projectId: P2, byggeplassId: null, externalCostObjectId: null, fraTid: "07:00", tilTid: "11:00" }))
      .rejects.toThrow("Prosjektet kan bare byttes på en reise");
    const reise = await prismaTimer.sheetTimer.create({
      data: {
        sheetId: o.sid, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, fraTid: "16:00", tilTid: "17:00",
        timer: 1, erReise: true, reiseRetning: "hjem", attestertStatus: "pending",
      },
    });
    await prismaVarelager.vareforbruk.create({
      data: {
        dato: new Date(), projectId: P1, vareId: VARE, antall: 1, registrertAvUserId: USER,
        dagsseddelId: o.sid, sheetTimerId: reise.id,
      },
    });
    await expect(dag().oppdaterTimerRad({ id: reise.id, projectId: P2, byggeplassId: null, externalCostObjectId: null, fraTid: "16:00", tilTid: "17:00" }))
      .rejects.toThrow("Reisen har varen");
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: o.r1 } })).projectId).toBe(P1);
    expect((await m(o.m1)).projectId).toBe(P1);
  });
});
