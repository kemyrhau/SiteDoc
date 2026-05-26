/**
 * Engangs-backfill: seed manglende SJA + RUH-maler på alle prosjekter som
 * har hms-avvik-modul aktiv. Speil av seedHmsModulOmradet-logikken i
 * apps/api/src/routes/modul.ts, men kjørt offline mot eksisterende prosjekter.
 *
 * Bruk:
 *   pnpm --filter @sitedoc/api exec tsx scripts/backfill-hms-maler.ts
 *
 * Idempotent: prefix-sjekk hopper over allerede-opprettede maler.
 */

import { prisma } from "@sitedoc/db";
import type { Prisma } from "@sitedoc/db";
import { PROSJEKT_MODULER } from "@sitedoc/shared";

async function main() {
  const hmsModul = PROSJEKT_MODULER.find((m) => m.slug === "hms-avvik");
  if (!hmsModul) {
    console.error("Fant ikke hms-avvik i PROSJEKT_MODULER");
    process.exit(1);
  }

  const aktive = await prisma.projectModule.findMany({
    where: { moduleSlug: "hms-avvik", status: "aktiv" },
    select: { projectId: true, project: { select: { name: true } } },
  });

  console.log(`Fant ${aktive.length} prosjekt(er) med hms-avvik aktiv\n`);

  for (const pm of aktive) {
    const projectId = pm.projectId;
    const navn = pm.project.name;
    console.log(`→ ${navn} (${projectId})`);

    await prisma.$transaction(async (tx) => {
      // Finn HMS-gruppe
      let hmsGruppe = await tx.projectGroup.findFirst({
        where: { projectId, domains: { array_contains: ["hms"] } },
        select: { id: true },
      });
      if (!hmsGruppe) {
        hmsGruppe = await tx.projectGroup.create({
          data: {
            projectId,
            name: "HMS-ansvarlige",
            slug: "hms-ansvarlige",
            category: "field",
            domains: ["hms"],
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
        console.log("  + opprettet HMS-gruppe");
      }

      // Finn HMS-flyt
      let hmsFlyt = await tx.dokumentflyt.findFirst({
        where: { projectId, maler: { some: { template: { domain: "hms" } } } },
        select: { id: true },
      });
      if (!hmsFlyt) {
        hmsFlyt = await tx.dokumentflyt.create({
          data: { projectId, name: "HMS" },
          select: { id: true },
        });
        await tx.dokumentflytMedlem.create({
          data: { dokumentflytId: hmsFlyt.id, rolle: "bestiller", steg: 1 },
        });
        await tx.dokumentflytMedlem.create({
          data: {
            dokumentflytId: hmsFlyt.id,
            rolle: "utforer",
            steg: 2,
            groupId: hmsGruppe.id,
          },
        });
        console.log("  + opprettet HMS-flyt");
      }

      // Backfill manglende maler
      for (const malDef of hmsModul.maler) {
        const finnes = await tx.reportTemplate.findFirst({
          where: { projectId, prefix: malDef.prefix },
          select: { id: true },
        });
        if (finnes) {
          // Eksisterende — sett subdomain/hmsSynlighet hvis null (post-PR1-backfill var generisk)
          await tx.reportTemplate.update({
            where: { id: finnes.id },
            data: {
              subdomain: malDef.subdomain ?? null,
              hmsSynlighet: malDef.hmsSynlighet ?? null,
            },
          });
          console.log(`  · ${malDef.prefix} finnes — oppdaterte subdomain=${malDef.subdomain ?? "null"}`);
          continue;
        }
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
        console.log(`  + opprettet mal ${malDef.prefix} (${malDef.navn})`);

        // Koble til HMS-flyt
        await tx.dokumentflytMal.upsert({
          where: {
            dokumentflytId_templateId: {
              dokumentflytId: hmsFlyt.id,
              templateId: nyMal.id,
            },
          },
          create: { dokumentflytId: hmsFlyt.id, templateId: nyMal.id },
          update: {},
        });
      }
    });
  }

  console.log("\nFerdig");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
