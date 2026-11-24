import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { lesFrossetUkeFraSnapshot, lesOvertidsgrunnlagFraSnapshot, lesUkeregnestykkeFraSnapshot } from "@sitedoc/shared";
import { dagsseddelRouter } from "./timer/dagsseddel";

/**
 * A4 (plan § 4.17 del B, B50 A, B53 A, B54 A, B85 ja) — ukeregnestykket mot EKTE Postgres
 * (lokal sandkasse, aldri test/prod): serveren regner uka mandag–søndag uten reise, sender
 * den på hver sedel (`uke`), peker ut linjene først når uka er komplett, og fryser
 * regnestykket i attestert-snapshotet.
 *
 * Ukene ligger i 2030, så «uka er over» ikke slår inn før testen er gammel. Unntak: «uka er
 * over»-testen bruker uke 47 2026.
 */

const id = (n: string) => `a4a4a4a4-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("03");
const LEDER = id("04"); // prosjektadmin på P1, ikke på P2
const P1 = id("11");
const P2 = id("12");
const ORD = id("21");
const OT50 = id("22");
const EGEN = id("23");
const REISE = id("24");
const AKT = id("31");
const BRUKERE = [USER, ADMIN, LEDER];

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
const dag = (userId = ADMIN) => dagsseddelRouter.createCaller(ctx(userId));

type Rad = { timer: number; lonnsartId?: string; erReise?: boolean; projectId?: string | null; fra?: string };
async function sedel(dato: string, rader: Rad[], status = "sent") {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(dato), status },
  });
  const ider: string[] = [];
  let fra = 7;
  for (const r of rader) {
    const til = fra + r.timer;
    const hh = (n: number) => `${String(Math.floor(n)).padStart(2, "0")}:${n % 1 ? "30" : "00"}`;
    const rad = await prismaTimer.sheetTimer.create({
      data: {
        sheetId: sid,
        projectId: r.projectId === undefined ? P1 : r.projectId,
        utenProsjekt: r.projectId === null,
        lonnsartId: r.lonnsartId ?? ORD,
        aktivitetId: AKT,
        fraTid: r.fra ?? hh(fra),
        tilTid: hh(til),
        timer: r.timer,
        erReise: r.erReise ?? false,
        kortId: "kort-1",
        attestertStatus: "pending",
      },
    });
    ider.push(rad.id);
    fra = til;
  }
  return { sid, ider };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Løs = any;
const liste = async (userId = ADMIN, status: "sent" | "accepted" = "sent"): Promise<Løs[]> =>
  (await dag(userId).hentTilAttesteringFirma({ organizationId: ORG, status })) as Løs[];
const finn = async (sid: string, userId = ADMIN, status: "sent" | "accepted" = "sent") =>
  (await liste(userId, status)).find((s) => s.id === sid);

/**
 * Eksempeluka (plan § 4.17 del B): 26,5 t ordinært + 2,5 t overtid + 7,5 t egenmelding = 36,5 t,
 * pluss 1,0 t reise som ikke teller. Tirsdag er 2,5 t over dagsnorm. Mandag står på P2.
 */
async function eksempeluka(man: string) {
  const d = (i: number) => new Date(Date.parse(`${man}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
  const mandag = await sedel(d(0), [{ timer: 7.5, projectId: P2 }]);
  const tirsdag = await sedel(d(1), [{ timer: 7.5 }, { timer: 2.5, lonnsartId: OT50 }]);
  const onsdag = await sedel(d(2), [{ timer: 7.5, lonnsartId: EGEN }]);
  const torsdag = await sedel(d(3), [{ timer: 6.5 }, { timer: 1, lonnsartId: REISE, erReise: true }]);
  const fredag = await sedel(d(4), [{ timer: 5 }]);
  return { mandag, tirsdag, onsdag, torsdag, fredag };
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, OT50, EGEN, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: [P1, P2] } } });
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
      { id: USER, email: "a4-arbeider@sitedoc.test", name: "Arbeider A4", role: "user" },
      { id: ADMIN, email: "a4-admin@sitedoc.test", name: "Attestant A4", role: "sitedoc_admin" },
      { id: LEDER, email: "a4-leder@sitedoc.test", name: "Prosjektleder A4", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "A4-firma" } });
  await prisma.organizationMember.createMany({
    data: [USER, LEDER].map((u) => ({ userId: u, organizationId: ORG, status: "aktiv" })),
  });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, reiseLonnsartId: REISE, dagsnorm: 7.5 } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "A4-1", name: "A4 Synlig prosjekt", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "A4-2", name: "A4 Skjult prosjekt", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectOrganization.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, organizationId: ORG, rolle: "hovedeier" })),
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: USER, projectId: P1, role: "member" },
      { userId: USER, projectId: P2, role: "member" },
      { userId: LEDER, projectId: P1, role: "admin" },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: OT50, organizationId: ORG, type: "overtid", navn: "Overtid 50 %", overtidsnivaa: 50, aktiv: true },
      { id: EGEN, organizationId: ORG, type: "fravaer", navn: "Egenmelding", aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("A4 — eksempeluka (uke 2, 2030)", () => {
  let uke: Awaited<ReturnType<typeof eksempeluka>>;
  beforeAll(async () => {
    uke = await eksempeluka("2030-01-07");
  });

  it("ett regnestykke: 36,5 av 37,5 uten reise, 1,0 t av 2,5 t kan trekkes, bare tirsdag", async () => {
    const s = await finn(uke.tirsdag.sid);
    expect(s.uke).toMatchObject({ ukestart: "2030-01-07", komplett: true, manglerDager: [] });
    expect(s.uke.regnestykke).toMatchObject({
      ukenorm: 37.5, ukesum: 36.5, reise: 1, mangler: 1, overDagsnorm: 2.5, godtattOvertid: 1.5, sumOvertid: 2.5, kanTrekkes: 1,
    });
    const kanTrekkes = Object.fromEntries(s.uke.regnestykke.dager.map((d: Løs) => [d.dato, d.kanTrekkes]));
    expect(kanTrekkes).toEqual({ "2030-01-07": 0, "2030-01-08": 1, "2030-01-09": 0, "2030-01-10": 0, "2030-01-11": 0 });
    // Linjene: overtidslinja pekes ut, reiselinja aldri.
    expect(s.ukeAvvikRadIder).toEqual([uke.tirsdag.ider[1]]);
    expect((await finn(uke.torsdag.sid)).ukeAvvikRadIder).toEqual([]);
  });

  it("alle sedlene i uka bærer samme regnestykke (skjermen regner ikke selv)", async () => {
    const alle = (await liste()).filter((s) => s.uke?.ukestart === "2030-01-07");
    expect(alle).toHaveLength(5);
    for (const s of alle) expect(s.uke.regnestykke.kanTrekkes).toBe(1);
  });

  it("B54 A: prosjektlederen ser ukas totaltall, uten navn på andre prosjekter", async () => {
    const l = await liste(LEDER);
    const tirsdag = l.find((s) => s.id === uke.tirsdag.sid);
    expect(tirsdag.uke.regnestykke).toMatchObject({ ukesum: 36.5, kanTrekkes: 1 });
    // Mandagen står bare på P2 — den vises ikke, men timene teller i ukesummen over.
    expect(l.find((s) => s.id === uke.mandag.sid)).toBeUndefined();
    expect(JSON.stringify(l)).not.toContain("A4 Skjult prosjekt");
  });

  it("snapshotet ved attestering har ukeregnestykket og ukesum uten reise", async () => {
    await dag().attester({ id: uke.tirsdag.sid });
    const rad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: uke.tirsdag.ider[1] } });
    expect(lesUkeregnestykkeFraSnapshot(rad.attestertSnapshot)).toMatchObject({ ukesum: 36.5, kanTrekkes: 1, mangler: 1 });
    expect(lesOvertidsgrunnlagFraSnapshot(rad.attestertSnapshot)).toMatchObject({ ukeTimer: 36.5, reisetimer: 1 });
    expect(lesFrossetUkeFraSnapshot(rad.attestertSnapshot)).toMatchObject({ komplett: true, manglerDager: [] });
    // Den attesterte dagen bærer fortsatt ukas regnestykke (B53 A: står under ukelinja med ↺).
    const attestert = await finn(uke.tirsdag.sid, ADMIN, "accepted");
    expect(attestert.uke).toMatchObject({ komplett: true, regnestykke: { kanTrekkes: 1 } });
  });
});

