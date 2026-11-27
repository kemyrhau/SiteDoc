import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter, attesteringsOmfang, attesteringsFirmaer } from "./timer/dagsseddel";
import { organisasjonRouter } from "./organisasjon";

/**
 * w10b (web-timeføring-plan § 4.6 «Tester som må til» og § 4.10 del D): én attestering på
 * firmanivå. Firmalista (`hentTilAttesteringFirma`) med prosjektleder-omfang, mot EKTE Postgres
 * (lokal engangs-DB, aldri test/prod). All data har faste id-er (prefiks 10b0a7e5) og ryddes.
 *
 * O1  Omfanget er likt `attesteringsFirmaer` pr. prosjekt, begge veier (S1 A).
 * O2  Lederen får ikke en sedel uten rad på prosjektene sine.
 * O3  H1: ikke et annet firmas sedler på eget prosjekt; ingenting fra firma der han ikke er
 *     aktiv ansatt.
 * O4  R13: rad på prosjekt han ikke har tilgang til kommer uten navn, nummer, underprosjekt og
 *     byggeplass; rad på prosjekt han har tilgang til (uten å lede) har navn. Serveren avviser
 *     attestering av rader han ikke leder.
 * O5  F1: sedel med bare fravær står ikke i lederens liste; fravær på sedel med rad på hans
 *     prosjekt følger firmavalget i begge stillinger.
 * O6  Firma-admin får samme svar som før (samme sedler, samme felt + to nye), unntatt S2 A:
 *     utlegget har `kortId` og `project` og står i jobbens kort (plan § 8.12).
 * O7  `kanAttestereFirma.kanAttestere` er usann for lederen (telefonen).
 * O8  Firma-admin i et deltakerfirma får ikke omfang i eierfirmaet (firmaadmin-eierfirma).
 * O9  Ansattnummer fra sedelens firma (M7); tidsrunding og `mineProsjektIder` i lista.
 * O10 `mineAttesteringsFirmaer` gir firmaene med omfang (B6).
 * O11 M3: `hentArbeidstidDefaults` gir firma-admin samme verdier som `hentSetting`; lederen når den.
 */

