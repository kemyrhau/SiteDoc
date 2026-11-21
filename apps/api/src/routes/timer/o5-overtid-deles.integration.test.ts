import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { fastPauseFraFor, foreslaOvertidSplitt, pauseFraForRad, regnJobbTid } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";
import { hentEffektivArbeidstid } from "../../services/timer";

/**
 * O5 B (plan § 8.22, «Kenneths test på d4bec43e», punkt 2) gjennom prosedyrene (`createCaller`) mot
 * EKTE Postgres (kastbar lokal sandkasse, aldri test/prod).
 *
 * I prosjektkort-modus deler «Legg til timer-rad» og «Rediger timer-rad» raden automatisk ved
 * lagring når dagen går over normen (`TimerRadDialog` → `brukOvertidForslag`). Testen regner delene
 * som vinduet gjør (`foreslaOvertidSplitt` med serverens norm og pause), viser at de er lik det
 * jobbskjemaets serverregel `regnJobbTid` gir for samme rad, og sender dem gjennom de samme to
 * kallene: serveren godtar begge delene (PK4, overlapp), de står i jobbens kort, og et bevisst
 * artsbytte på overtidsdelen står. Ingen serverendring.
 *
 * Data lages her med faste id-er (prefiks 05e5e5f0) og ryddes i afterAll.
 */

