import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O27 SLETTET-ER-SLETTET (Kenneth 2026-11-26): «det er noen gamle sedler som er slettet ->
 * men kommer tilbake … Når en timerad slettes -> da må den slettes helt».
 * (Fra O26 C, som målte at en sedel slettet på web gjenoppsto via telefonens push.)
 *
 * Det som er slettet på PC, kommer aldri tilbake fra telefonen:
 *  - slettedørene skriver sporet `timer.slettet_fra_pc` i samme transaksjon;
 *  - `syncBatch` avviser en sporet sedel (grunn `slettetPaPc`) og skriver aldri sporede rader
 *    (heller ikke som forslag, R7);
 *  - pull sender sedel-sporene (`slettetPaPc`), så telefonen fjerner kopien.
 *
 * Mot ekte Postgres (lokal sandkasse). Faste id-er med prefiks 0260e5f0, ryddes i afterAll.
 */

const id = (n: string) => `0260e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("03");
const P1 = id("11");
const P2 = id("12");
const TL = id("41"); // Timelønn
const TILLEGG = id("44");
const AKT = id("43");
const BRUKERE = [USER, ADMIN];

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


const raderPaa = (sheetId: string) =>
  prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { createdAt: "asc" } });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.slettetFraPc.deleteMany({ where: { userId: { in: BRUKERE } } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: TL } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "o26-arbeider@sitedoc.test", name: "Arbeider O26", role: "user" },
      { id: ADMIN, email: "o26-admin@sitedoc.test", name: "Admin O26", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "O26-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O26-1", name: "O26 P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.project.create({ data: { id: P2, projectNumber: "O26-2", name: "O26 P2", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P2, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P2, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.create({
    data: { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "antall" } });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort" },
  });
}

function iDag(offsetDager = 0): string {
  return new Date(Date.now() - offsetDager * 86_400_000).toISOString().slice(0, 10);
}

type Ekstra = Record<string, unknown>;
function telefonSedel(clientUuid: string, dato: string, radId: string, ekstraRad: Ekstra = {}, tillegg: Ekstra[] = []) {
  return {
    clientUuid, projectId: P1, aktivitetId: AKT, dato, status: "draft" as const, pauseMin: 0,
    timer: [{
      id: radId, projectId: P1, lonnsartId: TL, aktivitetId: AKT, timer: 4,
      fraTid: "07:00", tilTid: "11:00", pauseMin: 0, ...ekstraRad,
    }],
    tillegg, maskiner: [], utlegg: [],
  };
}
async function push(sedel: ReturnType<typeof telefonSedel>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svar = await dag().syncBatch({ sedler: [sedel as any] });
  return svar.resultater[0]!;
}
const spor = (id: string) => prismaTimer.slettetFraPc.findUnique({ where: { id } });

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O27 — sedel slettet på PC kommer ikke tilbake", () => {
  it("telefonen har sedelen med usendte endringer: push lager ingenting og svarer «slettet på PC»", async () => {
    const sid = randomUUID();
    const dato = iDag(1);
    expect((await push(telefonSedel(sid, dato, randomUUID()))).resultat).toBe("ok");
    await dag().slett({ id: sid });
    // Sporet står (stille tomhet er forbudt).
    const s = await spor(sid);
    expect(s).not.toBeNull();
    expect(s!.type).toBe("sedel");
    expect(s!.userId).toBe(USER);
    expect(s!.dato.toISOString().slice(0, 10)).toBe(dato);
    // Neste push med samme sedel (pending på telefonen).
    const svar = await push(telefonSedel(sid, dato, randomUUID()));
    expect(svar.resultat).toBe("avvist");
    expect(svar.grunn).toBe("slettetPaPc");
    expect(svar.feilNokkel).toBe("timer.sync.slettetPaPc");
    expect(await prismaTimer.dailySheet.findUnique({ where: { id: sid } })).toBeNull();
    expect(await raderPaa(sid)).toHaveLength(0);
  });

  it("pull sender sporet, også for en gammel dag utenfor vinduet", async () => {
    const sid = randomUUID();
    const dato = iDag(200);
    await push(telefonSedel(sid, dato, randomUUID()));
    await dag().slett({ id: sid });
    const pull = await dag().hentEndringerSiden({ maksDagerTilbake: 30 });
    expect(pull.slettetPaPc).toContainEqual({ id: sid, clientUuid: sid, dato });
    expect(pull.levendeSedler.map((s) => s.id)).not.toContain(sid);
  });

  it("vakt: idempotent re-send av en levende sedel er fortsatt ok", async () => {
    const sid = randomUUID();
    const rad = randomUUID();
    const dato = iDag(3);
    expect((await push(telefonSedel(sid, dato, rad))).resultat).toBe("ok");
    expect((await push(telefonSedel(sid, dato, rad))).resultat).toBe("ok");
    expect(await raderPaa(sid)).toHaveLength(1);
  });
});

describe("O27 — rad slettet på PC kommer ikke tilbake", () => {
  it("timerad slettet på web, ENDRET på telefonen: skrives ikke, ingen forslag, svaret ber telefonen fjerne den", async () => {
    const sid = randomUUID();
    const dato = iDag(4);
    const radA = randomUUID();
    await push(telefonSedel(sid, dato, radA));
    const lagret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radA } });
    await dag().fjernTimerRad({ id: radA });
    expect((await spor(radA))?.type).toBe("timer");
    const svar = await push(telefonSedel(sid, dato, radA, {
      serverVersjon: lagret.updatedAt.toISOString(),
      endretLokalt: true,
      tilTid: "12:00",
      timer: 5,
    }));
    expect(svar.resultat).toBe("ok");
    expect(svar.serverData?.slettetPaPc).toEqual([radA]);
    expect(svar.serverData?.hoppetOver).toContain(radA);
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radA } })).toBeNull();
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("timerad slettet på web, eldre app uten versjon (R11): skrives ikke", async () => {
    const sid = randomUUID();
    const dato = iDag(5);
    const radA = randomUUID();
    await push(telefonSedel(sid, dato, radA));
    await dag().fjernTimerRad({ id: radA });
    await push(telefonSedel(sid, dato, radA));
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radA } })).toBeNull();
  });

  it("tillegg slettet på web (payload-replace): skrives ikke på nytt", async () => {
    const sid = randomUUID();
    const dato = iDag(6);
    const radA = randomUUID();
    const tl = { id: randomUUID(), projectId: P1, tilleggId: TILLEGG, antall: 2 };
    expect((await push(telefonSedel(sid, dato, radA, {}, [tl]))).resultat).toBe("ok");
    await dag().fjernTilleggRad({ id: tl.id });
    expect((await spor(tl.id))?.type).toBe("tillegg");
    const svar = await push(telefonSedel(sid, dato, radA, {}, [{ ...tl, antall: 3 }]));
    expect(svar.resultat).toBe("ok");
    expect(svar.serverData?.slettetPaPc).toEqual([tl.id]);
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: tl.id } })).toBeNull();
  });

  it("«Slett jobben»: jobbens rader får spor og kommer ikke tilbake", async () => {
    const sid = randomUUID();
    const dato = iDag(7);
    const radA = randomUUID();
    await push(telefonSedel(sid, dato, radA));
    const kortId = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radA } })).kortId!;
    await dag().slettKort({ id: sid, kortId });
    expect((await spor(radA))?.type).toBe("timer");
    await push(telefonSedel(sid, dato, radA, { kortId }));
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radA } })).toBeNull();
  });

  it("«Flytt jobb» med «Slett reisen»: reisen får spor og kommer ikke tilbake (dør 9)", async () => {
    const sid = randomUUID();
    const dato = iDag(9);
    const jobb = randomUUID();
    const reise = randomUUID();
    const reiseRad = {
      id: reise, projectId: P1, lonnsartId: TL, aktivitetId: AKT, timer: 1,
      fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true, reiseKilde: "manuell",
    };
    const sedel = telefonSedel(sid, dato, jobb);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await push({ ...sedel, timer: [...sedel.timer, reiseRad] as any[] })).resultat).toBe("ok");
    const kortId = (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: jobb } })).kortId!;
    await prismaTimer.sheetTimer.update({ where: { id: reise }, data: { kortId } });
    const lagret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: reise } });

    await dag().flyttJobb({ sheetId: sid, kortId, projectId: P2, byggeplassId: null, reise: { valg: "slett" } });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: reise } })).toBeNull();
    expect((await spor(reise))?.type).toBe("timer");

    const svar = await push({
      ...sedel,
      timer: [
        { ...sedel.timer[0]!, projectId: P2, kortId },
        { ...reiseRad, kortId, serverVersjon: lagret.updatedAt.toISOString(), endretLokalt: true, tilTid: "07:30", timer: 1.5 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any[],
    });
    expect(svar.serverData?.slettetPaPc).toContain(reise);
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: reise } })).toBeNull();
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("vakt: ny rad på samme sedel (ingen spor) skrives som før", async () => {
    const sid = randomUUID();
    const dato = iDag(8);
    const radA = randomUUID();
    await push(telefonSedel(sid, dato, radA));
    await dag().fjernTimerRad({ id: radA });
    const radB = randomUUID();
    await push(telefonSedel(sid, dato, radB));
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radB } })).not.toBeNull();
  });
});
