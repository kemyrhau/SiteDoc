import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc/trpc";
import { addMemberSchema } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import { sendInvitasjonsEpost } from "../services/epost";
import {
  verifiserAdmin,
  verifiserProsjektmedlem,
} from "../trpc/tilgangskontroll";

export const medlemRouter = router({
  // Hent alle medlemmer for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
          enterprises: {
            include: { enterprise: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Hent mine entrepriser i et prosjekt (for innlogget bruker)
  hentMineEntrepriser: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.userId,
            projectId: input.projectId,
          },
        },
        include: {
          enterprises: {
            include: { enterprise: true },
          },
        },
      });

      if (!medlem) return [];

      // Admin uten entreprise-tilknytning ser alle entrepriser
      if (medlem.role === "admin" && medlem.enterprises.length === 0) {
        const alle = await ctx.prisma.enterprise.findMany({
          where: { projectId: input.projectId },
          orderBy: { name: "asc" },
        });
        return alle;
      }

      return medlem.enterprises.map((me) => me.enterprise);
    }),

  // Legg til medlem i prosjekt (krever admin)
  leggTil: protectedProcedure
    .input(addMemberSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Slå opp bruker på e-post, opprett hvis ikke finnes
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

      // Sjekk om medlemskap allerede finnes
      const eksisterende = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: input.projectId,
          },
        },
      });

      if (eksisterende) {
        // Legg til nye entreprise-tilknytninger
        if (input.enterpriseIds.length > 0) {
          for (const entId of input.enterpriseIds) {
            await ctx.prisma.memberEnterprise.upsert({
              where: {
                projectMemberId_enterpriseId: {
                  projectMemberId: eksisterende.id,
                  enterpriseId: entId,
                },
              },
              create: {
                projectMemberId: eksisterende.id,
                enterpriseId: entId,
              },
              update: {},
            });
          }
        }
        return ctx.prisma.projectMember.findUnique({
          where: { id: eksisterende.id },
          include: {
            user: true,
            enterprises: { include: { enterprise: true } },
          },
        });
      }

      const nyMedlem = await ctx.prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: input.projectId,
          role: input.role,
          enterprises: {
            create: input.enterpriseIds.map((entId) => ({
              enterpriseId: entId,
            })),
          },
        },
        include: {
          user: true,
          enterprises: { include: { enterprise: true } },
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

          await ctx.prisma.projectInvitation.create({
            data: {
              email: user.email,
              token,
              projectId: input.projectId,
              role: input.role,
              enterpriseId: input.enterpriseIds[0] ?? undefined,
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
        } catch (error) {
          console.error("Kunne ikke sende invitasjons-e-post:", error);
        }
      }

      return nyMedlem;
    }),

  // Fjern medlem fra prosjekt (krever admin)
  fjern: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.delete({
        where: { id: input.id },
      });
    }),

  // Oppdater rolle på medlem (krever admin)
  oppdaterRolle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.enum(["member", "admin"]),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.update({
        where: { id: input.id },
        data: { role: input.role },
        include: {
          user: true,
          enterprises: { include: { enterprise: true } },
        },
      });
    }),

  // Oppdater medlem (navn, e-post, telefon, rolle)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["member", "admin"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.projectMember.findUniqueOrThrow({
        where: { id: input.id },
        include: { user: true },
      });

      // Oppdater User-felter
      const brukerOppdatering: { name?: string; email?: string; phone?: string | null } = {};
      if (input.name !== undefined) brukerOppdatering.name = input.name;
      if (input.phone !== undefined) brukerOppdatering.phone = input.phone || null;
      if (input.email !== undefined && input.email !== medlem.user.email) {
        const eksisterende = await ctx.prisma.user.findUnique({
          where: { email: input.email },
        });
        if (eksisterende) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "E-postadressen er allerede i bruk",
          });
        }
        brukerOppdatering.email = input.email;
      }

      if (Object.keys(brukerOppdatering).length > 0) {
        await ctx.prisma.user.update({
          where: { id: medlem.userId },
          data: brukerOppdatering,
        });
      }

      // Oppdater rolle hvis endret
      if (input.role !== undefined) {
        await ctx.prisma.projectMember.update({
          where: { id: input.id },
          data: { role: input.role },
        });
      }

      return ctx.prisma.projectMember.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: true,
          enterprises: { include: { enterprise: true } },
        },
      });
    }),

  // Tilknytt et eksisterende prosjektmedlem til en entreprise
  tilknyttEntreprise: protectedProcedure
    .input(
      z.object({
        projectMemberId: z.string().uuid(),
        enterpriseId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.memberEnterprise.upsert({
        where: {
          projectMemberId_enterpriseId: {
            projectMemberId: input.projectMemberId,
            enterpriseId: input.enterpriseId,
          },
        },
        create: {
          projectMemberId: input.projectMemberId,
          enterpriseId: input.enterpriseId,
        },
        update: {},
      });
    }),

  // Fjern et prosjektmedlem fra en entreprise (fjerner MemberEnterprise-kobling)
  fjernFraEntreprise: protectedProcedure
    .input(
      z.object({
        projectMemberId: z.string().uuid(),
        enterpriseId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.memberEnterprise.delete({
        where: {
          projectMemberId_enterpriseId: {
            projectMemberId: input.projectMemberId,
            enterpriseId: input.enterpriseId,
          },
        },
      });
    }),

  // Søk brukere på e-post (autocomplete)
  sokBrukere: protectedProcedure
    .input(z.object({ email: z.string().min(1), projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.user.findMany({
        where: {
          email: { contains: input.email, mode: "insensitive" },
        },
        take: 10,
        select: { id: true, name: true, email: true, image: true },
      });
    }),
});
