import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";

/**
 * K1 (Kenneth 2026-11-23): Start og kobling bare for punktets flyt.
 *
 * «medlemmer av denne dokumentflyten skal kunne legge til en ekstra sjekkliste ved behov.
 * Et medlem som ikke ser skjekklisten, men ser kontrollplanens punkter -> kan heller ikke
 * fylle ut kontrollplanens sjekkliste.»
 *
 * Låser:
 *  - Start: medlem av PUNKTETS flyt (alle roller, person/faggruppe/gruppe-binding) eller admin
 *    → OK. Faggruppemedlem utenfor flyten og medlem av en annen flyt med samme eier → FORBIDDEN.
 *  - koblePunkt: krever tilgang til sjekklista og samme flyt som punktet.
 *  - hentKoblbareSjekklister: ingen sjekklister brukeren ikke har tilgang til, ingen fra andre flyter.
 *  - hentPunktHandlinger: samme regel som serveren (web-knappene).
 *  - Prosjektisolasjon: bruker i et annet prosjekt får FORBIDDEN.
 *  - V1 (Kenneth-vedtak 2026-08-15): firma-admin uten ProjectMember-rad er admin — Start,
 *    Koble og kandidatlista virker, flytfilteret på punktets flyt gjelder fortsatt.
 *  - K1-S (Kontrollør-vilkår etter H3): admin som ikke er HMS-behandler får verken se eller koble
 *    en privat HMS-sjekkliste andre har meldt via kontrollplanen. HMS-behandleren (`erHmsAdmin`,
 *    også firmaets `hms_ansvarlig` uten ProjectMember-rad) og melderen kobler fortsatt.
 */
