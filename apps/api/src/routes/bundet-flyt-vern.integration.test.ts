import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";

/**
 * Ordre bundet-flyt-skjema (fabel-tegning 2026-09-16, Kenneth-gatet): en `Dokumentflyt` merket
 * `bundet=true` holder dokumentene sine — flyt-BYTTE ut av den skal NEKTES på serveren, for ALLE
 * i prosjektet (egenskap ved flyten, ikke en rettighet — kanByttFlyt er urørt). Sperren sitter i
 * oppgave/sjekkliste.endreStatus, i forwarded-grenen der input.dokumentflytId ≠ dokumentets
 * nåværende flyt. Samme feilkode som slettObjekt/↻-sperren: PRECONDITION_FAILED.
 *
 * Krav 4 — «stille tomhet», krav (c): tre retninger, alle sett RØDE først (se rapporten):
 *   1. Bundet flyt → flyt-bytte NEKTES.
 *   2. Bundet flyt → videresend INNEN egen flyt GÅR GJENNOM (guarden treffer ikke — like viktig).
 *   3. Fri flyt   → flyt-bytte GÅR GJENNOM (beviser at sperren ikke over-anvender).
 * Test (4) gjentar retning 1 mot sjekkliste-routeren — sperren finnes i BEGGE filer.
 *
 * Går gjennom PROSEDYREN (createCaller), ikke rett mot DB. Auth: sitedoc_admin → forbi
 * verifiserDokumentTilgang + verifiserRetningsrett; ProjectMember(admin) kreves fordi
 * flyt-bytte-veien slår opp hentBrukerProsjektTilgang (krever medlem-rad selv for admin).
 * Mål-DB: localhost/CI-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 */

const ids = {
  userId: "",
  orgId: "",
  projectId: "",
  faggruppeId: "",
  templateId: "",
  bundetFlytId: "",
  friFlytId: "",
  malFlytId: "", // mål-flyt for bytte (fri, egen faggruppe)
  oppgaveIBundet: "",
  oppgaveIBundet2: "",
  oppgaveIFri: "",
  oppgaveIFriLes: "",
  sjekklisteIBundet: "",
};

async function lagFlyt(navn: string, bundet: boolean): Promise<string> {
  const flyt = await prisma.dokumentflyt.create({
    data: {
      projectId: ids.projectId,
      faggruppeId: ids.faggruppeId,
      name: navn,
      bundet,
      roller: [{ rolle: "registrator" }],
    },
  });
  return flyt.id;
}

async function lagOppgave(navn: string, flytId: string): Promise<string> {
  const o = await prisma.task.create({
    data: {
      templateId: ids.templateId,
      bestillerUserId: ids.userId,
      title: navn,
      status: "draft",
      dokumentflytId: flytId,
      utforerFaggruppeId: ids.faggruppeId,
      aktivPosisjon: 1,
    },
  });
  return o.id;
}

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: { email: "bundet-flyt-test@sitedoc.test", name: "Bundet-flyt admin", role: "sitedoc_admin" },
  });
  ids.userId = bruker.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma bundet flyt" } });
  ids.orgId = org.id;

  const prosjekt = await prisma.project.create({
    data: { projectNumber: "SD-BUNDET-FLYT-1", name: "Bundet-flyt-prosjekt", primaryOrganizationId: org.id },
  });
  ids.projectId = prosjekt.id;

  // ProjectMember(admin) for admin-brukeren — flyt-bytte-veien krever en medlem-rad.
  await prisma.projectMember.create({
    data: { userId: ids.userId, projectId: ids.projectId, role: "admin" },
  });

  const fg = await prisma.faggruppe.create({
    data: { projectId: ids.projectId, name: "Ledelsen", color: "#1e40af" },
  });
  ids.faggruppeId = fg.id;

  const mal = await prisma.reportTemplate.create({
    data: { projectId: ids.projectId, name: "Endringsmelding", category: "sjekkliste", domain: "kvalitet" },
  });
  ids.templateId = mal.id;

  ids.bundetFlytId = await lagFlyt("Endringsmelding — B12 (bundet)", true);
  ids.friFlytId = await lagFlyt("Tømrer — montasje (fri)", false);
  ids.malFlytId = await lagFlyt("Varsel — B12 (mål)", false);

  // Koble malen til flytene så `hentTilgjengeligeFlyter` (som filtrerer alleFlyter på
  // `maler.some.templateId`) returnerer `gjeldende` non-null for dokumenter på disse flytene.
  await prisma.dokumentflytMal.createMany({
    data: [
      { dokumentflytId: ids.bundetFlytId, templateId: ids.templateId },
      { dokumentflytId: ids.friFlytId, templateId: ids.templateId },
    ],
  });

  ids.oppgaveIBundet = await lagOppgave("EM-014 i bundet flyt", ids.bundetFlytId);
  ids.oppgaveIBundet2 = await lagOppgave("EM-015 i bundet flyt", ids.bundetFlytId);
  ids.oppgaveIFri = await lagOppgave("Montasje-oppgave i fri flyt", ids.friFlytId);
  // Egen fri-oppgave KUN for lese-testen (6) — `oppgaveIFri` flyt-byttes bort i test (3).
  ids.oppgaveIFriLes = await lagOppgave("Les-oppgave i fri flyt", ids.friFlytId);

  const cl = await prisma.checklist.create({
    data: {
      templateId: ids.templateId,
      bestillerUserId: ids.userId,
      title: "Sjekkliste i bundet flyt",
      status: "draft",
      dokumentflytId: ids.bundetFlytId,
      utforerFaggruppeId: ids.faggruppeId,
      aktivPosisjon: 1,
    },
  });
  ids.sjekklisteIBundet = cl.id;
});

