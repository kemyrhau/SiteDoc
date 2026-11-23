import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * R1 (Kenneth 2026-11-23: (a) ja, b1 ja, b3 ja) — returnert sedel, mot EKTE Postgres (lokal
 * sandkasse), gjennom prosedyrene (`createCaller`). Kenneths dag fra sitedoc_test: jobb 07–10,
 * reise 12–15 og arbeid 15–19 i Narvik-kortet.
 *
 *  (a)  Overlappmeldingen sier hva og hvor: «overlapper reisen 12:00–15:00 i kortet Narvik ·
 *       15:00–19:00» — både `lagreJobbTid` og radvakten `sjekkTimerOverlapp`.
 *  b1   Arbeiderens egne `returnert`-linjer kan flyttes (underprosjekt og sted) på egen returnert
 *       sedel; `attestert` sperrer som før.
 *  b3   Sletting på returnert dag (`fjernTimerRad`, `slettKort`) skriver de slettede radene til
 *       `sheet_rad_historikk` og logger `fjern_timer_rad` / `slett_kort`. Ikke på `draft`.
 *
 * Negativkontroll: på develop før R1 er (a) røde (meldingen sier «en annen rad»), b1 røde
 * («Gjenåpne linjene først») og b3 røde (0 historikkposter).
 */

const id = (n: string) => `b1e7c0de-0000-4000-8000-0000000000${n}`;
const USER = id("02");
const ORG = id("01");
const P = id("11");
const P2 = id("12");
const BP_NARVIK = id("31");
const BP_B12 = id("32");
const ECO = id("21");
const TL = id("41");
const REISE = id("45");
const AKT = id("44");
const TILLEGG = id("48");
const MASKIN = id("51");

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
const dag = () => dagsseddelRouter.createCaller(ctx(USER));

/** Kenneths dag: jobb K1 07–10 (B12), Narvik-kortet K3 med reise 12–15 og arbeid 15–19. */
async function dagNarvik(dato: string, o: { status?: string; k1Status?: string } = {}) {
  const sheet = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P, dato, organizationId: ORG });
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId: sheet.id } });
  const k1 = randomUUID();
  const k3 = randomUUID();
  const felles = { sheetId: sheet.id, aktivitetId: AKT, projectId: P };
  const rad1 = await prismaTimer.sheetTimer.create({
    data: {
      ...felles, lonnsartId: TL, kortId: k1, byggeplassId: BP_B12, fraTid: "07:00", tilTid: "10:00", pauseMin: 0, timer: 3,
      attestertStatus: o.k1Status ?? "pending",
    },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: {
      ...felles, lonnsartId: REISE, kortId: k3, byggeplassId: BP_NARVIK, fraTid: "12:00", tilTid: "15:00", pauseMin: 0, timer: 3,
      erReise: true, reiseRetning: "ut",
    },
  });
  const narvik = await prismaTimer.sheetTimer.create({
    data: { ...felles, lonnsartId: TL, kortId: k3, byggeplassId: BP_NARVIK, fraTid: "15:00", tilTid: "19:00", pauseMin: 0, timer: 4 },
  });
  if (o.status) await prismaTimer.dailySheet.update({ where: { id: sheet.id }, data: { status: o.status } });
  return { sheetId: sheet.id, k1, k3, rad1: rad1.id, reise: reise.id, narvik: narvik.id };
}

const historikk = (sheetId: string) =>
  prismaTimer.sheetRadHistorikk.findMany({ where: { sheetId }, orderBy: { radType: "asc" } });
const logg = (sheetId: string, action: string) =>
  prisma.activity.findMany({ where: { targetId: sheetId, action } });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO } });
  await prisma.byggeplass.deleteMany({ where: { id: { in: [BP_NARVIK, BP_B12] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "r1-retur@sitedoc.test", name: "Arbeider R1", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "R1-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort" } });
  for (const [p, nr] of [[P, "R1-1"], [P2, "R1-2"]] as const) {
    await prisma.project.create({ data: { id: p, projectNumber: nr, name: "Sitedoc Boligfelt B12", primaryOrganizationId: ORG } });
    await prisma.projectMember.create({ data: { userId: USER, projectId: p, role: "member" } });
    await prisma.projectModule.create({ data: { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  }
  await prisma.byggeplass.create({ data: { id: BP_NARVIK, projectId: P, name: "Narvik" } });
  await prisma.byggeplass.create({ data: { id: BP_B12, projectId: P, name: "B12" } });
  await prisma.externalCostObject.create({
    data: { id: ECO, organizationId: ORG, projectId: P, proAdmId: "TILL-001", kortNavn: "Tillegg R1", kilde: "manuell", opprettetAvUserId: USER, timerregistreringApen: true },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reise", aktiv: true, rekkefolge: 4 },
    ],
  });
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { reiseLonnsartId: REISE } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", internNavn: "Graver", utleieEnhet: "time" },
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

const NARVIK_TEKST = "overlapper reisen 12:00–15:00 i kortet Narvik · 15:00–19:00";

describe("R1 (a) — overlappmeldingen sier hva og hvor", () => {
  it("lagreJobbTid: 07:00–15:00 på jobben → «overlapper reisen 12:00–15:00 i kortet Narvik · 15:00–19:00»", async () => {
    const d = await dagNarvik("2026-11-02", { status: "returned", k1Status: "returnert" });
    const svar = dag().lagreJobbTid({ sheetId: d.sheetId, kortId: d.k1, fraTid: "07:00", tilTid: "15:00", pauseMin: 0, linjer: [{ radId: d.rad1, lonnsartId: TL }] });
    await expect(svar).rejects.toThrow(NARVIK_TEKST);
  });

  it("radvakten (oppdaterTimerRad): 07:00–15:00 → samme melding", async () => {
    const d = await dagNarvik("2026-11-03");
    const svar = dag().oppdaterTimerRad({ id: d.rad1, fraTid: "07:00", tilTid: "15:00", timer: 8, pauseMin: 0 });
    await expect(svar).rejects.toThrow(NARVIK_TEKST);
  });

  it("regelen er uendret: 07:00–12:00 lagres", async () => {
    const d = await dagNarvik("2026-11-04");
    await dag().lagreJobbTid({ sheetId: d.sheetId, kortId: d.k1, fraTid: "07:00", tilTid: "12:00", pauseMin: 0, linjer: [{ radId: d.rad1, lonnsartId: TL }] });
    expect((await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad1 } }))?.tilTid).toBe("12:00");
  });
});

