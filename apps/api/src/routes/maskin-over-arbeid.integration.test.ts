import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * w9 (plan § 4.4, B21 A / B22 A / B23 B) — maskintimer høyst jobbens arbeidstimer, gjennom
 * prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 *
 * Pr. skrivevei: en skriving som lager eller øker et brudd, avvises med
 * `data.feilNokkel = "timer.maskin.overArbeidAvvist"` og skriver ingenting. Negativkontroller:
 * et gammelt brudd i en annen jobb stopper ikke føring (B23 B), en døgn-maskin avvises aldri
 * (B21 A), å senke et gammelt brudd går gjennom.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f9) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f9-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("04");
const P1 = id("11");
const P2 = id("12");
const ECO_1 = id("31");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const MASKIN = id("51"); // uten enhet → krever fører
const DOEGN = id("52"); // utleieEnhet «doegn»

const BRUKERE = [USER, ADMIN];
const NOKKEL = "timer.maskin.overArbeidAvvist";

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
const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

async function nySedel(opts: { status?: string; pauseMin?: number } = {}) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      aktivitetId: AKT,
      dato: new Date(nyDato()),
      status: opts.status ?? "draft",
      pauseMin: opts.pauseMin ?? 0,
    },
  });
  return sid;
}

async function timerRad(
  sheetId: string,
  f: { fra: string; til: string; timer: number; kortId: string | null; projectId?: string },
) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      lonnsartId: ORD,
      aktivitetId: AKT,
      fraTid: f.fra,
      tilTid: f.til,
      timer: f.timer,
      kortId: f.kortId,
    },
  });
  return r.id;
}

async function maskinRad(
  sheetId: string,
  f: { timer: number; kortId: string | null; sheetTimerId?: string | null; vehicleId?: string; projectId?: string },
) {
  const r = await prismaTimer.sheetMachine.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      vehicleId: f.vehicleId ?? MASKIN,
      timer: f.timer,
      kortId: f.kortId,
      sheetTimerId: f.sheetTimerId ?? null,
    },
  });
  return r.id;
}

