import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./dagsseddel";
import { byggHistorikkPost, byggSlettePost } from "../../services/timer/slettespor";

/**
 * SL2 (plan § 4.18 del D; vedtak-timer-web § Slettet og korrigert punkt 1–3; Kenneth 2026-11-23
 * «s1 nei», «s2 ja», «B76: ja · B77: nei · B78: ja», L1 og L2 «Ja, begge») — leseren bak siden
 * «Slettet og korrigert», mot EKTE Postgres (lokal sandkasse), gjennom prosedyren (`createCaller`).
 *
 *  1  Leseren gir en returnert dag som ikke er sendt på nytt, og en dag der alt er slettet (SV8).
 *  2  Uten attesteringsrett: ingenting. Prosjektlederen får bare sine prosjekter, firma-admin får
 *     firmaet, en bruker i et annet firma får ingenting.
 *  3  Arbeideren får bare egne dager, også når forespørselen ber om en annens.
 *  4  Hendelser uten innhold (slettet før SL1) vises ikke.
 *  5  Tre slettede linjer → «3 slettet»; ingen slettede / bare korrigerte → ingen merke.
 *  6  Attesteringskortet (`hentTilAttesteringFirma`) viser ingen slettede linjer.
 *
 * Arbeiderens slettinger går gjennom de ekte prosedyrene (SL1-sporet). Attestantens sletting og
 * retting skrives med de samme byggerne SL1 bruker (`byggSlettePost`, `byggHistorikkPost`).
 * Negativkontroll: på develop `0bdee142` finnes ikke prosedyren — alle testene er røde.
 */

