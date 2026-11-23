import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";
import { hmsRouter } from "./hms";
import { gruppeRouter } from "./gruppe";
import { bildeRouter } from "./bilde";
import { seedStandardProsjektoppsett } from "../services/prosjektSeed";
import { buildTestContext } from "../test-harness/context";

/**
 * H3 (2026-11-23) — bare behandlerne i HMS-flyt-kortet behandler.
 *
 * Kenneth 2026-11-23 (HF2 ja, hms-domenemodell.md § HMS-flyt regel 3): en prosjektadmin som ikke
 * står som behandler, ser ikke private HMS-saker andre har meldt og har ingen behandlerknapper.
 * «Meld meg inn» gjør adminen til behandler. Behandler = medlem av HMS-gruppa (systemNokkel
 * "hms") eller firmaets HMS-ansvarlige — ikke «hms» i en gruppes domener.
 *
 * Prosjektet bygges med den ekte seeden. Alle kall går gjennom prosedyrene (createCaller) mot
 * ekte DB. Mål-DB: localhost-sandkasse.
 */

type Rolle = "melder" | "behandler" | "admin" | "padmGruppe" | "medlem" | "fremmed" | "flytMottaker" | "flytMedlem";
const brukere: Record<Rolle, string> = {
  melder: "", behandler: "", admin: "", padmGruppe: "", medlem: "", fremmed: "", flytMottaker: "", flytMedlem: "",
};
const ids = { projectId: "", annetProsjektId: "", hmsGruppeId: "", padmGruppeId: "", avvikId: "", ruhId: "", sjaId: "" };
const maler: Record<string, string> = {};

const ctx = (r: Rolle) => buildTestContext(brukere[r]);
const oppgave = (r: Rolle) => oppgaveRouter.createCaller(ctx(r));
const sjekkliste = (r: Rolle) => sjekklisteRouter.createCaller(ctx(r));
const hms = (r: Rolle) => hmsRouter.createCaller(ctx(r));
const bilde = (r: Rolle) => bildeRouter.createCaller(ctx(r));

async function nyttProsjekt(nummer: string, oppretter: string): Promise<string> {
  const p = await prisma.project.create({ data: { projectNumber: nummer, name: `H3 ${nummer}` } });
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.create({ data: { userId: oppretter, projectId: p.id, role: "member" } });
    await seedStandardProsjektoppsett(tx, p.id, oppretter);
  });
  return p.id;
}

async function leggIGruppe(rolle: Rolle, projectId: string, groupId: string) {
  const pm = await prisma.projectMember.findFirstOrThrow({ where: { userId: brukere[rolle], projectId } });
  await prisma.projectGroupMember.create({ data: { groupId, projectMemberId: pm.id } });
}

beforeAll(async () => {
  for (const r of Object.keys(brukere) as Rolle[]) {
    const u = await prisma.user.create({ data: { email: `h3-${r}@sitedoc.test`, name: `H3 ${r}`, role: "user" } });
    brukere[r] = u.id;
  }

  ids.projectId = await nyttProsjekt("SD-H3-HMS-1", brukere.melder);
  for (const [r, rolle] of [["behandler", "member"], ["admin", "admin"], ["padmGruppe", "member"], ["medlem", "member"]] as const) {
    await prisma.projectMember.create({ data: { userId: brukere[r], projectId: ids.projectId, role: rolle } });
  }

  const grupper = await prisma.projectGroup.findMany({
    where: { projectId: ids.projectId, slug: { in: ["hms-ledere", "prosjekt-admin"] } },
    select: { id: true, slug: true },
  });
  ids.hmsGruppeId = grupper.find((g) => g.slug === "hms-ledere")!.id;
  ids.padmGruppeId = grupper.find((g) => g.slug === "prosjekt-admin")!.id;
  await leggIGruppe("behandler", ids.projectId, ids.hmsGruppeId);
  await leggIGruppe("admin", ids.projectId, ids.padmGruppeId);
  await leggIGruppe("padmGruppe", ids.projectId, ids.padmGruppeId);

  // Prosjektisolasjon: «fremmed» er behandler i et annet prosjekt, ikke medlem her.
  ids.annetProsjektId = await nyttProsjekt("SD-H3-HMS-2", brukere.fremmed);
  const annenHms = await prisma.projectGroup.findFirstOrThrow({
    where: { projectId: ids.annetProsjektId, systemNokkel: "hms" },
    select: { id: true },
  });
  await leggIGruppe("fremmed", ids.annetProsjektId, annenHms.id);

  const hmsMaler = await prisma.reportTemplate.findMany({
    where: { projectId: ids.projectId, domain: "hms" },
    select: { id: true, prefix: true },
  });
  for (const m of hmsMaler) if (m.prefix) maler[m.prefix] = m.id;

  ids.avvikId = (await oppgave("melder").opprett({ templateId: maler.HMS!, title: "Løs stillas" })).id;
  ids.ruhId = (await oppgave("melder").opprett({ templateId: maler.RUH!, title: "Nesten fall" })).id;
  ids.sjaId = (await sjekkliste("melder").opprett({ templateId: maler.SJA!, title: "Løft" })).id;
  await oppgave("melder").hmsSendInn({ id: ids.avvikId });
  await oppgave("melder").hmsSendInn({ id: ids.ruhId });
  await sjekkliste("melder").hmsSendInn({ id: ids.sjaId });
});

