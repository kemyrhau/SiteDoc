import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";

export const bildeRouter = router({
  opprettForSjekkliste: protectedProcedure
    .input(
      z.object({
        checklistId: z.string().uuid(),
        fileUrl: z.string(),
        fileName: z.string(),
        fileSize: z.number().int(),
        gpsLat: z.number().optional(),
        gpsLng: z.number().optional(),
        gpsEnabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.image.create({
        data: {
          checklistId: input.checklistId,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileSize: input.fileSize,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
          gpsEnabled: input.gpsEnabled,
        },
      });
    }),
});