/** Sedelens rader slik de står (for «ingenting skrevet»). */
async function tilstand(sheetId: string) {
  const [sedel, timer, maskin] = await Promise.all([
    prismaTimer.dailySheet.findUnique({ where: { id: sheetId }, select: { pauseMin: true } }),
    prismaTimer.sheetTimer.findMany({
      where: { sheetId },
      select: { id: true, timer: true, fraTid: true, tilTid: true, kortId: true, externalCostObjectId: true, attestertStatus: true },
      orderBy: { id: "asc" },
    }),
    prismaTimer.sheetMachine.findMany({
      where: { sheetId },
      select: { id: true, timer: true, kortId: true, externalCostObjectId: true, attestertStatus: true },
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    pauseMin: sedel?.pauseMin,
    timer: timer.map((t) => ({ ...t, timer: Number(t.timer) })),
    maskin: maskin.map((m) => ({ ...m, timer: Number(m.timer) })),
  };
}

/** Kallet avvises med w9-nøkkelen, og sedelen står som før. */
async function forventAvvist(sheetId: string, kall: () => Promise<unknown>) {
  const foer = await tilstand(sheetId);
  const feil = await kall().then(
    () => null,
    (e: unknown) => e,
  );
  expect(feil, "kallet skulle vært avvist").toBeInstanceOf(TRPCError);
  const t = feil as TRPCError;
  // nokkelFeil legger nøkkelen i `cause`; feilformat løfter den til data.feilNokkel.
  expect((t.cause as { feilNokkel?: string } | undefined)?.feilNokkel).toBe(NOKKEL);
  expect(t.code).toBe("BAD_REQUEST");
  expect(await tilstand(sheetId)).toEqual(foer);
}

// ── Oppsett / rydding ───────────────────────────────────────────────────────
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [MASKIN, DOEGN] } } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_1 } });
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
      { id: USER, email: "w9-maskin-1@sitedoc.test", name: "Ola Fører", role: "user" },
      { id: ADMIN, email: "w9-maskin-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "w9-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "W9-1", name: "w9 P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "W9-2", name: "w9 P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [P1, P2].map((p) => ({ userId: USER, projectId: p, role: "member" })),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.externalCostObject.create({
    data: {
      id: ECO_1,
      organizationId: ORG,
      projectId: P1,
      proAdmId: "W9-E1",
      kortNavn: "Grøft",
      kilde: "manuell",
      opprettetAvUserId: ADMIN,
    },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" },
      { id: DOEGN, organizationId: ORG, kategori: "anleggsmaskin", type: "brakke", utleieEnhet: "doegn" },
    ],
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
describe("w9 — avvisning pr. skrivevei", () => {
  it("maskin.tilfoy: Olas eksempel, arbeid 4,5 t + maskin 7,5 t → avvist", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await forventAvvist(sid, () =>
      dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 7.5, sheetTimerId: tid }),
    );
  });

  it("maskin.tilfoy: maskin lik arbeidet går gjennom", async () => {
    const sid = await nySedel();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: randomUUID() });
    await dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 4.5, sheetTimerId: tid });
    expect((await tilstand(sid)).maskin).toHaveLength(1);
  });

  it("maskin.tilfoy: døgn-maskin over arbeidet avvises aldri (B21 A)", async () => {
    const sid = await nySedel();
    await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: randomUUID() });
    await dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: DOEGN, timer: 24 });
    expect((await tilstand(sid)).maskin).toHaveLength(1);
  });

  it("maskin.oppdater: 4 → 7,5 t avvist; et gammelt brudd kan senkes (B23 B)", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    const m = await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () => dag().maskin.oppdater({ id: m, timer: 7.5 }));

    const sid2 = await nySedel();
    const k2 = randomUUID();
    const tid2 = await timerRad(sid2, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k2 });
    const m2 = await maskinRad(sid2, { timer: 7.5, kortId: k2, sheetTimerId: tid2 }); // gammelt brudd
    await dag().maskin.oppdater({ id: m2, timer: 6 });
    expect((await tilstand(sid2)).maskin[0]!.timer).toBe(6);
  });

  it("oppdaterTimerRad: arbeid 4,5 → 2 t under en maskin på 4,5 t → avvist", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await maskinRad(sid, { timer: 4.5, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () => dag().oppdaterTimerRad({ id: tid, fraTid: "07:00", tilTid: "09:00", timer: 2 }));
  });

  it("fjernTimerRad: en av jobbens to arbeidsrader fjernes, maskinen blir over → avvist", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "09:00", timer: 2, kortId: k });
    const r2 = await timerRad(sid, { fra: "09:00", til: "11:30", timer: 2.5, kortId: k });
    await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: r1 });
    await forventAvvist(sid, () => dag().fjernTimerRad({ id: r2 }));
  });

  it("oppdater (pause): eldre rader uten jobb, pausen senkes så bøtta brytes → avvist", async () => {
    // Bøtteregelen: arbeid 4,5 + 30 min pause = 5,0 ≥ maskin 5,0. Uten pausen: 4,5 < 5,0.
    const sid = await nySedel({ pauseMin: 30 });
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: null });
    await maskinRad(sid, { timer: 5, kortId: null, sheetTimerId: tid });
    await forventAvvist(sid, () => dag().oppdater({ id: sid, pauseMin: 0 }));
  });

  it("oppdater (pause): jobber påvirkes ikke av pausen (bevares)", async () => {
    const sid = await nySedel({ pauseMin: 30 });
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await maskinRad(sid, { timer: 4.5, kortId: k, sheetTimerId: tid });
    await dag().oppdater({ id: sid, pauseMin: 0 });
    expect((await tilstand(sid)).pauseMin).toBe(0);
  });

  it("splittRadEier: del 2 til annet prosjekt tar arbeid fra jobbens maskin → avvist", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4, kortId: k });
    await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () =>
      dag().splittRadEier({
        radType: "timer",
        radId: tid,
        nyeRader: [
          { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2 },
          { projectId: P2, lonnsartId: ORD, aktivitetId: AKT, fraTid: "09:00", tilTid: "11:00", timer: 2 },
        ],
      }),
    );
  });

  it("forsonDagskort: forslaget senker jobbens arbeid under maskinen → avvist (w9m)", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await maskinRad(sid, { timer: 4.5, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () =>
      dag().forsonDagskort({
        sheetId: sid,
        oppdateringer: [
          { id: tid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 2, fraTid: "07:00", tilTid: "09:00", pauseMin: 0, kortId: k },
        ],
      }),
    );
  });

  it("forsonDagskort: et gammelt brudd i en annen jobb stopper ikke ny føring (negativkontroll)", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "09:00", timer: 2, kortId: k });
    await maskinRad(sid, { timer: 5, kortId: k, sheetTimerId: tid }); // gammelt brudd i jobb P1
    await dag().forsonDagskort({
      sheetId: sid,
      nyeRader: [
        { projectId: P2, lonnsartId: ORD, aktivitetId: AKT, timer: 3, fraTid: "10:00", tilTid: "13:00", pauseMin: 0 },
      ],
    });
    expect((await tilstand(sid)).timer).toHaveLength(2);
  });

  it("tilfoyTimerRad: gammelt brudd i annen jobb stopper ikke (negativkontroll)", async () => {
    const sid = await nySedel();
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "09:00", timer: 2, kortId: k });
    await maskinRad(sid, { timer: 5, kortId: k, sheetTimerId: tid });
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P2, lonnsartId: ORD, aktivitetId: AKT,
      timer: 3, fraTid: "10:00", tilTid: "13:00", pauseMin: 0,
    });
    expect((await tilstand(sid)).timer).toHaveLength(2);
  });

  it("delJobb: del A beholder en maskin større enn arbeidet sitt → avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "09:00", timer: 2, kortId: k });
    await timerRad(sid, { fra: "09:00", til: "13:00", timer: 4, kortId: k });
    await maskinRad(sid, { timer: 5, kortId: k, sheetTimerId: r1 }); // 5 ≤ 6 før; A får 2
    await forventAvvist(sid, () =>
      dag(ADMIN).delJobb({ sheetId: sid, kortId: k, kl: "09:00", externalCostObjectIdB: ECO_1 }),
    );
  });

  it("redigerSedelRader (attestering): maskin 7,5 t på 4,5 t arbeid → avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    const m = await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () =>
      dag(ADMIN).redigerSedelRader({
        sheetId: sid,
        nyeRader: {
          timer: [
            { originalId: tid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "11:30", timer: 4.5, pauseMin: 0 },
          ],
          tillegg: [],
          maskin: [{ originalId: m, projectId: P1, vehicleId: MASKIN, timer: 7.5 }],
        },
      }),
    );
  });

  it("splittRad (attestering): del 2 til annet prosjekt → avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const tid = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4, kortId: k });
    await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: tid });
    await forventAvvist(sid, () =>
      dag(ADMIN).splittRad({
        radType: "timer",
        radId: tid,
        nyeRader: [
          { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2 },
          { projectId: P2, lonnsartId: ORD, aktivitetId: AKT, fraTid: "09:00", tilTid: "11:00", timer: 2 },
        ],
      }),
    );
  });

  it("flyttTimerRadEco (attestering): én av to rader bytter underprosjekt, maskinen står → avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "09:00", timer: 2, kortId: k });
    const r2 = await timerRad(sid, { fra: "09:00", til: "11:00", timer: 2, kortId: k });
    await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: r1 });
    await forventAvvist(sid, () => dag(ADMIN).flyttTimerRadEco({ timerRadId: r2, externalCostObjectId: ECO_1 }));
  });

  it("flyttTimerRadEco helJobb: hele jobben flyttes med maskinen → ikke avvist (negativkontroll)", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4, kortId: k });
    await maskinRad(sid, { timer: 4, kortId: k, sheetTimerId: r1 });
    await dag(ADMIN).flyttTimerRadEco({ timerRadId: r1, externalCostObjectId: ECO_1, helJobb: true });
    const s = await tilstand(sid);
    expect(s.timer[0]!.externalCostObjectId).toBe(ECO_1);
    expect(s.maskin[0]!.externalCostObjectId).toBe(ECO_1);
  });

  // RETUR 1 V1 (w9m): flyttHeleJobben beholder kortId, så jobbens summer er uendret. Et nytt
  // brudd kan bare oppstå når sikreKortId slår en rad UTEN kortId (eldre data, regel 3) inn i
  // jobben fordi den nå har samme nøkkel. Vakten i samme transaksjon avviser det.
  it("flyttTimerRadEco helJobb: eldre førermaskin uten jobb på målet slås inn → nytt brudd → avvist", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await maskinRad(sid, { timer: 4.5, kortId: k, sheetTimerId: r1 });
    await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 3, kortId: null, externalCostObjectId: ECO_1 },
    });
    await forventAvvist(sid, () =>
      dag(ADMIN).flyttTimerRadEco({ timerRadId: r1, externalCostObjectId: ECO_1, helJobb: true }),
    );
  });

  it("flyttTimerRadEco helJobb: førermaskin i en annen jobb på målet slås ikke sammen (negativkontroll)", async () => {
    const sid = await nySedel({ status: "sent" });
    const k = randomUUID();
    const k2 = randomUUID();
    const r1 = await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: k });
    await maskinRad(sid, { timer: 4.5, kortId: k, sheetTimerId: r1 });
    const r2 = await timerRad(sid, { fra: "12:00", til: "13:00", timer: 1, kortId: k2 });
    await prismaTimer.sheetTimer.update({ where: { id: r2 }, data: { externalCostObjectId: ECO_1 } });
    await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 3, kortId: k2, sheetTimerId: r2, externalCostObjectId: ECO_1 },
    });
    await dag(ADMIN).flyttTimerRadEco({ timerRadId: r1, externalCostObjectId: ECO_1, helJobb: true });
    const s = await tilstand(sid);
    expect(new Set(s.maskin.map((m) => m.kortId))).toEqual(new Set([k, k2]));
  });
});

