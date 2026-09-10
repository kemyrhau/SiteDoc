/**
 * Standard prosjektoppsett-seeding (2026-09-10).
 *
 * Ett nytt prosjekt skal ha samme grunnoppsett uansett hvilken dør det kom inn
 * gjennom: standardgrupper (m/domener), prosjektmoduler + maler, standard
 * faggrupper og standard dokumentflyter. Malene er de samme konstantene fra
 * @sitedoc/shared som `opprettTestprosjekt` alltid har brukt.
 *
 * Bakgrunn: seedingen lå tidligere som en klient-side lazy-seed på Brukere-siden
 * (`opprettStandardgrupper.mutate()` når gruppelista var tom). Den falt ut som
 * kollateral i den 1600-linjers omskrivingen av brukere-siden (9a489876, 6. apr
 * 2026) — et uhell, ikke et vedtak. Etter det fikk prosjekter opprettet via
 * `prosjekt.opprett` og `admin.opprettProsjekt` ingen grupper/faggrupper/flyter
 * i det hele tatt. Denne funksjonen samler seedingen ett sted og kalles fra alle
 * tre veiene, så hullet ikke kan gjenoppstå per-vei.
 *
 * Kalles INNE i samme $transaction som prosjektopprettingen, ETTER at
 * oppretter-medlemmet er laget (Byggherre-koblingen slår opp medlemmet på
 * brukerId). Feiler seedingen, ruller hele opprettelsen tilbake.
 */
import { type Prisma } from "@sitedoc/db";
import {
  STANDARD_PROJECT_GROUPS,
  PROSJEKT_MODULER,
  STANDARD_FAGGRUPPER,
  STANDARD_DOKUMENTFLYTER,
} from "@sitedoc/shared";

type TxClient = Prisma.TransactionClient;

export async function seedStandardProsjektoppsett(
  tx: TxClient,
  projectId: string,
  brukerId: string,
): Promise<void> {
  // Idempotent: seed kun et tomt prosjekt. Speiler den opprinnelige klient-
  // lazy-seeden (`dbGrupper.length === 0` → seed) og gjør funksjonen trygg å
  // kalle to ganger uten å duplisere. Har prosjektet alt grupper, er det seedet.
  const finnesGrupper = await tx.projectGroup.count({ where: { projectId } });
  if (finnesGrupper > 0) return;

  // Standardgrupper (m/domener + permissions)
  for (const gruppe of STANDARD_PROJECT_GROUPS) {
    await tx.projectGroup.create({
      data: {
        projectId,
        name: gruppe.name,
        slug: gruppe.slug,
        category: gruppe.category,
        permissions: gruppe.permissions,
        domains: gruppe.domains,
        isDefault: true,
      },
    });
  }

  // Aktiver alle prosjektmoduler + deres maler (Godkjenning, HMS-avvik, Befaringsrapport)
  for (const modulDef of PROSJEKT_MODULER) {
    await tx.projectModule.create({
      data: { projectId, moduleSlug: modulDef.slug },
    });

    for (const malDef of modulDef.maler) {
      const mal = await tx.reportTemplate.create({
        data: {
          projectId,
          name: malDef.navn,
          description: malDef.beskrivelse,
          prefix: malDef.prefix,
          category: malDef.kategori,
          domain: malDef.domain,
          subjects: (malDef.emner ?? []) as Prisma.InputJsonValue,
        },
      });

      if (malDef.objekter.length > 0) {
        await tx.reportObject.createMany({
          data: malDef.objekter.map((obj) => ({
            templateId: mal.id,
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

  // Standard faggrupper
  const faggruppeIder: string[] = [];
  for (const fgDef of STANDARD_FAGGRUPPER) {
    const fg = await tx.faggruppe.create({
      data: {
        projectId,
        name: fgDef.navn,
        industry: fgDef.bransje,
        color: fgDef.farge,
        faggruppeNummer: fgDef.faggruppeNummer,
      },
    });
    faggruppeIder.push(fg.id);
  }

  // Koble oppretter til Byggherre-faggruppen (første)
  const medlem = await tx.projectMember.findFirst({
    where: { projectId, userId: brukerId },
  });
  if (medlem && faggruppeIder.length > 0) {
    await tx.faggruppeKobling.create({
      data: {
        projectMemberId: medlem.id,
        faggruppeId: faggruppeIder[0]!,
      },
    });
  }

  // Hent opprettede maler (for å koble til dokumentflyter via prefix)
  const opprettedeMaler = await tx.reportTemplate.findMany({
    where: { projectId },
    select: { id: true, prefix: true },
  });

  // Standard dokumentflyter
  for (const flytDef of STANDARD_DOKUMENTFLYTER) {
    const flyt = await tx.dokumentflyt.create({
      data: { projectId, name: flytDef.navn },
    });

    for (const idx of flytDef.oppretter) {
      if (idx < faggruppeIder.length) {
        await tx.dokumentflytMedlem.create({
          data: {
            dokumentflytId: flyt.id,
            faggruppeId: faggruppeIder[idx],
            rolle: "bestiller",
            steg: 1,
          },
        });
      }
    }

    for (const idx of flytDef.svarer) {
      if (idx < faggruppeIder.length) {
        await tx.dokumentflytMedlem.create({
          data: {
            dokumentflytId: flyt.id,
            faggruppeId: faggruppeIder[idx],
            rolle: "utforer",
            steg: 1,
          },
        });
      }
    }

    for (const prefix of flytDef.malPrefixer) {
      const mal = opprettedeMaler.find((m) => m.prefix === prefix);
      if (mal) {
        await tx.dokumentflytMal.create({
          data: { dokumentflytId: flyt.id, templateId: mal.id },
        });
      }
    }
  }
}
