import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { hentVaerHourly } from "../services/vaer";

export const vaerRouter = router({
  hentVaerdata: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ input }) => {
      const hourly = await hentVaerHourly(input.latitude, input.longitude, input.dato);
      // Behold responsformen `{ hourly }` (klienter leser `vaerdata.hourly`).
      return hourly ? { hourly } : null;
    }),
});