describe("w9 — reise teller ikke som arbeid (flyttet fra enhetstestene)", () => {
  async function medReise(sid: string, k: string) {
    const tid = await timerRad(sid, { fra: "07:00", til: "14:00", timer: 7, kortId: k });
    await prismaTimer.sheetTimer.create({
      data: { sheetId: sid, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, fraTid: "06:00", tilTid: "07:00", timer: 2, erReise: true },
    });
    return tid;
  }
  it("maskin.tilfoy: maskin 7 / arbeid 7 / reise 2 → ok", async () => {
    const sid = await nySedel();
    const tid = await medReise(sid, randomUUID());
    await dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 7, sheetTimerId: tid });
    expect((await tilstand(sid)).maskin).toHaveLength(1);
  });
  it("maskin.tilfoy: maskin 8 / arbeid 7 / reise 2 → avvist", async () => {
    const sid = await nySedel();
    const tid = await medReise(sid, randomUUID());
    await forventAvvist(sid, () =>
      dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 8, sheetTimerId: tid }),
    );
  });
});

describe("w9 — syncBatch (B22 A)", () => {
  function sedel(clientUuid: string, dato: string, tid: string, maskinTimer: number, vehicleId = MASKIN) {
    return {
      clientUuid,
      projectId: P1,
      aktivitetId: AKT,
      dato,
      status: "draft" as const,
      pauseMin: 0,
      timer: [
        { id: tid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 4.5, fraTid: "07:00", tilTid: "11:30", pauseMin: 0 },
      ],
      tillegg: [],
      maskiner: [{ id: randomUUID() as string, projectId: P1, vehicleId, timer: maskinTimer, sheetTimerId: tid }],
      utlegg: [],
    };
  }
  async function sync(s: ReturnType<typeof sedel>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await dag().syncBatch({ sedler: [s as any] })).resultater[0]!;
  }

  it("ny sedel med maskin 7,5 t på 4,5 t arbeid → avvist, ingenting skrevet", async () => {
    const cu = randomUUID();
    const svar = await sync(sedel(cu, nyDato(), randomUUID(), 7.5));
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toMatch(/maskin 7,5 t, arbeid 4,5 t/);
    // w9m (plan § 5): nøkkel + parametre ved siden av nb-teksten, så telefonen viser brukerens språk.
    expect(svar.feilNokkel).toBe(NOKKEL);
    expect(svar.feilParam).toMatchObject({ maskin: "7,5", arbeid: "4,5" });
    expect(await prismaTimer.dailySheet.findUnique({ where: { clientUuid: cu } })).toBeNull();
  });

  it("eksisterende sedel: maskinen økes over arbeidet → avvist, sedelen uendret", async () => {
    const cu = randomUUID();
    const dato = nyDato();
    const tid = randomUUID();
    const ok = await sync(sedel(cu, dato, tid, 4));
    expect(ok.resultat).toBe("ok");
    const sheet = await prismaTimer.dailySheet.findUnique({ where: { clientUuid: cu }, select: { id: true } });
    const foer = await tilstand(sheet!.id);
    const s = sedel(cu, dato, tid, 7.5);
    const lagret = await prismaTimer.sheetMachine.findFirst({ where: { sheetId: sheet!.id }, select: { id: true } });
    s.maskiner[0]!.id = lagret!.id;
    const svar = await sync(s);
    expect(svar.resultat).toBe("avvist");
    expect(await tilstand(sheet!.id)).toEqual(foer);
  });

  it("S3: maskin 8 / arbeid 7 / reise 2 → avvist også ved synk (overgangen er fjernet)", async () => {
    const tid = randomUUID();
    const s = sedel(randomUUID(), nyDato(), tid, 8);
    s.timer = [
      { id: tid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 7, fraTid: "07:00", tilTid: "14:00", pauseMin: 0 },
      { id: randomUUID() as string, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, timer: 2, fraTid: "14:00", tilTid: "16:00", pauseMin: 0 },
    ];
    const svar = await sync(s);
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toMatch(/maskin 8 t, arbeid 7 t/);
  });

  it("døgn-maskin over arbeidet → ok (negativkontroll)", async () => {
    const svar = await sync(sedel(randomUUID(), nyDato(), randomUUID(), 24, DOEGN));
    expect(svar.resultat).toBe("ok");
    expect(svar.feilNokkel).toBeUndefined();
  });
});