afterAll(async () => {
  for (const projectId of [ids.projectId, ids.annetProsjektId].filter(Boolean)) {
    const iProsjekt = { template: { projectId } };
    await prisma.documentTransfer.deleteMany({ where: { OR: [{ task: iProsjekt }, { checklist: iProsjekt }] } });
    await prisma.task.deleteMany({ where: iProsjekt });
    await prisma.checklist.deleteMany({ where: iProsjekt });
    await prisma.dokumentflyt.deleteMany({ where: { projectId } });
    await prisma.reportTemplate.deleteMany({ where: { projectId } });
    await prisma.faggruppe.deleteMany({ where: { projectId } });
    await prisma.projectGroup.deleteMany({ where: { projectId } });
    await prisma.projectModule.deleteMany({ where: { projectId } });
    await prisma.activity.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: Object.values(brukere).filter(Boolean) } } });
});

describe("H3: hvem er HMS-behandler (hms.erHmsAdmin → knappene på web og mobil)", () => {
  it.each([
    ["behandler", true],
    ["admin", false],
    ["padmGruppe", false],
    ["medlem", false],
    ["melder", false],
  ] as const)("%s → %s", async (r, forventet) => {
    expect(await hms(r).erHmsAdmin({ projectId: ids.projectId })).toBe(forventet);
  });

  it("prosjektisolasjon: behandler i et annet prosjekt er ikke behandler her", async () => {
    expect(await hms("fremmed").erHmsAdmin({ projectId: ids.annetProsjektId })).toBe(true);
    expect(await hms("fremmed").erHmsAdmin({ projectId: ids.projectId })).toBe(false);
  });
});