const id = (n: string) => `5120c0de-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("05");
const ARB = id("02");
const ARB2 = id("06");
const LEDER = id("03");
const FADM = id("07");
const UTEN = id("08");
const FREMMED = id("04");
const P = id("11");
const P2 = id("12");
const TL = id("41");
const OT50 = id("42");
const REISE = id("45");
const AKT = id("44");
const TILLEGG = id("48");
const KATEGORI = id("49");
const MASKIN = id("51");
const VARE = id("61");
const BRUKERE = [ARB, ARB2, LEDER, FADM, UTEN, FREMMED];

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

// Perioden: oktober 2026, én dag pr. scenario.
const PERIODE = { fraOgMed: "2026-10-01", tilOgMed: "2026-10-31" };
const dato = (d: number) => new Date(Date.UTC(2026, 9, d));
const iso = (d: number) => dato(d).toISOString().slice(0, 10);

/** En dag med én jobb (kort K) på prosjekt `projectId`: timelinje, reise, maskin, tillegg, utlegg og vare. */
async function nyDag(o: { d: number; status: "draft" | "returned" | "sent" | "accepted"; userId?: string; projectId?: string }) {
  const userId = o.userId ?? ARB;
  const projectId = o.projectId ?? P;
  const sheetId = randomUUID();
  const kortId = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sheetId, clientUuid: sheetId, organizationId: ORG, userId, registrertAvUserId: userId, aktivitetId: AKT, dato: dato(o.d), status: o.status },
  });
  const felles = { sheetId, aktivitetId: AKT, projectId, kortId };
  const rad1 = await prismaTimer.sheetTimer.create({
    data: { ...felles, lonnsartId: TL, fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, beskrivelse: "Graving" },
  });
  const reise = await prismaTimer.sheetTimer.create({
    data: { ...felles, lonnsartId: REISE, fraTid: "06:00", tilTid: "07:00", pauseMin: 0, timer: 1, erReise: true, reiseRetning: "ut" },
  });
  const maskin = await prismaTimer.sheetMachine.create({
    data: { sheetId, vehicleId: MASKIN, projectId, timer: 2, sheetTimerId: rad1.id, kortId },
  });
  const tillegg = await prismaTimer.sheetTillegg.create({
    data: { sheetId, tilleggId: TILLEGG, projectId, antall: 1, kommentar: "Smussarbeid", kortId },
  });
  const utlegg = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId, expenseCategoryId: KATEGORI, belop: 80, kommentar: "Parkering Narvik", ordningVedFoering: "utlegg", kortId },
  });
  const v = await prismaVarelager.vareforbruk.create({
    data: { dato: dato(o.d), projectId, vareId: VARE, antall: 3.5, registrertAvUserId: userId, kommentar: "Grøft", dagsseddelId: sheetId, sheetTimerId: rad1.id, kortId },
  });
  return { sheetId, kortId, rad1: rad1.id, reise: reise.id, maskin: maskin.id, tillegg: tillegg.id, utlegg: utlegg.id, vare: v.id };
}

/** Attestanten sletter en timelinje i «Rediger sedel»: posten SL1 skriver, så slettingen. */
async function slettSomAttestant(radId: string, av = LEDER) {
  const rad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radId } });
  await prismaTimer.sheetRadHistorikk.createMany({ data: [byggSlettePost("timer", rad, av, new Date())] });
  await prismaTimer.sheetTimer.delete({ where: { id: radId } });
}

/** Attestanten retter timene på en timelinje: posten uten markør (som `rettRadFelt`), så rettingen. */
async function rettSomAttestant(radId: string, timer: number, av = LEDER) {
  const rad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radId } });
  await prismaTimer.sheetRadHistorikk.createMany({ data: [byggHistorikkPost("timer", rad, av, new Date())] });
  await prismaTimer.sheetTimer.update({ where: { id: radId }, data: { timer } });
}

type Svar = Awaited<ReturnType<ReturnType<typeof dag>["slettetOgKorrigert"]>>;
const dagFor = (svar: Svar, sheetId: string) => svar.find((d) => d.sedelId === sheetId);

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    await prismaVarelager.vareforbruk.deleteMany({ where: { dagsseddelId: { in: sids } } });
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [TL, OT50, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P, P2] } } });
  for (const org of [ORG, ORG2]) {
    await prisma.organizationSetting.deleteMany({ where: { organizationId: org } });
    await prisma.organizationModule.deleteMany({ where: { organizationId: org } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org } });
  }
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ARB, email: "sl2-arbeider@sitedoc.test", name: "Ola Arbeider", role: "user" },
      { id: ARB2, email: "sl2-arbeider2@sitedoc.test", name: "Per Arbeider", role: "user" },
      { id: LEDER, email: "sl2-leder@sitedoc.test", name: "Kari Leder", role: "user" },
      { id: FADM, email: "sl2-fadm@sitedoc.test", name: "Firma Admin", role: "user" },
      { id: UTEN, email: "sl2-uten@sitedoc.test", name: "Uten Rett", role: "user" },
      { id: FREMMED, email: "sl2-fremmed@sitedoc.test", name: "Fremmed Admin", role: "user" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "SL2-firma" }, { id: ORG2, name: "SL2-annet-firma" }] });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: ARB2, organizationId: ORG, status: "aktiv" },
      { userId: LEDER, organizationId: ORG, status: "aktiv" },
      { userId: FADM, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: UTEN, organizationId: ORG, status: "aktiv" },
      { userId: FREMMED, organizationId: ORG2, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((moduleSlug) => ({ organizationId: ORG, moduleSlug, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort", tillattRedigerVedAttestering: true },
  });
  for (const [p, nr] of [[P, "SL2-1"], [P2, "SL2-2"]] as const) {
    await prisma.project.create({ data: { id: p, projectNumber: nr, name: `SL2 ${nr}`, primaryOrganizationId: ORG } });
    await prisma.projectOrganization.create({ data: { projectId: p, organizationId: ORG } });
    await prisma.projectModule.createMany({
      data: ["timer", "varelager"].map((moduleSlug) => ({ projectId: p, moduleSlug, organizationId: ORG, status: "aktiv" })),
    });
  }
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: ARB2, projectId: P, role: "member" },
      { userId: LEDER, projectId: P, role: "member", kanAttestere: true },
      { userId: UTEN, projectId: P, role: "member" },
      { userId: FREMMED, projectId: P, role: "member" },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true, rekkefolge: 1 },
      { id: OT50, organizationId: ORG, type: "ordinaer", navn: "Overtid 50 %", aktiv: true, rekkefolge: 2, overtidsnivaa: 50 },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reise", aktiv: true, rekkefolge: 4 },
    ],
  });
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { reiseLonnsartId: REISE } });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({ data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" } });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", internNavn: "Graver", utleieEnhet: "time" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

// Scenariene (bygges én gang, leses av alle testene).
let returnertTre: Awaited<ReturnType<typeof nyDag>>; // 2.10.: returnert, ikke sendt på nytt, tre linjer slettet
let altSlettet: Awaited<ReturnType<typeof nyDag>>; // 3.10.: returnert, «Slett jobben» — alt slettet
let bareKorrigert: Awaited<ReturnType<typeof nyDag>>; // 4.10.: sendt, attestanten rettet én linje
let urort: Awaited<ReturnType<typeof nyDag>>; // 5.10.: sendt, ingenting skjedd
let attestantSlettet: Awaited<ReturnType<typeof nyDag>>; // 6.10.: sendt, attestanten slettet reisen
let p2Dag: Awaited<ReturnType<typeof nyDag>>; // 7.10.: returnert, slettet linje på P2 (lederen har ikke P2)
let forSl1: Awaited<ReturnType<typeof nyDag>>; // 8.10.: poster uten innhold (slettet før SL1)
let annenArbeider: Awaited<ReturnType<typeof nyDag>>; // 9.10.: Per Arbeiders returnerte dag, én linje slettet

beforeAll(async () => {
  await ryddOpp();
  await seed();

  returnertTre = await nyDag({ d: 2, status: "returned" });
  await dag(ARB).maskin.fjern({ id: returnertTre.maskin });
  await dag(ARB).fjernTilleggRad({ id: returnertTre.tillegg });
  await dag(ARB).fjernUtleggRad({ id: returnertTre.utlegg });

  altSlettet = await nyDag({ d: 3, status: "returned" });
  await dag(ARB).slettKort({ id: altSlettet.sheetId, kortId: altSlettet.kortId });

  bareKorrigert = await nyDag({ d: 4, status: "sent" });
  await rettSomAttestant(bareKorrigert.rad1, 6);

  urort = await nyDag({ d: 5, status: "sent" });

  attestantSlettet = await nyDag({ d: 6, status: "sent" });
  await slettSomAttestant(attestantSlettet.reise);

  p2Dag = await nyDag({ d: 7, status: "returned", projectId: P2 });
  await dag(ARB).fjernTilleggRad({ id: p2Dag.tillegg });

  // Før SL1: «Slett jobben» logget varer og utlegg med bare id i activity_log, og en post uten
  // innhold kan finnes. Ingen av dem skal vises.
  forSl1 = await nyDag({ d: 8, status: "returned" });
  await prismaTimer.sheetRadHistorikk.create({
    data: { radType: "utlegg", originalRadId: randomUUID(), sheetId: forSl1.sheetId, snapshot: { hendelse: "slettet" }, erstattetAvUserId: ARB },
  });
  await prismaTimer.sheetRadHistorikk.create({
    data: { radType: "vare", originalRadId: randomUUID(), sheetId: forSl1.sheetId, snapshot: { id: randomUUID(), hendelse: "slettet" }, erstattetAvUserId: ARB },
  });
  await prisma.activity.create({
    data: { actorUserId: ARB, targetType: "DailySheet", targetId: forSl1.sheetId, action: "vare.slettet", payload: { vareforbrukId: randomUUID() } },
  });

  annenArbeider = await nyDag({ d: 9, status: "returned", userId: ARB2 });
  await dag(ARB2).fjernTilleggRad({ id: annenArbeider.tillegg });
}, 120_000);
afterAll(ryddOpp);

describe("SL2 test 1 — returnert dag som ikke er sendt på nytt, og dag der alt er slettet (SV8)", () => {
  it("firma-admin får den returnerte dagen med de tre slettede linjene og innholdet", async () => {
    const svar = await dag(FADM).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    const d = dagFor(svar, returnertTre.sheetId)!;
    expect(d).toBeDefined();
    expect(d.status).toBe("returned");
    expect(d.dato).toBe(iso(2));
    expect(d.ansatt.navn).toBe("Ola Arbeider");
    expect(d.hendelser.map((h) => [h.type, h.linjetype]).sort()).toEqual([
      ["slettet", "maskin"],
      ["slettet", "tillegg"],
      ["slettet", "utlegg"],
    ]);
    const utlegg = d.hendelser.find((h) => h.linjetype === "utlegg")!;
    expect(utlegg).toMatchObject({ navn: "Parkering", belop: 80, kommentar: "Parkering Narvik", prosjekt: "SL2-1 SL2 SL2-1", avNavn: "Ola Arbeider", avEier: true, dagenVarReturnert: true });
    const maskin = d.hendelser.find((h) => h.linjetype === "maskin")!;
    expect(maskin).toMatchObject({ navn: "Graver", timer: 2 });
  });

  it("en dag der alt er slettet («Slett jobben») står på siden, med alle linjetypene", async () => {
    const svar = await dag(FADM).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    const d = dagFor(svar, altSlettet.sheetId)!;
    expect(d).toBeDefined();
    expect(new Set(d.hendelser.map((h) => h.linjetype))).toEqual(new Set(["timer", "reise", "maskin", "tillegg", "utlegg", "vare"]));
    expect(d.hendelser.every((h) => h.type === "slettet")).toBe(true);
    const vare = d.hendelser.find((h) => h.linjetype === "vare")!;
    expect(vare).toMatchObject({ navn: "Pukk 6-32", antall: 3.5, enhet: "tonn" });
    const timer = d.hendelser.find((h) => h.linjetype === "timer")!;
    expect(timer).toMatchObject({ fraTid: "07:00", tilTid: "15:00", timer: 7.5, navn: "Timelønn", aktivitet: "Anleggsarbeid" });
    // Dagen har ingen levende rader igjen.
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: altSlettet.sheetId } })).toBe(0);
  });
});

describe("SL2 test 2 — omfang og firma-isolasjon", () => {
  it("en bruker uten attesteringsrett får FORBIDDEN", async () => {
    await expect(dag(UTEN).slettetOgKorrigert({ organizationId: ORG, ...PERIODE })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prosjektlederen får bare linjer på sine prosjekter (P, ikke P2)", async () => {
    const svar = await dag(LEDER).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    expect(dagFor(svar, returnertTre.sheetId)).toBeDefined();
    expect(dagFor(svar, p2Dag.sheetId)).toBeUndefined();
    expect(svar.flatMap((d) => d.hendelser).every((h) => h.projectId === P)).toBe(true);
  });

  it("firma-admin får hele firmaet, også P2", async () => {
    const svar = await dag(FADM).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    expect(dagFor(svar, p2Dag.sheetId)?.hendelser.map((h) => h.linjetype)).toEqual(["tillegg"]);
    expect(dagFor(svar, annenArbeider.sheetId)).toBeDefined();
  });

  it("en bruker i et annet firma får ingenting: FORBIDDEN som attestant, og egne-modus på vårt firma avvises", async () => {
    await expect(dag(FREMMED).slettetOgKorrigert({ organizationId: ORG, ...PERIODE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dag(FREMMED).slettetOgKorrigert({ organizationId: ORG, egne: true, ...PERIODE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Eget firma (ORG2): fremmedens egne dager — ingen.
    expect(await dag(FREMMED).slettetOgKorrigert({ organizationId: ORG2, ...PERIODE })).toEqual([]);
  });
});

describe("SL2 test 3 — arbeideren får bare egne dager", () => {
  it("Ola ser egne slettinger på returnert dag, attestantens sletting og rettingen — ikke Pers dag", async () => {
    const svar = await dag(ARB).slettetOgKorrigert({ organizationId: ORG, egne: true, ...PERIODE });
    expect(svar.every((d) => d.ansatt.id === ARB)).toBe(true);
    expect(dagFor(svar, annenArbeider.sheetId)).toBeUndefined();
    expect(dagFor(svar, returnertTre.sheetId)?.antallSlettet).toBe(3);
    const korr = dagFor(svar, bareKorrigert.sheetId)!.hendelser;
    expect(korr).toHaveLength(1);
    expect(korr[0]).toMatchObject({ type: "korrigert", linjetype: "timer", avNavn: "Kari Leder", timer: 6 });
    expect(korr[0]!.felter).toEqual([expect.objectContaining({ felt: "timer", foer: 7.5, etter: 6 })]);
    const slettetAvLeder = dagFor(svar, attestantSlettet.sheetId)!.hendelser;
    expect(slettetAvLeder).toEqual([expect.objectContaining({ type: "slettet", linjetype: "reise", avNavn: "Kari Leder", avEier: false, dagenVarReturnert: false })]);
  });

  it("forespørselen ber om en annens dag (userId sendt med) — svaret er fortsatt bare egne", async () => {
    const svar = await dag(ARB2).slettetOgKorrigert({ organizationId: ORG, egne: true, ...PERIODE, userId: ARB } as never);
    expect(svar.map((d) => d.sedelId)).toEqual([annenArbeider.sheetId]);
  });

  it("navnet til den som slettet er aldri e-post", async () => {
    const svar = await dag(ARB).slettetOgKorrigert({ organizationId: ORG, egne: true, ...PERIODE });
    expect(svar.flatMap((d) => d.hendelser).some((h) => (h.avNavn ?? "").includes("@"))).toBe(false);
  });
});

describe("SL2 test 4 — hendelser uten innhold (før SL1) vises ikke", () => {
  it("posten uten innhold og vare.slettet i activity_log gir ingen dag", async () => {
    const svar = await dag(FADM).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    expect(dagFor(svar, forSl1.sheetId)).toBeUndefined();
  });
});

describe("SL2 test 5 — tallet i merket", () => {
  it("tre slettede linjer gir 3; ingen slettede og bare korrigerte gir ikke merke", async () => {
    const svar = await dag(FADM).slettetOgKorrigert({ organizationId: ORG, ...PERIODE });
    expect(dagFor(svar, returnertTre.sheetId)?.antallSlettet).toBe(3);
    expect(dagFor(svar, urort.sheetId)).toBeUndefined();
    const korr = dagFor(svar, bareKorrigert.sheetId)!;
    expect(korr.antallSlettet).toBe(0);
    expect(korr.hendelser.map((h) => h.type)).toEqual(["korrigert"]);
  });
});

describe("SL2 test 6 — attesteringskortet viser ingen slettede linjer", () => {
  it("hentTilAttesteringFirma har ikke reisen attestanten slettet, og ingen nye felt", async () => {
    const liste = await dag(FADM).hentTilAttesteringFirma({ organizationId: ORG, ...PERIODE, status: "sent" });
    const s = liste.find((x) => x.id === attestantSlettet.sheetId)!;
    expect(s.timer.map((r) => r.id)).toEqual([attestantSlettet.rad1]);
    expect(Object.keys(s)).not.toContain("antallSlettet");
    expect(Object.keys(s)).not.toContain("hendelser");
  });
});

describe("SL2 — perioden er avgrenset", () => {
  it("over 93 dager avvises", async () => {
    await expect(dag(FADM).slettetOgKorrigert({ organizationId: ORG, fraOgMed: "2026-01-01", tilOgMed: "2026-12-31" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
