import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { hentKorrigertAvPrDag } from "../services/timer/kortLeser";

/**
 * w15g (web-timeforing-plan.md § 4.15 del F og H pkt. 28, 33, 37, 39, 40): merket «Korrigert av»
 * hos arbeideren — mot EKTE Postgres (lokal engangs-DB, aldri test/prod).
 *
 * 28: arbeiderens leser for dagen (`hentMedId`) gir korrigerte felt med før/etter, hvem og når;
 *     `list` gir pr. dag hvem som korrigerte sist og om flere har korrigert. Én test pr. vei i F60
 *     (retting i kortet, «Rediger arbeid», underprosjekt på rad og jobb, «Del opp», ✂).
 * 33: «Lagre endringer» med to rettede linjer gir merket på begge.
 * 37: prosjektbytte på en reise (F77) og underprosjekt fra loggen (F78).
 * 39: første korrigering (F76); fram og tilbake gir ingen merke; attestantens «var …» uendret.
 * 40: merket står etter attestering.
 * LØSNING GODKJENT punkt 4: arbeiderens senere verdi står aldri som attestantens.
 * Vakt (F80): en annen bruker får tomt fra begge leserne. Antall spørringer i `list` er fast.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f7) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f7-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ARB = id("03"); // arbeideren, Ola Tømrer
const KARI = id("04"); // attestant på P1 og P2
const PER = id("05"); // attestant på P1
const ADM = id("06"); // firma-admin — kan lese Olas dagsseddel, skal ikke få merket
const P1 = id("11");
const P2 = id("12");
const ECO1 = id("31");
const ECO2 = id("32");
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");

const BRUKERE = [ARB, KARI, PER, ADM];

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
const nyDato = () => new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000);

async function nySedel() {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: { id: sid, clientUuid: sid, organizationId: ORG, userId: ARB, registrertAvUserId: ARB, aktivitetId: AKT, dato: nyDato(), status: "sent" },
  });
  return sid;
}

const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const timerMellom = (fra: string, til: string) => (min(til) - min(fra)) / 60;

async function raArbeid(sheetId: string, f: { projectId?: string; eco?: string | null; fra: string; til: string; kortId?: string }) {
  return prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: f.projectId ?? P1, externalCostObjectId: f.eco ?? null, lonnsartId: ORD, aktivitetId: AKT,
      fraTid: f.fra, tilTid: f.til, timer: timerMellom(f.fra, f.til), kortId: f.kortId ?? randomUUID(),
    },
  });
}

async function raReise(sheetId: string) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId, projectId: P1, lonnsartId: REISE, aktivitetId: AKT, erReise: true, reiseRetning: "retur", reiseKilde: "manuell",
      fraTid: "15:00", tilTid: "15:35", timer: 0.58,
    },
  });
  return r.id;
}

/** Retting i kortet (pennens «Lagre»): slutten og timene i ett kall. */
const rettSlutt = (userId: string, radId: string, fra: string, til: string) =>
  dag(userId).rettRadFelt({ radType: "timer", radId, felter: { tilTid: til, timer: timerMellom(fra, til) } });