describe("H3: lesing av private HMS-saker (detalj)", () => {
  it.each([
    ["melder", true],
    ["behandler", true],
    ["admin", false],
    ["padmGruppe", false],
    ["medlem", false],
  ] as const)("HMS-avvik og RUH: %s → %s", async (r, forventet) => {
    for (const id of [ids.avvikId, ids.ruhId]) {
      const kall = oppgave(r).hentMedId({ id });
      if (forventet) await expect(kall).resolves.toMatchObject({ id });
      else await expect(kall).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("åpen SJA: prosjektadmin leser som før (bevart)", async () => {
    await expect(sjekkliste("admin").hentMedId({ id: ids.sjaId })).resolves.toMatchObject({ id: ids.sjaId });
  });

  it("negativkontroll: prosjektadmin leser fortsatt et vanlig bygg-dokument uten å være part", async () => {
    const bygg = await prisma.reportTemplate.findFirstOrThrow({
      where: { projectId: ids.projectId, domain: "bygg", category: "oppgave" },
      select: { id: true },
    });
    const flyt = await prisma.dokumentflytMal.findFirst({ where: { templateId: bygg.id }, select: { dokumentflytId: true } });
    const o = await prisma.task.create({
      data: {
        templateId: bygg.id,
        title: "Bygg-oppgave",
        number: 9001,
        bestillerUserId: brukere.melder,
        status: "draft",
        dokumentflytId: flyt?.dokumentflytId ?? null,
      },
      select: { id: true },
    });
    await expect(oppgave("admin").hentMedId({ id: o.id })).resolves.toMatchObject({ id: o.id });
  });
});

describe("H3: HMS-lista (hms.hentDokumenter)", () => {
  it("prosjektadmin ser bare åpne saker og egne — ikke private saker andre har meldt", async () => {
    const l = await hms("admin").hentDokumenter({ projectId: ids.projectId });
    expect(l.avvik.map((d) => d.id)).not.toContain(ids.avvikId);
    expect(l.ruh.map((d) => d.id)).not.toContain(ids.ruhId);
    expect(l.sja.map((d) => d.id)).toContain(ids.sjaId);
  });

  it("behandleren ser alle", async () => {
    const l = await hms("behandler").hentDokumenter({ projectId: ids.projectId });
    expect(l.avvik.map((d) => d.id)).toContain(ids.avvikId);
    expect(l.ruh.map((d) => d.id)).toContain(ids.ruhId);
  });
});

describe("H3-1: andre lesestier — byggTilgangsFilter (Bilder-siden og domene-listene)", () => {
  const privat = { sjekklisteId: "", byggOppgaveId: "" };

  beforeAll(async () => {
    // Privat HMS-sjekkliste med hmsSynlighet = null (H3 regner null som privat; slik ligger
    // 9 seedede maler i sitedoc_o13). Meldt av «melder».
    const mal = await prisma.reportTemplate.create({
      data: { projectId: ids.projectId, name: "H3 privat HMS-sjekkliste", category: "sjekkliste", domain: "hms", hmsSynlighet: null },
      select: { id: true },
    });
    privat.sjekklisteId = (await prisma.checklist.create({
      data: { templateId: mal.id, title: "Privat kontroll", bestillerUserId: brukere.melder, status: "received" },
      select: { id: true },
    })).id;
    const byggMal = await prisma.reportTemplate.findFirstOrThrow({
      where: { projectId: ids.projectId, domain: "bygg", category: "oppgave" },
      select: { id: true },
    });
    privat.byggOppgaveId = (await prisma.task.create({
      data: { templateId: byggMal.id, title: "Bygg med bilde", number: 9002, bestillerUserId: brukere.melder, status: "draft" },
      select: { id: true },
    })).id;
    const bildeData = { fileUrl: "/uploads/h3.jpg", fileName: "h3.jpg", fileSize: 1 };
    await prisma.image.createMany({
      data: [
        { ...bildeData, taskId: ids.avvikId },
        { ...bildeData, taskId: ids.ruhId },
        { ...bildeData, taskId: privat.byggOppgaveId },
        { ...bildeData, checklistId: ids.sjaId },
        { ...bildeData, checklistId: privat.sjekklisteId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.image.deleteMany({ where: { fileUrl: "/uploads/h3.jpg" } });
  });

  async function bildeIder(r: Rolle) {
    const b = await bilde(r).hentForProsjekt({ projectId: ids.projectId });
    return {
      oppgaver: b.oppgaveBilder.map((x) => x.taskId),
      sjekklister: b.sjekklisteBilder.map((x) => x.checklistId),
    };
  }

  it.each([
    ["admin", false],
    ["padmGruppe", false],
    ["medlem", false],
    ["behandler", true],
    ["melder", true],
  ] as const)("Bilder-siden: bilde på HMS-avvik, RUH og privat HMS-sjekkliste — %s → %s", async (r, forventet) => {
    const b = await bildeIder(r);
    for (const id of [ids.avvikId, ids.ruhId]) expect(b.oppgaver.includes(id)).toBe(forventet);
    expect(b.sjekklister.includes(privat.sjekklisteId)).toBe(forventet);
  });

  it("negativkontroll: prosjektadmin ser fortsatt bilde på bygg-oppgave og åpen SJA", async () => {
    const b = await bildeIder("admin");
    expect(b.oppgaver).toContain(privat.byggOppgaveId);
    expect(b.sjekklister).toContain(ids.sjaId);
  });

  it.each([
    ["admin", false],
    ["padmGruppe", false],
    ["medlem", false],
    ["behandler", true],
    ["melder", true],
  ] as const)("oppgave.hentForProsjekt({ domain: hms }) — %s → %s", async (r, forventet) => {
    const l = (await oppgave(r).hentForProsjekt({ projectId: ids.projectId, domain: "hms" })).map((d) => d.id);
    expect(l.includes(ids.avvikId)).toBe(forventet);
    expect(l.includes(ids.ruhId)).toBe(forventet);
  });

  it.each([
    ["admin", false],
    ["padmGruppe", false],
    ["behandler", true],
    ["melder", true],
  ] as const)("sjekkliste.hentForProsjekt({ domain: hms }) med privat HMS-sjekkliste — %s → %s", async (r, forventet) => {
    const l = (await sjekkliste(r).hentForProsjekt({ projectId: ids.projectId, domain: "hms" })).map((d) => d.id);
    expect(l.includes(privat.sjekklisteId)).toBe(forventet);
  });

  it("negativkontroll: prosjektadmin ser fortsatt åpen SJA og bygg-oppgaven i listene", async () => {
    const sja = (await sjekkliste("admin").hentForProsjekt({ projectId: ids.projectId, domain: "hms" })).map((d) => d.id);
    expect(sja).toContain(ids.sjaId);
    const bygg = (await oppgave("admin").hentForProsjekt({ projectId: ids.projectId })).map((d) => d.id);
    expect(bygg).toContain(privat.byggOppgaveId);
  });

  it("H3-2: oppgave.hentForSjekkliste på privat HMS-sjekkliste — admin FORBIDDEN, behandler og melder OK", async () => {
    await expect(oppgave("admin").hentForSjekkliste({ checklistId: privat.sjekklisteId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(oppgave("behandler").hentForSjekkliste({ checklistId: privat.sjekklisteId })).resolves.toEqual([]);
    await expect(oppgave("melder").hentForSjekkliste({ checklistId: privat.sjekklisteId })).resolves.toEqual([]);
  });
});

describe("H3-3: part i flyten beholder private HMS-saker i lista (speiler erPart && i flyten)", () => {
  let avvikId = "";

  beforeAll(async () => {
    // Privat HMS-avvik meldt av «melder» og sendt inn (har flyt). «flytMottaker» og «flytMedlem»
    // er vanlige medlemmer bundet direkte (projectMemberId) til avvikets flyt; ingen er behandler.
    avvikId = (await oppgave("melder").opprett({ templateId: maler.HMS!, title: "Videresendt avvik" })).id;
    await oppgave("melder").hmsSendInn({ id: avvikId });
    const { dokumentflytId } = await prisma.task.findUniqueOrThrow({ where: { id: avvikId }, select: { dokumentflytId: true } });
    expect(dokumentflytId).toBeTruthy();
    for (const r of ["flytMottaker", "flytMedlem"] as const) {
      const pm = await prisma.projectMember.create({ data: { userId: brukere[r], projectId: ids.projectId, role: "member" } });
      await prisma.dokumentflytMedlem.create({ data: { dokumentflytId: dokumentflytId!, projectMemberId: pm.id, rolle: "utforer" } });
    }
    await prisma.task.update({ where: { id: avvikId }, data: { recipientUserId: brukere.flytMottaker } });
  });

  it("forutsetning: ingen av dem er behandler, og detaljgaten slipper inn mottakeren, ikke den andre", async () => {
    expect(await hms("flytMottaker").erHmsAdmin({ projectId: ids.projectId })).toBe(false);
    expect(await hms("flytMedlem").erHmsAdmin({ projectId: ids.projectId })).toBe(false);
    await expect(oppgave("flytMottaker").hentMedId({ id: avvikId })).resolves.toMatchObject({ id: avvikId });
    await expect(oppgave("flytMedlem").hentMedId({ id: avvikId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["flytMottaker", true],
    ["flytMedlem", false],
  ] as const)("hms.hentDokumenter og oppgave.hentForProsjekt({ domain: hms }) — %s → %s", async (r, forventet) => {
    const l = await hms(r).hentDokumenter({ projectId: ids.projectId });
    expect(l.avvik.map((d) => d.id).includes(avvikId)).toBe(forventet);
    const o = (await oppgave(r).hentForProsjekt({ projectId: ids.projectId, domain: "hms" })).map((d) => d.id);
    expect(o.includes(avvikId)).toBe(forventet);
  });
});

describe("H3: behandlerhandlingene", () => {
  it.each(["admin", "padmGruppe", "medlem"] as const)("%s kan ikke besvare → FORBIDDEN", async (r) => {
    await expect(oppgave(r).hmsBesvar({ id: ids.avvikId, begrunnelse: "Sikret" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("behandleren besvarer", async () => {
    await expect(oppgave("behandler").hmsBesvar({ id: ids.ruhId, begrunnelse: "Sikret" })).resolves.toBeTruthy();
  });

  it("«Meld meg inn» gjør prosjektadmin til behandler med ett trykk", async () => {
    await gruppeRouter.createCaller(ctx("admin")).meldMegInn({ groupId: ids.hmsGruppeId, projectId: ids.projectId });
    expect(await hms("admin").erHmsAdmin({ projectId: ids.projectId })).toBe(true);
    await expect(oppgave("admin").hentMedId({ id: ids.avvikId })).resolves.toMatchObject({ id: ids.avvikId });
    await expect(oppgave("admin").hmsBesvar({ id: ids.avvikId, begrunnelse: "Sikret" })).resolves.toBeTruthy();
  });
});
