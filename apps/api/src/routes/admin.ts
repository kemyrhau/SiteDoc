import { z } from "zod";
import { router, protectedProcedure, opprettProsjektProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma, krypter } from "@sitedoc/db";
import { hentAktiveFirmamoduler } from "../services/firmamodul";

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
        where: { bestillerFaggruppe: { projectId: { in: prosjektIder } } },
      }),
      ctx.prisma.task.groupBy({
        by: ["bestillerFaggruppeId"],
        _count: true,
        where: { bestillerFaggruppe: { projectId: { in: prosjektIder } } },
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

    // Steg 1e Fase B: berik med aktiveFirmamoduler fra OrganizationModule.
    const moduler = await ctx.prisma.organizationModule.findMany({
      where: {
        organizationId: { in: orgs.map((o) => o.id) },
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
    return orgs.map((o) => {
      const { members, ...rest } = o;
      return {
        ...rest,
        users: members.map((m) => m.user),
        aktiveFirmamoduler: perOrg.get(o.id) ?? [],
      };
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

      const prosjekt = await ctx.prisma.project.create({
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

      await ctx.prisma.projectOrganization.create({
        data: {
          organizationId: input.organizationId,
          projectId: prosjekt.id,
        },
      });

      return prosjekt;
    }),

  // Hent prosjektdata-statistikk for slettevarsel (kun sitedoc_admin)
  hentProsjektStatistikk: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const fgFilter = { bestillerFaggruppe: { projectId: input.projectId } };
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

      await ctx.prisma.session.update({
        where: { sessionToken: ctx.sessionToken },
        data: {
          impersonatedUserId: input.targetUserId,
          originalUserId: adminUserId,
          impersonationExpiresAt: utloperVed,
        },
      });

      // Audit-log: best-effort. Activity-tabellen krever projectId, så vi
      // bruker target sin organizationId og null projectId via raw query
      // — eller logger til console for nå.
      // eslint-disable-next-line no-console
      console.log(`[impersonering] start admin=${adminUserId} target=${input.targetUserId} utloper=${utloperVed.toISOString()}`);

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

    await ctx.prisma.session.update({
      where: { sessionToken: ctx.sessionToken },
      data: {
        impersonatedUserId: null,
        originalUserId: null,
        impersonationExpiresAt: null,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`[impersonering] stopp admin=${adminUserId}`);

    return { ok: true as const };
  }),
});
