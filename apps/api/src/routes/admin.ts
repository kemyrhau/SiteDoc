import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";

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

  // Hent alle prosjekter (kun sitedoc_admin)
  hentAlleProsjekter: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    const prosjekter = await ctx.prisma.project.findMany({
      include: {
        members: { select: { id: true, user: { select: { name: true, email: true } } } },
        dokumentflytParts: { select: { id: true } },
        organizationProjects: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Hent sjekkliste- og oppgavetellere per prosjekt
    const prosjektIder = prosjekter.map((p) => p.id);
    const [sjekklisteTellere, oppgaveTellere] = await Promise.all([
      ctx.prisma.checklist.groupBy({
        by: ["bestillerEnterpriseId"],
        _count: true,
        where: { bestillerEnterprise: { projectId: { in: prosjektIder } } },
      }),
      ctx.prisma.task.groupBy({
        by: ["bestillerEnterpriseId"],
        _count: true,
        where: { bestillerEnterprise: { projectId: { in: prosjektIder } } },
      }),
    ]);

    // Bygg enterprise→prosjekt-mapping
    const enterpriseProsjektMap = new Map<string, string>();
    for (const p of prosjekter) {
      for (const e of p.dokumentflytParts) {
        enterpriseProsjektMap.set(e.id, p.id);
      }
    }

    // Summer per prosjekt
    const sjekklistePerProsjekt = new Map<string, number>();
    const oppgavePerProsjekt = new Map<string, number>();
    for (const s of sjekklisteTellere) {
      const pid = enterpriseProsjektMap.get(s.bestillerEnterpriseId);
      if (pid) sjekklistePerProsjekt.set(pid, (sjekklistePerProsjekt.get(pid) ?? 0) + s._count);
    }
    for (const o of oppgaveTellere) {
      const pid = enterpriseProsjektMap.get(o.bestillerEnterpriseId);
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

  // Hent alle organisasjoner (kun sitedoc_admin)
  hentAlleOrganisasjoner: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.organization.findMany({
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        projects: {
          include: { project: { select: { id: true, name: true, projectNumber: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Opprett organisasjon (kun sitedoc_admin)
  opprettOrganisasjon: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      organizationNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organization.create({
        data: {
          name: input.name,
          organizationNumber: input.organizationNumber,
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

      return ctx.prisma.organizationProject.upsert({
        where: {
          organizationId_projectId: {
            organizationId: input.organizationId,
            projectId: input.projectId,
          },
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          projectId: input.projectId,
        },
      });
    }),

  // Opprett prosjekt med valgfri firmatilknytning (kun sitedoc_admin)
  opprettProsjekt: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      organizationId: z.string().uuid().optional(),
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

      const prosjekt = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          projectNumber: prosjektnummer,
          members: {
            create: {
              userId: ctx.userId!,
              role: "admin",
            },
          },
        },
      });

      if (input.organizationId) {
        await ctx.prisma.organizationProject.create({
          data: {
            organizationId: input.organizationId,
            projectId: prosjekt.id,
          },
        });
      }

      return prosjekt;
    }),

  // Hent prosjektdata-statistikk for slettevarsel (kun sitedoc_admin)
  hentProsjektStatistikk: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const entFilter = { bestillerEnterprise: { projectId: input.projectId } };
      const [sjekklister, oppgaver, maler, entrepriser, medlemmer, tegninger, mapper] = await Promise.all([
        ctx.prisma.checklist.count({ where: entFilter }),
        ctx.prisma.task.count({ where: entFilter }),
        ctx.prisma.reportTemplate.count({ where: { projectId: input.projectId } }),
        ctx.prisma.dokumentflytPart.count({ where: { projectId: input.projectId } }),
        ctx.prisma.projectMember.count({ where: { projectId: input.projectId } }),
        ctx.prisma.drawing.count({ where: { projectId: input.projectId } }),
        ctx.prisma.folder.count({ where: { projectId: input.projectId } }),
      ]);

      return { sjekklister, oppgaver, maler, entrepriser, medlemmer, tegninger, mapper };
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

      await ctx.prisma.organizationProject.deleteMany({
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
          organizationProjects: { none: {} },
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
          organizationProjects: { none: {} },
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

    return ctx.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Hent Enterprise uten organisasjon (standalone)
  hentStandaloneEnterprises: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.dokumentflytPart.findMany({
      select: {
        id: true,
        name: true,
        companyName: true,
        enterpriseNumber: true,
        project: { select: { id: true, name: true, projectNumber: true } },
        dokumentflytKoblinger: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });
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
      type: z.enum(["proadm", "hr", "gps", "smartdoc"]),
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
          apiKey: input.apiKey ?? null,
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

      // apiKey-logikk: undefined = behold, "" = slett, ny verdi = erstatt
      const oppdatertApiKey = input.apiKey === undefined
        ? undefined // behold eksisterende
        : input.apiKey === ""
          ? null // slett nøkkelen
          : input.apiKey; // ny verdi

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
});
