import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";

const openMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
  }),
});

export const vaerRouter = router({
  hentVaerdata: publicProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ input }) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${input.latitude}&longitude=${input.longitude}&hourly=temperature_2m,weather_code,wind_speed_10m&start_date=${input.dato}&end_date=${input.dato}`;

      const respons = await fetch(url);
      if (!respons.ok) {
        throw new Error(`Open-Meteo feilet: ${respons.status}`);
      }

      const data = await respons.json();
      return openMeteoResponseSchema.parse(data);
    }),
});
