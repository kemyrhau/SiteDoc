import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { foreslaOvertidSplitt, vurderOvertidSplitt } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * M1 TIMERAD-LIVSLØP — MÅLING, INGEN RETTING (ordre 2026-11-26, rapport
 * `docs/claude/maaling-timerad-livslop.md`).
 *
 * Hver test gjør én handling gjennom prosedyren (`createCaller`) mot EKTE Postgres (lokal
 * sandkasse, aldri test/prod) og leser tilbake fra databasen og fra prosedyren skjermen bygger på
 * (`hentMedId`, `hentDagstotal`, `list`).
 *
 * RØDE tester er poenget: de beskriver det Kenneth forventer («ting blir ikke borte», «overtid
 * regnes ut eller det sies hvorfor») og feiler på dagens kode. De skal ikke rettes i denne
 * leveransen. Navnet starter med «RØD i dag:» når testen er ment å feile på f7a277d3.
 *
 * Runde 1 timer (R1, R3 — ordre 2026-11-26): overtid-testene og «ny jobb»-testene er skrevet om til
 * det som nå er rettet. «RØD i dag:»-tester som står igjen, gjelder R4–R6 (ikke i runde 1).
 *
 * Faste id-er med prefiks 0a11fe00, ryddes i afterAll.
 */

