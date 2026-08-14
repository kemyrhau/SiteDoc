import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";

/**
 * Regresjonsnett for L1.5 «forhåndsvalgt flyt»-bypass.
 *
 * Modellen: et kontrollpunkt kan ha en forhåndsvalgt dokumentflyt (satt av admin via
 * settPunktFlyt). Er den satt, er flyten plan-autorisert → Start bruker den direkte,
 * UAVHENGIG av om klikkeren er registrator. Er feltet null, gjelder dagens registrator-
 * krav. Denne testen låser begge greinene mot kjørende kode:
 *   1) preset-punkt + IKKE-registrator klikker → Start LYKKES (bypass virker)
 *   2) uten-preset-punkt + IKKE-registrator klikker → FORBIDDEN (registrator-kravet står)
 *
 * Uten grein (1) ville L1.5 vært funksjonsløs; uten grein (2) ville registrator-kravet
 * vært omgåelig for ethvert punkt — nettopp auth-hullet cowork fanget i designgaten.
 *
 * Krever localhost-sandkasse-DB (som alle *.integration.test.ts). Commit-seed → teardown.
 */
describe("sjekkliste.opprett — forhåndsvalgt flyt gjør Start uavhengig av registrator (L1.5)", () => {
  const NS = `kpflyt-${randomUUID().slice(0, 8)}`;
  const id = {
    projectId: "",
    klikkerUserId: "", // prosjektmedlem, IKKE registrator i flyten
    registratorUserId: "", // flytens registrator (en annen person)
    faggruppeId: "",
    dokumentflytId: "",
    templateId: "",
    presetPunktId: "", // har dokumentflytId satt
    utenPresetPunktId: "", // dokumentflytId = null
  };

  beforeAll(async () => {
    const klikker = await prisma.user.create({
      data: { id: randomUUID(), name: `${NS} Klikker`, email: `${NS}-klikker@l15.test`, role: "user" },
    });
    const registrator = await prisma.user.create({
      data: { id: randomUUID(), name: `${NS} Registrator`, email: `${NS}-reg@l15.test`, role: "user" },
    });
    id.klikkerUserId = klikker.id;
    id.registratorUserId = registrator.id;

    const project = await prisma.project.create({
      data: { id: randomUUID(), projectNumber: `${NS}`, name: `${NS} Prosjekt`, primaryOrganizationId: null },
    });
    id.projectId = project.id;

    // Klikkeren er vanlig prosjektmedlem (ikke admin, ikke registrator i flyten).
    const pmKlikker = await prisma.projectMember.create({
      data: { id: randomUUID(), userId: klikker.id, projectId: project.id, role: "member" },
    });
    const pmReg = await prisma.projectMember.create({
      data: { id: randomUUID(), userId: registrator.id, projectId: project.id, role: "member" },
    });

    const faggruppe = await prisma.faggruppe.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} Byggherre` },
    });
    id.faggruppeId = faggruppe.id;
    // Klikkeren tilhører eier-faggruppen → tilhørighetssjekken passerer, slik at
    // uten-preset-grenen (test 2) faktisk når registrator-gaten og ikke stopper før.
    await prisma.faggruppeKobling.create({
      data: { id: randomUUID(), projectMemberId: pmKlikker.id, faggruppeId: faggruppe.id },
    });

    // Flyt MED eier-faggruppe (bestiller utledes fra den) og en registrator som IKKE er
    // klikkeren. Ingen utfører-medlem → utfører faller tilbake til eier-faggruppen.
    const flyt = await prisma.dokumentflyt.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        name: `${NS} Flyt`,
        faggruppeId: faggruppe.id,
        roller: [{ rolle: "registrator" }, { rolle: "utforer" }],
      },
    });
    id.dokumentflytId = flyt.id;
    await prisma.dokumentflytMedlem.create({
      data: { id: randomUUID(), dokumentflytId: flyt.id, rolle: "registrator", steg: 1, projectMemberId: pmReg.id },
    });

    const template = await prisma.reportTemplate.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} Mal`, category: "sjekkliste", domain: "kvalitet" },
    });
    id.templateId = template.id;
    await prisma.dokumentflytMal.create({
      data: { id: randomUUID(), dokumentflytId: flyt.id, templateId: template.id },
    });

    const byggeplass = await prisma.byggeplass.create({
      data: { id: randomUUID(), projectId: project.id, name: `${NS} Bygg` },
    });
    const plan = await prisma.kontrollplan.create({
      data: { id: randomUUID(), projectId: project.id, byggeplassId: byggeplass.id, navn: `${NS} Kontrollplan` },
    });

    const presetPunkt = await prisma.kontrollplanPunkt.create({
      data: {
        id: randomUUID(),
        kontrollplanId: plan.id,
        sjekklisteMalId: template.id,
        faggruppeId: faggruppe.id,
        dokumentflytId: flyt.id, // forhåndsvalgt
      },
    });
    id.presetPunktId = presetPunkt.id;
    const utenPreset = await prisma.kontrollplanPunkt.create({
      data: {
        id: randomUUID(),
        kontrollplanId: plan.id,
        sjekklisteMalId: template.id,
        faggruppeId: faggruppe.id,
        // dokumentflytId utelatt → null
      },
    });
    id.utenPresetPunktId = utenPreset.id;
  });

  afterAll(async () => {
    // Rydd i FK-trygg rekkefølge (checklists opprettet av testen ryddes via templateId).
    await prisma.kontrollplanPunkt.deleteMany({ where: { sjekklisteMalId: id.templateId } });
    await prisma.checklist.deleteMany({ where: { templateId: id.templateId } });
    await prisma.kontrollplan.deleteMany({ where: { projectId: id.projectId } });
    await prisma.byggeplass.deleteMany({ where: { projectId: id.projectId } });
    await prisma.dokumentflytMal.deleteMany({ where: { dokumentflytId: id.dokumentflytId } });
    await prisma.dokumentflytMedlem.deleteMany({ where: { dokumentflytId: id.dokumentflytId } });
    await prisma.dokumentflyt.deleteMany({ where: { projectId: id.projectId } });
    await prisma.reportTemplate.deleteMany({ where: { projectId: id.projectId } });
    await prisma.faggruppeKobling.deleteMany({ where: { faggruppeId: id.faggruppeId } });
    await prisma.faggruppe.deleteMany({ where: { projectId: id.projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId: id.projectId } });
    await prisma.project.deleteMany({ where: { id: id.projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [id.klikkerUserId, id.registratorUserId] } } });
  });

  it("preset-punkt: ikke-registrator kan starte, og punktet kobles til sjekklisten", async () => {
    const caller = createTestCaller(id.klikkerUserId);
    const sjekkliste = await caller.sjekkliste.opprett({
      templateId: id.templateId,
      dokumentflytId: id.dokumentflytId,
      kontrollplanPunktId: id.presetPunktId,
    });
    expect(sjekkliste.id).toBeTruthy();

    const punkt = await prisma.kontrollplanPunkt.findUniqueOrThrow({ where: { id: id.presetPunktId } });
    expect(punkt.sjekklisteId).toBe(sjekkliste.id);
    // Bestiller ble utledet fra flytens eier-faggruppe, ikke klikkerens faggruppe.
    const laget = await prisma.checklist.findUniqueOrThrow({ where: { id: sjekkliste.id } });
    expect(laget.bestillerFaggruppeId).toBe(id.faggruppeId);
    expect(laget.dokumentflytId).toBe(id.dokumentflytId);
  });

  it("uten-preset-punkt: ikke-registrator avvises (registrator-kravet står)", async () => {
    const caller = createTestCaller(id.klikkerUserId);
    const feil = await caller.sjekkliste
      .opprett({
        templateId: id.templateId,
        dokumentflytId: id.dokumentflytId,
        bestillerFaggruppeId: id.faggruppeId,
        utforerFaggruppeId: id.faggruppeId,
        kontrollplanPunktId: id.utenPresetPunktId,
      })
      .then(() => null)
      .catch((e: unknown) => e as { code?: string; message: string });
    expect(feil).toBeTruthy();
    // Klikkeren tilhører faggruppen, men er ikke oppretter-medlem (registrator) av
    // flyten → registrator-gaten avviser. Beviser at bypass KUN gjelder preset-punkter.
    expect(String(feil?.message)).toMatch(/oppretter-medlem/i);
  });
});