const id = (n: string) => `05e5e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const TL = id("41");
const OT = id("42");
const AKT = id("43");

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

async function rader(sheetId: string) {
  return prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { fraTid: "asc" } });
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, OT] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "o5-overtid@sitedoc.test", name: "Arbeider O5", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "O5-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", dagsnorm: 7.5, standardPauseMin: 30, standardPauseEtterTimer: 4 },
  });
  await prisma.project.create({ data: { id: P1, projectNumber: "O5-1", name: "O5 Skole", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.create({
    data: { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
  });
  await prismaTimer.lonnsart.create({
    data: { id: OT, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %", aktiv: true, overtidsnivaa: 50, rekkefolge: 2 },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Arbeid" } });
}

/** Dagen: jobben (kort k) 07:00–13:30 med 30 min pause = 6 t. */
async function dagen(dato: string) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(dato), status: "draft" },
  });
  const k = randomUUID();
  const felles = { sheetId: sid, projectId: P1, aktivitetId: AKT, externalCostObjectId: null, vehicleId: null, beskrivelse: "Graving" };
  await dag().tilfoyTimerRad({ ...felles, lonnsartId: TL, timer: 6, fraTid: "07:00", tilTid: "13:30", pauseMin: 30, kortId: k });
  return { sid, k, felles };
}

/** Delene vinduet regner (`overtidForslag` i `TimerRadDialog`) for raden `egen` mot dagens andre rader. */
async function delerSomVinduet(sid: string, egen: { id: string; fraTid: string; tilTid: string }, dato: string) {
  const eff = await hentEffektivArbeidstid(ORG, new Date(dato));
  const lonnsarter = await prismaTimer.lonnsart.findMany({ where: { organizationId: ORG } });
  const andre = (await rader(sid))
    .filter((r) => r.id !== egen.id)
    .map((r) => ({
      id: r.id,
      fraTid: r.fraTid,
      tilTid: r.tilTid,
      pauseMin: r.pauseMin ?? 0,
      erReise: r.erReise,
      overtidsnivaa: lonnsarter.find((l) => l.id === r.lonnsartId)?.overtidsnivaa ?? null,
    }));
  const fastPauseFra = fastPauseFraFor(eff);
  // Som vinduet: pausepunktet pr. rad mot de andre radene (`pauseFraForRad`).
  const alle = [...andre, { id: egen.id, fraTid: egen.fraTid, tilTid: egen.tilTid, pauseMin: 0, erReise: false, overtidsnivaa: null }];
  const forslag = foreslaOvertidSplitt(alle, eff.dagsnorm, lonnsarter, {
    pauseFra: (r) =>
      r.fraTid && r.tilTid
        ? pauseFraForRad({
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            andreRader: alle.filter((a) => a.id !== r.id),
            pauseEtterTimer: eff.pauseEtterTimer,
            pauseMin: r.pauseMin,
            fastPauseFra,
          })
        : "00:00",
  }).find((f) => f.radId === egen.id);
  // Jobbskjemaets serverregel på samme rad gir de samme delene.
  const jobbRegel = regnJobbTid({
    fraTid: egen.fraTid,
    tilTid: egen.tilTid,
    pauseMin: 0,
    linje1Overtidsnivaa: null,
    andreRader: andre.filter((r): r is typeof r & { fraTid: string; tilTid: string } => !!r.fraTid && !!r.tilTid),
    norm: eff.dagsnorm,
    lonnsarter,
    pauseEtterTimer: eff.pauseEtterTimer,
    fastPauseFra,
  });
  return { forslag, jobbRegel };
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O5 B — overtid deles automatisk ved lagring (prosjektkort-modus)", () => {
  it("«Legg til» 13:30–15:30 på en dag med 6 t: 1,5 t Timelønn + 0,5 t overtid i jobbens kort — samme deler som regnJobbTid", async () => {
    const dato = "2026-11-17";
    const { sid, k, felles } = await dagen(dato);
    const { forslag, jobbRegel } = await delerSomVinduet(sid, { id: "__ny__", fraTid: "13:30", tilTid: "15:30" }, dato);
    expect(forslag?.normal).toMatchObject({ fraTid: "13:30", tilTid: "15:00", timer: 1.5 });
    expect(forslag?.overtid).toMatchObject({ fraTid: "15:00", tilTid: "15:30", timer: 0.5 });
    expect(forslag?.overtidLonnsart.id).toBe(OT);
    expect(jobbRegel.ok && jobbRegel.linjer.map((l) => [l.fraTid, l.tilTid, l.timer, l.overtid])).toEqual([
      ["13:30", "15:00", 1.5, false],
      ["15:00", "15:30", 0.5, true],
    ]);

    // Vinduets to kall (`brukOvertidForslag`, ny rad).
    await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: TL, ...forslag!.normal! });
    await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: OT, ...forslag!.overtid });
    const r = await rader(sid);
    expect(r.map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId, x.kortId])).toEqual([
      ["07:00", "13:30", 6, TL, k],
      ["13:30", "15:00", 1.5, TL, k],
      ["15:00", "15:30", 0.5, OT, k],
    ]);
  });

  it("«Rediger» som flytter en rad over normen (13:30–14:30 → 15:30): raden kortes inn, overtiden blir egen linje i kortet", async () => {
    const dato = "2026-11-16";
    const { sid, k, felles } = await dagen(dato);
    const r3 = (await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: TL, timer: 1, fraTid: "13:30", tilTid: "14:30", pauseMin: 0 })) as { id: string };
    const { forslag } = await delerSomVinduet(sid, { id: r3.id, fraTid: "13:30", tilTid: "15:30" }, dato);
    // Vinduets to kall (`brukOvertidForslag`, eksisterende rad).
    await dag().oppdaterTimerRad({ id: r3.id, aktivitetId: AKT, externalCostObjectId: null, vehicleId: null, beskrivelse: "Graving", lonnsartId: TL, ...forslag!.normal! });
    await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: OT, ...forslag!.overtid });
    const r = await rader(sid);
    expect(r.map((x) => [x.id === r3.id, x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId, x.kortId])).toEqual([
      [false, "07:00", "13:30", 6, TL, k],
      [true, "13:30", "15:00", 1.5, TL, k],
      [false, "15:00", "15:30", 0.5, OT, k],
    ]);
  });

  it("bevisst artsbytte står: overtidsdelen byttet til Timelønn på uendret tid lagres som Timelønn", async () => {
    const dato = "2026-11-13";
    const { sid, k, felles } = await dagen(dato);
    await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: TL, timer: 1.5, fraTid: "13:30", tilTid: "15:00", pauseMin: 0 });
    const r4 = (await dag().tilfoyTimerRad({ ...felles, kortId: k, lonnsartId: OT, timer: 0.5, fraTid: "15:00", tilTid: "15:30", pauseMin: 0 })) as { id: string };
    // Uendret tid: vinduet sender bare raden med ny art (`lagreRad`), ingen deling.
    await dag().oppdaterTimerRad({ id: r4.id, lonnsartId: TL, aktivitetId: AKT, timer: 0.5, externalCostObjectId: null, vehicleId: null, beskrivelse: "Graving", fraTid: "15:00", tilTid: "15:30", pauseMin: 0 });
    const r = await rader(sid);
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.id === r4.id)).toMatchObject({ lonnsartId: TL, fraTid: "15:00", tilTid: "15:30" });
  });
});
