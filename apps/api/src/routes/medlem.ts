import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { addMemberSchema } from "@siteflow/shared";

export const medlemRouter = router({
  // Hent alle medlemmer for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: {
          user: true,
          enterprise: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Legg til medlem i prosjekt
  leggTil: publicProcedure
    .input(addMemberSchema)
    .mutation(async ({ ctx, input }) => {
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
        // Oppdater entreprisetilknytning hvis oppgitt
        if (input.enterpriseId) {
          return ctx.prisma.projectMember.update({
            where: { id: eksisterende.id },
            data: { enterpriseId: input.enterpriseId },
            include: { user: true, enterprise: true },
          });
        }
        return ctx.prisma.projectMember.findUnique({
          where: { id: eksisterende.id },
          include: { user: true, enterprise: true },
        });
      }

      return ctx.prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: input.projectId,
          role: input.role,
          enterpriseId: input.enterpriseId,
        },
        include: { user: true, enterprise: true },
      });
    }),

  // Fjern medlem fra prosjekt
  fjern: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectMember.delete({
        where: { id: input.id },
      });
    }),

  // Oppdater rolle på medlem
  oppdaterRolle: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.enum(["member", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectMember.update({
        where: { id: input.id },
        data: { role: input.role },
        include: { user: true, enterprise: true },
      });
    }),

  // Søk brukere på e-post (autocomplete)
  sokBrukere: publicProcedure
    .input(z.object({ email: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: {
          email: { contains: input.email, mode: "insensitive" },
        },
        take: 10,
        select: { id: true, name: true, email: true, image: true },
      });
    }),
});
