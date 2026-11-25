import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { sikreKortId } from "../services/timer/kortId";
import { angreDelOppKort } from "../services/timer/angreDelOpp";

/**
 * D2h (plan § 4.16 del H, Kenneth 2026-11-25) — «↶ Angre del opp» (`angreDelJobb`) mot EKTE
 * Postgres (lokal sandkasse, aldri test/prod):
 *  1: del (timerad delt + rad til B, maskin delt, vare koblet om) → flytt tillegg og vare (1 av 3)
 *     til B → angre = tilstanden før delingen, linje for linje.
 *  2: Kenneths test (07:00–12:00 pause 30) → flytt maskin og vare (1 av 3) til B → angre = før.
 *  3: avvisning når en linje er attestert (timer, tillegg, maskin, vare), ingen linje endret —
 *     heller ikke vare og utlegg; knappen skjules (`angreDelOppKort`).
 *  4: rettet etter delingen, linjer fra et tredje kort, ett steg tilbake, eldre logg-post.
 *  5: «Korrigert av» hos arbeideren etter angringen: før = etter gir ingen merke.
 *  6: vare-sjekken i målkortet for `flyttLinjeTilKort`.
 *
 * All data lages her med faste id-er (prefiks d2ab0d00) og ryddes i afterAll.
 */

