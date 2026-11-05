import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  STANDARD_PROJECT_GROUPS,
  PERMISSIONS,
  createProjectGroupSchema,
  updateProjectGroupSchema,
  utvidTillatelser,
} from "@sitedoc/shared";
import type { AdminNiva } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import {
  verifiserAdmin,
  verifiserProsjektmedlem,
  hentBrukerTillatelser,
  erFirmaAdminForProsjekt,
  hentProsjektRolleNivaa,
  erGruppeansvarlig,
  aktivtMedlemWhere,
  aktivtProsjektmedlemWhere,
} from "../trpc/tilgangskontroll";
import { gjenapneEllerOpprettProsjektmedlem, loggMedlemsendring } from "../services/prosjektmedlemskap";

export const gruppeRouter = router({
  // Hent innlogget brukers flyt-info (for utledMinRolle)
  hentMinFlytInfo: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const alleGruppeModuler = ["sjekklister", "oppgaver", "tegninger", "3d"];

      // sitedoc_admin
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker?.role === "sitedoc_admin") {
        return { userId: ctx.userId, projectMemberId: "", faggruppeIder: [], gruppeIder: [], erAdmin: true, adminNiva: "sitedoc" as const, moduler: alleGruppeModuler };
      }

      const medlem = await ctx.prisma.projectMember.findFirst({
        where: aktivtProsjektmedlemWhere(ctx.userId, input.projectId),
        include: {
          faggruppeKoblinger: { where: aktivtMedlemWhere, select: { faggruppeId: true } },
          groupMemberships: {
            where: aktivtMedlemWhere,
            select: {
              groupId: true,
              group: { select: { modules: true } },
            },
          },
        },
      });

      if (!medlem) {
        // Firma-admin i eierfirmaet uten ProjectMember-rad — se alt (deltakerfirma: nei).
        if (await erFirmaAdminForProsjekt(ctx.userId, input.projectId)) {
          // Kloss 2 (Kenneth-vedtak 2026-07-23): firma-admin er IKKE et flyt-admin-nivå →
          // adminNiva:null (flyt-menyen behandler dem som vanlig deltaker, fjerner fantom-
          // menyvalget). erAdmin beholdes true for prosjekt-synlighet/redigering (uendret).
          return { userId: ctx.userId, projectMemberId: "", faggruppeIder: [], gruppeIder: [], erAdmin: true, adminNiva: null, moduler: alleGruppeModuler };
        }
        throw new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem" });
      }

      // Admin ser alt
      const erAdmin = medlem.role === "admin";

      // Aggreger moduler fra alle grupper
      const moduler = erAdmin
        ? alleGruppeModuler
        : [...new Set(
            medlem.groupMemberships.flatMap((gm) => (gm.group.modules as string[]) ?? []),
          )];

      return {
        userId: ctx.userId,
        projectMemberId: medlem.id,
        faggruppeIder: medlem.faggruppeKoblinger.map((e) => e.faggruppeId),
        gruppeIder: medlem.groupMemberships.map((gm) => gm.groupId),
        erAdmin,
        // Kloss 2: prosjektadmin (ProjectMember.role="admin") = egen matrise-kolonne "prosjekt";
        // vanlig medlem = null. sitedoc håndteres i egen gren over.
        adminNiva: (erAdmin ? "prosjekt" : null) as AdminNiva,
        moduler,
      };
    }),

  // Hent innlogget brukers tillatelser i et prosjekt
  hentMineTillatelser: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      return Array.from(tillatelser);
    }),

  // Hent innlogget brukers tillatelser + domener i et prosjekt
  hentMinTilgang: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // sitedoc_admin har full tilgang
      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } });
      if (bruker?.role === "sitedoc_admin") {
        return {
          tillatelser: [...PERMISSIONS],
          domener: [],
          erAdmin: true,
        };
      }

      const medlem = await ctx.prisma.projectMember.findFirst({
        where: aktivtProsjektmedlemWhere(ctx.userId, input.projectId),
        include: {
          groupMemberships: {
            where: aktivtMedlemWhere,
            include: {
              group: { select: { permissions: true, domains: true } },
            },
          },
        },
      });

      if (!medlem) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem" });
      }

      const erAdmin = medlem.role === "admin";
      const domener = new Set<string>();
      let tillatelser: Set<string>;

      if (erAdmin) {
        tillatelser = new Set([...PERMISSIONS]);
      } else {
        const raTillatelser: string[] = [];
        for (const gm of medlem.groupMemberships) {
          for (const p of gm.group.permissions as string[]) raTillatelser.push(p);
          for (const d of gm.group.domains as string[]) domener.add(d);
        }
        tillatelser = utvidTillatelser(raTillatelser);
      }

      return {
        tillatelser: Array.from(tillatelser),
        domener: Array.from(domener),
        erAdmin,
      };
    }),

  // Hent alle grupper for et prosjekt med medlemmer
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.projectGroup.findMany({
        where: { projectId: input.projectId },
        include: {
          members: {
            // Bare aktive gruppemedlemmer hos aktive prosjektmedlemmer (L2b).
            where: { ...aktivtMedlemWhere, projectMember: aktivtMedlemWhere },
            include: {
              projectMember: {
                include: {
                  user: true,
                  faggruppeKoblinger: { where: aktivtMedlemWhere, include: { faggruppe: true } },
                },
              },
            },
          },
          groupFaggrupper: {
            include: { faggruppe: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Firma HMS-ansvarlige for prosjektets org(er) — behandler-leddets firmakilde (§2,
  // Ordre 2.1). Leser OrganizationMember.firmaRoller="hms_ansvarlig". Server eier
  // firma-grensen: KUN org(er) prosjektet faktisk er koblet til via ProjectOrganization
  // — aldri hele plattformen. Read-only kilde; suppleres per prosjekt via HMS-gruppa.
  hentHmsAnsvarlige: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const orgKoblinger = await ctx.prisma.projectOrganization.findMany({
        where: { projectId: input.projectId },
        select: { organizationId: true },
      });
      const orgIder = orgKoblinger.map((o) => o.organizationId);
      if (orgIder.length === 0) return [];

      // Ordre (9) / L3: deaktivert ansatt er ikke lenger behandler.
      const medlemmer = await ctx.prisma.organizationMember.findMany({
        where: {
          organizationId: { in: orgIder },
          firmaRoller: { has: "hms_ansvarlig" },
          status: "aktiv",
        },
        select: {
          userId: true,
          organizationId: true,
          organization: { select: { name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // kanFjerne: rollen settes av firma-admin i firmaet som ga den (samme regel som
      // organisasjon.settFirmaHmsAnsvarlig, som avgjør på nytt ved fjerning).
      const [meg, mineAdminOrger] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } }),
        ctx.prisma.organizationMember.findMany({
          where: { userId: ctx.userId, organizationId: { in: orgIder }, status: "aktiv", firmaRoller: { has: "firma_admin" } },
          select: { organizationId: true },
        }),
      ]);
      const adminOrger = new Set(mineAdminOrger.map((m) => m.organizationId));
      const kanFjerneI = (orgId: string) => meg?.role === "sitedoc_admin" || adminOrger.has(orgId);

      // Dedup på userId (samme person kan ligge i flere av prosjektets org-koblinger);
      // raden fra et firma brukeren administrerer vinner, så fjern-valget ikke forsvinner.
      const sett = new Map<
        string,
        { userId: string; navn: string | null; epost: string; organizationId: string; organisasjonNavn: string; kanFjerne: boolean }
      >();
      for (const m of medlemmer) {
        const rad = {
          userId: m.userId,
          navn: m.user.name,
          epost: m.user.email,
          organizationId: m.organizationId,
          organisasjonNavn: m.organization.name,
          kanFjerne: kanFjerneI(m.organizationId),
        };
        if (!sett.get(m.userId)?.kanFjerne) sett.set(m.userId, rad);
      }
      return [...sett.values()];
    }),

  // Idempotent opprettelse av standardgrupper (krever admin)
  opprettStandardgrupper: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const opprettet = [];

      for (const gruppe of STANDARD_PROJECT_GROUPS) {
        const eksisterende = await ctx.prisma.projectGroup.findUnique({
          where: {
            projectId_slug: {
              projectId: input.projectId,
              slug: gruppe.slug,
            },
          },
        });

        if (!eksisterende) {
          const ny = await ctx.prisma.projectGroup.create({
            data: {
              projectId: input.projectId,
              name: gruppe.name,
              slug: gruppe.slug,
              category: gruppe.category,
              permissions: gruppe.permissions,
              domains: gruppe.domains,
              isDefault: true,
            },
          });
          opprettet.push(ny);
        }
      }

      return opprettet;
    }),

  // Opprett egendefinert gruppe (krever admin)
  opprett: protectedProcedure
    .input(createProjectGroupSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const slug =
        input.slug ??
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9æøå]+/g, "-")
          .replace(/^-|-$/g, "");

      return ctx.prisma.projectGroup.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          slug,
          category: input.category,
          permissions: [],
          isDefault: false,
        },
        include: {
          members: {
            // Bare aktive gruppemedlemmer hos aktive prosjektmedlemmer (L2b).
            where: { ...aktivtMedlemWhere, projectMember: aktivtMedlemWhere },
            include: {
              projectMember: {
                include: {
                  user: true,
                  faggruppeKoblinger: { where: aktivtMedlemWhere, include: { faggruppe: true } },
                },
              },
            },
          },
        },
      });
    }),

  // Oppdater gruppenavn (krever admin)
  oppdater: protectedProcedure
    .input(updateProjectGroupSchema.extend({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectGroup.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Slett gruppe (kun egendefinerte, ikke isDefault) — krever admin
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const gruppe = await ctx.prisma.projectGroup.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (gruppe.isDefault) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan ikke slette standardgrupper",
        });
      }

      return ctx.prisma.projectGroup.delete({
        where: { id: input.id },
      });
    }),

  // Fjern medlem fra gruppe (krever admin)
  fjernMedlem: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Prosjektadmin ELLER gruppeansvarlig for gruppa medlemmet ligger i.
      // hentProsjektRolleNivaa kjører ansettelses-/frysevaktene (kaster ved behov)
      // uten å kaste på «ikke admin», så gruppeansvarlig slipper gjennom.
      const { erAdmin } = await hentProsjektRolleNivaa(ctx.userId!, input.projectId);
      // Aktiv rad i dette prosjektet — en avsluttet rad eller annet prosjekt gir NOT_FOUND.
      const gm = await ctx.prisma.projectGroupMember.findFirst({
        where: { id: input.id, group: { projectId: input.projectId }, ...aktivtMedlemWhere },
        select: { groupId: true, projectMemberId: true },
      });
      if (!gm) throw new TRPCError({ code: "NOT_FOUND" });
      if (!erAdmin && !(await erGruppeansvarlig(ctx.userId!, input.projectId, gm.groupId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Du kan bare fjerne medlemmer fra grupper du er gruppeansvarlig for",
        });
      }

      // Myk (L2b B8): raden avsluttes og står som historikk; meldMegInn/registrer gjenåpner den.
      return ctx.prisma.$transaction(async (tx) => {
        const avsluttet = await tx.projectGroupMember.update({
          where: { id: input.id },
          data: { periodeSlutt: new Date() },
        });
        await loggMedlemsendring(tx, ctx, {
          projectId: input.projectId,
          targetType: "gruppe_medlem",
          targetId: input.id,
          action: "gruppemedlem_avsluttet",
          payload: { groupId: gm.groupId, projectMemberId: gm.projectMemberId },
        });
        return avsluttet;
      });
    }),

  // Oppdater gruppens tilknyttede faggrupper (krever admin)
  oppdaterFaggrupper: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        faggruppeIder: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Slett eksisterende, opprett nye
      await ctx.prisma.groupFaggruppe.deleteMany({
        where: { groupId: input.groupId },
      });

      if (input.faggruppeIder.length > 0) {
        await ctx.prisma.groupFaggruppe.createMany({
          data: input.faggruppeIder.map((faggruppeId) => ({
            groupId: input.groupId,
            faggruppeId,
          })),
        });
      }

      return ctx.prisma.projectGroup.findUniqueOrThrow({
        where: { id: input.groupId },
        include: {
          groupFaggrupper: { include: { faggruppe: true } },
        },
      });
    }),

  // Oppdater gruppens fagområder (krever admin)
  oppdaterDomener: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        domains: z.array(z.enum(["bygg", "hms", "kvalitet"])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectGroup.update({
        where: { id: input.groupId },
        data: { domains: input.domains },
      });
    }),

  // Oppdater moduler for en gruppe
  oppdaterModuler: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        modules: z.array(z.enum(["sjekklister", "oppgaver", "tegninger", "3d"])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      return ctx.prisma.projectGroup.update({
        where: { id: input.groupId },
        data: { modules: input.modules },
      });
    }),

  // Oppdater byggeplassfilter for en gruppe
  // Per Fase 0.5 § 3: bruker ProjectGroupByggeplass m2m-koblingstabell
  // (erstatter dødt building_ids jsonb). Semantikk: tom array = alle byggeplasser.
  oppdaterByggeplasser: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        byggeplassIder: z.array(z.string().uuid()).nullable(), // null/[] = alle byggeplasser
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const nyeIder = input.byggeplassIder ?? [];
      return ctx.prisma.$transaction([
        ctx.prisma.projectGroupByggeplass.deleteMany({
          where: { groupId: input.groupId },
        }),
        ctx.prisma.projectGroupByggeplass.createMany({
          data: nyeIder.map((byggeplassId) => ({
            groupId: input.groupId,
            byggeplassId,
          })),
          skipDuplicates: true,
        }),
      ]);
    }),

  // Sett gruppeadmin
  settGruppeAdmin: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        projectMemberId: z.string().uuid(),
        isAdmin: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const medlem = await ctx.prisma.projectGroupMember.findFirst({
        where: {
          groupId: input.groupId,
          projectMemberId: input.projectMemberId,
          group: { projectId: input.projectId },
          ...aktivtMedlemWhere,
        },
      });
      if (!medlem) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.projectGroupMember.update({
        where: { id: medlem.id },
        data: { isAdmin: input.isAdmin },
      });
    }),

  // Fjern seg selv fra en gruppe
  fjernSegSelv: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, ...aktivtMedlemWhere },
      });
      if (!medlem) throw new TRPCError({ code: "NOT_FOUND" });
      // Myk (L2b B8): aktiv rad avsluttes; `count` som før (deleteMany-formen).
      const rad = await ctx.prisma.projectGroupMember.findFirst({
        where: { groupId: input.groupId, projectMemberId: medlem.id, ...aktivtMedlemWhere },
        select: { id: true },
      });
      if (!rad) return { count: 0 };
      return ctx.prisma.$transaction(async (tx) => {
        await tx.projectGroupMember.update({ where: { id: rad.id }, data: { periodeSlutt: new Date() } });
        await loggMedlemsendring(tx, ctx, {
          projectId: input.projectId,
          targetType: "gruppe_medlem",
          targetId: rad.id,
          action: "gruppemedlem_avsluttet",
          payload: { groupId: input.groupId, projectMemberId: medlem.id, selv: true },
        });
        return { count: 1 };
      });
    }),

  // Meld innlogget bruker inn som medlem av en gruppe (ett-klikks selv-innmelding).
  // Brukt av «Meld meg inn»-banneret (Funn H) for å bli HMS-behandler. Å bli behandler
  // er en rettighets-tildeling, ikke en visning → serveren håndhever admin-nivå
  // (sitedoc_admin / firma-admin på prosjektets org / ProjectMember.role="admin") via
  // verifiserAdmin, ikke bare UI-et. Speiler fjernSegSelv (motsatt retning).
  meldMegInn: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Gruppen må tilhøre prosjektet (hindrer kryss-prosjekt-innmelding)
      const gruppe = await ctx.prisma.projectGroup.findFirst({
        where: { id: input.groupId, projectId: input.projectId },
        select: { id: true },
      });
      if (!gruppe) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Gruppen finnes ikke i dette prosjektet",
        });
      }

      // Finn eller opprett kallerens ProjectMember — firma-admin/sitedoc_admin kan
      // mangle rad (de arver prosjekttilgang uten ProjectMember). En behandler MÅ
      // ha en ProjectMember å knytte gruppemedlemskapet til. En avsluttet rad gjenåpnes (L2b B8).
      return ctx.prisma.$transaction(async (tx) => {
        const projectMember = await gjenapneEllerOpprettProsjektmedlem(tx, {
          userId: ctx.userId,
          projectId: input.projectId,
          role: "member",
        });
        return tx.projectGroupMember.upsert({
          where: {
            groupId_projectMemberId: {
              groupId: input.groupId,
              projectMemberId: projectMember.id,
            },
          },
          update: { periodeSlutt: null },
          create: { groupId: input.groupId, projectMemberId: projectMember.id },
        });
      });
    }),
});