describe("K1 — Start og kobling bare for punktets flyt", () => {
  const NS = `k1-${randomUUID().slice(0, 8)}`;
  const brukere: Record<string, string> = {};
  const id = {
    projectId: "",
    annetProsjektId: "",
    orgId: "",
    faggruppeId: "",
    medlemsFaggruppeId: "",
    gruppeId: "",
    flytA: "",
    flytB: "",
    templateId: "",
    byggeplassId: "",
    planId: "",
    sjekklisteA: "",
    sjekklisteB: "",
    hmsMal: "",
    hmsApenMal: "",
    hmsGruppeId: "",
    hmsPrivat: "",
    hmsApen: "",
  };
  const punkter: string[] = [];

  async function lagBruker(navn: string, rolle: "user" | "sitedoc_admin" = "user") {
    const u = await prisma.user.create({
      data: { id: randomUUID(), name: `${NS} ${navn}`, email: `${NS}-${navn}@k1.test`, role: rolle },
    });
    brukere[navn] = u.id;
    return u.id;
  }
  async function lagPm(userId: string, projectId: string, role: "member" | "admin" = "member") {
    return prisma.projectMember.create({ data: { id: randomUUID(), userId, projectId, role } });
  }
  async function lagPunkt(dokumentflytId: string | null = id.flytA, sjekklisteMalId = id.templateId) {
    const p = await prisma.kontrollplanPunkt.create({
      data: {
        id: randomUUID(),
        kontrollplanId: id.planId,
        sjekklisteMalId,
        faggruppeId: id.faggruppeId,
        dokumentflytId,
      },
    });
    punkter.push(p.id);
    return p.id;
  }
  async function start(navn: string, punktId: string) {
    return createTestCaller(brukere[navn]!)
      .sjekkliste.opprett({ templateId: id.templateId, dokumentflytId: id.flytA, kontrollplanPunktId: punktId })
      .then(async (r) => {
        // Prøveprosjekt har maks 10 sjekklister: rydd straks, ellers gir grensen falsk FORBIDDEN.
        await prisma.kontrollplanPunkt.update({ where: { id: punktId }, data: { sjekklisteId: null } });
        await prisma.checklist.delete({ where: { id: r.id } });
        return { ok: true as const };
      })
      .catch((e: unknown) => ({ ok: false as const, code: (e as { code?: string }).code, melding: (e as Error).message }));
  }

  beforeAll(async () => {
    id.orgId = (await prisma.organization.create({ data: { id: randomUUID(), name: `${NS} Firma` } })).id;
    const project = await prisma.project.create({
      data: { id: randomUUID(), projectNumber: NS, name: `${NS} Prosjekt`, primaryOrganizationId: id.orgId },
    });
    id.projectId = project.id;
    const annet = await prisma.project.create({
      data: { id: randomUUID(), projectNumber: `${NS}-b`, name: `${NS} Annet`, primaryOrganizationId: null },
    });
    id.annetProsjektId = annet.id;

    // Eier-faggruppe for begge flyter + punktets faggruppe.
    id.faggruppeId = (await prisma.faggruppe.create({ data: { id: randomUUID(), projectId: project.id, name: `${NS} Eier` } })).id;
    // Faggruppe som er medlem (utfører) av flyt A — binding via faggruppe.
    id.medlemsFaggruppeId = (await prisma.faggruppe.create({ data: { id: randomUUID(), projectId: project.id, name: `${NS} Fag` } })).id;
    id.gruppeId = (await prisma.projectGroup.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} Gruppe`, slug: `${NS}-gruppe`, category: "generelt" },
    })).id;

    id.flytA = (await prisma.dokumentflyt.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} A`, faggruppeId: id.faggruppeId, roller: [] },
    })).id;
    id.flytB = (await prisma.dokumentflyt.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} B`, faggruppeId: id.faggruppeId, roller: [] },
    })).id;

    id.templateId = (await prisma.reportTemplate.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} Mal`, category: "sjekkliste", domain: "kvalitet" },
    })).id;
    for (const f of [id.flytA, id.flytB]) {
      await prisma.dokumentflytMal.create({ data: { id: randomUUID(), dokumentflytId: f, templateId: id.templateId } });
    }

    // Flyt A: én person i hver rolle + faggruppe-binding + gruppe-binding.
    for (const rolle of ["registrator", "bestiller", "utforer", "godkjenner"] as const) {
      const pm = await lagPm(await lagBruker(rolle), project.id);
      await prisma.dokumentflytMedlem.create({
        data: { id: randomUUID(), dokumentflytId: id.flytA, rolle, steg: 1, projectMemberId: pm.id },
      });
    }
    const pmFag = await lagPm(await lagBruker("viaFaggruppe"), project.id);
    await prisma.faggruppeKobling.create({ data: { id: randomUUID(), projectMemberId: pmFag.id, faggruppeId: id.medlemsFaggruppeId } });
    await prisma.dokumentflytMedlem.create({
      data: { id: randomUUID(), dokumentflytId: id.flytA, rolle: "utforer", steg: 2, faggruppeId: id.medlemsFaggruppeId },
    });
    const pmGr = await lagPm(await lagBruker("viaGruppe"), project.id);
    await prisma.projectGroupMember.create({ data: { id: randomUUID(), groupId: id.gruppeId, projectMemberId: pmGr.id } });
    await prisma.dokumentflytMedlem.create({
      data: { id: randomUUID(), dokumentflytId: id.flytA, rolle: "godkjenner", steg: 3, groupId: id.gruppeId },
    });

    // Meldt fjerning 1: medlem av punktets EIER-faggruppe, men ikke av flyt A.
    const pmEier = await lagPm(await lagBruker("eierFaggruppe"), project.id);
    await prisma.faggruppeKobling.create({ data: { id: randomUUID(), projectMemberId: pmEier.id, faggruppeId: id.faggruppeId } });
    // Meldt fjerning 2: medlem av flyt B (samme eier-faggruppe), ikke av flyt A.
    const pmB = await lagPm(await lagBruker("flytB"), project.id);
    await prisma.dokumentflytMedlem.create({
      data: { id: randomUUID(), dokumentflytId: id.flytB, rolle: "registrator", steg: 1, projectMemberId: pmB.id },
    });
    // Vanlig prosjektmedlem uten noe.
    await lagPm(await lagBruker("utenfor"), project.id);
    // Admin-varianter.
    await lagPm(await lagBruker("prosjektadmin"), project.id, "admin");
    await lagBruker("sitedocAdmin", "sitedoc_admin");
    // V1: firma-admin i prosjektets firma, UTEN ProjectMember-rad.
    await prisma.organizationMember.create({
      data: { userId: await lagBruker("firmaAdmin"), organizationId: id.orgId, status: "aktiv", firmaRoller: ["firma_admin"] },
    });
    // Admin i et ANNET prosjekt (prosjektisolasjon).
    await lagPm(await lagBruker("fremmedAdmin"), annet.id, "admin");

    id.byggeplassId = (await prisma.byggeplass.create({ data: { id: randomUUID(), projectId: project.id, name: `${NS} Bygg` } })).id;
    id.planId = (await prisma.kontrollplan.create({
      data: { id: randomUUID(), projectId: project.id, byggeplassId: id.byggeplassId, navn: `${NS} Plan` },
    })).id;

    // Eksisterende, ukoblede sjekklister: én i flyt A, én i flyt B. Bestiller-faggruppe =
    // medlemsfaggruppa (ikke eier), så eier-faggruppemedlemmet ikke får faggruppe-direkte tilgang.
    const lagSjekkliste = async (flyt: string, tittel: string) =>
      (await prisma.checklist.create({
        data: {
          id: randomUUID(),
          templateId: id.templateId,
          bestillerUserId: brukere.registrator!,
          bestillerFaggruppeId: id.medlemsFaggruppeId,
          utforerFaggruppeId: id.medlemsFaggruppeId,
          dokumentflytId: flyt,
          title: `${NS} ${tittel}`,
          byggeplassId: id.byggeplassId,
        },
      })).id;
    id.sjekklisteA = await lagSjekkliste(id.flytA, "SA");
    id.sjekklisteB = await lagSjekkliste(id.flytB, "SB");

    // K1-S: en kontrollplan-mal kan være en HMS-mal. Privat = hmsSynlighet null (H3 regner null
    // som privat, slik de seedede SJA-malene står), åpen = "apen". Begge i flyt A.
    id.hmsMal = (await prisma.reportTemplate.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} HMS-mal`, category: "sjekkliste", domain: "hms" },
    })).id;
    id.hmsApenMal = (await prisma.reportTemplate.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} HMS åpen`, category: "sjekkliste", domain: "hms", hmsSynlighet: "apen" },
    })).id;
    for (const t of [id.hmsMal, id.hmsApenMal]) {
      await prisma.dokumentflytMal.create({ data: { id: randomUUID(), dokumentflytId: id.flytA, templateId: t } });
    }
    // HMS-behandler: medlem av prosjektets HMS-gruppe (systemNokkel "hms"), ikke av flyt A.
    id.hmsGruppeId = (await prisma.projectGroup.create({
      data: {
        id: randomUUID(), projectId: project.id, name: `${NS} HMS`, slug: `${NS}-hms`, category: "generelt",
        systemNokkel: "hms", domains: ["hms"],
      },
    })).id;
    const pmHms = await lagPm(await lagBruker("hmsBehandler"), project.id);
    await prisma.projectGroupMember.create({ data: { id: randomUUID(), groupId: id.hmsGruppeId, projectMemberId: pmHms.id } });
    // Firma-admin som også er firmaets HMS-ansvarlige, uten ProjectMember-rad.
    await prisma.organizationMember.create({
      data: {
        userId: await lagBruker("firmaHms"), organizationId: id.orgId, status: "aktiv",
        firmaRoller: ["firma_admin", "hms_ansvarlig"],
      },
    });
    const lagHmsSjekkliste = async (templateId: string, tittel: string) =>
      (await prisma.checklist.create({
        data: {
          id: randomUUID(),
          templateId,
          bestillerUserId: brukere.registrator!,
          bestillerFaggruppeId: id.medlemsFaggruppeId,
          utforerFaggruppeId: id.medlemsFaggruppeId,
          dokumentflytId: id.flytA,
          title: `${NS} ${tittel}`,
          byggeplassId: id.byggeplassId,
        },
      })).id;
    id.hmsPrivat = await lagHmsSjekkliste(id.hmsMal, "HMS privat");
    id.hmsApen = await lagHmsSjekkliste(id.hmsApenMal, "HMS åpen");
  });

  afterAll(async () => {
    await prisma.kontrollplanPunkt.deleteMany({ where: { kontrollplanId: id.planId } });
    const iProsjekt = { template: { projectId: id.projectId } };
    await prisma.checklistChangeLog.deleteMany({ where: { checklist: iProsjekt } }).catch(() => undefined);
    await prisma.documentTransfer.deleteMany({ where: { checklist: iProsjekt } }).catch(() => undefined);
    await prisma.checklist.deleteMany({ where: iProsjekt });
    await prisma.kontrollplan.deleteMany({ where: { projectId: id.projectId } });
    await prisma.byggeplass.deleteMany({ where: { projectId: id.projectId } });
    await prisma.dokumentflytMal.deleteMany({ where: { dokumentflytId: { in: [id.flytA, id.flytB] } } });
    await prisma.dokumentflytMedlem.deleteMany({ where: { dokumentflytId: { in: [id.flytA, id.flytB] } } });
    await prisma.dokumentflyt.deleteMany({ where: { projectId: id.projectId } });
    await prisma.reportTemplate.deleteMany({ where: { projectId: id.projectId } });
    await prisma.projectGroupMember.deleteMany({ where: { groupId: { in: [id.gruppeId, id.hmsGruppeId] } } });
    await prisma.projectGroup.deleteMany({ where: { projectId: id.projectId } });
    await prisma.faggruppeKobling.deleteMany({ where: { faggruppe: { projectId: id.projectId } } });
    await prisma.faggruppe.deleteMany({ where: { projectId: id.projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [id.projectId, id.annetProsjektId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [id.projectId, id.annetProsjektId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: id.orgId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(brukere) } } });
    await prisma.organization.deleteMany({ where: { id: id.orgId } });
  });

  describe("Start", () => {
    for (const navn of ["registrator", "bestiller", "utforer", "godkjenner", "viaFaggruppe", "viaGruppe"]) {
      it(`flytmedlem (${navn}) kan starte`, async () => {
        const r = await start(navn, await lagPunkt());
        expect(r).toMatchObject({ ok: true });
      });
    }
    for (const navn of ["prosjektadmin", "sitedocAdmin", "firmaAdmin"]) {
      it(`${navn} kan starte`, async () => {
        expect(await start(navn, await lagPunkt())).toMatchObject({ ok: true });
      });
    }
    for (const navn of ["eierFaggruppe", "flytB", "utenfor"]) {
      it(`${navn} (utenfor punktets flyt) får FORBIDDEN`, async () => {
        expect(await start(navn, await lagPunkt())).toMatchObject({ ok: false, code: "FORBIDDEN", melding: expect.stringMatching(/dokumentflyten til dette kontrollpunktet/) });
      });
    }
    it("admin i et annet prosjekt får FORBIDDEN (prosjektisolasjon)", async () => {
      expect(await start("fremmedAdmin", await lagPunkt())).toMatchObject({ ok: false, code: "FORBIDDEN" });
    });
  });

  describe("Koble eksisterende", () => {
    const koble = (navn: string, punktId: string, sjekklisteId: string) =>
      createTestCaller(brukere[navn]!)
        .kontrollplan.koblePunkt({ punktId, sjekklisteId })
        .then(() => ({ ok: true as const }))
        .catch((e: unknown) => ({ ok: false as const, code: (e as { code?: string }).code }));

    it("prosjektmedlem uten tilgang til sjekklista får FORBIDDEN", async () => {
      expect(await koble("utenfor", await lagPunkt(), id.sjekklisteA)).toEqual({ ok: false, code: "FORBIDDEN" });
    });
    it("sjekkliste fra en annen flyt avvises, også for admin", async () => {
      expect(await koble("prosjektadmin", await lagPunkt(), id.sjekklisteB)).toEqual({ ok: false, code: "BAD_REQUEST" });
    });
    it("admin i et annet prosjekt får FORBIDDEN", async () => {
      expect(await koble("fremmedAdmin", await lagPunkt(), id.sjekklisteA)).toEqual({ ok: false, code: "FORBIDDEN" });
    });
    it("V1: firma-admin uten ProjectMember kobler sjekkliste fra punktets flyt, men ikke fra en annen", async () => {
      const punktId = await lagPunkt();
      expect(await koble("firmaAdmin", punktId, id.sjekklisteB)).toEqual({ ok: false, code: "BAD_REQUEST" });
      expect(await koble("firmaAdmin", punktId, id.sjekklisteA)).toEqual({ ok: true });
      const p = await prisma.kontrollplanPunkt.findUniqueOrThrow({ where: { id: punktId } });
      expect(p.sjekklisteId).toBe(id.sjekklisteA);
      await prisma.kontrollplanPunkt.update({ where: { id: punktId }, data: { sjekklisteId: null } });
    });
    it("flytmedlem kobler sjekkliste fra punktets flyt", async () => {
      const punktId = await lagPunkt();
      expect(await koble("godkjenner", punktId, id.sjekklisteA)).toEqual({ ok: true });
      const p = await prisma.kontrollplanPunkt.findUniqueOrThrow({ where: { id: punktId } });
      expect(p.sjekklisteId).toBe(id.sjekklisteA);
      await prisma.kontrollplanPunkt.update({ where: { id: punktId }, data: { sjekklisteId: null } });
    });
  });

  describe("Kandidatlista og handlinger", () => {
    const kandidater = async (navn: string, punktId: string) =>
      (await createTestCaller(brukere[navn]!).kontrollplan.hentKoblbareSjekklister({ punktId })).map((s) => s.id);

    it("uten tilgang: ingen kandidater (ingen lekkasje av fremmede sjekklister)", async () => {
      const punktId = await lagPunkt();
      expect(await kandidater("utenfor", punktId)).toEqual([]);
      expect(await kandidater("eierFaggruppe", punktId)).toEqual([]);
    });
    it("flytmedlem ser bare sjekklister i punktets flyt", async () => {
      const ids = await kandidater("utforer", await lagPunkt());
      expect(ids).toContain(id.sjekklisteA);
      expect(ids).not.toContain(id.sjekklisteB);
    });
    it("admin ser bare punktets flyt; punkt uten flyt viser begge", async () => {
      const medFlyt = await kandidater("prosjektadmin", await lagPunkt());
      expect(medFlyt).toEqual([id.sjekklisteA]);
      const utenFlyt = await kandidater("prosjektadmin", await lagPunkt(null));
      expect(utenFlyt.sort()).toEqual([id.sjekklisteA, id.sjekklisteB].sort());
    });
    it("V1: firma-admin uten ProjectMember ser bare punktets flyt", async () => {
      expect(await kandidater("firmaAdmin", await lagPunkt())).toEqual([id.sjekklisteA]);
    });
    it("bruker i et annet prosjekt får FORBIDDEN", async () => {
      await expect(kandidater("fremmedAdmin", await lagPunkt())).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("hentPunktHandlinger speiler serverregelen pr. rolle", async () => {
      const medFlyt = await lagPunkt();
      const utenFlyt = await lagPunkt(null);
      const handlinger = (navn: string) =>
        createTestCaller(brukere[navn]!).kontrollplan.hentPunktHandlinger({ byggeplassId: id.byggeplassId });

      const flytmedlem = await handlinger("bestiller");
      expect(flytmedlem[medFlyt]).toEqual({ kanStarte: true, kanKoble: true });
      expect(flytmedlem[utenFlyt]).toEqual({ kanStarte: true, kanKoble: true });

      const eier = await handlinger("eierFaggruppe");
      expect(eier[medFlyt]).toEqual({ kanStarte: false, kanKoble: false });
      // Punkt uten flyt: Start vises som før (gir «velg flyt»-meldingen).
      expect(eier[utenFlyt]).toEqual({ kanStarte: true, kanKoble: false });

      expect((await handlinger("flytB"))[medFlyt]).toEqual({ kanStarte: false, kanKoble: false });
      expect((await handlinger("prosjektadmin"))[medFlyt]).toEqual({ kanStarte: true, kanKoble: true });
      // V1: firma-admin uten ProjectMember-rad får begge knappene.
      expect((await handlinger("firmaAdmin"))[medFlyt]).toEqual({ kanStarte: true, kanKoble: true });
      await expect(handlinger("fremmedAdmin")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
  describe("K1-S — private HMS-sjekklister via kontrollplanen", () => {
    const koble = (navn: string, punktId: string, sjekklisteId: string) =>
      createTestCaller(brukere[navn]!)
        .kontrollplan.koblePunkt({ punktId, sjekklisteId })
        .then(async () => {
          await prisma.kontrollplanPunkt.update({ where: { id: punktId }, data: { sjekklisteId: null } });
          return { ok: true as const };
        })
        .catch((e: unknown) => ({ ok: false as const, code: (e as { code?: string }).code }));
    const kandidater = async (navn: string, punktId: string) =>
      (await createTestCaller(brukere[navn]!).kontrollplan.hentKoblbareSjekklister({ punktId })).map((s) => s.id);
    const handlinger = async (navn: string, punktId: string) =>
      (await createTestCaller(brukere[navn]!).kontrollplan.hentPunktHandlinger({ byggeplassId: id.byggeplassId }))[punktId];

    // Rolle for rolle: [navn, ser og kobler den private HMS-sjekklista, kanStarte på punktet].
    const roller = [
      ["prosjektadmin", false, true],
      ["firmaAdmin", false, true],
      ["sitedocAdmin", true, true],
      ["firmaHms", true, true],
      ["hmsBehandler", true, false],
      ["registrator", true, true],
      ["utforer", false, true],
    ] as const;

    it.each(roller)("privat HMS-punkt, %s: kandidatlista", async (navn, ser) => {
      expect(await kandidater(navn, await lagPunkt(id.flytA, id.hmsMal))).toEqual(ser ? [id.hmsPrivat] : []);
    });
    it.each(roller)("privat HMS-punkt, %s: hentPunktHandlinger", async (navn, ser, kanStarte) => {
      const punktId = await lagPunkt(id.flytA, id.hmsMal);
      expect(await handlinger(navn, punktId)).toEqual({ kanStarte, kanKoble: ser });
    });
    it.each(roller)("privat HMS-punkt, %s: koblePunkt", async (navn, ser) => {
      expect(await koble(navn, await lagPunkt(id.flytA, id.hmsMal), id.hmsPrivat)).toEqual(
        ser ? { ok: true } : { ok: false, code: "FORBIDDEN" },
      );
    });

    it("negativkontroll: åpen HMS-sjekkliste vises og kobles av admin som før", async () => {
      for (const navn of ["prosjektadmin", "firmaAdmin"]) {
        const punktId = await lagPunkt(id.flytA, id.hmsApenMal);
        expect(await kandidater(navn, punktId)).toEqual([id.hmsApen]);
        expect(await handlinger(navn, punktId)).toEqual({ kanStarte: true, kanKoble: true });
        expect(await koble(navn, punktId, id.hmsApen)).toEqual({ ok: true });
      }
    });
    it("negativkontroll: bygg-punkt for admin uendret", async () => {
      for (const navn of ["prosjektadmin", "firmaAdmin"]) {
        const punktId = await lagPunkt();
        expect(await kandidater(navn, punktId)).toEqual([id.sjekklisteA]);
        expect(await handlinger(navn, punktId)).toEqual({ kanStarte: true, kanKoble: true });
        expect(await koble(navn, punktId, id.sjekklisteA)).toEqual({ ok: true });
      }
    });
  });
});
