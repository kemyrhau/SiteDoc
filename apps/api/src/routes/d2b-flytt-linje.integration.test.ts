import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { sikreKortId } from "../services/timer/kortId";

/**
 * D2b (plan § 4.16 del G, B68 ja, B74 ja) — `flyttLinjeTilKort` mot EKTE Postgres (lokal
 * sandkasse, aldri test/prod). Testene 4–10 og 27 i del G:
 *  4: tillegg, utlegg og maskin får målkortets kort-id og underprosjekt; maskinen kobles til en
 *     timerad i målkortet; kortinvarianten holder.
 *  5: kort A og kort B har begge «Uten» — linja står i B etterpå (DG10).
 *  6: vare hel og delt (1 av 3 → 2 i A og 1 i B, koblet til en timerad i hvert kort, sum 3).
 *  7: reise flyttes; målkort på et annet prosjekt avvises.
 *  8: grensene, én test pr. avvisning, ingen linje endret.
 *  9: en attestant som bare har attesteringsrett, kan flytte en vare (DG12).
 * 10: arbeideren ser «Korrigert av» på en flyttet linje (underprosjektet endret).
 * 27: kort med tre kort på prosjektet — flytting til hvert av dem; attestert målkort avvises.
 * Lesning 2 (orkestrator 2026-11-24): maskin til et kort med for lite arbeid avvises (DO15).
 *
 * All data lages her med faste id-er (prefiks d2ab0b00) og ryddes i afterAll.
 */

