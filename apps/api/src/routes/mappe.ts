import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { settMappeTilgangSchema } from "@sitedoc/shared/validation";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const mappeRouter = router({
  // Hent alle mapper for et prosjekt (flat liste med parentId + tilgangsoppføringer)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.folder.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { documents: true } },
          accessEntries: {
            include: {
              enterprise: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny mappe
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        parentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.folder.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId ?? null,
        },
      });
    }),

  // Oppdater mappe (gi nytt navn)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Slett mappe (kaskaderer til undermapper og dokumenter)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.delete({ where: { id: input.id } });
    }),

  // Hent dokumenter for en mappe
  hentDokumenter: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.document.findMany({
        where: { folderId: input.folderId },
        orderBy: { name: "asc" },
      });
    }),

  // Hent tilgangskonfigurasjon for én mappe
  hentTilgang: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappeForTilgang = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappeForTilgang.projectId);
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: {
          id: true,
          accessMode: true,
          accessEntries: {
            include: {
              enterprise: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      return mappe;
    }),

  // Sett tilgang for en mappe (erstatter alle oppføringer)
  settTilgang: protectedProcedure
    .input(settMappeTilgangSchema)
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.$transaction(async (tx) => {
        // Oppdater accessMode
        await tx.folder.update({
          where: { id: input.folderId },
          data: { accessMode: input.accessMode },
        });

        // Slett alle eksisterende oppføringer
        await tx.folderAccess.deleteMany({
          where: { folderId: input.folderId },
        });

        // Opprett nye oppføringer (kun for custom-modus)
        if (input.accessMode === "custom" && input.entries.length > 0) {
          await tx.folderAccess.createMany({
            data: input.entries.map((entry) => ({
              folderId: input.folderId,
              accessType: entry.accessType,
              enterpriseId: entry.enterpriseId ?? null,
              groupId: entry.groupId ?? null,
              userId: entry.userId ?? null,
            })),
          });
        }

        // Returner oppdatert mappe med tilgangsoppføringer
        return tx.folder.findUniqueOrThrow({
          where: { id: input.folderId },
          include: {
            accessEntries: {
              include: {
                enterprise: { select: { id: true, name: true, color: true } },
                group: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });
      });
    }),

  lastOppDokument: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        name: z.string().min(1),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.document.create({
        data: {
          folderId: input.folderId,
          name: input.name,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
          fileSize: input.fileSize,
        },
      });
    }),
});
