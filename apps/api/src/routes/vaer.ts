import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";

const openMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
  }),
});

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
      // Bruk archive-API for historiske datoer, forecast for fremtidige
      const iDag = new Date().toISOString().slice(0, 10);
      const erHistorisk = input.dato < iDag;
      const baseUrl = erHistorisk
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";

      const url = `${baseUrl}?latitude=${input.latitude}&longitude=${input.longitude}&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation&wind_speed_unit=ms&start_date=${input.dato}&end_date=${input.dato}`;

      try {
        const respons = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!respons.ok) return null;

        const data = await respons.json();
        return openMeteoResponseSchema.parse(data);
      } catch {
        // Feil stille — vær er ikke kritisk
        return null;
      }
    }),
});