afterAll(async () => {
  await prisma.documentTransfer.deleteMany({ where: { OR: [{ task: { template: { projectId: ids.projectId } } }, { checklist: { template: { projectId: ids.projectId } } }] } });
  await prisma.task.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.checklist.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.dokumentflyt.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.reportTemplate.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.faggruppe.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId: ids.projectId } });
  if (ids.projectId) await prisma.project.deleteMany({ where: { id: ids.projectId } });
  if (ids.orgId) await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

function ctx() {
  return {
    userId: ids.userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("bundet flyt — serversperre mot flyt-bytte (fabel-tegning 2026-09-16)", () => {
  it("(1) NEKTER flyt-bytte UT av en bundet flyt (oppgave)", async () => {
    let feilkode: string | null = null;
    let melding = "";
    try {
      await oppgaveRouter.createCaller(ctx()).endreStatus({
        id: ids.oppgaveIBundet,
        nyStatus: "forwarded",
        dokumentflytId: ids.malFlytId, // ≠ bundetFlytId → flyt-bytte
        recipientUserId: ids.userId,
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      feilkode = err.code ?? "UKJENT";
      melding = err.message ?? "";
    }
    expect(feilkode).toBe("PRECONDITION_FAILED");
    // Melding sier at FLYTEN er bundet — ikke at brukeren mangler tilgang.
    expect(melding).toContain("Bundet flyt");
    expect(melding).toContain("Det gjelder alle i prosjektet, ikke bare deg");

    // Sperren skrev ingenting: oppgaven ligger fortsatt i den bundne flyten.
    const etter = await prisma.task.findUniqueOrThrow({ where: { id: ids.oppgaveIBundet } });
    expect(etter.dokumentflytId).toBe(ids.bundetFlytId);
  });

  it("(2) TILLATER videresend INNEN egen bundet flyt (ingen flyt-bytte)", async () => {
    // Ingen dokumentflytId (eller lik nåværende) → guarden treffer ikke, forwarden går gjennom.
    const res = await oppgaveRouter.createCaller(ctx()).endreStatus({
      id: ids.oppgaveIBundet2,
      nyStatus: "forwarded",
      recipientUserId: ids.userId,
    });
    // Ligger fortsatt i den bundne flyten (ingen bytte), mottaker satt.
    expect(res.dokumentflytId).toBe(ids.bundetFlytId);
    expect(res.recipientUserId).toBe(ids.userId);
  });

  it("(3) TILLATER flyt-bytte UT av en FRI flyt (beviser at sperren ikke over-anvender)", async () => {
    const res = await oppgaveRouter.createCaller(ctx()).endreStatus({
      id: ids.oppgaveIFri,
      nyStatus: "forwarded",
      dokumentflytId: ids.malFlytId, // ≠ friFlytId → flyt-bytte, skal gå gjennom
      recipientUserId: ids.userId,
    });
    expect(res.dokumentflytId).toBe(ids.malFlytId);
  });

  it("(4) NEKTER flyt-bytte UT av en bundet flyt også for sjekkliste-routeren", async () => {
    let feilkode: string | null = null;
    let melding = "";
    try {
      await sjekklisteRouter.createCaller(ctx()).endreStatus({
        id: ids.sjekklisteIBundet,
        nyStatus: "forwarded",
        dokumentflytId: ids.malFlytId,
        recipientUserId: ids.userId,
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      feilkode = err.code ?? "UKJENT";
      melding = err.message ?? "";
    }
    expect(feilkode).toBe("PRECONDITION_FAILED");
    expect(melding).toContain("Bundet flyt");

    const etter = await prisma.checklist.findUniqueOrThrow({ where: { id: ids.sjekklisteIBundet } });
    expect(etter.dokumentflytId).toBe(ids.bundetFlytId);
  });

  // Bundet flyt — MOBIL (bundet-flyt-mobil 2026-09-17): `hentTilgjengeligeFlyter.gjeldende` MÅ
  // bære `bundet` så mobil kan speile serversperren (den leser gjeldende, ikke prosjektflytlista
  // som web). Uten disse ville feltet kunne falle tomt stille — mobil får da rettighets-lesningen
  // fotnoten ble skrevet for å avvise. Krav (c): FEILER hvis feltet mangler på gjeldende.
  it("(5) hentTilgjengeligeFlyter.gjeldende.bundet = true for en bundet flyt (oppgave)", async () => {
    const res = await oppgaveRouter.createCaller(ctx()).hentTilgjengeligeFlyter({ id: ids.oppgaveIBundet });
    expect(res.gjeldende?.bundet).toBe(true);
  });

  it("(6) hentTilgjengeligeFlyter.gjeldende.bundet = false for en fri flyt (beviser ikke alltid true)", async () => {
    const res = await oppgaveRouter.createCaller(ctx()).hentTilgjengeligeFlyter({ id: ids.oppgaveIFriLes });
    expect(res.gjeldende?.bundet).toBe(false);
  });

  it("(7) hentTilgjengeligeFlyter.gjeldende.bundet = true også for sjekkliste-routeren", async () => {
    const res = await sjekklisteRouter.createCaller(ctx()).hentTilgjengeligeFlyter({ id: ids.sjekklisteIBundet });
    expect(res.gjeldende?.bundet).toBe(true);
  });
});
