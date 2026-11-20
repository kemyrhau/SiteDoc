import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { vareforbrukRouter } from "./vareforbruk";
import { rapportRouter } from "./timer/rapport";

/**
 * Ordre d2a (prosjektkort-kortid-spec.md § 12.6.1) — attesteringens grunnlag mot EKTE
 * Postgres (lokal sandkasse, aldri test/prod).
 *
 * Lesere: T24, T25, T57, T69 + rader ukeavviket peker på + vakt for detaljEksport.
 * Skriveveier: T56, T58, T59, T62, T68, T70 + vakt for syncBatch (maskin uten kobling).
 *
 * All data lages her med faste id-er (prefiks c0d1e5f1) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f1-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("05"); // annet firma (isolasjon)
const USER = id("02");
const USER2 = id("03");
const ADMIN = id("04"); // sitedoc_admin
const P1 = id("11");
const P2 = id("12");
const B1 = id("21"); // i P1
const B2 = id("22"); // i P2
const E1 = id("31"); // i P1
const E2 = id("32"); // i P2
const ORD = id("41");
const REISE = id("42");
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45");
const OT50 = id("46"); // overtid 50 %
const M_TIME = id("51");
const M_DOEGN = id("52");
const M_UKJENT = id("53");
const VARE = id("61");
const VARE_ORG2 = id("62");

const BRUKERE = [USER, USER2, ADMIN];

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
const vare = (userId = ADMIN) => vareforbrukRouter.createCaller(ctx(userId));
const rapport = (userId = ADMIN) => rapportRouter.createCaller(ctx(userId));

// Én sedel pr. test → egen dato. Uke 47 2026 (16.–20. nov) brukes av ukeavvik-testen.
let datoTeller = 0;
function nyDato(): string {
  const d = new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function nySedel(opts: { userId?: string; status?: string; dato?: string; org?: string } = {}) {
  const sid = randomUUID();
  const userId = opts.userId ?? USER;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: opts.org ?? ORG,
      userId,
      registrertAvUserId: userId,
      aktivitetId: AKT,
      dato: new Date(opts.dato ?? nyDato()),
      status: opts.status ?? "sent",
    },
  });
  return sid;
}

type TimerF = {
  fra?: string | null;
  til?: string | null;
  timer?: number;
  projectId?: string | null;
  kortId?: string | null;
  lonnsartId?: string;
  erReise?: boolean;
  byggeplassId?: string | null;
  eco?: string | null;
  status?: string;
  createdAt?: Date;
};
async function timerRad(sheetId: string, f: TimerF = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: f.projectId === undefined ? P1 : f.projectId,
      utenProsjekt: f.projectId === null,
      lonnsartId: f.lonnsartId ?? ORD,
      aktivitetId: AKT,
      fraTid: f.fra === undefined ? "07:00" : f.fra,
      tilTid: f.til === undefined ? "11:00" : f.til,
      timer: f.timer ?? 4,
      erReise: f.erReise ?? false,
      byggeplassId: f.byggeplassId ?? null,
      externalCostObjectId: f.eco ?? null,
      kortId: f.kortId === undefined ? "kort-1" : f.kortId,
      attestertStatus: f.status ?? "pending",
      ...(f.createdAt ? { createdAt: f.createdAt } : {}),
    },
  });
  return r.id;
}
type MaskinF = {
  vehicleId?: string;
  timer?: number;
  mengde?: number | null;
  enhet?: string | null;
  sheetTimerId?: string | null;
  kortId?: string | null;
  projectId?: string;
  fra?: string | null;
  til?: string | null;
  status?: string;
  byggeplassId?: string | null;
  eco?: string | null;
};
async function maskinRad(sheetId: string, f: MaskinF = {}) {
  const r = await prismaTimer.sheetMachine.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      vehicleId: f.vehicleId ?? M_TIME,
      timer: f.timer ?? 1,
      mengde: f.mengde ?? null,
      enhet: f.enhet ?? null,
      sheetTimerId: f.sheetTimerId ?? null,
      kortId: f.kortId === undefined ? "kort-1" : f.kortId,
      fraTid: f.fra ?? null,
      tilTid: f.til ?? null,
      attestertStatus: f.status ?? "pending",
      byggeplassId: f.byggeplassId ?? null,
      externalCostObjectId: f.eco ?? null,
    },
  });
  return r.id;
}
async function vareRad(
  sheetId: string | null,
  f: { sheetTimerId?: string | null; kortId?: string | null; antall?: number; vareId?: string; userId?: string; attestert?: boolean } = {},
) {
  const r = await prismaVarelager.vareforbruk.create({
    data: {
      dato: new Date("2026-09-01"),
      projectId: P1,
      vareId: f.vareId ?? VARE,
      antall: f.antall ?? 3,
      registrertAvUserId: f.userId ?? USER,
      dagsseddelId: sheetId,
      sheetTimerId: f.sheetTimerId ?? null,
      kortId: f.kortId === undefined ? "kort-1" : f.kortId,
      ...(f.attestert ? { attestertSnapshot: { attestert: true } } : {}),
    },
  });
  return r.id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Løs = any;
const firmaListe = async (status: "sent" | "accepted" = "sent"): Promise<Løs[]> =>
  (await dag().hentTilAttesteringFirma({ organizationId: ORG, status })) as Løs[];
const finnSedel = async (sid: string, status: "sent" | "accepted" = "sent"): Promise<Løs> =>
  (await firmaListe(status)).find((s) => s.id === sid);

// ── Oppsett / rydding ───────────────────────────────────────────────────────
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({
    where: { userId: { in: BRUKERE } },
    select: { id: true },
  });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of [
      "sheet_timer_forslag",
      "sheet_rad_historikk",
      "sheet_machines",
      "sheet_tillegg",
      "sheet_utlegg",
      "sheet_timer",
    ]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: { in: [VARE, VARE_ORG2] } } });
  await prismaMaskin.equipment.deleteMany({ where: { id: { in: [M_TIME, M_DOEGN, M_UKJENT] } } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE, OT50] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: { in: [E1, E2] } } });
  await prisma.byggeplass.deleteMany({ where: { id: { in: [B1, B2] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "kortid-d2a-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "kortid-d2a-2@sitedoc.test", name: "Arbeider To", role: "user" },
      { id: ADMIN, email: "kortid-d2a-admin@sitedoc.test", name: "Attestant", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.createMany({
    data: [
      { id: ORG, name: "D2a-firma" },
      { id: ORG2, name: "D2a-annet-firma" },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: USER2, organizationId: ORG, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [ORG, ORG2].flatMap((o) => [
      { organizationId: o, moduleSlug: "timer", status: "aktiv" },
      { organizationId: o, moduleSlug: "varelager", status: "aktiv" },
      { organizationId: o, moduleSlug: "maskin", status: "aktiv" },
    ]),
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "D2A-1", internalProjectNumber: "2611", name: "D2a P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "D2A-2", name: "D2a P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectOrganization.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, organizationId: ORG, rolle: "hovedeier" })),
  });
  await prisma.projectMember.createMany({
    data: [USER, USER2].flatMap((u) => [
      { userId: u, projectId: P1, role: "member" },
      { userId: u, projectId: P2, role: "member" },
    ]),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].flatMap((p) => [
      { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: p, moduleSlug: "varelager", organizationId: ORG, status: "aktiv" },
    ]),
  });
  await prisma.byggeplass.createMany({
    data: [
      { id: B1, projectId: P1, name: "D2a Byggeplass 1" },
      { id: B2, projectId: P2, name: "D2a Byggeplass 2" },
    ],
  });
  await prisma.externalCostObject.createMany({
    data: [
      { id: E1, organizationId: ORG, projectId: P1, proAdmId: "D2A-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: ADMIN },
      { id: E2, organizationId: ORG, projectId: P2, proAdmId: "D2A-E2", kortNavn: "Mur", kilde: "manuell", opprettetAvUserId: ADMIN },
    ],
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
      { id: OT50, organizationId: ORG, type: "overtid", navn: "Overtid 50 %", overtidsnivaa: 50, aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({
    data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" },
  });
  await prismaMaskin.equipment.createMany({
    data: [
      { id: M_TIME, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin", merke: "Volvo", modell: "EC220E", utleieEnhet: "time" },
      { id: M_DOEGN, organizationId: ORG, kategori: "anleggsmaskin", type: "hoppetusse", internNavn: "Hoppetusse", utleieEnhet: "doegn" },
      { id: M_UKJENT, organizationId: ORG, kategori: "anleggsmaskin", type: "dumper", internNavn: "Dumper" },
    ],
  });
  await prismaVarelager.vare.createMany({
    data: [
      { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" },
      { id: VARE_ORG2, organizationId: ORG2, navn: "Fremmed vare", enhet: "stk" },
    ],
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
//  Lesere (commit 1)
// ════════════════════════════════════════════════════════════════════════════
describe("T24 — leserne gir varer, utlegg og maskiner", () => {
  it("varer med sheetTimerId og kortId i alle tre leserne; utlegg i detaljen; maskiner i prosjektlista", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    await maskinRad(sid, { sheetTimerId: t1 });
    const v1 = await vareRad(sid, { sheetTimerId: t1 });
    // Vare fra et annet firmas katalog som peker på sedelen: aldri med.
    await vareRad(sid, { vareId: VARE_ORG2 });
    await prismaTimer.sheetUtlegg.create({
      data: { sheetId: sid, projectId: P1, expenseCategoryId: KATEGORI, belop: 120, ordningVedFoering: "utlegg", kortId: "kort-1" },
    });
    // Annen brukers sedel med egen vare.
    const sAnnen = await nySedel({ userId: USER2 });
    const tAnnen = await timerRad(sAnnen);
    const vAnnen = await vareRad(sAnnen, { sheetTimerId: tAnnen, userId: USER2 });

    const firma = await finnSedel(sid);
    expect(firma.varer.map((v: Løs) => v.id)).toEqual([v1]);
    expect(firma.varer[0]).toMatchObject({ sheetTimerId: t1, kortId: "kort-1", navn: "Pukk 6-32", enhet: "tonn", antall: 3 });
    expect((await finnSedel(sAnnen)).varer.map((v: Løs) => v.id)).toEqual([vAnnen]);

    const detalj: Løs = await dag().hentForAttestering({ id: sid });
    expect(detalj.varer.map((v: Løs) => v.id)).toEqual([v1]);
    expect(detalj.utlegg).toHaveLength(1);
    expect(detalj.utlegg[0]).toMatchObject({ belop: expect.anything(), kortId: "kort-1", expenseCategory: { navn: "Parkering" } });

    const prosjektListe: Løs[] = await dag().hentTilAttestering({ projectId: P1 });
    const ps = prosjektListe.find((s) => s.id === sid);
    expect(ps.maskiner).toHaveLength(1);
    expect(ps.varer.map((v: Løs) => v.id)).toEqual([v1]);
    expect(prosjektListe.find((s) => s.id === sAnnen).varer.map((v: Løs) => v.id)).toEqual([vAnnen]);
  });

  it("varelager av → tom liste, ingen feil", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    await vareRad(sid, { sheetTimerId: t1 });
    await prisma.organizationModule.deleteMany({ where: { organizationId: ORG, moduleSlug: "varelager" } });
    try {
      expect((await finnSedel(sid)).varer).toEqual([]);
      expect(((await dag().hentForAttestering({ id: sid })) as Løs).varer).toEqual([]);
    } finally {
      await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "varelager", status: "aktiv" } });
    }
  });
});

describe("T25 — navn på underprosjekt og byggeplass for alle sedelens prosjekter", () => {
  it("rader på to prosjekter har begge navn i alle tre leserne", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid, { projectId: P1, byggeplassId: B1, eco: E1, kortId: "kort-p1" });
    const t2 = await timerRad(sid, { projectId: P2, byggeplassId: B2, eco: E2, kortId: "kort-p2", fra: "12:00", til: "15:00", timer: 3 });
    const m2 = await maskinRad(sid, { projectId: P2, byggeplassId: B2, eco: E2, kortId: "kort-p2", sheetTimerId: t2 });

    const sjekk = (s: Løs) => {
      const r1 = s.timer.find((r: Løs) => r.id === t1);
      const r2 = s.timer.find((r: Løs) => r.id === t2);
      expect(r1).toMatchObject({ byggeplassNavn: "D2a Byggeplass 1", underprosjekt: { navn: "D2A-E1 · Grøft" } });
      expect(r2).toMatchObject({ byggeplassNavn: "D2a Byggeplass 2", underprosjekt: { navn: "D2A-E2 · Mur" } });
      const m = s.maskiner.find((r: Løs) => r.id === m2);
      expect(m).toMatchObject({ byggeplassNavn: "D2a Byggeplass 2", underprosjekt: { proAdmId: "D2A-E2", kortNavn: "Mur" } });
    };
    sjekk(await finnSedel(sid));
    sjekk(await dag().hentForAttestering({ id: sid }));
    sjekk(((await dag().hentTilAttestering({ projectId: P1 })) as Løs[]).find((s) => s.id === sid));
  });

  it("radene er sortert på fraTid, så opprettet", async () => {
    const sid = await nySedel();
    const sen = await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2 });
    const tidlig = await timerRad(sid, { fra: "07:00", til: "11:00" });
    const s = await finnSedel(sid);
    expect(s.timer.map((r: Løs) => r.id)).toEqual([tidlig, sen]);
    const d: Løs = await dag().hentForAttestering({ id: sid });
    expect(d.timer.map((r: Løs) => r.id)).toEqual([tidlig, sen]);
  });
});

describe("T57 — rettede felter", () => {
  it("rettet rad gir felt, verdien før, hvem og når; uendret rad med post gir tom liste", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const m1 = await maskinRad(sid, { sheetTimerId: t1, mengde: 6 });
    const tUendret = await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2 });
    const naa = new Date("2026-11-16T10:00:00.000Z");
    const maskinFoer = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m1 } });
    const uendret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: tUendret } });
    await prismaTimer.sheetRadHistorikk.createMany({
      data: [
        {
          radType: "maskin",
          originalRadId: m1,
          sheetId: sid,
          snapshot: JSON.parse(JSON.stringify({ ...maskinFoer, mengde: "5" })),
          erstattetAvUserId: ADMIN,
          erstattetVed: naa,
        },
        {
          radType: "timer",
          originalRadId: tUendret,
          sheetId: sid,
          snapshot: JSON.parse(JSON.stringify(uendret)),
          erstattetAvUserId: ADMIN,
          erstattetVed: naa,
        },
      ],
    });
    for (const s of [await finnSedel(sid), (await dag().hentForAttestering({ id: sid })) as Løs]) {
      const m = s.maskiner.find((r: Løs) => r.id === m1);
      expect(m.rettedeFelter).toEqual([{ felt: "mengde", foer: 5, avUserId: ADMIN, avNavn: "Attestant", ved: naa }]);
      expect(s.timer.find((r: Løs) => r.id === tUendret).rettedeFelter).toEqual([]);
      expect(s.timer.find((r: Løs) => r.id === t1).rettedeFelter).toEqual([]);
    }
  });
});

describe("T69 — maskinens enhet og «mangler timerad»", () => {
  it("time-maskin uten kobling er merket; døgn-maskin uten kobling er ikke; koblet time-maskin er ikke", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const mTime = await maskinRad(sid, { vehicleId: M_TIME });
    const mDoegn = await maskinRad(sid, { vehicleId: M_DOEGN });
    const mUkjent = await maskinRad(sid, { vehicleId: M_UKJENT });
    const mKoblet = await maskinRad(sid, { vehicleId: M_TIME, sheetTimerId: t1 });
    for (const s of [
      await finnSedel(sid),
      (await dag().hentForAttestering({ id: sid })) as Løs,
      ((await dag().hentTilAttestering({ projectId: P1 })) as Løs[]).find((x) => x.id === sid),
    ]) {
      const m = (radId: string) => s.maskiner.find((r: Løs) => r.id === radId);
      expect(m(mTime)).toMatchObject({ utleieEnhet: "time", manglerTimerad: true });
      expect(m(mDoegn)).toMatchObject({ utleieEnhet: "doegn", manglerTimerad: false });
      expect(m(mUkjent)).toMatchObject({ utleieEnhet: null, manglerTimerad: true });
      expect(m(mKoblet)).toMatchObject({ utleieEnhet: "time", manglerTimerad: false });
    }
  });
});

describe("Avvik pekes ut — rader ukeavviket gjelder", () => {
  it("ført overtid uten beregnet overtid peker på overtidsraden", async () => {
    const sid = await nySedel({ dato: "2026-11-17" });
    const ord = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4 });
    const ot = await timerRad(sid, { fra: "11:00", til: "13:00", timer: 2, lonnsartId: OT50 });
    const s = await finnSedel(sid);
    expect(s.ukeAvvikRadIder).toEqual([ot]);
    expect(s.ukeAvvikRadIder).not.toContain(ord);
    const d: Løs = await dag().hentForAttestering({ id: sid });
    expect(d.ukeAvvikRadIder).toEqual([ot]);
    const p = ((await dag().hentTilAttestering({ projectId: P1 })) as Løs[]).find((x) => x.id === sid);
    expect(p.ukeAvvikRadIder).toEqual([ot]);
  });
});

describe("Vakt — detaljEksport samme svar etter at oppslaget flyttet til kortLeser", () => {
  it("maskinnavn, enhet, byggeplass og underprosjekt er uendret", async () => {
    const sid = await nySedel({ dato: "2026-10-05" });
    const t1 = await timerRad(sid, { projectId: P1, byggeplassId: B1, eco: E1 });
    await maskinRad(sid, { vehicleId: M_TIME, sheetTimerId: t1, byggeplassId: B1, eco: E1, mengde: 4, enhet: "m3" });
    await maskinRad(sid, { vehicleId: M_DOEGN, fra: "12:00", til: "13:00" });
    await maskinRad(sid, { vehicleId: M_UKJENT, projectId: P2, kortId: "kort-2" });
    const svar: Løs = await rapport().detaljEksport({
      organizationId: ORG,
      fra: "2026-10-05",
      til: "2026-10-05",
      taMedUattesterte: true,
    });
    const form = {
      timer: svar.timerader.map((r: Løs) => ({
        byggeplass: r.byggeplass,
        underprosjekt: r.underprosjekt,
        maskiner: (r.maskiner ?? []).map((m: Løs) => ({ navn: m.navn, utleieEnhet: m.utleieEnhet, byggeplass: m.byggeplass, underprosjekt: m.underprosjekt })),
      })),
      utenTimerad: svar.maskinUtenTimerad.map((m: Løs) => ({ navn: m.navn, utleieEnhet: m.utleieEnhet, byggeplass: m.byggeplass, underprosjekt: m.underprosjekt })),
    };
    expect(form).toMatchInlineSnapshot(`
      {
        "timer": [
          {
            "byggeplass": "D2a Byggeplass 1",
            "maskiner": [
              {
                "byggeplass": "D2a Byggeplass 1",
                "navn": "Volvo EC220E",
                "underprosjekt": "D2A-E1 · Grøft",
                "utleieEnhet": "time",
              },
            ],
            "underprosjekt": "D2A-E1 · Grøft",
          },
        ],
        "utenTimerad": [
          {
            "byggeplass": null,
            "navn": "Hoppetusse",
            "underprosjekt": null,
            "utleieEnhet": "doegn",
          },
          {
            "byggeplass": null,
            "navn": "Dumper",
            "underprosjekt": null,
            "utleieEnhet": null,
          },
        ],
      }
    `);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Skriveveier (commit 2)
// ════════════════════════════════════════════════════════════════════════════
const historikkFor = (sheetId: string) =>
  prismaTimer.sheetRadHistorikk.findMany({ where: { sheetId }, orderBy: { erstattetVed: "asc" } });

describe("T56 — rettRadFelt", () => {
  it("maskinmengde 5 → 6: samme id, kortId og sheetTimerId; én historikkpost med 5; sedelen fortsatt sendt", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const annen = await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2 });
    const m1 = await maskinRad(sid, { sheetTimerId: t1, mengde: 5, enhet: "m3" });
    const svar: Løs = await dag().rettRadFelt({ radType: "maskin", radId: m1, felter: { mengde: 6 } });
    expect(svar.id).toBe(m1);
    const etter = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m1 } });
    expect(Number(etter.mengde)).toBe(6);
    expect(etter.kortId).toBe("kort-1");
    expect(etter.sheetTimerId).toBe(t1);
    const h = await historikkFor(sid);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ radType: "maskin", originalRadId: m1 });
    expect(Number((h[0]!.snapshot as Løs).mengde)).toBe(5);
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: annen } })).id).toBe(annen);
    expect((await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sid } })).status).toBe("sent");
    // Leseren viser rettingen.
    const s = await finnSedel(sid);
    expect(s.maskiner.find((r: Løs) => r.id === m1).rettedeFelter).toMatchObject([{ felt: "mengde", foer: 5, avUserId: ADMIN }]);
  });

  it("avvist, og verdien står: ikke firmaadministrator, firmavalget av, attestert rad, sedel ikke sendt", async () => {
    const sjekk = async (sid: string, m: string, kall: () => Promise<unknown>) => {
      await expect(kall()).rejects.toThrow();
      expect(Number((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).mengde)).toBe(5);
      expect(await historikkFor(sid)).toHaveLength(0);
    };
    const s1 = await nySedel();
    const m1 = await maskinRad(s1, { sheetTimerId: await timerRad(s1), mengde: 5 });
    await sjekk(s1, m1, () => dag(USER).rettRadFelt({ radType: "maskin", radId: m1, felter: { mengde: 6 } }));

    await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { tillattRedigerVedAttestering: false } });
    try {
      await sjekk(s1, m1, () => dag().rettRadFelt({ radType: "maskin", radId: m1, felter: { mengde: 6 } }));
    } finally {
      await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { tillattRedigerVedAttestering: true } });
    }

    const s2 = await nySedel();
    const m2 = await maskinRad(s2, { sheetTimerId: await timerRad(s2), mengde: 5, status: "attestert" });
    await sjekk(s2, m2, () => dag().rettRadFelt({ radType: "maskin", radId: m2, felter: { mengde: 6 } }));

    const s3 = await nySedel({ status: "draft" });
    const m3 = await maskinRad(s3, { sheetTimerId: await timerRad(s3), mengde: 5 });
    await sjekk(s3, m3, () => dag().rettRadFelt({ radType: "maskin", radId: m3, felter: { mengde: 6 } }));
  });

  it("overlapp i tid og maskin over arbeid avvises som i redigerSedelRader", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4 });
    await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2 });
    const m1 = await maskinRad(sid, { sheetTimerId: t1, timer: 3 });
    await expect(
      dag().rettRadFelt({ radType: "timer", radId: t1, felter: { tilTid: "13:00", timer: 6 } }),
    ).rejects.toThrow(/overlapper/);
    await expect(dag().rettRadFelt({ radType: "maskin", radId: m1, felter: { timer: 9 } })).rejects.toThrow();
    expect(await historikkFor(sid)).toHaveLength(0);
  });
});

describe("T70 — sperren (R24) i attestantens veier", () => {
  // w9-tillegget: serveren kobler maskinen til jobbens timerad; sperren gjelder bare jobb uten arbeid.
  it("rettRadFelt: bytte fra døgn- til time-maskin på ukoblet maskinrad kobles til jobbens timerad", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid);
    const m = await maskinRad(sid, { vehicleId: M_DOEGN });
    await dag().rettRadFelt({ radType: "maskin", radId: m, felter: { vehicleId: M_TIME } });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } });
    expect(lagret.vehicleId).toBe(M_TIME);
    expect(lagret.sheetTimerId).toBe(t);
  });

  const radInput = async (sid: string) => {
    const timer = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    const maskin = await prismaTimer.sheetMachine.findMany({ where: { sheetId: sid }, orderBy: { createdAt: "asc" } });
    return {
      timer: timer.map((r) => ({
        originalId: r.id as string | null,
        projectId: r.projectId,
        lonnsartId: r.lonnsartId!,
        aktivitetId: r.aktivitetId!,
        externalCostObjectId: r.externalCostObjectId,
        byggeplassId: r.byggeplassId,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        timer: Number(r.timer),
        pauseMin: r.pauseMin,
      })),
      tillegg: [],
      maskin: maskin.map((r) => ({
        originalId: r.id as string | null,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId,
        vehicleId: r.vehicleId,
        byggeplassId: r.byggeplassId,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        timer: Number(r.timer),
        mengde: r.mengde === null ? null : Number(r.mengde),
        enhet: r.enhet,
      })),
    };
  };

  // Ordrens bevis (w9-tillegget): «Rediger arbeid» bytter døgn-maskin til førermaskin.
  it("redigerSedelRader: bytte døgn-maskin til førermaskin går gjennom og kobles til jobbens timerad", async () => {
    const sid = await nySedel();
    await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4 });
    const stor = await timerRad(sid, { fra: "11:30", til: "15:30", timer: 4 });
    const m = await maskinRad(sid, { vehicleId: M_DOEGN, timer: 2 });
    await prismaTimer.sheetMachine.update({ where: { id: m }, data: { fraTid: "12:00", tilTid: "14:00" } });
    const inn = await radInput(sid);
    inn.maskin[0]!.vehicleId = M_TIME;
    await dag().redigerSedelRader({ sheetId: sid, nyeRader: inn });
    const lagret = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } });
    expect(lagret.vehicleId).toBe(M_TIME);
    // Overlapp i fra–til velger raden 11:30–15:30.
    expect(lagret.sheetTimerId).toBe(stor);
  });

  it("redigerSedelRader: bytte døgn-maskin til førermaskin på jobb uten arbeid avvises med ny tekst; ingenting endres", async () => {
    const sid = await nySedel();
    await timerRad(sid, { kortId: "kort-annen" });
    const m = await maskinRad(sid, { vehicleId: M_DOEGN, timer: 2, kortId: "kort-uten-arbeid" });
    const inn = await radInput(sid);
    inn.maskin[0]!.vehicleId = M_TIME;
    const feil = await dag().redigerSedelRader({ sheetId: sid, nyeRader: inn }).catch((e: unknown) => e);
    expect((feil as { cause?: { feilNokkel?: string } }).cause?.feilNokkel).toBe("timer.maskin.utenArbeidAvvist");
    expect(String((feil as Error).message)).not.toMatch(/timerad|prosjektkort/);
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).vehicleId).toBe(M_DOEGN);
  });

  it("redigerSedelRader: slette timeraden en time-maskin står på, kobler maskinen til jobbens andre timerad", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const t2 = await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2 });
    const m = await maskinRad(sid, { sheetTimerId: t1, vehicleId: M_TIME, timer: 1 });
    const inn = await radInput(sid);
    inn.timer = inn.timer.filter((r) => r.originalId !== t1);
    await dag().redigerSedelRader({ sheetId: sid, nyeRader: inn });
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBe(t2);
  });

  it("redigerSedelRader: slette jobbens eneste arbeid med time-maskin igjen avvises", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    await maskinRad(sid, { sheetTimerId: t1, vehicleId: M_TIME, timer: 1 });
    const inn = await radInput(sid);
    inn.timer = inn.timer.filter((r) => r.originalId !== t1);
    await expect(dag().redigerSedelRader({ sheetId: sid, nyeRader: inn })).rejects.toThrow(/Volvo EC220E/);
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(1);
  });

  it("redigerSedelRader: ny maskinrad uten originalId kobles til jobbens timerad; ukoblet rad som ikke endres røres ikke", async () => {
    const sid = await nySedel();
    const t = await timerRad(sid, { fra: "07:00", til: "15:00", timer: 8 });
    const ukoblet = await maskinRad(sid, { vehicleId: M_TIME, timer: 1 });
    const inn = await radInput(sid);
    const ny = { ...inn.maskin[0]!, originalId: null, timer: 1 };
    await dag().redigerSedelRader({ sheetId: sid, nyeRader: { ...inn, maskin: [...inn.maskin, ny] } });
    const maskiner = await prismaTimer.sheetMachine.findMany({ where: { sheetId: sid } });
    expect(maskiner).toHaveLength(2);
    expect(maskiner.find((r) => r.id !== ukoblet)?.sheetTimerId).toBe(t);
    // Den uendrede, ukoblede eldre raden står ukoblet.
    expect(maskiner.find((r) => r.id === ukoblet)?.sheetTimerId).toBeNull();
  });
});

describe("T58 — redigerSedelRader beholder koblingene", () => {
  it("etter en retting peker maskiner og varer på timeraden de sto på; ingen peker på en rad som ikke finnes", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4 });
    const t2 = await timerRad(sid, { fra: "12:00", til: "15:00", timer: 3 });
    const m1 = await maskinRad(sid, { sheetTimerId: t1, vehicleId: M_TIME, timer: 2 });
    const m2 = await maskinRad(sid, { sheetTimerId: t2, vehicleId: M_DOEGN, timer: 1 });
    const v1 = await vareRad(sid, { sheetTimerId: t1 });
    const timer = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    const maskin = await prismaTimer.sheetMachine.findMany({ where: { sheetId: sid }, orderBy: { createdAt: "asc" } });
    await dag().redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: timer.map((r) => ({
          originalId: r.id,
          projectId: r.projectId,
          lonnsartId: r.lonnsartId!,
          aktivitetId: r.aktivitetId!,
          fraTid: r.fraTid,
          // t1 rettes: 07–10, 3 t.
          tilTid: r.id === t1 ? "10:00" : r.tilTid,
          timer: r.id === t1 ? 3 : Number(r.timer),
          pauseMin: r.pauseMin,
        })),
        tillegg: [],
        maskin: maskin.map((r) => ({
          originalId: r.id,
          projectId: r.projectId,
          vehicleId: r.vehicleId,
          timer: Number(r.timer),
        })),
      },
    });
    const timerEtter = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid } });
    const maskinEtter = await prismaTimer.sheetMachine.findMany({ where: { sheetId: sid } });
    const timerIder = new Set(timerEtter.map((r) => r.id));
    const radFor = (gammel: string) =>
      timerEtter.find((r) => r.id === gammel || r.parentRadId === gammel)!.id;
    expect(maskinEtter.find((m) => m.id === m1 || m.parentRadId === m1)!.sheetTimerId).toBe(radFor(t1));
    expect(maskinEtter.find((m) => m.id === m2 || m.parentRadId === m2)!.sheetTimerId).toBe(radFor(t2));
    for (const m of maskinEtter) if (m.sheetTimerId) expect(timerIder.has(m.sheetTimerId)).toBe(true);
    const vEtter = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v1 } });
    expect(vEtter.sheetTimerId).toBe(radFor(t1));
    // Valget (a): rettet rad beholder id-en, og bare den fikk historikkpost.
    expect(timerIder.has(t1)).toBe(true);
    expect((await historikkFor(sid)).map((h) => h.originalRadId)).toEqual([t1]);
  });

  it("slettet timerad med døgn-maskin og vare: koblingene nulles, peker aldri på en rad som ikke finnes", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid, { fra: "07:00", til: "11:00", timer: 4 });
    const t2 = await timerRad(sid, { fra: "12:00", til: "15:00", timer: 3 });
    const m = await maskinRad(sid, { sheetTimerId: t2, vehicleId: M_DOEGN });
    const v = await vareRad(sid, { sheetTimerId: t2 });
    const r1 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t1 } });
    const mr = await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } });
    await dag().redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          {
            originalId: t1,
            projectId: r1.projectId,
            lonnsartId: r1.lonnsartId!,
            aktivitetId: r1.aktivitetId!,
            fraTid: r1.fraTid,
            tilTid: r1.tilTid,
            timer: Number(r1.timer),
            pauseMin: r1.pauseMin,
          },
        ],
        tillegg: [],
        maskin: [{ originalId: m, projectId: mr.projectId, vehicleId: mr.vehicleId, timer: Number(mr.timer) }],
      },
    });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: t2 } })).toBeNull();
    expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBeNull();
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v } })).sheetTimerId).toBeNull();
  });
});

describe("T59 — gjenaapneRader", () => {
  it("attesterte rader blir ventende, ferdig attestert sedel blir sendt, andre rader urørt, loggført", async () => {
    const sid = await nySedel({ status: "accepted" });
    const t1 = await timerRad(sid, { status: "attestert" });
    const t2 = await timerRad(sid, { fra: "12:00", til: "14:00", timer: 2, status: "attestert" });
    await prismaTimer.dailySheet.update({ where: { id: sid }, data: { attestertAvUserId: ADMIN, attestertVed: new Date() } });
    await dag().gjenaapneRader({ radIder: { timerIder: [t1] } });
    const r1 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t1 } });
    const r2 = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t2 } });
    expect(r1.attestertStatus).toBe("pending");
    expect(r1.attestertAvUserId).toBeNull();
    expect(r2.attestertStatus).toBe("attestert");
    const sedel = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sid } });
    expect(sedel.status).toBe("sent");
    const h = await historikkFor(sid);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ originalRadId: t1, erstattetAvUserId: ADMIN });
    // Gjenåpningen er ikke en retting.
    const s = await finnSedel(sid);
    expect(s.timer.find((r: Løs) => r.id === t1).rettedeFelter).toEqual([]);
  });

  it("uten attesteringsrett: avvist", async () => {
    const sid = await nySedel({ status: "accepted" });
    const t1 = await timerRad(sid, { status: "attestert" });
    await expect(dag(USER).gjenaapneRader({ radIder: { timerIder: [t1] } })).rejects.toThrow();
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: t1 } })).attestertStatus).toBe("attestert");
  });
});

describe("T62 — vare-retting", () => {
  it("administrator retter antallet på en sendt sedel; loggen har antallet før og etter", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const v = await vareRad(sid, { sheetTimerId: t1, antall: 3 });
    await vare().oppdater({ id: v, antall: 5 });
    const logg = await prisma.activity.findFirstOrThrow({
      where: { targetId: v, action: "vare.endret" },
      orderBy: { createdAt: "desc" },
    });
    expect(logg.payload).toMatchObject({ antall: "5", antallFoer: "3" });
  });

  it("vare på attestert timerad kan ikke rettes", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid, { status: "attestert" });
    const v = await vareRad(sid, { sheetTimerId: t1, antall: 3 });
    await expect(vare().oppdater({ id: v, antall: 5 })).rejects.toThrow();
    expect(Number((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v } })).antall)).toBe(3);
  });
});

describe("T68 — splitt beholder koblingene", () => {
  const splittTimer = (radId: string) => ({
    radType: "timer" as const,
    radId,
    nyeRader: [
      { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2 },
      { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "09:00", tilTid: "11:00", timer: 2 },
    ],
  });

  it("splittRad: timerad med to maskiner og én vare — alle peker på første del", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    const m1 = await maskinRad(sid, { sheetTimerId: t1, timer: 1 });
    const m2 = await maskinRad(sid, { sheetTimerId: t1, vehicleId: M_DOEGN, timer: 1 });
    const v = await vareRad(sid, { sheetTimerId: t1 });
    await dag().splittRad(splittTimer(t1));
    const deler = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    expect(deler).toHaveLength(2);
    const forste = deler[0]!.id;
    for (const m of [m1, m2]) expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBe(forste);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v } })).sheetTimerId).toBe(forste);
  });

  it("w10a (A9) splittRad: begge delene får originalens beskrivelse", async () => {
    const sid = await nySedel();
    const t1 = await timerRad(sid);
    await prismaTimer.sheetTimer.update({ where: { id: t1 }, data: { beskrivelse: "Forskaling akse 3" } });
    await dag().splittRad(splittTimer(t1));
    const deler = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    expect(deler).toHaveLength(2);
    expect(deler.map((d) => d.beskrivelse)).toEqual(["Forskaling akse 3", "Forskaling akse 3"]);
  });

  it("splittRadEier: samme for eieren på egen sedel", async () => {
    const sid = await nySedel({ status: "draft" });
    const t1 = await timerRad(sid);
    const m1 = await maskinRad(sid, { sheetTimerId: t1, timer: 1 });
    const m2 = await maskinRad(sid, { sheetTimerId: t1, vehicleId: M_DOEGN, timer: 1 });
    const v = await vareRad(sid, { sheetTimerId: t1 });
    await dag(USER).splittRadEier(splittTimer(t1));
    const deler = await prismaTimer.sheetTimer.findMany({ where: { sheetId: sid }, orderBy: { fraTid: "asc" } });
    const forste = deler[0]!.id;
    for (const m of [m1, m2]) expect((await prismaTimer.sheetMachine.findUniqueOrThrow({ where: { id: m } })).sheetTimerId).toBe(forste);
    expect((await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v } })).sheetTimerId).toBe(forste);
  });

  it("delt maskinrad: delene arver originalens sheetTimerId (splittRad og splittRadEier)", async () => {
    for (const [status, kall] of [
      ["sent", (inn: Løs) => dag().splittRad(inn)],
      ["draft", (inn: Løs) => dag(USER).splittRadEier(inn)],
    ] as const) {
      const sid = await nySedel({ status });
      const t1 = await timerRad(sid);
      const m = await maskinRad(sid, { sheetTimerId: t1, timer: 2 });
      await kall({
        radType: "maskin",
        radId: m,
        nyeRader: [
          { projectId: P1, vehicleId: M_TIME, timer: 1 },
          { projectId: P1, vehicleId: M_TIME, timer: 1 },
        ],
      });
      const deler = await prismaTimer.sheetMachine.findMany({ where: { sheetId: sid } });
      expect(deler).toHaveLength(2);
      for (const d of deler) expect(d.sheetTimerId).toBe(t1);
    }
  });
});

describe("Vakt — syncBatch lagrer sedel med maskin uten kobling", () => {
  it("eldre app: time-maskin uten sheetTimerId lagres", async () => {
    const clientUuid = randomUUID();
    const tid = randomUUID();
    const mid = randomUUID();
    const svar = await dag(USER).syncBatch({
      sedler: [
        {
          clientUuid,
          projectId: P1,
          aktivitetId: AKT,
          dato: nyDato(),
          status: "draft",
          pauseMin: 0,
          timer: [{ id: tid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 4, fraTid: "07:00", tilTid: "11:00", pauseMin: 0 }],
          tillegg: [],
          maskiner: [{ id: mid, projectId: P1, vehicleId: M_TIME, timer: 2 }],
          utlegg: [],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
    });
    expect(svar.resultater[0]!.resultat).toBe("ok");
    const m = await prismaTimer.sheetMachine.findMany({ where: { sheetId: clientUuid } });
    expect(m).toHaveLength(1);
    expect(m[0]!.sheetTimerId).toBeNull();
  });
});
