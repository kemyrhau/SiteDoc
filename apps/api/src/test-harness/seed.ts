/**
 * Flytmodell Fase 5a — seed + teardown for integrasjonstesten.
 *
 * Grense-flagg A (cowork-gatet): authz-hjelperne bruker modul-`prisma`-singleton,
 * så interaktiv tx-rollback gir split-brain (authz ser ikke ucommittet seed).
 * Derfor: COMMIT seed → EKSPLISITT teardown på sporede ID-er (revers-FK) i afterAll.
 * Navne-namespaced markør (`FLYT5A`) for trygghet mot rester.
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). KUN test-kode.
 *
 * Scenario: standalone-prosjekt (ingen org — gyldig permanent tilstand), 4 DISTINKTE
 * personer, 4-ledds flyt med distinkt `steg` 1–4:
 *   1 registrator (utfor, oppretter)  2 bestiller (kontroll)
 *   3 utfører (utfor, hovedansvarlig)  4 godkjenner (kontroll)
 * Tilgang løses via flyt-medlemskap (avgjorDokumentTilgang-grenen) — ingen ekstra gruppe.
 */

import { prisma } from "@sitedoc/db";
import { randomUUID } from "crypto";

const NS = "FLYT5A";

export interface FlytScenario {
  projectId: string;
  dokumentflytId: string;
  templateId: string;
  checklistId: string;
  /** userId per ledd (distinkte personer). */
  A_registrator: string;
  B_bestiller: string;
  C_utforer: string;
  D_godkjenner: string;
  /** En femte bruker som er prosjektmedlem men IKKE i flyten (authz-negativ seer). */
  E_utenfor: string;
}

/**
 * Opprett scenariet (committes). Returnerer ID-er + `checklistId` (fersk draft @ Ledd 1).
 * Kall `teardown(scenario)` i afterAll.
 */
export async function seedScenario(): Promise<FlytScenario> {
  const kjoreId = randomUUID().slice(0, 8);
  const epost = (rolle: string) => `${NS.toLowerCase()}-${rolle}-${kjoreId}@flyt5a.test`;

  // 5 distinkte brukere (4 ledд + 1 utenfor).
  async function lagBruker(navn: string, rolle: string): Promise<string> {
    const u = await prisma.user.create({
      data: { id: randomUUID(), name: `${NS} ${navn}`, email: epost(rolle), role: "user" },
    });
    return u.id;
  }
  const A = await lagBruker("Registrator A", "reg");
  const B = await lagBruker("Bestiller B", "best");
  const C = await lagBruker("Utfører C", "utf");
  const D = await lagBruker("Godkjenner D", "godk");
  const E = await lagBruker("Utenfor E", "utenfor");

  // Standalone-prosjekt (organizationId = null — gyldig permanent tilstand).
  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      projectNumber: `${NS}-${kjoreId}`,
      name: `${NS} Test-prosjekt ${kjoreId}`,
      primaryOrganizationId: null,
    },
  });

  // ProjectMember per bruker (rolle=member → ikke admin; øver ekte retningsrett).
  async function lagMedlem(userId: string): Promise<string> {
    const pm = await prisma.projectMember.create({
      data: { id: randomUUID(), userId, projectId: project.id, role: "member" },
    });
    return pm.id;
  }
  const pmA = await lagMedlem(A);
  const pmB = await lagMedlem(B);
  const pmC = await lagMedlem(C);
  const pmD = await lagMedlem(D);
  await lagMedlem(E); // E er prosjektmedlem, men IKKE flyt-medlem.

  // Dokumentflyt med 4 ledд (distinkt steg + klassifisering + distinkt person).
  const flyt = await prisma.dokumentflyt.create({
    data: {
      id: randomUUID(),
      projectId: project.id,
      name: `${NS} Flyt`,
      roller: [
        { rolle: "registrator" },
        { rolle: "bestiller" },
        { rolle: "utforer" },
        { rolle: "godkjenner" },
      ],
    },
  });

  async function lagLedd(
    steg: number,
    rolle: string,
    klassifisering: "kontroll" | "utfor" | "orienteres",
    projectMemberId: string,
    erHovedansvarlig = false,
  ) {
    await prisma.dokumentflytMedlem.create({
      data: {
        id: randomUUID(),
        dokumentflytId: flyt.id,
        rolle,
        steg,
        klassifisering,
        erHovedansvarlig,
        projectMemberId,
      },
    });
  }
  await lagLedd(1, "registrator", "utfor", pmA);
  await lagLedd(2, "bestiller", "kontroll", pmB);
  await lagLedd(3, "utforer", "utfor", pmC, true);
  await lagLedd(4, "godkjenner", "kontroll", pmD);

  // Mal (domain=bygg, ingen utfyllbare objekter → responded-guard passerer trivielt).
  const template = await prisma.reportTemplate.create({
    data: {
      id: randomUUID(),
      projectId: project.id,
      name: `${NS} Sjekklistemal`,
      category: "sjekkliste",
      domain: "bygg",
    },
  });

  // Fersk sjekkliste: draft, Ledd 1 (oppretter A har ballen), sendt=false.
  const checklist = await prisma.checklist.create({
    data: {
      id: randomUUID(),
      templateId: template.id,
      bestillerUserId: A,
      title: `${NS} Sjekkliste`,
      status: "draft",
      dokumentflytId: flyt.id,
      aktivPosisjon: 1,
      sendt: false,
      recipientUserId: A,
      data: {},
    },
  });

  return {
    projectId: project.id,
    dokumentflytId: flyt.id,
    templateId: template.id,
    checklistId: checklist.id,
    A_registrator: A,
    B_bestiller: B,
    C_utforer: C,
    D_godkjenner: D,
    E_utenfor: E,
  };
}

/** Sett klassifisering på ett ledд (for orienteres-hopp-scenariet). Test-setup. */
export async function settLeddKlassifisering(
  dokumentflytId: string,
  steg: number,
  klassifisering: "kontroll" | "utfor" | "orienteres",
): Promise<void> {
  await prisma.dokumentflytMedlem.updateMany({
    where: { dokumentflytId, steg },
    data: { klassifisering },
  });
}

/** Slett alt seedet, revers-FK-orden. Idempotent (deleteMany). */
export async function teardown(s: FlytScenario): Promise<void> {
  await prisma.documentTransfer.deleteMany({ where: { checklistId: s.checklistId } });
  await prisma.checklist.deleteMany({ where: { id: s.checklistId } });
  await prisma.reportObject.deleteMany({ where: { templateId: s.templateId } });
  await prisma.dokumentflytMedlem.deleteMany({ where: { dokumentflytId: s.dokumentflytId } });
  await prisma.reportTemplate.deleteMany({ where: { id: s.templateId } });
  await prisma.dokumentflyt.deleteMany({ where: { id: s.dokumentflytId } });
  await prisma.projectMember.deleteMany({ where: { projectId: s.projectId } });
  await prisma.dokumentflyt.deleteMany({ where: { projectId: s.projectId } });
  await prisma.project.deleteMany({ where: { id: s.projectId } });
  const brukere = [s.A_registrator, s.B_bestiller, s.C_utforer, s.D_godkjenner, s.E_utenfor];
  await prisma.user.deleteMany({ where: { id: { in: brukere } } });
}