describe("R1 b1 — arbeiderens egne returnerte linjer kan flyttes", () => {
  it("underprosjekt: returnert linje på egen returnert sedel flyttes, og står fortsatt som returnert", async () => {
    const d = await dagNarvik("2026-11-05", { status: "returned", k1Status: "returnert" });
    await dag().flyttJobbEco({ sheetId: d.sheetId, kortId: d.k1, externalCostObjectId: ECO });
    const rad = await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad1 } });
    expect(rad).toMatchObject({ externalCostObjectId: ECO, attestertStatus: "returnert" });
  });

  it("sted: returnert linje på egen returnert sedel flyttes til et annet prosjekt", async () => {
    const d = await dagNarvik("2026-11-06", { status: "returned", k1Status: "returnert" });
    await dag().flyttJobb({ sheetId: d.sheetId, kortId: d.k1, projectId: P2, byggeplassId: null });
    expect((await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad1 } }))?.projectId).toBe(P2);
  });

  it("attestert linje sperrer fortsatt — ingenting endres", async () => {
    const d = await dagNarvik("2026-11-07", { status: "returned", k1Status: "attestert" });
    await expect(dag().flyttJobbEco({ sheetId: d.sheetId, kortId: d.k1, externalCostObjectId: ECO })).rejects.toThrow(/Gjenåpne linjene først/);
    await expect(dag().flyttJobb({ sheetId: d.sheetId, kortId: d.k1, projectId: P2, byggeplassId: null })).rejects.toThrow(/Gjenåpne linjene først/);
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: d.rad1 } })).toMatchObject({ projectId: P, externalCostObjectId: null });
  });
});

describe("R1 b3 — spor ved sletting på returnert dag", () => {
  it("fjernTimerRad på returnert dag: raden og maskinen som slettes med den, står i historikken; logget", async () => {
    const d = await dagNarvik("2026-11-09", { status: "returned", k1Status: "returnert" });
    const m = await prismaTimer.sheetMachine.create({
      data: { sheetId: d.sheetId, vehicleId: MASKIN, projectId: P, timer: 2, sheetTimerId: d.rad1, kortId: d.k1 },
    });
    await dag().fjernTimerRad({ id: d.rad1, slettMaskiner: true });
    const h = await historikk(d.sheetId);
    expect(h.map((p) => [p.radType, p.originalRadId, p.erstattetAvUserId])).toEqual([
      ["maskin", m.id, USER],
      ["timer", d.rad1, USER],
    ]);
    expect(h.find((p) => p.radType === "timer")?.snapshot).toMatchObject({ fraTid: "07:00", tilTid: "10:00", attestertStatus: "returnert", hendelse: "slettet" });
    expect(await logg(d.sheetId, "fjern_timer_rad")).toHaveLength(1);
  });

  it("slettKort på returnert dag: timer, reise, maskin og tillegg i historikken; logget", async () => {
    const d = await dagNarvik("2026-11-10", { status: "returned" });
    const m = await prismaTimer.sheetMachine.create({ data: { sheetId: d.sheetId, vehicleId: MASKIN, projectId: P, timer: 1, kortId: d.k3 } });
    const t = await prismaTimer.sheetTillegg.create({ data: { sheetId: d.sheetId, tilleggId: TILLEGG, projectId: P, antall: 1, kortId: d.k3 } });
    await dag().slettKort({ id: d.sheetId, kortId: d.k3 });
    const h = await historikk(d.sheetId);
    expect(h.map((p) => p.originalRadId).sort()).toEqual([d.reise, d.narvik, m.id, t.id].sort());
    expect(new Set(h.map((p) => p.radType))).toEqual(new Set(["timer", "maskin", "tillegg"]));
    expect(await logg(d.sheetId, "slett_kort")).toHaveLength(1);
  });

  it("utkast (draft): ingen historikk og ingen logg", async () => {
    const d = await dagNarvik("2026-11-11");
    await dag().fjernTimerRad({ id: d.rad1 });
    await dag().slettKort({ id: d.sheetId, kortId: d.k3 });
    expect(await historikk(d.sheetId)).toHaveLength(0);
    expect(await logg(d.sheetId, "fjern_timer_rad")).toHaveLength(0);
    expect(await logg(d.sheetId, "slett_kort")).toHaveLength(0);
  });
});