describe("A4 — etter rettingen (B85 ja)", () => {
  it("1,0 t gjort om til ordinær tid: «kan trekkes» borte, «Under ukenorm 1,0 t» står", async () => {
    const uke = await eksempeluka("2030-02-04");
    const [ord, ot] = uke.tirsdag.ider;
    await prismaTimer.sheetTimer.update({ where: { id: ord }, data: { timer: 8.5, tilTid: "15:30" } });
    await prismaTimer.sheetTimer.update({ where: { id: ot }, data: { timer: 1.5, fraTid: "15:30", tilTid: "17:00" } });
    const s = await finn(uke.tirsdag.sid);
    expect(s.uke.regnestykke).toMatchObject({ ukesum: 36.5, mangler: 1, sumOvertid: 1.5, kanTrekkes: 0 });
    expect(s.ukeAvvikRadIder).toEqual([]);
  });
});

describe("A4 — helg og komplett uke", () => {
  it("overtid ført lørdag pekes ut", async () => {
    const man = "2030-01-14";
    const d = (i: number) => new Date(Date.parse(`${man}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    for (let i = 0; i < 4; i++) await sedel(d(i), [{ timer: 7.5 }]);
    await sedel(d(4), [{ timer: 5.5 }]);
    const lordag = await sedel(d(5), [{ timer: 1.5, lonnsartId: OT50 }]);
    const s = await finn(lordag.sid);
    expect(s.uke.regnestykke).toMatchObject({ ukesum: 37, mangler: 0.5, kanTrekkes: 1.5 });
    expect(s.ukeAvvikRadIder).toEqual([lordag.ider[0]]);
  });

  it("to arbeidsdager mangler: uka er ikke komplett, ingen linjer pekes ut", async () => {
    const man = "2030-01-28";
    const d = (i: number) => new Date(Date.parse(`${man}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    const mandag = await sedel(d(0), [{ timer: 7.5 }, { timer: 2, lonnsartId: OT50 }]);
    await sedel(d(1), [{ timer: 7.5 }]);
    await sedel(d(2), [{ timer: 7.5 }]);
    await sedel(d(3), [{ timer: 7.5 }], "draft"); // utkast = mangler
    const s = await finn(mandag.sid);
    expect(s.uke).toMatchObject({ komplett: false, manglerDager: [d(3), d(4)] });
    // Regnestykket står («uka så langt»), men linjene merkes ikke før uka er komplett.
    expect(s.uke.regnestykke).toMatchObject({ ukesum: 24.5, kanTrekkes: 2 });
    expect(s.ukeAvvikRadIder).toEqual([]);
  });

  it("uka er over: komplett selv om dager mangler", async () => {
    const mandag = await sedel("2026-11-16", [{ timer: 7.5 }, { timer: 2, lonnsartId: OT50 }]);
    const s = await finn(mandag.sid);
    expect(s.uke.komplett).toBe(true);
    expect(s.uke.manglerDager).toHaveLength(4);
    expect(s.ukeAvvikRadIder).toEqual([mandag.ider[1]]);
  });
});

const dagI = (man: string, i: number) => new Date(Date.parse(`${man}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);

describe("A4 RETUR vilkår 1 — B54 A: prosjektlederen får dagstall bare for dager hen ser", () => {
  it("mandagen på P2 og dagen med bare fravær uten prosjekt står ikke i lederens dager[]", async () => {
    const man = "2030-02-11";
    await sedel(dagI(man, 0), [{ timer: 7.5, projectId: P2 }]);
    const tirsdag = await sedel(dagI(man, 1), [{ timer: 7.5 }, { timer: 2.5, lonnsartId: OT50 }]);
    await sedel(dagI(man, 2), [{ timer: 7.5, lonnsartId: EGEN, projectId: null }]);
    // Attestanten (firma) ser alle tre dagene.
    const admin = await finn(tirsdag.sid);
    expect(admin.uke.regnestykke.dager.map((d: Løs) => d.dato)).toEqual([dagI(man, 0), dagI(man, 1), dagI(man, 2)]);
    // Lederen: ukas totaltall som før, dagstall bare for tirsdagen.
    const leder = await finn(tirsdag.sid, LEDER);
    expect(leder.uke.regnestykke).toMatchObject({ ukesum: 25, sumOvertid: 2.5, fravaer: 7.5 });
    expect(leder.uke.regnestykke.dager.map((d: Løs) => d.dato)).toEqual([dagI(man, 1)]);
    // Detaljen: lederen får bare sedelens egen dag.
    const detalj = (await dag(LEDER).hentForAttestering({ id: tirsdag.sid })) as Løs;
    expect(detalj.uke.regnestykke.dager.map((d: Løs) => d.dato)).toEqual([dagI(man, 1)]);
  });
});

describe("A4 RETUR vilkår 2 — frosset regnestykke fra en uke som ikke var komplett", () => {
  it("dag med overtid attestert mens to arbeidsdager mangler: detaljen peker ikke ut linjer", async () => {
    const man = "2030-02-18";
    const mandag = await sedel(dagI(man, 0), [{ timer: 7.5 }, { timer: 2, lonnsartId: OT50 }]);
    await sedel(dagI(man, 1), [{ timer: 7.5 }]);
    await sedel(dagI(man, 2), [{ timer: 7.5 }]);
    await dag().attester({ id: mandag.sid });
    const rad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: mandag.ider[1] } });
    expect(lesFrossetUkeFraSnapshot(rad.attestertSnapshot)).toMatchObject({
      komplett: false,
      manglerDager: [dagI(man, 3), dagI(man, 4)],
      regnestykke: { kanTrekkes: 2 },
    });
    const detalj = (await dag().hentForAttestering({ id: mandag.sid })) as Løs;
    expect(detalj.ukeAvvikRadIder).toEqual([]);
    expect(detalj.uke).toMatchObject({ komplett: false, manglerDager: [dagI(man, 3), dagI(man, 4)] });
  });
});