async function korrigeringer(sid: string, userId = ARB) {
  const s = await dag(userId).hentMedId({ id: sid });
  return (s as unknown as { korrigeringer: Record<"timer" | "tillegg" | "maskin", Record<string, { avNavn: string | null; ved: Date; felter: { felt: string; foer: unknown; etter: unknown; foerTekst: string | null; etterTekst: string | null }[] }>> }).korrigeringer;
}
async function dagenIListe(sid: string, userId = ARB, input?: { userId: string }) {
  const liste = await dag(userId).list(input);
  return (liste.find((s) => s.id === sid) as unknown as { korrigertAv: { navn: string | null; flere: boolean } | null } | undefined)?.korrigertAv;
}
const felt = (k: { felter: { felt: string }[] } | undefined, navn: string) =>
  (k?.felter.find((f) => f.felt === navn) as { foer: unknown; etter: unknown; foerTekst: string | null; etterTekst: string | null } | undefined);

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [ECO1, ECO2] } } });
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
      { id: ARB, email: "w15g-arbeider@sitedoc.test", name: "Ola Tømrer", role: "user" },
      { id: KARI, email: "w15g-kari@sitedoc.test", name: "Kari Leder", role: "user" },
      { id: PER, email: "w15g-per@sitedoc.test", name: "Per Hansen", role: "user" },
      { id: ADM, email: "w15g-admin@sitedoc.test", name: "Admin", role: "user" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "w15g-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      ...[ARB, KARI, PER].map((u) => ({ userId: u, organizationId: ORG, status: "aktiv" })),
      { userId: ADM, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.createMany({
    data: ["timer", "maskin", "varelager"].map((m) => ({ organizationId: ORG, moduleSlug: m, status: "aktiv" })),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true, tillattSelvAttestering: false },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "W15G-1", internalProjectNumber: "1050", name: "Sitedoc Boligfelt B12", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "W15G-2", internalProjectNumber: "1060", name: "Kontor Narvik", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: ARB, projectId: P1, role: "member" },
      { userId: ARB, projectId: P2, role: "member" },
      { userId: KARI, projectId: P1, role: "member", kanAttestere: true },
      { userId: KARI, projectId: P2, role: "member", kanAttestere: true },
      { userId: PER, projectId: P1, role: "member", kanAttestere: true },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.externalCostObject.createMany({
    data: [
      { id: ECO1, organizationId: ORG, projectId: P1, proAdmId: "1050-01", kortNavn: "Grunnarbeid", kilde: "manuell", opprettetAvUserId: KARI },
      { id: ECO2, organizationId: ORG, projectId: P1, proAdmId: "1050-02", kortNavn: "Råbygg", kilde: "manuell", opprettetAvUserId: KARI },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Normaltid", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Forskaling" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
//  28 — arbeiderens to lesere, én test pr. vei i F60
// ════════════════════════════════════════════════════════════════════════════
describe("w15g pkt. 28 — arbeiderens lesere får de korrigerte feltene", () => {
  it("retting i kortet: hentMedId gir slutt 15:35 → 15:50 med Kari Leder og tidspunkt; list gir «Kari Leder»", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    const foer = Date.now();
    await rettSlutt(KARI, r.id, "11:30", "15:50");

    const k = (await korrigeringer(sid)).timer[r.id];
    expect(k?.avNavn).toBe("Kari Leder");
    expect(new Date(k!.ved).getTime()).toBeGreaterThanOrEqual(foer - 1000);
    expect(felt(k, "tilTid")).toMatchObject({ foer: "15:35", etter: "15:50" });
    expect(felt(k, "timer")).toMatchObject({ foer: 4.08, etter: 4.33 });
    expect(felt(k, "fraTid")).toBeUndefined();
    expect(await dagenIListe(sid)).toEqual({ navn: "Kari Leder", flere: false });
  });

  it("en dag uten retting har ingen korrigeringer og ingen «Korrigert av»", async () => {
    const sid = await nySedel();
    await raArbeid(sid, { fra: "07:00", til: "15:00" });
    expect(await korrigeringer(sid)).toEqual({ timer: {}, tillegg: {}, maskin: {} });
    expect(await dagenIListe(sid)).toBeNull();
  });

  it("to attestanter på dagen: list gir den siste med «m.fl.»", async () => {
    const sid = await nySedel();
    const a = await raArbeid(sid, { fra: "07:00", til: "11:00" });
    const b = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(PER, a.id, "07:00", "10:30");
    await rettSlutt(KARI, b.id, "11:30", "15:50");
    expect(await dagenIListe(sid)).toEqual({ navn: "Kari Leder", flere: true });
  });

  it("underprosjekt på én rad («Føres på») og for hele jobben gir merket med underprosjektet før og etter (F78)", async () => {
    const sid = await nySedel();
    const enRad = await raArbeid(sid, { fra: "07:00", til: "09:00", eco: ECO1 });
    const kortId = randomUUID();
    const j1 = await raArbeid(sid, { fra: "09:00", til: "11:00", eco: ECO1, kortId });
    await dag(KARI).flyttTimerRadEco({ timerRadId: enRad.id, radType: "timer", externalCostObjectId: ECO2 });
    const jobb = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: j1.id } });
    await dag(KARI).flyttTimerRadEco({ timerRadId: j1.id, radType: "timer", externalCostObjectId: null, helJobb: true });
    expect(jobb.kortId).toBeTruthy();

    const k = await korrigeringer(sid);
    expect(felt(k.timer[enRad.id], "externalCostObjectId")).toMatchObject({
      foer: ECO1, etter: ECO2, foerTekst: "1050-01 · Grunnarbeid", etterTekst: "1050-02 · Råbygg",
    });
    expect(felt(k.timer[j1.id], "externalCostObjectId")).toMatchObject({ foer: ECO1, etter: null, foerTekst: "1050-01 · Grunnarbeid" });
    expect(k.timer[j1.id]?.avNavn).toBe("Kari Leder");
  });

  it("«Del opp»: del A har slutten før og etter", async () => {
    const sid = await nySedel();
    const kortId = randomUUID();
    const r = await raArbeid(sid, { fra: "07:00", til: "15:00", kortId });
    const lagret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r.id } });
    await dag(KARI).delJobb({ sheetId: sid, kortId: lagret.kortId!, kl: "11:00", externalCostObjectIdB: null });
    const k = await korrigeringer(sid);
    expect(felt(k.timer[r.id], "tilTid")).toMatchObject({ foer: "15:00", etter: "11:00" });
    expect(k.timer[r.id]?.avNavn).toBe("Kari Leder");
  });

  it("✂: delene har merket mot originalen", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "07:00", til: "15:00" });
    await dag(KARI).splittRad({
      radType: "timer",
      radId: r.id,
      nyeRader: [
        { lonnsartId: ORD, aktivitetId: AKT, projectId: P1, fraTid: "07:00", tilTid: "11:00", timer: 4 },
        { lonnsartId: ORD, aktivitetId: AKT, projectId: P1, fraTid: "11:00", tilTid: "15:00", timer: 4 },
      ],
    } as Parameters<ReturnType<typeof dag>["splittRad"]>[0]);
    const deler = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    const k = await korrigeringer(sid);
    expect(felt(k.timer[deler[0]!.id], "tilTid")).toMatchObject({ foer: "15:00", etter: "11:00" });
    expect(felt(k.timer[deler[1]!.id], "fraTid")).toMatchObject({ foer: "07:00", etter: "11:00" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  33 — «Lagre endringer» i «Rediger arbeid»
// ════════════════════════════════════════════════════════════════════════════
describe("w15g pkt. 33 — «Lagre endringer» med to rettede linjer", () => {
  it("begge linjene har merket «Korrigert av» hos arbeideren; en urørt linje har ikke", async () => {
    const sid = await nySedel();
    const a = await raArbeid(sid, { fra: "07:00", til: "11:00" });
    const b = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    const c = await raArbeid(sid, { fra: "16:00", til: "16:30" });
    const rad = (r: typeof a, til?: string) => ({
      originalId: r.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, externalCostObjectId: null, byggeplassId: null,
      fraTid: r.fraTid, tilTid: til ?? r.tilTid, timer: timerMellom(r.fraTid!, til ?? r.tilTid!), pauseMin: 0,
    });
    await dag(KARI).redigerSedelRader({
      sheetId: sid,
      nyeRader: { timer: [rad(a, "10:30"), rad(b, "15:50"), rad(c)], tillegg: [], maskin: [] },
    });
    const k = await korrigeringer(sid);
    expect(felt(k.timer[a.id], "tilTid")).toMatchObject({ foer: "11:00", etter: "10:30" });
    expect(felt(k.timer[b.id], "tilTid")).toMatchObject({ foer: "15:35", etter: "15:50" });
    expect(k.timer[c.id]).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  37 — sted: prosjektbytte på en reise (F77)
// ════════════════════════════════════════════════════════════════════════════
describe("w15g pkt. 37 — «Korrigert av» for sted", () => {
  it("prosjektbytte på en reise i attesteringen: prosjektet før og etter, med navn", async () => {
    const sid = await nySedel();
    await raArbeid(sid, { fra: "07:00", til: "15:00" });
    const reise = await raReise(sid);
    await dag(KARI).rettRadFelt({ radType: "timer", radId: reise, felter: { projectId: P2 } });
    const k = await korrigeringer(sid);
    expect(felt(k.timer[reise], "projectId")).toMatchObject({
      foer: P1, etter: P2, foerTekst: "1050 Sitedoc Boligfelt B12", etterTekst: "1060 Kontor Narvik",
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  39 — første korrigering (F76)
// ════════════════════════════════════════════════════════════════════════════
describe("w15g pkt. 39 — første korrigering", () => {
  it("15:35 → 15:40 → 15:50 står som 15:35 → 15:50, med navn og tid fra siste; attestantens «var …» er uendret", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(PER, r.id, "11:30", "15:40");
    await rettSlutt(KARI, r.id, "11:30", "15:50");
    const k = (await korrigeringer(sid)).timer[r.id];
    expect(felt(k, "tilTid")).toMatchObject({ foer: "15:35", etter: "15:50" });
    expect(k?.avNavn).toBe("Kari Leder");
    // Attestanten ser fortsatt siste retting («var 15:40»).
    const att = await dag(KARI).hentForAttestering({ id: sid });
    const attRad = (att as unknown as { timer: { id: string; rettedeFelter: { felt: string; foer: unknown }[] }[] }).timer.find((x) => x.id === r.id);
    expect(attRad?.rettedeFelter.find((f) => f.felt === "tilTid")?.foer).toBe("15:40");
  });

  it("fram og tilbake gir ingen merke, og dagen har ikke «Korrigert av» i lista", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(KARI, r.id, "11:30", "15:40");
    await rettSlutt(KARI, r.id, "11:30", "15:35");
    expect((await korrigeringer(sid)).timer[r.id]).toBeUndefined();
    expect(await dagenIListe(sid)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  40 — merket står etter attestering
// ════════════════════════════════════════════════════════════════════════════
describe("w15g pkt. 40 — merket står etter attestering", () => {
  it("en korrigert linje som så er attestert, har fortsatt merket", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(KARI, r.id, "11:30", "15:50");
    await dag(KARI).attesterRader({ radIder: { timerIder: [r.id], tilleggIder: [], maskinIder: [] } });
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r.id } })).attestertStatus).toBe("attestert");
    expect(felt((await korrigeringer(sid)).timer[r.id], "tilTid")).toMatchObject({ foer: "15:35", etter: "15:50" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  LØSNING GODKJENT punkt 4 — returnert og sendt på nytt
// ════════════════════════════════════════════════════════════════════════════
describe("w15g punkt 4 — arbeiderens senere verdi står ikke som attestantens", () => {
  it("Kari setter 15:50, arbeideren 16:00: merket viser 15:35 → 15:50", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(KARI, r.id, "11:30", "15:50");
    // Arbeiderens penn (`oppdaterTimerRad`) skriver ingen historikk; raden får hans verdi direkte.
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "returned" } });
    await prismaTimer.sheetTimer.update({ where: { id: r.id }, data: { tilTid: "16:00", timer: timerMellom("11:30", "16:00") } });
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { status: "sent" } });
    const k = (await korrigeringer(sid)).timer[r.id];
    expect(felt(k, "tilTid")).toMatchObject({ foer: "15:35", etter: "15:50" });
    expect(k?.avNavn).toBe("Kari Leder");
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Vakt (F80) — bare eieren får merket
// ════════════════════════════════════════════════════════════════════════════
describe("w15g vakt — en annen bruker får tomt fra hentMedId og list", () => {
  it("firma-admin leser Olas dag og liste: ingen korrigeringer, ingen «Korrigert av»; Ola får dem", async () => {
    const sid = await nySedel();
    const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
    await rettSlutt(KARI, r.id, "11:30", "15:50");
    expect(await korrigeringer(sid, ADM)).toEqual({ timer: {}, tillegg: {}, maskin: {} });
    expect(await dagenIListe(sid, ADM, { userId: ARB })).toBeNull();
    expect((await korrigeringer(sid, ARB)).timer[r.id]).toBeDefined();
    expect(await dagenIListe(sid, ARB)).toEqual({ navn: "Kari Leder", flere: false });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Kostnaden for list — antall spørringer er fast
// ════════════════════════════════════════════════════════════════════════════
describe("w15g — antall spørringer for «Korrigert av» i list", () => {
  function tellende() {
    const teller = { n: 0 };
    const tell = <T extends object>(klient: T): T =>
      new Proxy(klient, {
        get(mål, navn) {
          const modell = Reflect.get(mål, navn) as object;
          if (typeof modell !== "object" || modell === null) return modell;
          return new Proxy(modell, {
            get(m, metode) {
              const f = Reflect.get(m, metode) as unknown;
              if (typeof f !== "function") return f;
              return (...a: unknown[]) => { teller.n++; return (f as (...x: unknown[]) => unknown).apply(m, a); };
            },
          });
        },
      });
    return { teller, k: { prisma: tell(prisma), prismaTimer: tell(prismaTimer) } };
  }

  it("tre spørringer for én dag og for mange dager", async () => {
    const sedler = [];
    for (let i = 0; i < 6; i++) {
      const sid = await nySedel();
      const r = await raArbeid(sid, { fra: "11:30", til: "15:35" });
      await rettSlutt(i % 2 ? KARI : PER, r.id, "11:30", "15:50");
      sedler.push(sid);
    }
    const les = async (ider: string[]) => {
      const s = await prismaTimer.dailySheet.findMany({ where: { id: { in: ider } }, include: { timer: true, tillegg: true, maskiner: true } });
      const { teller, k } = tellende();
      const ut = await hentKorrigertAvPrDag(k as Parameters<typeof hentKorrigertAvPrDag>[0], s);
      return { n: teller.n, ut };
    };
    const en = await les(sedler.slice(0, 1));
    const alle = await les(sedler);
    expect(en.n).toBe(3);
    expect(alle.n).toBe(3);
    expect(alle.ut.size).toBe(6);
  });
});