// Tellings-SQL-en i leveransen (løsning § 5), ordrett. Testen viser at den teller det merket viser.
const TELLING_SQL = `
-- w9: jobber som venter og bryter regelen. Kjøres mot sitedoc_test og sitedoc.
WITH arbeid AS (
  SELECT t.sheet_id, t.kort_id, SUM(t.timer) AS arbeid
  FROM timer.sheet_timer t
  WHERE t.kort_id IS NOT NULL
    AND COALESCE(t.attestert_status, 'pending') <> 'erstattet'
    AND NOT t.er_reise
  GROUP BY t.sheet_id, t.kort_id
), maskin AS (
  SELECT m.sheet_id, m.kort_id,
         COALESCE(SUM(m.timer) FILTER (WHERE e.utleie_enhet IS DISTINCT FROM 'doegn'), 0) AS forer,
         COALESCE(MAX(m.timer) FILTER (WHERE e.utleie_enhet = 'doegn'), 0)               AS doegn_maks,
         BOOL_OR(COALESCE(m.attestert_status, 'pending') = 'pending')                     AS venter
  FROM timer.sheet_machines m
  LEFT JOIN maskin.equipment e ON e.id = m.vehicle_id
  WHERE COALESCE(m.attestert_status, 'pending') <> 'erstattet'
  GROUP BY m.sheet_id, m.kort_id
)
SELECT d.status,
       COUNT(*) FILTER (WHERE mk.kort_id IS NOT NULL AND mk.forer     > COALESCE(a.arbeid, 0) + 0.001) AS jobb_brudd_forer,
       COUNT(*) FILTER (WHERE mk.kort_id IS NOT NULL AND mk.doegn_maks > COALESCE(a.arbeid, 0) + 0.001) AS jobb_varsel_doegn,
       COUNT(*) FILTER (WHERE mk.kort_id IS NULL)                                                       AS maskinrader_uten_jobb
FROM maskin mk
JOIN timer.daily_sheets d ON d.id = mk.sheet_id
LEFT JOIN arbeid a ON a.sheet_id = mk.sheet_id AND a.kort_id = mk.kort_id
WHERE mk.venter
GROUP BY d.status
`;

