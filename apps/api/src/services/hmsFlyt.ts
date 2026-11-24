import type { Prisma } from "@sitedoc/db";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import { finnHmsGruppe, HMS_SYSTEMNOKKEL } from "./hmsGruppe";

/**
 * Seeder HMS-spesifikk infrastruktur når hms-avvik-modulen aktiveres:
 * - HMS-gruppe (ProjectGroup med domains: ["hms"])
 * - HMS-dokumentflyt med bestiller-boks (åpen) + utforer-boks (HMS-gruppe)
 * - Kobler alle ReportTemplate(domain="hms") på prosjektet til flyten
 *
 * Idempotent: gjentatte kall gir ikke duplikater.
 */
/**
 * Finn eller opprett prosjektets HMS-behandlergruppe, entydig via systemNokkel="hms".
 *
 * Tidligere ble gruppa slått opp på `domains array_contains ["hms"]` — men domenet
 * "hms" er BREDDE-tilgang som også prosjekt-admin bærer. Oppslaget kunne dermed
 * finne prosjekt-admin og konkludere at HMS-gruppa fantes, så den aldri ble
 * opprettet. systemNokkel gjør identiteten entydig; den partielle unik-indeksen
 * (project_id, system_nokkel) WHERE NOT NULL hindrer duplikat på DB-nivå.
 */
export async function sikreHmsGruppe(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<{ id: string }> {
  const eksisterende = await finnHmsGruppe(tx, projectId);
  if (eksisterende) return eksisterende;

  return tx.projectGroup.create({
    data: {
      projectId,
      name: "HMS-ansvarlige",
      slug: "hms-ansvarlige",
      category: "field",
      domains: ["hms"],
      systemNokkel: HMS_SYSTEMNOKKEL,
      permissions: [
        "create_tasks",
        "create_checklists",
        "checklist_edit",
        "checklist_view",
        "task_edit",
        "task_view",
      ],
      isDefault: true,
    },
    select: { id: true },
  });
}

export async function seedHmsModulOmradet(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  // 1) Finn eller opprett HMS-gruppen (entydig via systemNokkel)
  const hmsGruppe = await sikreHmsGruppe(tx, projectId);

  // 2) Finn eksisterende HMS-flyt via DokumentflytMal-kobling til mal med domain="hms"
  let hmsFlyt = await tx.dokumentflyt.findFirst({
    where: {
      projectId,
      maler: { some: { template: { domain: "hms" } } },
    },
    select: { id: true },
  });
  if (!hmsFlyt) {
    hmsFlyt = await tx.dokumentflyt.create({
      data: { projectId, name: "HMS" },
      select: { id: true },
    });
    // Boks 1: bestiller — null-medlem (åpen for alle prosjektmedlemmer)
    await tx.dokumentflytMedlem.create({
      data: { dokumentflytId: hmsFlyt.id, rolle: "bestiller", steg: 1 },
    });
    // Boks 2: utforer — HMS-gruppen
    await tx.dokumentflytMedlem.create({
      data: {
        dokumentflytId: hmsFlyt.id,
        rolle: "utforer",
        steg: 2,
        groupId: hmsGruppe.id,
      },
    });
  }

  // 2.5) Backfill: opprett manglende HMS-maler (SJA + RUH + HMS-avvik) for prosjekter
  // som hadde modulen aktivert før SJA/RUH ble lagt til i PROSJEKT_MODULER. Idempotent
  // via prefix-sjekk. Speiler modul.aktiver-løkkens opprettings-logikk slik at funksjonen
  // er selv-helbredende uavhengig av hvilken kallsti som treffer den.
  const hmsModulDef = PROSJEKT_MODULER.find((m) => m.slug === "hms-avvik");
  if (hmsModulDef) {
    for (const malDef of hmsModulDef.maler) {
      const finnes = await tx.reportTemplate.findFirst({
        where: { projectId, prefix: malDef.prefix },
        select: { id: true },
      });
      if (finnes) continue;
      const nyMal = await tx.reportTemplate.create({
        data: {
          projectId,
          name: malDef.navn,
          description: malDef.beskrivelse,
          prefix: malDef.prefix,
          category: malDef.kategori,
          domain: malDef.domain,
          subdomain: malDef.subdomain ?? null,
          hmsSynlighet: malDef.hmsSynlighet ?? null,
          subjects: (malDef.emner ?? []) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      if (malDef.objekter.length > 0) {
        await tx.reportObject.createMany({
          data: malDef.objekter.map((obj) => ({
            templateId: nyMal.id,
            type: obj.type,
            label: obj.label,
            sortOrder: obj.sortOrder,
            required: obj.required ?? false,
            config: obj.config as Prisma.InputJsonValue,
          })),
        });
      }
    }
  }

  // 3) Koble alle HMS-maler til flyten — idempotent via composite-unique
  const hmsMaler = await tx.reportTemplate.findMany({
    where: { projectId, domain: "hms" },
    select: { id: true },
  });
  for (const mal of hmsMaler) {
    await tx.dokumentflytMal.upsert({
      where: {
        dokumentflytId_templateId: {
          dokumentflytId: hmsFlyt.id,
          templateId: mal.id,
        },
      },
      create: { dokumentflytId: hmsFlyt.id, templateId: mal.id },
      update: {},
    });
  }
}