const id = (n: string) => `10b0a7e5-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02");
const ANSATT = id("03"); // arbeider i ORG
const ANSATT_B = id("04"); // arbeider i ORG2
const LEDER = id("05"); // admin på P1, medlem (ikke leder) på P2, ikke på P3. Aktiv i ORG og ORG2.
const KAN = id("06"); // «kan attestere» på P3 (role member), aktiv i ORG
const SLUTTET = id("07"); // admin på P1, deaktivert i ORG
const FADMIN = id("08"); // firma-admin i ORG
const FADMIN2 = id("09"); // firma-admin i ORG2 (deltakerfirma på P1)
const SITEADMIN = id("10");
const P1 = id("11");
const P2 = id("12");
const P3 = id("13");
const BP3 = id("21"); // byggeplass på P3
const ECO3 = id("22"); // underprosjekt på P3
const ORD = id("41");
const FRAV = id("42");
const AKT = id("44");
const ORD2 = id("45");
const AKT2 = id("47");
const KAT = id("48"); // utleggskategori i ORG

const BRUKERE = [ANSATT, ANSATT_B, LEDER, KAN, SLUTTET, FADMIN, FADMIN2, SITEADMIN];
const PROSJEKTER = [P1, P2, P3];
// Prosjektnummer er unikt i DB; unikt pr. løp så rester etter et avbrutt løp ikke velter seeden.
const NR = randomUUID().slice(0, 8);
const P3_NR = `W10B-3-${NR}`;

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

const UKE = { fraOgMed: "2026-11-02", tilOgMed: "2026-11-08", status: ["sent", "accepted"] as ("sent" | "accepted")[] };
let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 10, 2) + (datoTeller++ % 7) * 86_400_000).toISOString().slice(0, 10);
}

async function nySedel(userId: string, org = ORG) {
  const sid = randomUUID();
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: org,
      userId,
      registrertAvUserId: userId,
      aktivitetId: org === ORG ? AKT : AKT2,
      dato: new Date(nyDato()),
      status: "sent",
    },
  });
  return sid;
}
async function arbeid(sheetId: string, projectId: string, f: { org?: string; byggeplassId?: string; eco?: string } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId,
      lonnsartId: f.org === ORG2 ? ORD2 : ORD,
      aktivitetId: f.org === ORG2 ? AKT2 : AKT,
      fraTid: "07:00",
      tilTid: "09:00",
      timer: 2,
      byggeplassId: f.byggeplassId ?? null,
      externalCostObjectId: f.eco ?? null,
    },
  });
  return r.id;
}
async function fravaer(sheetId: string) {
  const r = await prismaTimer.sheetTimer.create({
    data: { sheetId, projectId: null, utenProsjekt: true, lonnsartId: FRAV, aktivitetId: AKT, timer: 5.5 },
  });
  return r.id;
}
async function utlegg(sheetId: string, projectId: string, kortId: string | null) {
  const r = await prismaTimer.sheetUtlegg.create({
    data: { sheetId, projectId, expenseCategoryId: KAT, belop: 100, ordningVedFoering: "utlegg", kortId },
  });
  return r.id;
}

type Rad = { id: string; projectId: string | null; project: { name: string } | null; byggeplassNavn?: string | null; underprosjekt?: unknown };
type Sedel = {
  id: string;
  fravaerKanAttesteres: boolean;
  timer: Rad[];
  utlegg: Array<Record<string, unknown>>;
  ansatt: { ansattnummer: string | null } | null;
  mineProsjektIder: string[] | null;
  tidsrundingMinutter: number | null;
};
const liste = async (userId: string, org = ORG) =>
  (await dag(userId).hentTilAttesteringFirma({ organizationId: org, ...UKE })) as unknown as Sedel[];

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
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KAT } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, FRAV, ORD2] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT2] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO3 } });
  await prisma.byggeplass.deleteMany({ where: { id: BP3 } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: PROSJEKTER } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: PROSJEKTER } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: PROSJEKTER } } });
  await prisma.project.deleteMany({ where: { id: { in: PROSJEKTER } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ANSATT, email: "w10b-ansatt@sitedoc.test", name: "Ansatt", role: "user" },
      { id: ANSATT_B, email: "w10b-ansatt-b@sitedoc.test", name: "Ansatt B", role: "user" },
      { id: LEDER, email: "w10b-leder@sitedoc.test", name: "Leder", role: "user" },
      { id: KAN, email: "w10b-kan@sitedoc.test", name: "Kan attestere", role: "user" },
      { id: SLUTTET, email: "w10b-sluttet@sitedoc.test", name: "Sluttet", role: "user" },
      { id: FADMIN, email: "w10b-fadmin@sitedoc.test", name: "Lønn", role: "user" },
      { id: FADMIN2, email: "w10b-fadmin2@sitedoc.test", name: "Lønn 2", role: "user" },
      { id: SITEADMIN, email: "w10b-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.createMany({
    data: [
      { id: ORG, name: "W10b-firma" },
      { id: ORG2, name: "W10b-firma 2" },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { userId: ANSATT, organizationId: ORG, status: "aktiv", ansattnummer: "A-1" },
      { userId: LEDER, organizationId: ORG, status: "aktiv" },
      { userId: KAN, organizationId: ORG, status: "aktiv" },
      { userId: SLUTTET, organizationId: ORG, status: "deaktivert" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: ANSATT_B, organizationId: ORG2, status: "aktiv", ansattnummer: "B-1" },
      { userId: ANSATT, organizationId: ORG2, status: "aktiv", ansattnummer: "A-ORG2" },
      { userId: LEDER, organizationId: ORG2, status: "aktiv" },
      { userId: FADMIN2, organizationId: ORG2, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [ORG, ORG2].map((o) => ({ organizationId: o, moduleSlug: "timer", status: "aktiv" })),
  });
  await prisma.organizationSetting.createMany({
    data: [{ organizationId: ORG, tidsrundingMinutter: 30, standardStartTid: "06:30", standardPauseMin: 45, standardPauseEtterTimer: 5 }, { organizationId: ORG2 }],
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: `W10B-1-${NR}`, name: "Ledet bygg", primaryOrganizationId: ORG },
      { id: P2, projectNumber: `W10B-2-${NR}`, name: "Delt bygg", primaryOrganizationId: ORG },
      { id: P3, projectNumber: P3_NR, name: "Hemmelig bygg", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectOrganization.createMany({
    data: [
      { projectId: P1, organizationId: ORG },
      { projectId: P2, organizationId: ORG },
      { projectId: P3, organizationId: ORG },
      { projectId: P1, organizationId: ORG2, rolle: "underentreprenor" },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: ANSATT, projectId: P1, role: "member" },
      { userId: ANSATT, projectId: P2, role: "member" },
      { userId: ANSATT, projectId: P3, role: "member" },
      { userId: ANSATT_B, projectId: P1, role: "member" },
      { userId: LEDER, projectId: P1, role: "admin" },
      { userId: LEDER, projectId: P2, role: "member" },
      { userId: KAN, projectId: P3, role: "member", kanAttestere: true },
      { userId: SLUTTET, projectId: P1, role: "admin" },
      { userId: FADMIN2, projectId: P1, role: "member" },
    ],
  });
  await prisma.projectModule.createMany({
    data: PROSJEKTER.map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.byggeplass.create({ data: { id: BP3, projectId: P3, name: "Hemmelig byggeplass" } });
  await prisma.externalCostObject.create({
    data: {
      id: ECO3,
      organizationId: ORG,
      projectId: P3,
      proAdmId: "HEM-1",
      kortNavn: "Hemmelig underprosjekt",
      kilde: "manuell",
      opprettetAvUserId: FADMIN,
    },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: FRAV, organizationId: ORG, type: "fravaer", navn: "Egenmelding", aktiv: true },
      { id: ORD2, organizationId: ORG2, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.createMany({
    data: [
      { id: AKT, organizationId: ORG, navn: "Grunnarbeid" },
      { id: AKT2, organizationId: ORG2, navn: "Grunnarbeid" },
    ],
  });
  await prismaTimer.expenseCategory.create({ data: { id: KAT, organizationId: ORG, navn: "Parkering" } });
}

// Sedlene (alle i uka UKE).
let S_P1 = ""; // ANSATT, ORG: rad på P1 + rad på P3 (byggeplass + underprosjekt) + rad på P2 + utlegg
let S_P3 = ""; // ANSATT, ORG: bare P3
let S_FRAV = ""; // ANSATT, ORG: bare fravær
let S_P1_FRAV = ""; // ANSATT, ORG: P1 + fravær
let S_ORG2 = ""; // ANSATT_B, ORG2: rad på P1
let R_P1 = "";
let R_P2 = "";
let R_P3 = "";
let R_FRAV = "";
let U_P1 = "";
let U_P3 = "";

beforeAll(async () => {
  await ryddOpp();
  await seed();
  S_P1 = await nySedel(ANSATT);
  R_P1 = await arbeid(S_P1, P1);
  R_P2 = await arbeid(S_P1, P2);
  R_P3 = await arbeid(S_P1, P3, { byggeplassId: BP3, eco: ECO3 });
  U_P1 = await utlegg(S_P1, P1, "kort-p1");
  U_P3 = await utlegg(S_P1, P3, "kort-p3");
  S_P3 = await nySedel(ANSATT);
  await arbeid(S_P3, P3);
  S_FRAV = await nySedel(ANSATT);
  await fravaer(S_FRAV);
  S_P1_FRAV = await nySedel(ANSATT);
  await arbeid(S_P1_FRAV, P1);
  R_FRAV = await fravaer(S_P1_FRAV);
  S_ORG2 = await nySedel(ANSATT_B, ORG2);
  await arbeid(S_ORG2, P1, { org: ORG2 });
}, 60_000);
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
describe("O1 — omfanget er likt attesteringsFirmaer pr. prosjekt (begge veier)", () => {
  it.each([
    ["LEDER", LEDER, ORG],
    ["LEDER i ORG2", LEDER, ORG2],
    ["KAN", KAN, ORG],
    ["SLUTTET", SLUTTET, ORG],
    ["ANSATT", ANSATT, ORG],
    ["FADMIN2 i ORG", FADMIN2, ORG],
  ])("%s", async (_navn, userId, org) => {
    const omfang = await attesteringsOmfang(userId, org);
    expect(omfang.type).toBe("prosjekter");
    if (omfang.type !== "prosjekter") return;
    for (const p of PROSJEKTER) {
      const firmaer = await attesteringsFirmaer(userId, p);
      const iFirma = firmaer === null || firmaer.includes(org);
      expect({ p, iOmfang: omfang.prosjektIder.includes(p) }).toEqual({ p, iOmfang: iFirma });
    }
  });

  it("firma-admin og sitedoc_admin har omfang alle", async () => {
    expect(await attesteringsOmfang(FADMIN, ORG)).toEqual({ type: "alle" });
    expect(await attesteringsOmfang(SITEADMIN, ORG)).toEqual({ type: "alle" });
  });

  it("lederen har P1, KAN har P3 (kan attestere uten admin-rolle)", async () => {
    expect(await attesteringsOmfang(LEDER, ORG)).toEqual({ type: "prosjekter", prosjektIder: [P1] });
    expect(await attesteringsOmfang(KAN, ORG)).toEqual({ type: "prosjekter", prosjektIder: [P3] });
  });
});

describe("O2/O3 — hvilke sedler lederen får", () => {
  it("bare firmaets sedler med rad på prosjektene hans", async () => {
    const ider = (await liste(LEDER)).map((s) => s.id).sort();
    expect(ider).toEqual([S_P1, S_P1_FRAV].sort());
    expect(ider).not.toContain(S_P3); // ingen rad på P1
  });

  it("H1: ikke ORG2 sin sedel på eget prosjekt i ORG-lista", async () => {
    expect((await liste(LEDER)).map((s) => s.id)).not.toContain(S_ORG2);
  });

  it("i ORG2 (aktiv ansatt der) får han ORG2 sin sedel, og ingen av ORG sine", async () => {
    const ider = (await liste(LEDER, ORG2)).map((s) => s.id);
    expect(ider).toEqual([S_ORG2]);
  });

  it("ingenting fra firma der han ikke er aktiv ansatt", async () => {
    await expect(liste(SLUTTET)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("vanlig ansatt og firma-admin i deltakerfirmaet får ingen tilgang", async () => {
    await expect(liste(ANSATT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(liste(FADMIN2)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("O4 — navneskjul (R13) og serverens sperre", () => {
  it("rad på prosjekt uten tilgang røper ikke navn, nummer, byggeplass eller underprosjekt", async () => {
    const s = (await liste(LEDER)).find((x) => x.id === S_P1)!;
    const p3 = s.timer.find((r) => r.id === R_P3)!;
    expect(p3.projectId).toBe(P3);
    expect(p3.project).toBeNull();
    expect(p3.byggeplassNavn ?? null).toBeNull();
    expect(p3.underprosjekt ?? null).toBeNull();
    expect(JSON.stringify(s)).not.toContain("Hemmelig");
    expect(JSON.stringify(s)).not.toContain(P3_NR);
  });

  it("rad på prosjekt han har tilgang til (uten å lede) har navn", async () => {
    const s = (await liste(LEDER)).find((x) => x.id === S_P1)!;
    expect(s.timer.find((r) => r.id === R_P2)!.project?.name).toBe("Delt bygg");
    expect(s.timer.find((r) => r.id === R_P1)!.project?.name).toBe("Ledet bygg");
  });

  it("utlegg: kort-id og prosjekt for lederen, med navneskjul (S2)", async () => {
    const s = (await liste(LEDER)).find((x) => x.id === S_P1)!;
    const u1 = s.utlegg.find((u) => u.id === U_P1)!;
    const u3 = s.utlegg.find((u) => u.id === U_P3)!;
    expect(u1.kortId).toBe("kort-p1");
    expect((u1.project as { name: string } | null)?.name).toBe("Ledet bygg");
    expect(u3.kortId).toBe("kort-p3");
    expect(u3.project).toBeNull();
  });

  it("serveren avviser attestering av rader på prosjekt han ikke leder", async () => {
    await expect(dag(LEDER).attesterRader({ radIder: { timerIder: [R_P2] } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dag(LEDER).attesterRader({ radIder: { timerIder: [R_P3] } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("O5 — fravær uten prosjekt (F1)", () => {
  it("sedel med bare fravær står ikke i lederens liste, men i firma-admins", async () => {
    expect((await liste(LEDER)).map((s) => s.id)).not.toContain(S_FRAV);
    expect((await liste(FADMIN)).map((s) => s.id)).toContain(S_FRAV);
  });

  it("firmavalget av: fraværet kan ikke attesteres av lederen", async () => {
    await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { fravaerAttesteresAvProsjektleder: false } });
    const s = (await liste(LEDER)).find((x) => x.id === S_P1_FRAV)!;
    expect(s.fravaerKanAttesteres).toBe(false);
    await expect(dag(LEDER).attesterRader({ radIder: { timerIder: [R_FRAV] } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("firmavalget på: fraværet kan attesteres av lederen", async () => {
    await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { fravaerAttesteresAvProsjektleder: true } });
    const s = (await liste(LEDER)).find((x) => x.id === S_P1_FRAV)!;
    expect(s.fravaerKanAttesteres).toBe(true);
    await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { fravaerAttesteresAvProsjektleder: false } });
  });
});

describe("O6 — firma-admin får samme svar som før", () => {
  // Feltene firmalista ga før w10b (dagsseddel.ts før endringen) + de to nye.
  const NYE = ["mineProsjektIder", "tidsrundingMinutter"];
  const UTLEGG_FOR = ["belop", "byggeplassId", "expenseCategory", "externalCostObjectId", "id", "projectId", "vedlegg"];
  // S2 A (Kenneth, plan § 8.12): de eneste nye utleggsfeltene for firma-admin.
  const UTLEGG_S2 = ["kortId", "project"];
  // Retur 3 runde 6: timeraden utlegget er koblet til (id på samme sedel) — styrer «→ Kort»-målene.
  const UTLEGG_R6 = ["sheetTimerId"];

  it("alle firmaets sedler, også bare fravær; ingen andre firmas", async () => {
    const ider = (await liste(FADMIN)).map((s) => s.id).sort();
    expect(ider).toEqual([S_P1, S_P3, S_FRAV, S_P1_FRAV].sort());
  });

  it("alle navn synlige, utlegg med samme felt + S2-feltene, mineProsjektIder null", async () => {
    const svar = await liste(FADMIN);
    const s = svar.find((x) => x.id === S_P1)!;
    expect(s.timer.find((r) => r.id === R_P3)!.project?.name).toBe("Hemmelig bygg");
    expect(s.timer.find((r) => r.id === R_P3)!.byggeplassNavn).toBe("Hemmelig byggeplass");
    for (const u of s.utlegg) expect(Object.keys(u).sort()).toEqual([...UTLEGG_FOR, ...UTLEGG_S2, ...UTLEGG_R6].sort());
    expect(s.mineProsjektIder).toBeNull();
    for (const k of NYE) expect(Object.keys(s)).toContain(k);
  });

  it("S2 A: utlegget står i jobbens kort for firma-admin, uten navneskjul", async () => {
    const s = (await liste(FADMIN)).find((x) => x.id === S_P1)!;
    const u1 = s.utlegg.find((u) => u.id === U_P1)!;
    const u3 = s.utlegg.find((u) => u.id === U_P3)!;
    expect(u1.kortId).toBe("kort-p1");
    expect((u1.project as { name: string } | null)?.name).toBe("Ledet bygg");
    expect(u3.kortId).toBe("kort-p3");
    expect((u3.project as { name: string } | null)?.name).toBe("Hemmelig bygg");
  });

  it("samme svar for sitedoc_admin og firma-admin", async () => {
    const a = await liste(FADMIN);
    const b = await liste(SITEADMIN);
    const uten = (x: Sedel[]) => JSON.stringify(x.map(({ fravaerKanAttesteres: _f, ...r }) => r));
    expect(uten(b)).toBe(uten(a));
  });
});

describe("O7 — kanAttestereFirma", () => {
  it("lederen: kanAttestere usann (telefonen), omfang prosjekter", async () => {
    expect(await dag(LEDER).kanAttestereFirma({ organizationId: ORG })).toEqual({
      kanAttestere: false,
      omfang: "prosjekter",
      prosjektIder: [P1],
    });
  });
  it("firma-admin: kanAttestere sann, omfang alle", async () => {
    expect(await dag(FADMIN).kanAttestereFirma({ organizationId: ORG })).toMatchObject({ kanAttestere: true, omfang: "alle" });
  });
  it("vanlig ansatt: ingen", async () => {
    expect(await dag(ANSATT).kanAttestereFirma({ organizationId: ORG })).toMatchObject({ kanAttestere: false, omfang: "ingen" });
  });
});

describe("O8 — firma-admin i deltakerfirma (firmaadmin-eierfirma)", () => {
  it("FADMIN2 (admin i ORG2, medlem på P1) har ingen omfang i ORG", async () => {
    expect(await attesteringsOmfang(FADMIN2, ORG)).toEqual({ type: "prosjekter", prosjektIder: [] });
    expect(await dag(FADMIN2).kanAttestereFirma({ organizationId: ORG })).toMatchObject({ kanAttestere: false, omfang: "ingen" });
  });
});

describe("O9 — ansattnummer, tidsrunding og mine prosjekter", () => {
  it("ansattnummer fra sedelens firma, ikke et annet firmas", async () => {
    const s = (await liste(LEDER)).find((x) => x.id === S_P1)!;
    expect(s.ansatt?.ansattnummer).toBe("A-1");
  });
  it("lista bærer firmaets tidsrunding og lederens prosjekter", async () => {
    const s = (await liste(LEDER)).find((x) => x.id === S_P1)!;
    expect(s.tidsrundingMinutter).toBe(30);
    expect(s.mineProsjektIder).toEqual([P1]);
  });
});

describe("O10 — mineAttesteringsFirmaer", () => {
  it("lederen i to firma får begge, med omfang prosjekter", async () => {
    expect(await dag(LEDER).mineAttesteringsFirmaer()).toEqual([
      { id: ORG, navn: "W10b-firma", omfang: "prosjekter", harTimerModul: true },
      { id: ORG2, navn: "W10b-firma 2", omfang: "prosjekter", harTimerModul: true },
    ]);
  });
  it("firma-admin får sitt firma med omfang alle; vanlig ansatt og sluttet får ingenting", async () => {
    expect(await dag(FADMIN).mineAttesteringsFirmaer()).toEqual([
      { id: ORG, navn: "W10b-firma", omfang: "alle", harTimerModul: true },
    ]);
    expect(await dag(ANSATT).mineAttesteringsFirmaer()).toEqual([]);
    expect(await dag(SLUTTET).mineAttesteringsFirmaer()).toEqual([]);
  });
});

describe("O11 — M3: rettemodalens innstillinger uten firma-admin-kall", () => {
  const FELT = ["tidsrundingMinutter", "standardPauseMin", "standardStartTid", "standardPauseEtterTimer"] as const;
  it("hentArbeidstidDefaults gir firma-admin nøyaktig de samme verdiene som hentSetting", async () => {
    const org = (u: string) => organisasjonRouter.createCaller(ctx(u));
    const gammel = await org(FADMIN).hentSetting({ organizationId: ORG });
    const ny = await org(FADMIN).hentArbeidstidDefaults({ organizationId: ORG });
    for (const f of FELT) expect(ny[f], f).toEqual(gammel[f]);
    expect(FELT.map((f) => ny[f])).toEqual([30, 45, "06:30", 5]);
  });
  it("prosjektlederen når hentArbeidstidDefaults, men ikke hentSetting", async () => {
    const org = organisasjonRouter.createCaller(ctx(LEDER));
    const ny = await org.hentArbeidstidDefaults({ organizationId: ORG });
    expect(FELT.map((f) => ny[f])).toEqual([30, 45, "06:30", 5]);
    await expect(org.hentSetting({ organizationId: ORG })).rejects.toThrow();
  });
});
