/**
 * WMO-værkoder → norsk tekst
 * Basert på WMO Code Table 4677 (forenklet)
 * Brukt av Open-Meteo API
 */
const VAERKODE_MAP: Record<number, string> = {
  0: "Klart",
  1: "Hovedsakelig klart",
  2: "Delvis skyet",
  3: "Overskyet",
  45: "Tåke",
  48: "Rimtåke",
  51: "Lett yr",
  53: "Moderat yr",
  55: "Tett yr",
  56: "Lett underkjølt yr",
  57: "Tett underkjølt yr",
  61: "Lett regn",
  63: "Moderat regn",
  65: "Kraftig regn",
  66: "Lett underkjølt regn",
  67: "Kraftig underkjølt regn",
  71: "Lett snøfall",
  73: "Moderat snøfall",
  75: "Kraftig snøfall",
  77: "Snøkorn",
  80: "Lett regnbyge",
  81: "Moderat regnbyge",
  82: "Kraftig regnbyge",
  85: "Lett snøbyge",
  86: "Kraftig snøbyge",
  95: "Tordenvær",
  96: "Tordenvær med lett hagl",
  99: "Tordenvær med kraftig hagl",
};

/**
 * Konverterer WMO-værkode til norsk tekst.
 * Returnerer "Ukjent" for ukjente koder.
 */
export function vaerkodeTilTekst(code: number): string {
  return VAERKODE_MAP[code] ?? "Ukjent";
}

/** Timesvis værserie fra Open-Meteo (samme form som `vaer.hentVaerdata` returnerer). */
export interface VaerHourly {
  time: string[];
  temperature_2m: (number | null)[];
  weather_code: (number | null)[];
  wind_speed_10m: (number | null)[];
  precipitation: (number | null)[];
}

/** Lagret værsnapshot på et weather-felt. */
export interface VaerSnapshot {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde: "automatisk";
}

/**
 * Finn indeksen i den timesvise værserien nærmest befaringens klokkeslett.
 * Open-Meteo returnerer 24 timer for datoen; vi plukker timen nærmest tidspunktet
 * brukeren fylte inn. Rent date-felt (uten klokkeslett) bruker kl. 12 som representant.
 */
export function finnVaerTimeIndeks(times: string[], tidspunkt: string): number {
  const harKlokke = tidspunkt.length >= 13 && tidspunkt[10] === "T";
  const maalTime = harKlokke ? parseInt(tidspunkt.slice(11, 13), 10) : 12;
  let beste = 0;
  let besteDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (!t || t.length < 13) continue;
    const diff = Math.abs(parseInt(t.slice(11, 13), 10) - maalTime);
    if (diff < besteDiff) {
      besteDiff = diff;
      beste = i;
    }
  }
  return beste;
}

/**
 * Bygg et værsnapshot fra en timesvis serie for et gitt befaringstidspunkt.
 * Temperatur/værkode/vind hentes for timen nærmest klokkeslettet; nedbør summeres
 * for hele dagen. Delt av web-hook, mobil-hook og mobil vær-kø.
 */
export function byggVaerSnapshot(
  hourly: VaerHourly,
  tidspunkt: string,
): VaerSnapshot {
  const indeks = finnVaerTimeIndeks(hourly.time, tidspunkt);
  const temp = hourly.temperature_2m[indeks];
  const vaerkode = hourly.weather_code[indeks];
  const vind = hourly.wind_speed_10m[indeks];
  const dagNedbor = hourly.precipitation.reduce(
    (sum: number, v: number | null) => sum + (v ?? 0),
    0,
  );
  return {
    temp: temp != null ? `${temp}°C` : undefined,
    conditions: vaerkode != null ? vaerkodeTilTekst(vaerkode) : undefined,
    wind: vind != null ? `${vind} m/s` : undefined,
    precipitation: `${Math.round(dagNedbor * 10) / 10} mm`,
    kilde: "automatisk",
  };
}