describe("w9 — tellings-SQL", () => {
  type Rad = { status: string; jobb_brudd_forer: bigint; jobb_varsel_doegn: bigint; maskinrader_uten_jobb: bigint };
  async function utkast() {
    const rader = await prismaTimer.$queryRawUnsafe<Rad[]>(TELLING_SQL);
    const r = rader.find((x) => x.status === "draft");
    return {
      brudd: Number(r?.jobb_brudd_forer ?? 0),
      doegn: Number(r?.jobb_varsel_doegn ?? 0),
      utenJobb: Number(r?.maskinrader_uten_jobb ?? 0),
    };
  }

  it("teller ett førerbrudd, ett døgnvarsel og én maskinrad uten jobb", async () => {
    const foer = await utkast();
    const sid = await nySedel();
    const a = randomUUID();
    const b = randomUUID();
    await timerRad(sid, { fra: "07:00", til: "11:30", timer: 4.5, kortId: a });
    await maskinRad(sid, { timer: 7.5, kortId: a }); // Ola: brudd
    await timerRad(sid, { fra: "12:00", til: "16:00", timer: 4, kortId: b, projectId: P2 });
    await maskinRad(sid, { timer: 24, kortId: b, vehicleId: DOEGN, projectId: P2 }); // varsel
    await maskinRad(sid, { timer: 1, kortId: null }); // eldre rad
    await maskinRad(sid, { timer: 3, kortId: b, projectId: P2 }); // 3 ≤ 4: ikke brudd
    const etter = await utkast();
    expect({ brudd: etter.brudd - foer.brudd, doegn: etter.doegn - foer.doegn, utenJobb: etter.utenJobb - foer.utenJobb })
      .toEqual({ brudd: 1, doegn: 1, utenJobb: 1 });
  });
});