const id = (n: string) => `d2ab0d00-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ARB = id("03");
const ATT = id("04");
const P1 = id("11");
const ECO_TILL = id("31");
const ORD = id("41");
const AKT = id("43");
const MASKIN = id("51");
const MASKIN2 = id("52");
const VARE = id("61");
const TL = id("71");
const KAT = id("72");
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
const dag = (userId: string) => dagsseddelRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 10, 2) + datoTeller++ * 86_400_000);

type Rad = { fra: string; til: string; timer: number; pause?: number };

/** Sedel med ett kort (A, «Uten»): timeradene, én maskin, tillegg, utlegg og vare (3 sekk). */
async function nyDag(o: { rader: Rad[]; maskinTimer: number; maskinRad?: number; vareRad?: number }) {
  const sheetId = randomUUID();
  const dato = nyDato();
  const kortId = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sheetId, clientUuid: sheetId, organizationId: ORG, userId: ARB, registrertAvUserId: ARB, aktivitetId: AKT, dato, status: "sent",
      // Hodets pause = sum av radenes (som `synkroniserHodePause` holder den).
      pauseMin: o.rader.reduce((s, r) => s + (r.pause ?? 0), 0) },
  });
  const rader: string[] = [];
  for (const r of o.rader) {
    const ny = await prismaTimer.sheetTimer.create({
      data: { sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: r.fra, tilTid: r.til, timer: r.timer, pauseMin: r.pause ?? 0, kortId },
    });
    rader.push(ny.id);
  }
  const maskin = await prismaTimer.sheetMachine.create({
    data: { sheetId, sheetTimerId: rader[o.maskinRad ?? 0]!, vehicleId: MASKIN, projectId: P1, timer: o.maskinTimer, kortId },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({ data: { sheetId, tilleggId: TL, projectId: P1, antall: 1, kortId } });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId: P1, expenseCategoryId: KAT, belop: 120, ordningVedFoering: "utlegg", kortId },
  });
  const vare = await prismaVarelager.vareforbruk.create({
    data: { dato, projectId: P1, vareId: VARE, antall: 3, registrertAvUserId: ARB, dagsseddelId: sheetId, sheetTimerId: rader[o.vareRad ?? 0]!, kortId },
  });
  await sikreKortId(prismaTimer, sheetId);
  return { sheetId, kortId, rader, maskin: maskin.id, tillegg: tillegg.id, utlegg: utlegg.id, vare: vare.id };
}

/** Alle linjene på sedelen med feltene delingen og angringen kan endre. */
async function tilstand(sheetId: string) {
  const [sedel, timer, maskiner, tillegg, utlegg, varer] = await Promise.all([
    prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sheetId }, select: { pauseMin: true } }),
    prismaTimer.sheetTimer.findMany({
      where: { sheetId },
      select: {
        id: true, kortId: true, externalCostObjectId: true, byggeplassId: true, fraTid: true, tilTid: true, timer: true, pauseMin: true,
        lonnsartId: true, parentRadId: true, attestertStatus: true, erReise: true,
      },
      orderBy: { id: "asc" },
    }),
    prismaTimer.sheetMachine.findMany({
      where: { sheetId },
      select: { id: true, kortId: true, externalCostObjectId: true, byggeplassId: true, sheetTimerId: true, timer: true, attestertStatus: true },
      orderBy: { id: "asc" },
    }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true, byggeplassId: true }, orderBy: { id: "asc" } }),
    prismaTimer.sheetUtlegg.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true, byggeplassId: true }, orderBy: { id: "asc" } }),
    prismaVarelager.vareforbruk.findMany({
      where: { dagsseddelId: sheetId },
      select: { id: true, kortId: true, externalCostObjectId: true, byggeplassId: true, sheetTimerId: true, antall: true, attestertSnapshot: true },
      orderBy: { id: "asc" },
    }),
  ]);
  return JSON.parse(JSON.stringify({ sedel, timer, maskiner, tillegg, utlegg, varer })) as unknown;
}

const del = (sheetId: string, kortId: string, kl: string) =>
  dag(ATT).delJobb({ sheetId, kortId, kl, externalCostObjectIdB: ECO_TILL }).then((r) => r.kortIdB!);
const flytt = (sheetId: string, radType: "maskin" | "tillegg" | "utlegg" | "vare", radId: string, tilKortId: string, mengde?: number) =>
  dag(ATT).flyttLinjeTilKort({ sheetId, radType, radId, tilKortId, ...(mengde !== undefined ? { mengde } : {}) });
const angre = (sheetId: string, kortId: string, userId = ATT) => dag(userId).angreDelJobb({ sheetId, kortId });
const knapper = async (sheetId: string) => (await angreDelOppKort({ prisma, prismaTimer, prismaVarelager } as never, [sheetId])).get(sheetId) ?? [];

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [MASKIN, MASKIN2] } } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TL } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KAT } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: ORD } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_TILL } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "d2h-arbeider@sitedoc.test", name: "Ola arbeider", role: "user" },
      { id: ATT, email: "d2h-attestant@sitedoc.test", name: "Kari attestant", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "d2h-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: ATT, organizationId: ORG, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, tillattRedigerVedAttestering: true } });
  await prisma.project.create({ data: { id: P1, projectNumber: "D2H-1", name: "d2h P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P1, role: "member" },
      { userId: ATT, projectId: P1, role: "member", kanAttestere: true },
    ],
  });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.externalCostObject.create({
    data: { id: ECO_TILL, organizationId: ORG, projectId: P1, proAdmId: "TILL-001", kortNavn: "Tilleggsarbeid kantstein", kilde: "manuell", opprettetAvUserId: ATT },
  });
  await prismaTimer.lonnsart.create({ data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TL, organizationId: ORG, navn: "Smusstillegg", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KAT, organizationId: ORG, navn: "Parkering" } });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" },
      { id: MASKIN2, organizationId: ORG, kategori: "anleggsmaskin", type: "hjullaster" },
    ],
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Fugesand", enhet: "sekk" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

/** To rader (07–11 og 11:30–13:30), maskin 4 t på rad 1, vare på rad 2; delt kl 10:00. */
async function delMedToRader() {
  const d = await nyDag({ rader: [{ fra: "07:00", til: "11:00", timer: 4 }, { fra: "11:30", til: "13:30", timer: 2 }], maskinTimer: 4, vareRad: 1 });
  const foer = await tilstand(d.sheetId);
  const kortB = await del(d.sheetId, d.kortId, "10:00");
  return { ...d, foer, kortB };
}

describe("D2h test 1 — del, flytt, angre = før delingen", () => {
  it("timerad delt + rad til B, maskin delt, vare koblet om, tillegg og 1 av 3 sekk flyttet: alt som før", async () => {
    const d = await delMedToRader();
    // Delingen gjorde det den skulle: maskinen er delt, varen koblet om til en rad i A.
    const etterDel = await prismaTimer.sheetMachine.findMany({ where: { sheetId: d.sheetId } });
    expect(etterDel).toHaveLength(2);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: d.vare } })).sheetTimerId).toBe(d.rader[0]);
    await flytt(d.sheetId, "tillegg", d.tillegg, d.kortB);
    const { nyId } = await flytt(d.sheetId, "vare", d.vare, d.kortB, 1);
    expect(nyId).toBeTruthy();
    expect(await knapper(d.sheetId)).toEqual([d.kortB]);

    const svar = await angre(d.sheetId, d.kortB);
    expect(svar.kortIdA).toBe(d.kortId);
    expect(await tilstand(d.sheetId)).toEqual(d.foer);
    expect(await knapper(d.sheetId)).toEqual([]);
    const logg = await prisma.activity.findFirstOrThrow({ where: { targetId: d.sheetId, action: "angre_del_jobb" } });
    expect(logg.payload).toMatchObject({ kortIdA: d.kortId, kortIdB: d.kortB });
  });

  it("del opp kan gjøres igjen etter angringen", async () => {
    const d = await delMedToRader();
    await angre(d.sheetId, d.kortB);
    const nyB = await del(d.sheetId, d.kortId, "10:00");
    expect(await knapper(d.sheetId)).toEqual([nyB]);
    await angre(d.sheetId, nyB);
    expect(await tilstand(d.sheetId)).toEqual(d.foer);
  });
});

describe("D2h test 2 — Kenneths test (07:00–12:00, pause 30)", () => {
  it("del kl 09:00, flytt maskin og 1 av 3 sekk til B, angre: fra–til, pause, timer, maskin og vare som før", async () => {
    const d = await nyDag({ rader: [{ fra: "07:00", til: "12:00", timer: 4.5, pause: 30 }], maskinTimer: 1 });
    const foer = await tilstand(d.sheetId);
    const kortB = await del(d.sheetId, d.kortId, "09:00");
    await flytt(d.sheetId, "maskin", d.maskin, kortB);
    await flytt(d.sheetId, "vare", d.vare, kortB, 1);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: d.maskin } })).kortId).toBe(kortB);
    await angre(d.sheetId, kortB);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });
});

describe("D2h test 3 — avvisning når en linje er attestert (ingen linje endret)", () => {
  const tilfeller: { navn: string; sett: (d: Awaited<ReturnType<typeof delMedToRader>>) => Promise<unknown> }[] = [
    { navn: "timerad i B", sett: (d) => prismaTimer.sheetTimer.updateMany({ where: { kortId: d.kortB }, data: { attestertStatus: "attestert" } }) },
    { navn: "tillegg i A", sett: (d) => prismaTimer.sheetTillegg.update({ where: { id: d.tillegg }, data: { attestertStatus: "attestert" } }) },
    { navn: "maskin i A", sett: (d) => prismaTimer.sheetMachine.update({ where: { id: d.maskin }, data: { attestertStatus: "attestert" } }) },
    {
      navn: "vare i A (øyeblikksbilde)",
      sett: (d) => prismaVarelager.vareforbruk.update({ where: { id: d.vare }, data: { attestertSnapshot: { attestertVed: "2026-11-25" } } }),
    },
  ];
  for (const t of tilfeller) {
    it(`${t.navn}: avvist, knappen skjult, vare og utlegg uendret`, async () => {
      const d = await delMedToRader();
      await flytt(d.sheetId, "utlegg", d.utlegg, d.kortB);
      await t.sett(d);
      const foer = await tilstand(d.sheetId);
      await expect(angre(d.sheetId, d.kortB)).rejects.toThrow(/alle linjene i begge kortene venter/);
      expect(await tilstand(d.sheetId)).toEqual(foer);
      expect(await knapper(d.sheetId)).toEqual([]);
    });
  }

  it("utlegget flyttet til B kommer tilbake til A når alt venter", async () => {
    const d = await delMedToRader();
    await flytt(d.sheetId, "utlegg", d.utlegg, d.kortB);
    await angre(d.sheetId, d.kortB);
    expect(await tilstand(d.sheetId)).toEqual(d.foer);
  });
});

describe("D2h test 4 — avvisninger og ett steg tilbake", () => {
  it("rettet etter delingen (fra–til på del B): avvist, knappen står, ingen linje endret", async () => {
    const d = await delMedToRader();
    await prismaTimer.sheetTimer.updateMany({ where: { kortId: d.kortB, parentRadId: d.rader[0] }, data: { tilTid: "10:45", timer: 0.75 } });
    const foer = await tilstand(d.sheetId);
    expect(await knapper(d.sheetId)).toEqual([d.kortB]);
    await expect(angre(d.sheetId, d.kortB)).rejects.toThrow(/rettet etter delingen/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });

  it("underprosjektet på B teller ikke som retting", async () => {
    const d = await delMedToRader();
    await prismaTimer.sheetTimer.updateMany({ where: { kortId: d.kortB }, data: { externalCostObjectId: null } });
    await angre(d.sheetId, d.kortB);
    expect(await tilstand(d.sheetId)).toEqual(d.foer);
  });

  it("linje fra et tredje kort i B: avvist, ingen linje endret", async () => {
    const d = await delMedToRader();
    // Et tredje kort på samme prosjekt med et tillegg som flyttes til B.
    const kortC = randomUUID();
    await prismaTimer.sheetTimer.create({
      data: { sheetId: d.sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "14:00", tilTid: "15:00", timer: 1, kortId: kortC },
    });
    const tilleggC = await prismaTimer.sheetTillegg.create({ data: { sheetId: d.sheetId, tilleggId: TL, projectId: P1, antall: 1, kortId: kortC } });
    await flytt(d.sheetId, "tillegg", tilleggC.id, d.kortB);
    const foer = await tilstand(d.sheetId);
    await expect(angre(d.sheetId, d.kortB)).rejects.toThrow(/linjer fra et annet kort/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });

  it("B delt videre (B → B + C): bare C har knappen; C så B gir jobben som før", async () => {
    const d = await delMedToRader();
    const kortC = await del(d.sheetId, d.kortB, "12:30");
    expect(await knapper(d.sheetId)).toEqual([kortC]);
    await expect(angre(d.sheetId, d.kortB)).rejects.toThrow(/delt videre/);
    await angre(d.sheetId, kortC);
    expect(await knapper(d.sheetId)).toEqual([d.kortB]);
    await angre(d.sheetId, d.kortB);
    expect(await tilstand(d.sheetId)).toEqual(d.foer);
  });

  it("kort som ikke kom fra «Del opp» avvises", async () => {
    const d = await delMedToRader();
    await expect(angre(d.sheetId, d.kortId)).rejects.toThrow(/kom ikke fra «Del opp»/);
  });

  it("arbeideren kan ikke angre på egen sedel", async () => {
    const d = await delMedToRader();
    await expect(angre(d.sheetId, d.kortB, ARB)).rejects.toThrow();
  });

  it("eldre «Del opp»-post uten kortIdA/kortIdB kjennes på delt/tilB", async () => {
    const d = await delMedToRader();
    const post = await prisma.activity.findFirstOrThrow({ where: { targetId: d.sheetId, action: "del_jobb" } });
    const { kortIdA: _a, kortIdB: _b, vareOmkoblet: _v, ...gammel } = post.payload as Record<string, unknown>;
    const maskinOmkoblet = ((gammel.maskinOmkoblet as { id: string }[]) ?? []).map((m) => m.id);
    await prisma.activity.update({ where: { id: post.id }, data: { payload: { ...gammel, maskinOmkoblet } as never } });
    expect(await knapper(d.sheetId)).toEqual([d.kortB]);
    await angre(d.sheetId, d.kortB);
    const etter = (await tilstand(d.sheetId)) as { timer: unknown; maskiner: unknown; varer: { sheetTimerId: string }[] };
    const foer = d.foer as typeof etter;
    expect(etter.timer).toEqual(foer.timer);
    expect(etter.maskiner).toEqual(foer.maskiner);
    // Eldre post har ikke varens kobling: varen står i A, koblet til en rad i A.
    expect(d.rader).toContain(etter.varer[0]!.sheetTimerId);
  });
});

describe("D2h test 5 — «Korrigert av» etter angringen", () => {
  it("før = etter gir ingen merke på timeradene og maskinen", async () => {
    const d = await delMedToRader();
    await angre(d.sheetId, d.kortB);
    const s = (await dag(ARB).hentMedId({ id: d.sheetId })) as unknown as {
      korrigeringer: Record<string, Record<string, unknown> | undefined>;
    };
    for (const r of d.rader) expect(s.korrigeringer.timer?.[r]).toBeUndefined();
    expect(s.korrigeringer.maskin?.[d.maskin]).toBeUndefined();
  });
});

describe("D2h test 6 — vare-sjekken i målkortet (flyttLinjeTilKort)", () => {
  it("målkort med attestert vare avviser flyttingen, ingen linje endret", async () => {
    const d = await delMedToRader();
    const { nyId } = await flytt(d.sheetId, "vare", d.vare, d.kortB, 1);
    await prismaVarelager.vareforbruk.update({ where: { id: nyId! }, data: { attestertSnapshot: { attestertVed: "2026-11-25" } } });
    const foer = await tilstand(d.sheetId);
    await expect(flytt(d.sheetId, "tillegg", d.tillegg, d.kortB)).rejects.toThrow(/Målkortet har linjer som ikke venter/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });
});