const id = (n: string) => `d2ab0b00-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02");
const ARB = id("03"); // arbeideren
const ATT = id("04"); // attestant på P1 (bare kanAttestere, ikke prosjekt- eller firmaadmin)
const ARB2 = id("05"); // arbeider i ORG2
const P1 = id("11");
const P2 = id("12"); // ATT er medlem uten attesteringsrett
const P3 = id("13"); // ORG2
const ECO_TILL = id("31");
const ORD = id("41");
const AKT = id("43");
const AKT2 = id("44");
const MASKIN = id("51");
const VARE = id("61");
const TL = id("71");
const KAT = id("72");

const BRUKERE = [ARB, ATT, ARB2];

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
const nyDato = () => new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000);

type KortOppsett = { fra: string; til: string; timer: number; eco: string | null; attestert?: boolean };

/**
 * Sedel med kort A (07:00–11:00, «Uten») og kort B (som oppgitt), på samme prosjekt.
 * Kort A har maskin (koblet), tillegg, utlegg, reise og vare (3 sekk, koblet).
 */
async function nyDag(o: { b?: KortOppsett; ekstra?: KortOppsett[]; status?: string; eier?: string; projectId?: string; maskinTimer?: number } = {}) {
  const projectId = o.projectId ?? P1;
  const eier = o.eier ?? ARB;
  const org = projectId === P3 ? ORG2 : ORG;
  const sheetId = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: {
      id: sheetId, clientUuid: sheetId, organizationId: org, userId: eier, registrertAvUserId: eier,
      aktivitetId: org === ORG ? AKT : AKT2, dato, status: o.status ?? "sent",
    },
  });
  const kort = async (k: KortOppsett) => {
    const kortId = randomUUID();
    const r = await prismaTimer.sheetTimer.create({
      data: {
        sheetId, projectId, lonnsartId: ORD, aktivitetId: org === ORG ? AKT : AKT2, fraTid: k.fra, tilTid: k.til, timer: k.timer,
        externalCostObjectId: k.eco, kortId, attestertStatus: k.attestert ? "attestert" : "pending",
      },
    });
    return { kortId, rad: r.id };
  };
  const a = await kort({ fra: "07:00", til: "11:00", timer: 4, eco: null });
  const b = await kort(o.b ?? { fra: "11:00", til: "15:00", timer: 4, eco: ECO_TILL });
  const ekstra = [];
  for (const k of o.ekstra ?? []) ekstra.push(await kort(k));
  const maskin = await prismaTimer.sheetMachine.create({
    data: { sheetId, sheetTimerId: a.rad, vehicleId: MASKIN, projectId, timer: o.maskinTimer ?? 2, kortId: a.kortId },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({
    data: { sheetId, tilleggId: TL, projectId, antall: 1, kortId: a.kortId },
  });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId, expenseCategoryId: KAT, belop: 120, ordningVedFoering: "utlegg", kortId: a.kortId },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId, lonnsartId: ORD, aktivitetId: org === ORG ? AKT : AKT2, fraTid: "11:00", tilTid: "11:20", timer: 0.33,
      erReise: true, kortId: a.kortId,
    },
  });
  const vare = await prismaVarelager.vareforbruk.create({
    data: {
      dato, projectId, vareId: VARE, antall: 3, registrertAvUserId: eier, dagsseddelId: sheetId,
      sheetTimerId: a.rad, kortId: a.kortId,
    },
  });
  return { sheetId, a, b, ekstra, maskin: maskin.id, tillegg: tillegg.id, utlegg: utlegg.id, reise: reise.id, vare: vare.id };
}

async function settRedigering(paa: boolean) {
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { tillattRedigerVedAttestering: paa } });
}

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
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TL } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KAT } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: ORD } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT2] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_TILL } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2, P3] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2, P3] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2, P3] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "d2b-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: ATT, email: "d2b-attestant@sitedoc.test", name: "Kari ansatt", role: "user" },
      { id: ARB2, email: "d2b-arbeider-annet@sitedoc.test", name: "Arbeider annet firma", role: "user" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "d2b-firma" }, { id: ORG2, name: "d2b-annet-firma" }] });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: ATT, organizationId: ORG, status: "aktiv" },
      { userId: ARB2, organizationId: ORG2, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, tillattRedigerVedAttestering: true } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "D2B-1", name: "d2b P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "D2B-2", name: "d2b P2", primaryOrganizationId: ORG },
      { id: P3, projectNumber: "D2B-3", name: "d2b P3", primaryOrganizationId: ORG2 },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P1, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: ATT, projectId: P1, role: "member", kanAttestere: true },
      { userId: ATT, projectId: P2, role: "member" },
      { userId: ARB2, projectId: P3, role: "member" },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.externalCostObject.create({
    data: { id: ECO_TILL, organizationId: ORG, projectId: P1, proAdmId: "TILL-001", kortNavn: "Tilleggsarbeid kantstein", kilde: "manuell", opprettetAvUserId: ATT },
  });
  await prismaTimer.lonnsart.create({ data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true } });
  await prismaTimer.aktivitet.createMany({ data: [{ id: AKT, organizationId: ORG, navn: "Anleggsarbeid" }, { id: AKT2, organizationId: ORG2, navn: "Annet" }] });
  await prismaTimer.tillegg.create({ data: { id: TL, organizationId: ORG, navn: "Smusstillegg", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KAT, organizationId: ORG, navn: "Parkering" } });
  await prismaMaskin.equipment.create({ data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" } });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Fugesand", enhet: "sekk" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);
beforeEach(() => settRedigering(true));

const flytt = (userId: string, input: Parameters<ReturnType<typeof dag>["flyttLinjeTilKort"]>[0]) => dag(userId).flyttLinjeTilKort(input);

/** Kort-id, underprosjekt, byggeplass og kobling for hver av linjene (alt som kan endres). */
async function tilstand(sheetId: string) {
  const [timer, maskiner, tillegg, utlegg, varer] = await Promise.all([
    prismaTimer.sheetTimer.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true, byggeplassId: true }, orderBy: { id: "asc" } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true, sheetTimerId: true, timer: true }, orderBy: { id: "asc" } }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true }, orderBy: { id: "asc" } }),
    prismaTimer.sheetUtlegg.findMany({ where: { sheetId }, select: { id: true, kortId: true, externalCostObjectId: true }, orderBy: { id: "asc" } }),
    prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: sheetId }, select: { id: true, kortId: true, externalCostObjectId: true, sheetTimerId: true, antall: true }, orderBy: { id: "asc" } }),
  ]);
  return JSON.parse(JSON.stringify({ timer, maskiner, tillegg, utlegg, varer })) as unknown;
}

async function invariantHolder(sheetId: string) {
  const r = await sikreKortId(prismaTimer, sheetId);
  expect(r.brudd).toEqual([]);
}

describe("D2b test 4 — tillegg, utlegg og maskin til kort B", () => {
  it("tillegget får kort B sin kort-id og underprosjekt", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: d.b.kortId });
    const t = await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: d.tillegg } });
    expect(t.kortId).toBe(d.b.kortId);
    expect(t.externalCostObjectId).toBe(ECO_TILL);
    await invariantHolder(d.sheetId);
  });

  it("utlegget får kort B sin kort-id og underprosjekt", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "utlegg", radId: d.utlegg, tilKortId: d.b.kortId });
    const u = await prismaTimer.sheetUtlegg.findUniqueOrThrow({ where: { id: d.utlegg } });
    expect(u.kortId).toBe(d.b.kortId);
    expect(u.externalCostObjectId).toBe(ECO_TILL);
    await invariantHolder(d.sheetId);
  });

  it("maskinen står i kort B, koblet til en timerad i kort B", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "maskin", radId: d.maskin, tilKortId: d.b.kortId });
    const m = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: d.maskin } });
    expect(m.kortId).toBe(d.b.kortId);
    expect(m.externalCostObjectId).toBe(ECO_TILL);
    expect(m.sheetTimerId).toBe(d.b.rad);
    await invariantHolder(d.sheetId);
  });

  it("lesning 2: maskin 4,00 t til kort B med 0,50 t arbeid avvises (DO15), ingenting endret", async () => {
    const d = await nyDag({ b: { fra: "11:00", til: "11:30", timer: 0.5, eco: ECO_TILL }, maskinTimer: 4 });
    const foer = await tilstand(d.sheetId);
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "maskin", radId: d.maskin, tilKortId: d.b.kortId })).rejects.toThrow();
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });
});

describe("D2b test 5 — samme nøkkel («Uten» i begge)", () => {
  it("tillegget står i kort B etterpå, ikke i det eldste kortet A (DG10)", async () => {
    const d = await nyDag({ b: { fra: "11:00", til: "15:00", timer: 4, eco: null } });
    await flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: d.b.kortId });
    await sikreKortId(prismaTimer, d.sheetId);
    const t = await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: d.tillegg } });
    expect(t.kortId).toBe(d.b.kortId);
  });
});

describe("D2b test 6 — vare hel og delt", () => {
  it("3 sekk flyttet hel står i kort B, koblet til en timerad i B", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "vare", radId: d.vare, tilKortId: d.b.kortId });
    const v = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: d.vare } });
    expect(v.kortId).toBe(d.b.kortId);
    expect(v.sheetTimerId).toBe(d.b.rad);
    expect(Number(v.antall)).toBe(3);
    await sikreKortId(prismaTimer, d.sheetId);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: d.vare } })).kortId).toBe(d.b.kortId);
  });

  it("1 av 3 gir 2 i A og 1 i B, koblet til en timerad i hvert kort, og summen er 3", async () => {
    const d = await nyDag();
    const svar = await flytt(ATT, { sheetId: d.sheetId, radType: "vare", radId: d.vare, tilKortId: d.b.kortId, mengde: 1 });
    await sikreKortId(prismaTimer, d.sheetId);
    const varer = await prismaVarelager.vareforbruk.findMany({ where: { dagsseddelId: d.sheetId } });
    expect(varer).toHaveLength(2);
    const iA = varer.find((v) => v.id === d.vare)!;
    const iB = varer.find((v) => v.id === svar.nyId)!;
    expect([Number(iA.antall), iA.kortId, iA.sheetTimerId]).toEqual([2, d.a.kortId, d.a.rad]);
    expect([Number(iB.antall), iB.kortId, iB.sheetTimerId, iB.externalCostObjectId]).toEqual([1, d.b.kortId, d.b.rad, ECO_TILL]);
    expect(iB.registrertAvUserId).toBe(ARB); // delt linje arver hvem som førte den
    expect(varer.reduce((s, v) => s + Number(v.antall), 0)).toBe(3);
  });

  it("mengde over linjas antall avvises, ingenting endret", async () => {
    const d = await nyDag();
    const foer = await tilstand(d.sheetId);
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "vare", radId: d.vare, tilKortId: d.b.kortId, mengde: 4 })).rejects.toThrow(/Mengden/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });

  it("attestert vare (øyeblikksbilde) flyttes ikke", async () => {
    const d = await nyDag();
    await prismaVarelager.vareforbruk.update({ where: { id: d.vare }, data: { attestertSnapshot: { attestertVed: "2026-10-01" } } });
    const foer = await tilstand(d.sheetId);
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "vare", radId: d.vare, tilKortId: d.b.kortId })).rejects.toThrow(/venter/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });
});

describe("D2b test 7 — reise", () => {
  it("reisen står i kort B etterpå", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "reise", radId: d.reise, tilKortId: d.b.kortId });
    await sikreKortId(prismaTimer, d.sheetId);
    const r = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: d.reise } });
    expect([r.kortId, r.externalCostObjectId]).toEqual([d.b.kortId, ECO_TILL]);
  });

  it("målkort på et annet prosjekt avvises, ingenting endret", async () => {
    const d = await nyDag();
    // Et kort på P2 på samme sedel.
    const kortP2 = randomUUID();
    await prismaTimer.sheetTimer.create({
      data: { sheetId: d.sheetId, projectId: P2, lonnsartId: ORD, aktivitetId: AKT, fraTid: "15:00", tilTid: "16:00", timer: 1, kortId: kortP2 },
    });
    const foer = await tilstand(d.sheetId);
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "reise", radId: d.reise, tilKortId: kortP2 })).rejects.toThrow(/samme prosjekt/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });

  it("en lønnsart-linje er ikke en reise og flyttes ikke", async () => {
    const d = await nyDag();
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "reise", radId: d.a.rad, tilKortId: d.b.kortId })).rejects.toThrow(/finnes ikke/);
  });
});

describe("D2b test 8 — grensene (ingen linje endret)", () => {
  const avvist = async (d: Awaited<ReturnType<typeof nyDag>>, userId: string, tilKortId: string, re: RegExp) => {
    const foer = await tilstand(d.sheetId);
    await expect(flytt(userId, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId })).rejects.toThrow(re);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  };

  it("attestant uten attesteringsrett på prosjektet", async () => {
    const d = await nyDag({ projectId: P2, b: { fra: "11:00", til: "15:00", timer: 4, eco: null } });
    await avvist(d, ATT, d.b.kortId, /attester|FORBIDDEN/i);
  });

  it("egen dagsseddel", async () => {
    const d = await nyDag({ eier: ATT });
    await avvist(d, ATT, d.b.kortId, /Egne timer/);
  });

  it("firmavalget «rediger ved attestering» er av", async () => {
    const d = await nyDag();
    await settRedigering(false);
    await avvist(d, ATT, d.b.kortId, /Rediger ved attestering/);
  });

  it("dagen er ikke sendt", async () => {
    const d = await nyDag({ status: "draft" });
    await avvist(d, ATT, d.b.kortId, /innsendte/);
  });

  it("linja er attestert", async () => {
    const d = await nyDag();
    await prismaTimer.sheetTillegg.update({ where: { id: d.tillegg }, data: { attestertStatus: "attestert" } });
    await avvist(d, ATT, d.b.kortId, /venter/);
  });

  it("målkortet er attestert", async () => {
    const d = await nyDag({ b: { fra: "11:00", til: "15:00", timer: 4, eco: ECO_TILL, attestert: true } });
    await avvist(d, ATT, d.b.kortId, /Målkortet har linjer/);
  });

  it("målkort på en annen dagsseddel", async () => {
    const d = await nyDag();
    const annen = await nyDag();
    await avvist(d, ATT, annen.b.kortId, /Målkortet finnes ikke/);
  });

  it("målkort i et annet firma", async () => {
    const d = await nyDag();
    const annen = await nyDag({ projectId: P3, eier: ARB2 });
    await avvist(d, ATT, annen.b.kortId, /Målkortet finnes ikke/);
  });

  it("utlegg flyttes ikke når en annen linje i kildekortet er attestert (lesning 3)", async () => {
    const d = await nyDag();
    await prismaTimer.sheetTillegg.update({ where: { id: d.tillegg }, data: { attestertStatus: "attestert" } });
    const foer = await tilstand(d.sheetId);
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "utlegg", radId: d.utlegg, tilKortId: d.b.kortId })).rejects.toThrow(/Utlegg flyttes bare/);
    expect(await tilstand(d.sheetId)).toEqual(foer);
  });
});

describe("D2b test 9 — vareretten ved flytting", () => {
  it("en attestant som bare har attesteringsrett, kan flytte en vare (DG12)", async () => {
    const d = await nyDag();
    const medlem = await prisma.projectMember.findFirstOrThrow({ where: { userId: ATT, projectId: P1 } });
    expect([medlem.role, medlem.kanAttestere]).toEqual(["member", true]);
    await flytt(ATT, { sheetId: d.sheetId, radType: "vare", radId: d.vare, tilKortId: d.b.kortId, mengde: 1 });
    expect(await prismaVarelager.vareforbruk.count({ where: { dagsseddelId: d.sheetId, kortId: d.b.kortId } })).toBe(1);
  });
});

describe("D2b test 10 — «Korrigert av» hos arbeideren", () => {
  it("flyttet tillegg viser underprosjektet før og etter, med attestantens navn", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: d.b.kortId });
    const s = (await dag(ARB).hentMedId({ id: d.sheetId })) as unknown as {
      korrigeringer: Record<string, Record<string, { avNavn: string | null; felter: { felt: string; foer: unknown; etter: unknown }[] }>>;
    };
    const k = s.korrigeringer.tillegg?.[d.tillegg];
    expect(k?.avNavn).toBe("Kari ansatt");
    expect(k?.felter.find((f) => f.felt === "externalCostObjectId")).toMatchObject({ foer: null, etter: ECO_TILL });
  });

  it("flyttet maskin viser «Korrigert av»", async () => {
    const d = await nyDag();
    await flytt(ATT, { sheetId: d.sheetId, radType: "maskin", radId: d.maskin, tilKortId: d.b.kortId });
    const s = (await dag(ARB).hentMedId({ id: d.sheetId })) as unknown as { korrigeringer: Record<string, Record<string, { avNavn: string | null }>> };
    expect(s.korrigeringer.maskin?.[d.maskin]?.avNavn).toBe("Kari ansatt");
  });
});

describe("D2b test 27 — kort åpnet alene, tre kort på prosjektet", () => {
  it("linja kan flyttes til hvert av de to andre kortene", async () => {
    const d = await nyDag({ ekstra: [{ fra: "15:00", til: "17:00", timer: 2, eco: null }] });
    const c = d.ekstra[0]!;
    await flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: c.kortId });
    expect((await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: d.tillegg } })).kortId).toBe(c.kortId);
    await flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: d.b.kortId });
    expect((await prismaTimer.sheetTillegg.findUniqueOrThrow({ where: { id: d.tillegg } })).kortId).toBe(d.b.kortId);
    await invariantHolder(d.sheetId);
  });

  it("flytting til kortet linja står i, avvises", async () => {
    const d = await nyDag();
    await expect(flytt(ATT, { sheetId: d.sheetId, radType: "tillegg", radId: d.tillegg, tilKortId: d.a.kortId })).rejects.toThrow(/allerede/);
  });
});
