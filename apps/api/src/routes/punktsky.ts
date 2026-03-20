import { z } from "zod";
import { join } from "node:path";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { konverterPunktsky } from "../services/punktskyKonvertering";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export const punktskyRouter = router({
  // Hent alle punktskyer for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.pointCloud.findMany({
        where: {
          projectId: input.projectId,
          ...(input.buildingId ? { buildingId: input.buildingId } : {}),
        },
        include: {
          building: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Hent én punktsky med detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ps = await ctx.prisma.pointCloud.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          building: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, ps.projectId);
      return ps;
    }),

  // Opprett punktsky (start konvertering)
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const punktsky = await ctx.prisma.pointCloud.create({
        data: {
          projectId: input.projectId,
          buildingId: input.buildingId,
          name: input.name,
          description: input.description,
          fileUrl: input.fileUrl,
          fileType: input.fileType.toLowerCase(),
          fileSize: input.fileSize,
          conversionStatus: "pending",
        },
      });

      // Start asynkron konvertering
      const filSti = join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", ""));
      konverterPunktsky(filSti, input.name + "." + input.fileType, UPLOADS_DIR)
        .then(async (resultat) => {
          await ctx.prisma.pointCloud.update({
            where: { id: punktsky.id },
            data: {
              conversionStatus: resultat.feil ? "failed" : "done",
              conversionError: resultat.feil,
              potreeUrl: resultat.potreeUrl,
              pointCount: resultat.lasInfo?.punktAntall,
              hasClassification: resultat.lasInfo?.harKlassifisering ?? false,
              hasRgb: resultat.lasInfo?.harRgb ?? false,
              classifications: resultat.lasInfo?.klassifiseringer ?? undefined,
              boundingBox: resultat.lasInfo?.boundingBox ?? undefined,
            },
          });
          console.log(`[Punktsky] Konvertering fullført for ${punktsky.id}`);
        })
        .catch(async (err) => {
          console.error(`[Punktsky] Konvertering feilet for ${punktsky.id}:`, err);
          await ctx.prisma.pointCloud.update({
            where: { id: punktsky.id },
            data: {
              conversionStatus: "failed",
              conversionError: err instanceof Error ? err.message : "Ukjent feil",
            },
          });
        });

      return punktsky;
    }),

  // Hent konverteringsstatus
  hentKonverteringsStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ps = await ctx.prisma.pointCloud.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          projectId: true,
          conversionStatus: true,
          conversionError: true,
          potreeUrl: true,
          pointCount: true,
          hasClassification: true,
          hasRgb: true,
          classifications: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, ps.projectId);
      return ps;
    }),

  // Slett punktsky
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ps = await ctx.prisma.pointCloud.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, ps.projectId);
      return ctx.prisma.pointCloud.delete({ where: { id: input.id } });
    }),
});
