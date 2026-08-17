import { z } from "zod";
import type { VaerHourly } from "@sitedoc/shared";

const openMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
  }),
});

/**
 * Hent timesvis værserie fra Open-Meteo for én dato og koordinat.
 * Archive-API for historiske datoer, forecast for i dag/fremtid. Feiler stille
 * (→ null) — vær er aldri kritisk. Delt av `vaer`-ruta og finaliserings-resolveren
 * (funn d), så vær kan hentes server-side utenfor React.
 */
export async function hentVaerHourly(
  latitude: number,
  longitude: number,
  dato: string,
): Promise<VaerHourly | null> {
  const iDag = new Date().toISOString().slice(0, 10);
  const erHistorisk = dato < iDag;
  const baseUrl = erHistorisk
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const url = `${baseUrl}?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation&wind_speed_unit=ms&start_date=${dato}&end_date=${dato}`;

  try {
    const respons = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!respons.ok) return null;

    const data = await respons.json();
    return openMeteoResponseSchema.parse(data).hourly;
  } catch {
    // Feil stille — vær er ikke kritisk
    return null;
  }
}
