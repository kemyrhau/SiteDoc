import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  STANDARD_PROJECT_GROUPS,
  PERMISSIONS,
  createProjectGroupSchema,
  updateProjectGroupSchema,
  addGroupMemberByEmailSchema,
  utvidTillatelser,
} from "@sitedoc/shared";
import { sendInvitasjonsEpost } from "../services/epost";
import { TRPCError } from "@trpc/server";
import {
  verifiserAdmin,
  verifiserProsjektmedlem,
  hentBrukerTillatelser,
} from "../trpc/tilgangskontroll";

export const gruppeRouter = router({
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

      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
        include: {
          groupMemberships: {
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
            include: {
              projectMember: {
                include: {
                  user: true,
                  enterprises: { include: { enterprise: true } },
                },
              },
            },
          },
          groupEnterprises: {
            include: { enterprise: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
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
            include: {
              projectMember: {
                include: {
                  user: true,
                  enterprises: { include: { enterprise: true } },
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

  // Legg til medlem: finn/opprett bruker → finn/opprett ProjectMember → upsert GroupMember (krever admin)
  leggTilMedlem: protectedProcedure
    .input(addGroupMemberByEmailSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Finn eller opprett bruker
      let user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        user = await ctx.prisma.user.create({
          data: {
            email: input.email,
            name: `${input.firstName} ${input.lastName}`,
            phone: input.phone,
          },
        });
      } else if (!user.name) {
        user = await ctx.prisma.user.update({
          where: { id: user.id },
          data: {
            name: `${input.firstName} ${input.lastName}`,
            phone: input.phone ?? user.phone,
          },
        });
      }

      // Finn eller opprett ProjectMember
      let projectMember = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: input.projectId,
          },
        },
      });

      if (!projectMember) {
        projectMember = await ctx.prisma.projectMember.create({
          data: {
            userId: user.id,
            projectId: input.projectId,
            role: "member",
          },
        });
      }

      // Upsert GroupMember
      const gruppeMedlem = await ctx.prisma.projectGroupMember.upsert({
        where: {
          groupId_projectMemberId: {
            groupId: input.groupId,
            projectMemberId: projectMember.id,
          },
        },
        update: {},
        create: {
          groupId: input.groupId,
          projectMemberId: projectMember.id,
        },
        include: {
          projectMember: {
            include: {
              user: true,
              enterprises: { include: { enterprise: true } },
            },
          },
        },
      });

      // Send invitasjons-e-post hvis brukeren ikke har logget inn (ingen Account)
      const harKonto = await ctx.prisma.account.findFirst({
        where: { userId: user.id },
      });

      if (!harKonto) {
        try {
          const token = crypto.randomBytes(32).toString("base64url");
          const utloper = new Date();
          utloper.setDate(utloper.getDate() + 7);

          const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
            where: { id: input.projectId },
            select: { name: true },
          });

          const inviterer = await ctx.prisma.user.findUniqueOrThrow({
            where: { id: ctx.userId },
            select: { name: true },
          });

          // Sjekk om det allerede finnes en ventende invitasjon for denne e-posten og prosjektet
          const eksisterendeInvitasjon = await ctx.prisma.projectInvitation.findFirst({
            where: {
              email: user.email,
              projectId: input.projectId,
              status: "pending",
            },
          });

          if (!eksisterendeInvitasjon) {
            await ctx.prisma.projectInvitation.create({
              data: {
                email: user.email,
                token,
                projectId: input.projectId,
                role: "member",
                groupId: input.groupId,
                invitedByUserId: ctx.userId,
                expiresAt: utloper,
              },
            });

            await sendInvitasjonsEpost({
              til: user.email,
              invitasjonstoken: token,
              prosjektNavn: prosjekt.name,
              invitertAvNavn: inviterer.name ?? "En kollega",
              melding: input.melding,
            });
          }
        } catch (error) {
          console.error("Kunne ikke sende invitasjons-e-post:", error);
        }
      }

      return gruppeMedlem;
    }),

  // Fjern medlem fra gruppe (krever admin)
  fjernMedlem: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectGroupMember.delete({
        where: { id: input.id },
      });
    }),

  // Oppdater gruppens tilknyttede entrepriser (krever admin)
  oppdaterEntrepriser: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        enterpriseIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Slett eksisterende, opprett nye
      await ctx.prisma.groupEnterprise.deleteMany({
        where: { groupId: input.groupId },
      });

      if (input.enterpriseIds.length > 0) {
        await ctx.prisma.groupEnterprise.createMany({
          data: input.enterpriseIds.map((enterpriseId) => ({
            groupId: input.groupId,
            enterpriseId,
          })),
        });
      }

      return ctx.prisma.projectGroup.findUniqueOrThrow({
        where: { id: input.groupId },
        include: {
          groupEnterprises: { include: { enterprise: true } },
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
  oppdaterByggeplasser: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        projectId: z.string().uuid(),
        byggeplassIder: z.array(z.string().uuid()).nullable(), // null = alle
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      return ctx.prisma.projectGroup.update({
        where: { id: input.groupId },
        data: {
          byggeplassIder: input.byggeplassIder ?? Prisma.DbNull,
        },
      });
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
        where: { groupId: input.groupId, projectMemberId: input.projectMemberId },
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
        where: { userId: ctx.userId, projectId: input.projectId },
      });
      if (!medlem) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.projectGroupMember.deleteMany({
        where: { groupId: input.groupId, projectMemberId: medlem.id },
      });
    }),
});