const id = (n: string) => `0a11fe00-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const TL = id("41"); // Timelønn
const OT50 = id("42"); // «Overtid 50%» — UTEN overtidsnivaa (slik SITEDOC MYRHAUG er målt i prod 26.11)
const OT100 = id("44"); // «Overtid 100%» — UTEN overtidsnivaa
const AKT = id("43");
const TILLEGG = id("51");

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

const rader = (sheetId: string) =>
  prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: [{ fraTid: "asc" }, { createdAt: "asc" }] });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, OT50, OT100] } } });
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
  await prisma.user.create({ data: { id: USER, email: "m1-livslop@sitedoc.test", name: "Arbeider M1", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "M1-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", dagsnorm: 7.5, standardPauseMin: 30, standardPauseEtterTimer: 4 },
  });
  await prisma.project.create({ data: { id: P1, projectNumber: "M1-1", name: "M1 UNN", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      // Prod-tilstanden: navnet sier overtid, men `overtidsnivaa` er tom.
      { id: OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50%", aktiv: true, overtidsnivaa: null, rekkefolge: 2 },
      { id: OT100, organizationId: ORG, type: "ordinaer", navn: "Overtid 100%", aktiv: true, overtidsnivaa: null, rekkefolge: 3 },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Arbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smusstillegg", type: "antall" } });
}

let datoTeller = 0;
/** Unik dato pr. test innen siste 30 dager (aldersgrensen og telefonens slettevindu). */
function nyDato(): string {
  return new Date(Date.now() - (2 + datoTeller++) * 86_400_000).toISOString().slice(0, 10);
}

/** Dagen med jobb 1 (kort k1) 07:00–15:00, 30 min pause = 7,5 t — Kenneths UNN-rad. */
async function dagMedJobb1(status: "draft" | "sent" | "returned" = "draft") {
  const sid = randomUUID();
  const dato = nyDato();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(dato), status: "draft" },
  });
  const k1 = randomUUID();
  const felles = { sheetId: sid, projectId: P1, aktivitetId: AKT, externalCostObjectId: null, vehicleId: null, beskrivelse: "UNN" };
  const r1 = (await dag().tilfoyTimerRad({ ...felles, lonnsartId: TL, timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kortId: k1 })) as { id: string };
  if (status !== "draft") await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status } });
  return { sid, dato, k1, r1: r1.id, felles };
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ---------------------------------------------------------------------------------------------
// Spørsmål 5 — stille utfall: overtid
// ---------------------------------------------------------------------------------------------
describe("M1 vei «Legg til timer-rad» / «Lagre jobb» — overtid når firmaets overtidsarter mangler overtidsnivaa", () => {
  const DAG_15_18 = [
    { id: "a", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, erReise: false, overtidsnivaa: null },
    { id: "b", fraTid: "15:00", tilTid: "18:00", pauseMin: 0, erReise: false, overtidsnivaa: null },
  ];
  const pauseFra = { pauseFra: (r: { id: string }) => (r.id === "a" ? "11:00" : "00:00") };

  it("`foreslaOvertidSplitt` (mobil) er uendret: tom liste; `vurderOvertidSplitt` sier hvorfor (R3)", async () => {
    const lonnsarter = await prismaTimer.lonnsart.findMany({ where: { organizationId: ORG } });
    expect(foreslaOvertidSplitt(DAG_15_18, 7.5, lonnsarter, pauseFra)).toEqual([]);
    // R3: over normen, ingen aktiv art med nivå 50 — sies fra, med nivå og rad.
    expect(vurderOvertidSplitt(DAG_15_18, 7.5, lonnsarter, pauseFra)).toEqual({
      forslag: [],
      manglerArt: { nivaa: 50, radIder: ["b"] },
    });
  });

  // R3 for «Legg til» er klientens (TimerRadDialog regner med `vurderOvertidSplitt` og viser
  // meldingen — web-test i jobb-vinduer.test.tsx). Serveren lagrer raden som før.
  it("R3 «Legg til» 15–18: raden lagres som Timelønn, og regelen dialogen viser fra, sier at overtidsart mangler", async () => {
    const { sid, felles } = await dagMedJobb1();
    const k2 = randomUUID();
    await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 3, fraTid: "15:00", tilTid: "18:00", pauseMin: 0 });
    const r = await rader(sid);
    expect(r.map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId])).toEqual([
      ["07:00", "15:00", 7.5, TL],
      ["15:00", "18:00", 3, TL],
    ]);
    const lonnsarter = await prismaTimer.lonnsart.findMany({ where: { organizationId: ORG } });
    const dagensRader = r.map((x, i) => ({ id: x.id, fraTid: x.fraTid, tilTid: x.tilTid, pauseMin: x.pauseMin, erReise: false, overtidsnivaa: null, i }));
    const v = vurderOvertidSplitt(dagensRader, 7.5, lonnsarter, { pauseFra: (x) => (x.id === r[0]!.id ? "11:00" : "00:00") });
    expect(v.manglerArt).toEqual({ nivaa: 50, radIder: [r[1]!.id] });
  });

  it("R3 «Lagre jobb» (lagreJobbTid) 15–18: én normallinje, og svaret sier `overtidManglerArt: 50`", async () => {
    const { sid, felles } = await dagMedJobb1();
    const k2 = randomUUID();
    const ny = (await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 1, fraTid: "15:00", tilTid: "16:00", pauseMin: 0 })) as { id: string };
    const svar = await dag().lagreJobbTid({ sheetId: sid, kortId: k2, fraTid: "15:00", tilTid: "18:00", pauseMin: 0, linjer: [{ radId: ny.id, lonnsartId: TL }] });
    expect(svar.overtidsnivaa).toBeNull();
    expect(svar.rad2Id).toBeNull();
    const r = await rader(sid);
    expect(r.filter((x) => x.kortId === k2).map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId])).toEqual([["15:00", "18:00", 3, TL]]);
    expect(svar.overtidManglerArt).toBe(50);
  });

  it("kontroll: med `overtidsnivaa = 50` på «Overtid 50%» deler samme lagring 15–18 i overtid (grønn)", async () => {
    await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: 50 } });
    try {
      const { sid, felles } = await dagMedJobb1();
      const k2 = randomUUID();
      const ny = (await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 1, fraTid: "15:00", tilTid: "16:00", pauseMin: 0 })) as { id: string };
      const svar = await dag().lagreJobbTid({ sheetId: sid, kortId: k2, fraTid: "15:00", tilTid: "18:00", pauseMin: 0, linjer: [{ radId: ny.id, lonnsartId: TL }] });
      expect(svar.helOvertid).toBe(true);
      const r = await rader(sid);
      expect(r.filter((x) => x.kortId === k2).map((x) => x.lonnsartId)).toEqual([OT50]);
    } finally {
      await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: null } });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// R1 (runde 1 timer) — ny jobb i kortet er ETT kall: `tilfoyTimerRad` med `somJobb`
// ---------------------------------------------------------------------------------------------
describe("R1 — ny jobb som ett kall (`tilfoyTimerRad` + `somJobb`)", () => {
  it("15–18 etter 7,5 t med «Overtid 50%» nivå 50: ett kall gir én overtidslinje (hel overtid)", async () => {
    await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: 50 } });
    try {
      const { sid, felles } = await dagMedJobb1();
      const k2 = randomUUID();
      // Sendt som Timelønn: serveren ser at hele jobben er over normen og lagrer overtidsarten.
      const svar = (await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 3, fraTid: "15:00", tilTid: "18:00", pauseMin: 0, somJobb: true })) as Record<string, unknown>;
      expect(svar.helOvertid).toBe(true);
      const r = await rader(sid);
      expect(r.filter((x) => x.kortId === k2).map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId])).toEqual([["15:00", "18:00", 3, OT50]]);
      // Sendt som overtidsarten (det klienten gjør, `art1Lagres`): samme rad lagres.
      const k3 = randomUUID();
      await dag().tilfoyTimerRad({ ...felles, kortId: k3, lonnsartId: OT50, timer: 1, fraTid: "18:00", tilTid: "19:00", pauseMin: 0, somJobb: true });
      expect((await rader(sid)).filter((x) => x.kortId === k3).map((x) => [x.fraTid, x.tilTid, x.lonnsartId])).toEqual([["18:00", "19:00", OT50]]);
    } finally {
      await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: null } });
    }
  });

  it("14–16 når 7,5 t passeres kl. 15 (jobb 1 07–14): ett kall gir to linjer, normal + overtid", async () => {
    await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: 50 } });
    try {
      const sid = randomUUID();
      await prismaTimer.dailySheet.create({
        data: { id: sid, clientUuid: sid, organizationId: ORG, userId: USER, registrertAvUserId: USER, aktivitetId: AKT, dato: new Date(nyDato()), status: "draft" },
      });
      const felles = { sheetId: sid, projectId: P1, aktivitetId: AKT, externalCostObjectId: null, vehicleId: null, beskrivelse: "UNN" };
      await dag().tilfoyTimerRad({ ...felles, lonnsartId: TL, timer: 6.5, fraTid: "07:00", tilTid: "14:00", pauseMin: 30, kortId: randomUUID() });
      const k2 = randomUUID();
      const svar = (await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 2, fraTid: "14:00", tilTid: "16:00", pauseMin: 0, somJobb: true })) as Record<string, unknown>;
      expect(svar.rad2Id).toBeTruthy();
      expect(svar.overtidsnivaa).toBe(50);
      const r = await rader(sid);
      expect(r.filter((x) => x.kortId === k2).map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId])).toEqual([
        ["14:00", "15:00", 1, TL],
        ["15:00", "16:00", 1, OT50],
      ]);
    } finally {
      await prismaTimer.lonnsart.update({ where: { id: OT50 }, data: { overtidsnivaa: null } });
    }
  });

  it("uten overtidsart med nivå (prod-tilstanden): én normallinje, svaret sier `overtidManglerArt: 50`", async () => {
    const { sid, felles } = await dagMedJobb1();
    const k2 = randomUUID();
    const svar = (await dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 3, fraTid: "15:00", tilTid: "18:00", pauseMin: 0, somJobb: true })) as Record<string, unknown>;
    expect(svar.overtidManglerArt).toBe(50);
    const r = await rader(sid);
    expect(r.filter((x) => x.kortId === k2).map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.lonnsartId])).toEqual([["15:00", "18:00", 3, TL]]);
  });

  it("overlapp med jobb 1: kallet avvises og INGENTING er lagret (alt eller ingenting)", async () => {
    const { sid, felles } = await dagMedJobb1();
    const k2 = randomUUID();
    await expect(
      dag().tilfoyTimerRad({ ...felles, kortId: k2, lonnsartId: TL, timer: 3, fraTid: "14:00", tilTid: "17:00", pauseMin: 0, somJobb: true }),
    ).rejects.toBeTruthy();
    expect((await rader(sid)).filter((x) => x.kortId === k2)).toHaveLength(0);
  });

  it("kortet har alt linjer: `somJobb` avvises (ny jobb er bare for et tomt kort)", async () => {
    const { sid, k1, felles } = await dagMedJobb1();
    await expect(
      dag().tilfoyTimerRad({ ...felles, kortId: k1, lonnsartId: TL, timer: 1, fraTid: "15:00", tilTid: "16:00", pauseMin: 0, somJobb: true }),
    ).rejects.toBeTruthy();
    expect(await rader(sid)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Spørsmål 2 — vises den riktig etter lagring: det skjermen bygger på
// ---------------------------------------------------------------------------------------------
describe("M1 — serverens svar etter lagring (det dagskortet og timerlista henter på nytt)", () => {
  it("hentMedId og hentDagstotal har den nye raden 15–18 straks etter tilfoyTimerRad (grønn: serveren er riktig)", async () => {
    const { sid, dato, felles } = await dagMedJobb1();
    await dag().tilfoyTimerRad({ ...felles, kortId: randomUUID(), lonnsartId: TL, timer: 3, fraTid: "15:00", tilTid: "18:00", pauseMin: 0 });
    const sedel = (await dag().hentMedId({ id: sid })) as { timer: Array<{ fraTid: string | null; timer: unknown }> };
    expect(sedel.timer.map((t) => t.fraTid).sort()).toEqual(["07:00", "15:00"]);
    const sum = sedel.timer.reduce((s, t) => s + Number(t.timer), 0);
    expect(sum).toBe(10.5);
    const total = (await dag().hentDagstotal({ dato })) as unknown;
    expect(JSON.stringify(total)).toContain("10.5");
  });
});

// ---------------------------------------------------------------------------------------------
// Spørsmål 6 — sletting som kan late som den gikk
// ---------------------------------------------------------------------------------------------
describe("M1 vei «Slett dagsseddel» / «Slett jobben» / ✕ — hva serveren gjør", () => {
  it("«Slett dagsseddel» (slett) på returnert dag avvises med PRECONDITION_FAILED — sedel og rad står (grønn på server)", async () => {
    const { sid, r1 } = await dagMedJobb1("returned");
    await expect(dag().slett({ id: sid })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await prismaTimer.dailySheet.findUnique({ where: { id: sid } })).not.toBeNull();
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } })).not.toBeNull();
  });

  it("«Slett dagsseddel» på sendt dag avvises — sedel og rad står (grønn på server)", async () => {
    const { sid, r1 } = await dagMedJobb1("sent");
    await expect(dag().slett({ id: sid })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } })).not.toBeNull();
  });

  it("«Slett jobben» (slettKort) på utkast: raden er borte, men sedelen står igjen tom (målt)", async () => {
    const { sid, k1, r1 } = await dagMedJobb1();
    await dag().slettKort({ id: sid, kortId: k1 });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } })).toBeNull();
    // Dagsseddelen står — med 0 rader. Synlighet i timerlista: se rapporten (O26).
    expect(await prismaTimer.dailySheet.findUnique({ where: { id: sid } })).not.toBeNull();
    expect(await rader(sid)).toHaveLength(0);
  });

  it("«Slett jobben» på sendt dag avvises (grønn på server)", async () => {
    const { sid, k1, r1 } = await dagMedJobb1("sent");
    await expect(dag().slettKort({ id: sid, kortId: k1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } })).not.toBeNull();
  });

  it("✕ på rad (fjernTimerRad) på sendt dag avvises (grønn på server)", async () => {
    const { r1 } = await dagMedJobb1("sent");
    await expect(dag().fjernTimerRad({ id: r1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Spørsmål 3/4/5 — telefonsynk: kan noe bli borte, komme tilbake eller overskrives i stillhet
// ---------------------------------------------------------------------------------------------
type TelefonTillegg = { id: string; projectId: string; tilleggId: string; antall: number; kortId: string | null };
function telefonSedel(sid: string, dato: string, timerRad: { id: string; kortId: string; serverVersjon: string }, tillegg: TelefonTillegg[]) {
  return {
    clientUuid: sid, projectId: P1, aktivitetId: AKT, dato, status: "draft" as const, pauseMin: 0,
    timer: [{
      id: timerRad.id, projectId: P1, lonnsartId: TL, aktivitetId: AKT, timer: 7.5,
      fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kortId: timerRad.kortId, endretLokalt: false,
      serverVersjon: timerRad.serverVersjon,
    }],
    tillegg, maskiner: [], utlegg: [],
  };
}
/** Radens versjon slik telefonen har den etter siste pull. */
async function versjon(radId: string): Promise<string> {
  return (await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radId } })).updatedAt.toISOString();
}
async function push(sedel: ReturnType<typeof telefonSedel>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svar = await dag().syncBatch({ sedler: [sedel as any] });
  return svar.resultater[0]!;
}

describe("M1 vei telefonsynk (syncBatch) — tillegg er ikke versjonert", () => {
  it("RØD i dag: tillegg slettet på PC kommer tilbake når telefonen pusher sedelen (pending) med tillegget i lasten", async () => {
    const { sid, dato, k1, r1, felles } = await dagMedJobb1();
    const t = (await dag().tilfoyTilleggRad({ sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1, kortId: k1 })) as { id: string };
    void felles;
    // PC: ✕ på tillegget.
    await dag().fjernTilleggRad({ id: t.id });
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: t.id } })).toBeNull();
    // Telefonen har sedelen pending (en annen endring) og tillegget i sin lokale kopi.
    const res = await push(telefonSedel(sid, dato, { id: r1, kortId: k1, serverVersjon: await versjon(r1) }, [{ id: t.id, projectId: P1, tilleggId: TILLEGG, antall: 1, kortId: k1 }]));
    expect(res.resultat).toBe("ok"); // synken melder ingenting
    // Forventet (Kenneth): det som er slettet, er slettet.
    expect(await prismaTimer.sheetTillegg.findUnique({ where: { id: t.id } })).toBeNull();
  });

  it("RØD i dag: tillegg rettet på PC (antall 1 → 3) overskrives i stillhet av telefonens gamle verdi", async () => {
    const { sid, dato, k1, r1 } = await dagMedJobb1();
    const t = (await dag().tilfoyTilleggRad({ sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1, kortId: k1 })) as { id: string };
    await dag().oppdaterTilleggRad({ id: t.id, antall: 3 });
    const res = await push(telefonSedel(sid, dato, { id: r1, kortId: k1, serverVersjon: await versjon(r1) }, [{ id: t.id, projectId: P1, tilleggId: TILLEGG, antall: 1, kortId: k1 }]));
    expect(res.resultat).toBe("ok");
    const etter = await prismaTimer.sheetTillegg.findUnique({ where: { id: t.id } });
    // Forventet: PC-rettingen står, eller synken melder avvik. Målt: 1 og «ok».
    expect(Number(etter?.antall)).toBe(3);
  });

  it("timerrad endret på PC og telefonen sender sin gamle (endretLokalt false): PC-versjonen står (grønn — V19.9-versjonering)", async () => {
    const { sid, dato, k1, r1 } = await dagMedJobb1();
    const telefonensVersjon = await versjon(r1);
    await dag().lagreJobbTid({ sheetId: sid, kortId: k1, fraTid: "07:00", tilTid: "14:00", pauseMin: 30, linjer: [{ radId: r1, lonnsartId: TL }] });
    const res = await push(telefonSedel(sid, dato, { id: r1, kortId: k1, serverVersjon: telefonensVersjon }, []));
    // Målt: svar «ok» — telefonens rad (urørt lokalt, gammel versjon) hoppes over (V19.9 S-regel).
    expect(res.resultat).toBe("ok");
    const etter = await prismaTimer.sheetTimer.findUnique({ where: { id: r1 } });
    expect(etter?.tilTid).toBe("14:00");
  });
});

// ---------------------------------------------------------------------------------------------
// Premisset om sedel 576d5533 («`synced_at` tom» = ikke slettet?): hva `synced_at` betyr
// ---------------------------------------------------------------------------------------------
describe("M1 — `synced_at` på en sedel laget på web", () => {
  it("opprett + tilfoyTimerRad på web setter aldri `synced_at` — tom verdi sier ingenting om sletting (grønn, målt)", async () => {
    const sid = randomUUID();
    await dag().opprett({ clientUuid: sid, aktivitetId: AKT, dato: nyDato(), pauseMin: 0 });
    const sedel = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { clientUuid: sid } });
    await dag().tilfoyTimerRad({ sheetId: sedel.id, projectId: P1, aktivitetId: AKT, externalCostObjectId: null, vehicleId: null, beskrivelse: "UNN", lonnsartId: TL, timer: 7.5, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kortId: randomUUID() });
    const etter = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sedel.id } });
    expect(etter.syncedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// TILLEGG 1 scenario 1 — avbryte et kort som er startet («+ Registrer timer»)
// `RegistrerTimerKnapp` kaller `opprett` med prosjektet (RegistrerTimerKnapp.tsx:147–158);
// serveren lager dagen OG første rad etter normen før brukeren har skrevet noe
// (`opprettForsteTimerRadForslag`, dagsseddel.ts:3290–3360). Uendret siden 36c64c82.
// ---------------------------------------------------------------------------------------------
describe("M1 T1 vei «+ Registrer timer» (opprett med prosjekt) — hva står igjen hvis brukeren går ut", () => {
  it("ett trykk lager sedel + lagret timerad 07:00–15:00 (7,5 t) før noe er skrevet (grønn, målt)", async () => {
    const cu = randomUUID();
    const sedel = await dag().opprett({ clientUuid: cu, aktivitetId: AKT, projectId: P1, dato: nyDato(), pauseMin: 0 });
    const r = await rader(sedel.id);
    expect(r.map((x) => [x.fraTid, x.tilTid, Number(x.timer), x.pauseMin, x.lonnsartId, x.projectId])).toEqual([
      ["07:00", "15:00", 7.5, 30, TL, P1],
    ]);
  });

  it("RØD i dag (Kenneth: «jeg kan ikke avbryte noe jeg ser starter feil»): å gå ut uten å skrive noe etterlater en lagret 7,5 t-rad — ingen avbryt-vei uten sletting", async () => {
    const sedel = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato: nyDato(), pauseMin: 0 });
    // Brukeren lukker / navigerer bort. Ingen mutasjon kalles. Det som står igjen på serveren:
    expect(await rader(sedel.id)).toHaveLength(0);
  });

  it("«Slett dagsseddel» og så «+ Registrer timer» samme dag: 07:00–15:00 er tilbake (grønn, målt — oppleves som «slettet kommer tilbake»)", async () => {
    const dato = nyDato();
    const s1 = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato, pauseMin: 0 });
    await dag().slett({ id: s1.id });
    const s2 = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato, pauseMin: 0 });
    expect(s2.eksisterte).toBe(false);
    expect((await rader(s2.id)).map((x) => [x.fraTid, x.tilTid])).toEqual([["07:00", "15:00"]]);
  });

  it("«Slett jobben» og så «+ Registrer timer» samme dag: sedelen finnes (tom), ingen ny auto-rad (grønn, målt)", async () => {
    const dato = nyDato();
    const s1 = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato, pauseMin: 0 });
    const [rad] = await rader(s1.id);
    await dag().slettKort({ id: s1.id, kortId: rad!.kortId! });
    const s2 = await dag().opprett({ clientUuid: randomUUID(), aktivitetId: AKT, projectId: P1, dato, pauseMin: 0 });
    expect(s2.eksisterte).toBe(true);
    expect(await rader(s2.id)).toHaveLength(0);
  });
});
