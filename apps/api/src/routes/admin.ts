import { z } from "zod";
import { router, protectedProcedure, opprettProsjektProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma, krypter } from "@sitedoc/db";
import { autoLeggFirmaAdmins } from "../services/autoProsjektAdmin";
import { hentBrukersOrg } from "../trpc/tilgangskontroll";
import { importerKatalog } from "../services/katalog/importerKatalog";
import { seedManglendeKatalog } from "../services/seed";
import { IKKE_SLETTET } from "../utils/softDelete";
import {
  klassifiserFirmaStatus,
  hentFirmaAktivitet,
  hentProsjektAktivitet,
} from "../services/firmaOversikt";

/**
 * Verifiser at bruker er SiteDoc-administrator.
 */
async function verifiserSiteDocAdmin(
  prisma: { user: { findUniqueOrThrow: (args: { where: { id: string }; select: { role: true } }) => Promise<{ role: string }> } },
  userId: string,
) {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });

  if (bruker.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Krever SiteDoc-administrator" });
  }
}

export const adminRouter = router({
  // Sjekk om innlogget bruker er sitedoc_admin
  erAdmin: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { role: true },
    });
    return bruker.role === "sitedoc_admin";
  }),

  // Seed manglende firmamodul-katalog for ÉN org (kun sitedoc_admin).
  // Cross-org driftsverktøy, ikke firma-selvbetjening. Idempotent, rører aldri
  // eksisterende data. SCOPE: kun expenseCategories (se seedManglendeKatalog).
  // Bakgrunn: A.Markussen (prod) har Timer aktiv + 44 importerte lønnsarter, men
  // 0 utleggskategorier → U3-velgerens UTLEGG-gruppe ville stått tom. seedTimer-
  // ForOrganization er aldri kjørt for dem. Kjøres målrettet i stedet for
  // aktiverNivaa1 (som ville injisert 16 seed-lønnsarter — seedNivaa-guarden ser
  // ikke import-lønnsartene). Navngitt oppfølger: robuste guarder + settFirmamodul-
  // wiring så stien dekker alle datatyper og alle firmamoduler.
  seedManglendeFirmakatalog: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      // Org må finnes — cross-org verktøy skal ikke skrive foreldreløse rader.
      const org = await ctx.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organisasjon finnes ikke" });
      }

      return seedManglendeKatalog(input.organizationId);
    }),

  // Hent alle prosjekter (kun sitedoc_admin).
  // Valgfri organizationId-filter — gjør at admin/prosjekter respekterer
  // FirmaVelger på samme måte som /dashbord (Blokk A 2026-05-04).
  hentAlleProsjekter: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    const prosjekter = await ctx.prisma.project.findMany({
      where: input?.organizationId
        ? { primaryOrganizationId: input.organizationId }
        : undefined,
      include: {
        members: { select: { id: true, user: { select: { name: true, email: true } } } },
        faggrupper: { select: { id: true } },
        primaryOrganization: { select: { id: true, name: true } },
        projectOrganizations: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Hent sjekkliste- og oppgavetellere per prosjekt
    const prosjektIder = prosjekter.map((p) => p.id);
    const [sjekklisteTellere, oppgaveTellere] = await Promise.all([
      ctx.prisma.checklist.groupBy({
        by: ["bestillerFaggruppeId"],
        _count: true,
        where: { ...IKKE_SLETTET, bestillerFaggruppe: { projectId: { in: prosjektIder } } },
      }),
      ctx.prisma.task.groupBy({
        by: ["bestillerFaggruppeId"],
        _count: true,
        where: { ...IKKE_SLETTET, bestillerFaggruppe: { projectId: { in: prosjektIder } } },
      }),
    ]);

    // Bygg faggruppe→prosjekt-mapping
    const faggruppeProsjektMap = new Map<string, string>();
    for (const p of prosjekter) {
      for (const e of p.faggrupper) {
        faggruppeProsjektMap.set(e.id, p.id);
      }
    }

    // Summer per prosjekt
    const sjekklistePerProsjekt = new Map<string, number>();
    const oppgavePerProsjekt = new Map<string, number>();
    for (const s of sjekklisteTellere) {
      const pid = s.bestillerFaggruppeId ? faggruppeProsjektMap.get(s.bestillerFaggruppeId) : undefined;
      if (pid) sjekklistePerProsjekt.set(pid, (sjekklistePerProsjekt.get(pid) ?? 0) + s._count);
    }
    for (const o of oppgaveTellere) {
      const pid = o.bestillerFaggruppeId ? faggruppeProsjektMap.get(o.bestillerFaggruppeId) : undefined;
      if (pid) oppgavePerProsjekt.set(pid, (oppgavePerProsjekt.get(pid) ?? 0) + o._count);
    }

    return prosjekter.map((p) => ({
      ...p,
      _count: {
        checklists: sjekklistePerProsjekt.get(p.id) ?? 0,
        tasks: oppgavePerProsjekt.get(p.id) ?? 0,
      },
    }));
  }),

  // Hent alle kunde-firmaer (kun sitedoc_admin). Skall-firmaer (erKunde=false)
  // filtreres ut — de er faggruppe-rader opprettet som Organization og hører
  // ikke hjemme i admin-vyen. Blokk C / P2 (2026-05-04).
  hentAlleOrganisasjoner: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    const orgs = await ctx.prisma.organization.findMany({
      where: { erKunde: true },
      include: {
        members: {
          select: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        projects: {
          include: { project: { select: { id: true, name: true, projectNumber: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const orgIds = orgs.map((o) => o.id);

    // Steg 1e Fase B: berik med aktiveFirmamoduler fra OrganizationModule.
    const moduler = await ctx.prisma.organizationModule.findMany({
      where: {
        organizationId: { in: orgIds },
        status: "aktiv",
      },
      select: { organizationId: true, moduleSlug: true },
    });
    const perOrg = new Map<string, string[]>();
    for (const m of moduler) {
      const liste = perOrg.get(m.organizationId) ?? [];
      liste.push(m.moduleSlug);
      perOrg.set(m.organizationId, liste);
    }

    // 1a-berikelse (2026-07-27): prosjekt-tellere (aktive + totalt) og sist
    // aktivitet. Prosjekt-tilhørighet regnes på primaryOrganizationId — samme
    // eierskaps-akse som detaljsidens prosjektliste.
    const [prosjektTellere, sistAktivitet] = await Promise.all([
      ctx.prisma.project.groupBy({
        by: ["primaryOrganizationId", "status"],
        where: { primaryOrganizationId: { in: orgIds } },
        _count: true,
      }),
      hentFirmaAktivitet(ctx.prisma, orgIds),
    ]);
    const aktivePerOrg = new Map<string, number>();
    const totaltPerOrg = new Map<string, number>();
    for (const rad of prosjektTellere) {
      const id = rad.primaryOrganizationId;
      if (!id) continue;
      totaltPerOrg.set(id, (totaltPerOrg.get(id) ?? 0) + rad._count);
      if (rad.status === "active") {
        aktivePerOrg.set(id, (aktivePerOrg.get(id) ?? 0) + rad._count);
      }
    }

    return orgs.map((o) => {
      const { members, ...rest } = o;
      return {
        ...rest,
        users: members.map((m) => m.user),
        aktiveFirmamoduler: perOrg.get(o.id) ?? [],
        status: klassifiserFirmaStatus(o),
        prosjekterAktive: aktivePerOrg.get(o.id) ?? 0,
        prosjekterTotalt: totaltPerOrg.get(o.id) ?? 0,
        sistAktivitet: sistAktivitet.get(o.id) ?? null,
      };
    });
  }),

  // Hent ett firma med detaljdata for firma-detaljsiden (1b). Tynne faner
  // (brukere/moduler/fakturering/innstillinger) er visninger av eksisterende
  // data — ingen ny forretningslogikk. Prosjekt-tellekort på primaryOrg.
  hentFirmaDetalj: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const org = await ctx.prisma.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          invoiceAddress: true,
          invoiceEmail: true,
          ehfEnabled: true,
          erKunde: true,
          createdAt: true,
        },
      });

      const [tellere, medlemmer, moduler, innstillinger] = await Promise.all([
        ctx.prisma.project.groupBy({
          by: ["status"],
          where: { primaryOrganizationId: input.organizationId },
          _count: true,
        }),
        ctx.prisma.organizationMember.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            ansattRolle: true,
            firmaRoller: true,
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.organizationModule.findMany({
          where: { organizationId: input.organizationId },
          select: { moduleSlug: true, status: true, aktivertVed: true, deaktivertVed: true },
          orderBy: { aktivertVed: "asc" },
        }),
        ctx.prisma.organizationSetting.findUnique({
          where: { organizationId: input.organizationId },
          select: {
            timezone: true,
            dagsnorm: true,
            timerTilgangDefault: true,
            vareforbrukTilgangDefault: true,
            maskinbrukTilgangDefault: true,
          },
        }),
      ]);

      let aktive = 0;
      let fullfortArkivert = 0;
      let deaktivert = 0;
      for (const t of tellere) {
        if (t.status === "active") aktive += t._count;
        else if (t.status === "deactivated") deaktivert += t._count;
        else fullfortArkivert += t._count; // archived + completed
      }

      return {
        ...org,
        status: klassifiserFirmaStatus(org),
        prosjektTellekort: { aktive, fullfortArkivert, deaktivert },
        brukere: medlemmer,
        moduler,
        innstillinger: innstillinger
          ? {
              timezone: innstillinger.timezone,
              dagsnorm: Number(innstillinger.dagsnorm),
              timerTilgangDefault: innstillinger.timerTilgangDefault,
              vareforbrukTilgangDefault: innstillinger.vareforbrukTilgangDefault,
              maskinbrukTilgangDefault: innstillinger.maskinbrukTilgangDefault,
            }
          : null,
      };
    }),

  // Paginert prosjektliste for ett firma (1b Prosjekter-fane). Server-side
  // paginering fra dag én — poenget er skala. Sort «sistAktivitet» bruker
  // Project.updatedAt som DB-proxy (indekserbar); DISPLAY-verdien merges med
  // Activity (Activity primær, updatedAt fallback) per rad. Activity er sparsom
  // for kjernemoduler, så avviket er lite — dokumentert i firmaOversikt.ts.
  hentProsjekterForFirma: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        søk: z.string().optional(),
        status: z.enum(["aktive", "arkiverte", "alle"]).default("aktive"),
        sortering: z.enum(["sistAktivitet", "navn", "opprettet"]).default("sistAktivitet"),
        page: z.number().int().min(1).default(1),
        take: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const statusFilter =
        input.status === "aktive"
          ? { status: "active" }
          : input.status === "arkiverte"
            ? { status: { in: ["archived", "completed", "deactivated"] } }
            : {};
      const søk = input.søk?.trim();
      const søkFilter = søk
        ? {
            OR: [
              { name: { contains: søk, mode: "insensitive" as const } },
              { projectNumber: { contains: søk, mode: "insensitive" as const } },
            ],
          }
        : {};
      const where: Prisma.ProjectWhereInput = {
        primaryOrganizationId: input.organizationId,
        ...statusFilter,
        ...søkFilter,
      };
      const orderBy: Prisma.ProjectOrderByWithRelationInput =
        input.sortering === "navn"
          ? { name: "asc" }
          : input.sortering === "opprettet"
            ? { createdAt: "desc" }
            : { updatedAt: "desc" };

      const [total, prosjekter] = await Promise.all([
        ctx.prisma.project.count({ where }),
        ctx.prisma.project.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.take,
          take: input.take,
          select: {
            id: true,
            name: true,
            projectNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            trialExpiresAt: true,
            members: { select: { id: true } },
          },
        }),
      ]);

      const projIds = prosjekter.map((p) => p.id);
      const faggrupper = await ctx.prisma.faggruppe.findMany({
        where: { projectId: { in: projIds } },
        select: { id: true, projectId: true },
      });
      const fgTilProsjekt = new Map(faggrupper.map((f) => [f.id, f.projectId]));
      const fgIds = faggrupper.map((f) => f.id);

      const [sjekk, oppg, aktivitet] = await Promise.all([
        ctx.prisma.checklist.groupBy({
          by: ["bestillerFaggruppeId"],
          _count: true,
          where: { ...IKKE_SLETTET, bestillerFaggruppeId: { in: fgIds } },
        }),
        ctx.prisma.task.groupBy({
          by: ["bestillerFaggruppeId"],
          _count: true,
          where: { ...IKKE_SLETTET, bestillerFaggruppeId: { in: fgIds } },
        }),
        hentProsjektAktivitet(ctx.prisma, projIds),
      ]);
      const sjekkPer = new Map<string, number>();
      const oppgPer = new Map<string, number>();
      for (const s of sjekk) {
        const pid = s.bestillerFaggruppeId ? fgTilProsjekt.get(s.bestillerFaggruppeId) : undefined;
        if (pid) sjekkPer.set(pid, (sjekkPer.get(pid) ?? 0) + s._count);
      }
      for (const o of oppg) {
        const pid = o.bestillerFaggruppeId ? fgTilProsjekt.get(o.bestillerFaggruppeId) : undefined;
        if (pid) oppgPer.set(pid, (oppgPer.get(pid) ?? 0) + o._count);
      }

      return {
        total,
        page: input.page,
        take: input.take,
        items: prosjekter.map((p) => ({
          id: p.id,
          name: p.name,
          projectNumber: p.projectNumber,
          status: p.status,
          trialExpiresAt: p.trialExpiresAt,
          antallMedlemmer: p.members.length,
          antallSjekklister: sjekkPer.get(p.id) ?? 0,
          antallOppgaver: oppgPer.get(p.id) ?? 0,
          sistAktivitet: aktivitet.get(p.id) ?? p.updatedAt,
        })),
      };
    }),

  // Opprett organisasjon (kun sitedoc_admin)
  opprettOrganisasjon: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      organizationNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      // erKunde: true — admin-vyen administrerer reelle kundefirma. Uten dette
      // faller raden til schema-default false og filtreres bort av
      // hentAlleOrganisasjoner (where: { erKunde: true }) → firmaet blir usynlig
      // selv om create lykkes (rotårsak «Opprett firma fungerer ikke», 2026-06-25).
      return ctx.prisma.organization.create({
        data: {
          name: input.name,
          organizationNumber: input.organizationNumber,
          erKunde: true,
        },
      });
    }),

  // Oppdater organisasjon (kun sitedoc_admin)
  oppdaterOrganisasjon: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      organizationNumber: z.string().optional().nullable(),
      invoiceAddress: z.string().optional().nullable(),
      invoiceEmail: z.string().email().optional().nullable(),
      ehfEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const { id, ...data } = input;
      return ctx.prisma.organization.update({
        where: { id },
        data,
      });
    }),

  // Tilknytt bruker til organisasjon + sett rolle (kun sitedoc_admin)
  settBrukerOrganisasjon: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      role: z.enum(["user", "company_admin"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const data: { organizationId: string | null; role?: string } = {
        organizationId: input.organizationId,
      };
      if (input.role) data.role = input.role;

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data,
      });
    }),

  // Tilknytt prosjekt til organisasjon (kun sitedoc_admin)
  tilknyttProsjekt: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.projectOrganization.upsert({
        where: {
          projectId_organizationId: {
            projectId: input.projectId,
            organizationId: input.organizationId,
          },
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          projectId: input.projectId,
        },
      });
    }),

  // Opprett prosjekt med firmatilknytning (kun sitedoc_admin)
  // 2026-05-20: firma påkrevd — alle kunder skal være registrert som firma.
  // Bugfix: primaryOrganizationId settes nå på Project.create (var tidligere
  // utelatt — prosjekter ble orphaned i admin-listens primær-filter selv om
  // admin valgte firma i dropdown).
  opprettProsjekt: opprettProsjektProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const antall = await ctx.prisma.project.count();
      const dato = new Date();
      const aar = dato.getFullYear();
      const mnd = String(dato.getMonth() + 1).padStart(2, "0");
      const dag = String(dato.getDate()).padStart(2, "0");
      const sekv = String(antall + 1).padStart(4, "0");
      const prosjektnummer = `SD-${aar}${mnd}${dag}-${sekv}`;

      return ctx.prisma.$transaction(async (tx) => {
        const prosjekt = await tx.project.create({
          data: {
            name: input.name,
            description: input.description,
            projectNumber: prosjektnummer,
            primaryOrganizationId: input.organizationId,
            members: {
              create: {
                userId: ctx.userId!,
                role: "admin",
              },
            },
          },
        });

        await tx.projectOrganization.create({
          data: {
            organizationId: input.organizationId,
            projectId: prosjekt.id,
          },
        });

        // B Kloss 2b: auto-legg firma-admins som prosjektadmin hvis firmaet
        // har slått på innstillingen. Dedup mot oppretteren (laget over).
        await autoLeggFirmaAdmins(tx, prosjekt.id, input.organizationId);

        return prosjekt;
      });
    }),

  // Hent prosjektdata-statistikk for slettevarsel (kun sitedoc_admin)
  hentProsjektStatistikk: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const fgFilter = { ...IKKE_SLETTET, bestillerFaggruppe: { projectId: input.projectId } };
      const [sjekklister, oppgaver, maler, faggrupper, medlemmer, tegninger, mapper] = await Promise.all([
        ctx.prisma.checklist.count({ where: fgFilter }),
        ctx.prisma.task.count({ where: fgFilter }),
        ctx.prisma.reportTemplate.count({ where: { projectId: input.projectId } }),
        ctx.prisma.faggruppe.count({ where: { projectId: input.projectId } }),
        ctx.prisma.projectMember.count({ where: { projectId: input.projectId } }),
        ctx.prisma.drawing.count({ where: { projectId: input.projectId } }),
        ctx.prisma.folder.count({ where: { projectId: input.projectId } }),
      ]);

      return { sjekklister, oppgaver, maler, faggrupper, medlemmer, tegninger, mapper };
    }),

  // Slett prosjekt med all data (kun sitedoc_admin)
  slettProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      await ctx.prisma.project.delete({
        where: { id: input.projectId },
      });

      return { ok: true };
    }),

  // Fjern prosjekt fra organisasjon (kun sitedoc_admin)
  fjernProsjektTilknytning: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      await ctx.prisma.projectOrganization.deleteMany({
        where: {
          organizationId: input.organizationId,
          projectId: input.projectId,
        },
      });

      return { ok: true };
    }),

  // Deaktiver og slett utløpte prøveprosjekter
  // 30+ dager → deaktiver (status: "deactivated"), 90+ dager → slett
  slettUtlopteProsjekter: protectedProcedure
    .mutation(async ({ ctx }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const nå = new Date();
      const slettGrense = new Date();
      slettGrense.setDate(slettGrense.getDate() - 60); // 60 dager etter utløp

      // Deaktiver prosjekter der prøveperioden har utløpt (trialExpiresAt < nå, eller createdAt + 30d < nå for eldre prosjekter)
      const deaktiverte = await ctx.prisma.project.updateMany({
        where: {
          projectOrganizations: { none: {} },
          status: "active",
          OR: [
            { trialExpiresAt: { lt: nå } },
            { trialExpiresAt: null, createdAt: { lt: new Date(nå.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
        data: { status: "deactivated" },
      });

      // Slett prosjekter der prøveperioden utløp for mer enn 60 dager siden
      const utlopte = await ctx.prisma.project.findMany({
        where: {
          projectOrganizations: { none: {} },
          OR: [
            { trialExpiresAt: { lt: slettGrense } },
            { trialExpiresAt: null, createdAt: { lt: new Date(slettGrense.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
        select: { id: true, name: true },
      });

      for (const p of utlopte) {
        await ctx.prisma.project.delete({ where: { id: p.id } });
      }

      return {
        deaktivert: deaktiverte.count,
        slettet: utlopte.length,
        prosjekter: utlopte,
      };
    }),

  // Forleng prøveperiode for et prosjekt
  forlengProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      dager: z.number().int().min(1).max(365),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { trialExpiresAt: true, createdAt: true, status: true },
      });

      // Beregn ny utløpsdato: forleng fra nåværende utløp eller fra nå (hvis allerede utløpt)
      const nåværendeUtløp = prosjekt.trialExpiresAt
        ?? new Date(prosjekt.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const basis = nåværendeUtløp > new Date() ? nåværendeUtløp : new Date();
      const nyUtløp = new Date(basis.getTime() + input.dager * 24 * 60 * 60 * 1000);

      await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: {
          trialExpiresAt: nyUtløp,
          // Reaktiver hvis deaktivert
          ...(prosjekt.status === "deactivated" ? { status: "active" } : {}),
        },
      });

      return { nyUtløp };
    }),

  // Hent alle brukere (kun sitedoc_admin)
  hentAlleBrukere: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    const users = await ctx.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const medlemmer = await ctx.prisma.organizationMember.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, organization: { select: { id: true, name: true } } },
    });
    const orgMap = new Map(medlemmer.map((m) => [m.userId, m.organization]));
    return users.map((u) => ({
      ...u,
      organizationId: orgMap.get(u.id)?.id ?? null,
      organization: orgMap.get(u.id) ?? null,
    }));
  }),

  // --------------------------------------------------------------------------
  // OrganizationIntegration CRUD (kun sitedoc_admin)
  // --------------------------------------------------------------------------

  hentIntegrasjonerForOrg: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const integrasjoner = await ctx.prisma.organizationIntegration.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
      });

      return integrasjoner.map((i) => ({
        id: i.id,
        type: i.type,
        url: i.url,
        harNøkkel: !!i.apiKey,
        config: i.config,
        aktiv: i.aktiv,
        createdAt: i.createdAt,
      }));
    }),

  opprettIntegrasjon: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      type: z.enum(["proadm", "hr", "gps", "smartdoc", "reginn"]),
      url: z.string().url().optional(),
      apiKey: z.string().optional(),
      config: z.record(z.unknown()).optional(),
      aktiv: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const integrasjon = await ctx.prisma.organizationIntegration.create({
        data: {
          organizationId: input.organizationId,
          type: input.type,
          url: input.url ?? null,
          apiKey: input.apiKey ? krypter(input.apiKey) : null,
          config: input.config ? (input.config as Prisma.InputJsonValue) : Prisma.JsonNull,
          aktiv: input.aktiv,
        },
      });

      return {
        id: integrasjon.id,
        type: integrasjon.type,
        url: integrasjon.url,
        harNøkkel: !!integrasjon.apiKey,
        config: integrasjon.config,
        aktiv: integrasjon.aktiv,
        createdAt: integrasjon.createdAt,
      };
    }),

  oppdaterIntegrasjon: protectedProcedure
    .input(z.object({
      id: z.string(),
      url: z.string().url().nullable().optional(),
      apiKey: z.string().optional(),
      config: z.record(z.unknown()).nullable().optional(),
      aktiv: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      // Verifiser at integrasjonen eksisterer
      const eksisterende = await ctx.prisma.organizationIntegration.findUnique({
        where: { id: input.id },
      });
      if (!eksisterende) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integrasjon ikke funnet" });
      }

      // apiKey-logikk: undefined = behold, "" = slett, ny verdi = erstatt (krypteres)
      const oppdatertApiKey = input.apiKey === undefined
        ? undefined // behold eksisterende
        : input.apiKey === ""
          ? null // slett nøkkelen
          : krypter(input.apiKey); // ny verdi (kryptert)

      const integrasjon = await ctx.prisma.organizationIntegration.update({
        where: { id: input.id },
        data: {
          url: input.url !== undefined ? input.url : undefined,
          apiKey: oppdatertApiKey !== undefined ? oppdatertApiKey : undefined,
          config: input.config !== undefined ? (input.config ? (input.config as Prisma.InputJsonValue) : Prisma.JsonNull) : undefined,
          aktiv: input.aktiv !== undefined ? input.aktiv : undefined,
        },
      });

      return {
        id: integrasjon.id,
        type: integrasjon.type,
        url: integrasjon.url,
        harNøkkel: !!integrasjon.apiKey,
        config: integrasjon.config,
        aktiv: integrasjon.aktiv,
        createdAt: integrasjon.createdAt,
      };
    }),

  slettIntegrasjon: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      // Verifiser at integrasjonen eksisterer
      const eksisterende = await ctx.prisma.organizationIntegration.findUnique({
        where: { id: input.id },
      });
      if (!eksisterende) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integrasjon ikke funnet" });
      }

      await ctx.prisma.organizationIntegration.delete({
        where: { id: input.id },
      });

      return { slettet: true };
    }),

  // --------------------------------------------------------------------------
  // Platform-konfigurasjon (read-only status, sitedoc-nivå)
  // --------------------------------------------------------------------------

  hentPlatformIntegrasjoner: protectedProcedure
    .query(async ({ ctx }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      return {
        vegvesen: {
          konfigurert: !!process.env.VEGVESEN_API_KEY,
          beskrivelse:
            "Statens Vegvesen — kjøretøyoppslag på regnummer. Felles platform-nøkkel.",
        },
        krypteringsnoekkel: {
          konfigurert: !!process.env.SITEDOC_INTEGRATION_KEY,
          beskrivelse:
            "Master-nøkkel for AES-256-GCM kryptering av OrganizationIntegration.apiKey.",
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Impersonering — sitedoc_admin "view as user". Augmented session-mønster:
  // Session.impersonatedUserId/originalUserId/impersonationExpiresAt settes
  // på admin-sin egen session-rad. Context bruker impersonatedUserId som
  // effektiv userId, men beholder actualUserId = admin for audit.
  // --------------------------------------------------------------------------

  hentImpersoneringStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.imperseringAktiv || !ctx.sessionToken) {
      return { aktiv: false } as const;
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return { aktiv: false } as const;
    const medlem = await ctx.prisma.organizationMember.findFirst({
      where: { userId: ctx.userId },
      select: { organization: { select: { id: true, name: true } } },
    });
    // Hent utløpstidspunkt for impersonering — slik at banner kan vise
    // countdown eller skjules automatisk ved utløp (klient-side oppfølger).
    const session = await ctx.prisma.session.findUnique({
      where: { sessionToken: ctx.sessionToken },
      select: { impersonationExpiresAt: true },
    });
    return {
      aktiv: true as const,
      target: {
        ...user,
        organizationId: medlem?.organization.id ?? null,
        organization: medlem ? { name: medlem.organization.name } : null,
      },
      utloperVed: session?.impersonationExpiresAt?.toISOString() ?? null,
    };
  }),

  startImpersonering: protectedProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verifisér at brukeren som starter er sitedoc_admin (basert på actualUserId
      // — hvis allerede impersonering aktiv, gates på admin-id, ikke imperserte).
      const adminUserId = ctx.actualUserId ?? ctx.userId;
      if (!adminUserId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      await verifiserSiteDocAdmin(ctx.prisma, adminUserId);

      if (input.targetUserId === adminUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan ikke impersonere seg selv",
        });
      }

      const target = await ctx.prisma.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true, role: true, name: true, email: true, canLogin: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bruker ikke funnet" });
      }
      if (target.role === "sitedoc_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kan ikke impersonere andre sitedoc-administratorer",
        });
      }
      if (!target.canLogin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bruker er deaktivert (canLogin = false)",
        });
      }

      // sessionToken hentes fra ctx (parsed i context.ts / route.ts) for å
      // unngå Fastify- vs fetch-Request-skille.
      if (!ctx.sessionToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Ingen aktiv sesjon funnet",
        });
      }

      const utloperVed = new Date(Date.now() + 60 * 60 * 1000); // 1 time

      const oppdatertSesjon = await ctx.prisma.session.update({
        where: { sessionToken: ctx.sessionToken },
        data: {
          impersonatedUserId: input.targetUserId,
          originalUserId: adminUserId,
          impersonationExpiresAt: utloperVed,
        },
        select: { id: true },
      });

      // Persistent audit-spor (Variant B, 2026-05-28) — erstatter console.log.
      // Defensiv .catch: audit-feil skal ikke blokkere selve impersoneringen
      // (Session er allerede oppdatert).
      const targetOrgId = await hentBrukersOrg(input.targetUserId).catch(() => null);
      await ctx.prisma.impersonationAudit
        .create({
          data: {
            adminUserId,
            targetUserId: input.targetUserId,
            targetOrganizationId: targetOrgId,
            sessionId: oppdatertSesjon.id,
            utloperVed,
          },
        })
        .catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[impersonering] audit INSERT feilet:", e);
        });

      return {
        ok: true as const,
        target: { id: target.id, name: target.name, email: target.email },
        utloperVed: utloperVed.toISOString(),
      };
    }),

  stoppImpersonering: protectedProcedure.mutation(async ({ ctx }) => {
    const adminUserId = ctx.actualUserId ?? ctx.userId;
    if (!adminUserId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!ctx.sessionToken) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const oppdatertSesjon = await ctx.prisma.session.update({
      where: { sessionToken: ctx.sessionToken },
      data: {
        impersonatedUserId: null,
        originalUserId: null,
        impersonationExpiresAt: null,
      },
      select: { id: true },
    });

    // Persistent audit-spor (Variant B, 2026-05-28) — markér siste aktive rad
    // for denne (admin, session) som manuelt avsluttet. Idempotent updateMany:
    // ingen rad oppdatert hvis ingen aktiv audit finnes (forsvarlig hvis
    // start-INSERT feilet defensivt eller raden allerede er ryddet av lazy
    // utløps-markering).
    await ctx.prisma.impersonationAudit
      .updateMany({
        where: {
          adminUserId,
          sessionId: oppdatertSesjon.id,
          avsluttetVed: null,
        },
        data: {
          avsluttetVed: new Date(),
          avsluttetGrunn: "manuell",
        },
      })
      .catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn("[impersonering] audit UPDATE feilet:", e);
      });

    return { ok: true as const };
  }),

  // Importer en firmaspesifikk timer-katalog (lønnsarter/aktiviteter/tillegg).
  // Kun sitedoc_admin — koder er firmaegne og skal aldri i en delt seed.
  // Kjør ALLTID dryRun=true mot sitedoc_test før prod. Kundedata leveres som
  // `katalog` (se apps/api/src/services/katalog/fixtures/).
  importerTimerKatalog: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        katalog: z.object({
          standardKode: z.string().optional(),
          lonnsarter: z.array(
            z.object({
              kode: z.string(),
              navn: z.string(),
              type: z.string(),
              tvungenKommentar: z.boolean().optional(),
              matchNavn: z.array(z.string()).optional(),
            }),
          ),
          aktiviteter: z.array(
            z.object({
              kode: z.string(),
              navn: z.string(),
              matchNavn: z.array(z.string()).optional(),
              internkostnad: z.number().optional(),
              prisMotKunde: z.number().optional(),
            }),
          ),
          tillegg: z.array(
            z.object({
              kode: z.string(),
              navn: z.string(),
              type: z.string(),
              tvungenKommentar: z.boolean().optional(),
              matchNavn: z.array(z.string()).optional(),
            }),
          ),
        }),
        dryRun: z.boolean().default(true),
        deaktiverUmatchedeLonnsarter: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      return importerKatalog(input.organizationId, input.katalog, {
        dryRun: input.dryRun,
        deaktiverUmatchede: {
          lonnsarter: input.deaktiverUmatchedeLonnsarter,
          aktiviteter: false,
          tillegg: false,
        },
        standardKode: input.katalog.standardKode,
      });
    }),

  // E2E-sweep (2026-08-12): sikkerhetsnett mot test-firma-søppel som teardown
  // ikke rakk (crash/avbrutt kjøring). Kjøres ved oppstart av E2E-suiten (ikke
  // cron). Sletter KUN `E2E`-prefiksede firmaer eldre enn ett døgn — 24t så en
  // parallell kjøring ikke sletter et firma en annen bruker akkurat nå — og kun
  // dem UTEN prosjekter (samme signatur som de akkumulerte: 0 prosjekter/medlemmer).
  // Cascade tar settings/moduler (som Kenneths manuelle DELETE).
  //
  // 🔴 Env-guard (samme mønster som migrate-gaten): aborter hvis DATABASE_URL ikke
  // peker på sitedoc_test. Endepunktet finnes også i prod-imaget, men guarden gjør
  // det til en no-op der — i tillegg til sitedoc_admin-gaten.
  sweepE2EFirmaer: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
    if (!process.env.DATABASE_URL?.includes("sitedoc_test")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "sweepE2EFirmaer kjører kun mot sitedoc_test",
      });
    }
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await ctx.prisma.organization.deleteMany({
      where: {
        name: { startsWith: "E2E" },
        createdAt: { lt: cutoff },
        projects: { none: {} }, // ingen projectOrganization-lenke
        primaryProjects: { none: {} }, // ingen primaryOrganizationId-lenke
      },
    });
    return { slettet: res.count };
  }),
});
