import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { oppgaveRouter } from "./oppgave";

/**
 * Kontraktssak-runde 1 (ordre 2026-09-17). To DB-integrasjonstester (ikke mock),
 * begge sett RØDE først (se rapporten):
 *
 *  (c) STILLE TOMHET: oppgave-lista MÅ levere `template.subdomain = "kontrakt"` for et
 *      dokument fra en kontraktssak-mal. Uten det når klassen aldri klienten, og ikon/
 *      segment/detaljlinje ville stått tomme uten en feil. Feiler hvis select-en dropper feltet.
 *
 *  TILGANG UENDRET: en bruker med KUN gruppetilgang `domains: ["bygg"]` ser NØYAKTIG samme
 *      dokumentsett før og etter at en mal settes til kontraktssak. Beviser at `subdomain`
 *      ikke leses av tilgangskontrollen (`domain` er urørt = "bygg") — runde 1 endrer hvordan
 *      dokumentet ser ut, ikke hvem som ser det.
 *
 * Går gjennom PROSEDYREN (createCaller), ikke rett mot DB. Mål-DB: localhost/CI-sandkasse.
 */

const ids = {
  adminUserId: "",
  vanligUserId: "",
  orgId: "",
  projectId: "",
  faggruppeId: "",
  malKontraktId: "",
  malFlipId: "",
  taskKontraktId: "",
  taskFlipId: "",
  projectMemberId: "",
  groupId: "",
};

function ctx(userId: string) {
  return {
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { email: "kontraktssak-admin@sitedoc.test", name: "Kontraktssak admin", role: "sitedoc_admin" },
  });
  ids.adminUserId = admin.id;

  const vanlig = await prisma.user.create({
    data: { email: "kontraktssak-bygg@sitedoc.test", name: "Bygg-gruppe bruker", role: "user" },
  });
  ids.vanligUserId = vanlig.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma kontraktssak" } });
  ids.orgId = org.id;

  const prosjekt = await prisma.project.create({
    data: { projectNumber: "SD-KONTRAKT-1", name: "Kontraktssak-prosjekt", primaryOrganizationId: org.id },
  });
  ids.projectId = prosjekt.id;

  const fg = await prisma.faggruppe.create({
    data: { projectId: ids.projectId, name: "Grunnarbeid", color: "#1e40af" },
  });
  ids.faggruppeId = fg.id;

  // Kontraktssak-mal: undertype "kontrakt" på et vanlig bygg-dokument (domain uendret).
  const malKontrakt = await prisma.reportTemplate.create({
    data: { projectId: ids.projectId, name: "Varsel", category: "oppgave", domain: "bygg", subdomain: "kontrakt", prefix: "VAR" },
  });
  ids.malKontraktId = malKontrakt.id;

  const taskKontrakt = await prisma.task.create({
    data: { templateId: malKontrakt.id, bestillerUserId: ids.adminUserId, title: "Endring fra byggherren", status: "draft", number: 1 },
  });
  ids.taskKontraktId = taskKontrakt.id;

  // «Flip»-mal: starter som vanlig oppgave (subdomain=null), settes til kontrakt i tilgangs-testen.
  const malFlip = await prisma.reportTemplate.create({
    data: { projectId: ids.projectId, name: "Befaring", category: "oppgave", domain: "bygg", subdomain: null, prefix: "BEF" },
  });
  ids.malFlipId = malFlip.id;

  const taskFlip = await prisma.task.create({
    data: { templateId: malFlip.id, bestillerUserId: ids.adminUserId, title: "Befaring grøft", status: "draft", number: 1 },
  });
  ids.taskFlipId = taskFlip.id;

  // Vanlig bruker med KUN gruppetilgang domains=["bygg"] (ingen faggrupper → tverrgående).
  const pm = await prisma.projectMember.create({
    data: { userId: ids.vanligUserId, projectId: ids.projectId, role: "member" },
  });
  ids.projectMemberId = pm.id;

  const gruppe = await prisma.projectGroup.create({
    data: { projectId: ids.projectId, name: "Bygg-gruppe", slug: "bygg-gruppe", category: "field", domains: ["bygg"] },
  });
  ids.groupId = gruppe.id;

  await prisma.projectGroupMember.create({
    data: { groupId: gruppe.id, projectMemberId: pm.id },
  });
});

afterAll(async () => {
  await prisma.projectGroupMember.deleteMany({ where: { group: { projectId: ids.projectId } } });
  await prisma.groupFaggruppe.deleteMany({ where: { group: { projectId: ids.projectId } } });
  await prisma.projectGroup.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.task.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.reportTemplate.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.faggruppe.deleteMany({ where: { projectId: ids.projectId } });
  if (ids.projectId) await prisma.project.deleteMany({ where: { id: ids.projectId } });
  if (ids.orgId) await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.adminUserId, ids.vanligUserId] } } });
});

describe("kontraktssak — subdomain når klienten + tilgang uendret", () => {
  it("(c) oppgave-lista leverer template.subdomain=\"kontrakt\" for en kontraktssak-mal", async () => {
    const rader = await oppgaveRouter.createCaller(ctx(ids.adminUserId)).hentForProsjekt({
      projectId: ids.projectId,
    });
    const rad = rader.find((r) => r.id === ids.taskKontraktId);
    expect(rad).toBeDefined();
    // 🔴 Kjernen: klassen MÅ nå klienten. Feiler hvis select-en dropper subdomain.
    expect((rad?.template as { subdomain?: string | null } | null)?.subdomain).toBe("kontrakt");
  });

  it("bruker med gruppetilgang [\"bygg\"] ser SAMME dokumentsett før og etter at malen settes til kontraktssak", async () => {
    const før = await oppgaveRouter.createCaller(ctx(ids.vanligUserId)).hentForProsjekt({
      projectId: ids.projectId,
    });
    const settFør = new Set(før.map((r) => r.id));
    // Han skal se begge bygg-dokumentene via gruppens domain-tilgang.
    expect(settFør.has(ids.taskFlipId)).toBe(true);
    expect(settFør.has(ids.taskKontraktId)).toBe(true);

    // Sett flip-malen til kontraktssak — domain forblir "bygg", kun subdomain endres.
    await prisma.reportTemplate.update({
      where: { id: ids.malFlipId },
      data: { subdomain: "kontrakt" },
    });

    const etter = await oppgaveRouter.createCaller(ctx(ids.vanligUserId)).hentForProsjekt({
      projectId: ids.projectId,
    });
    const settEtter = new Set(etter.map((r) => r.id));

    // Nøyaktig samme sett — subdomain leses ikke av tilgangskontrollen.
    expect(settEtter).toEqual(settFør);
  });
});
