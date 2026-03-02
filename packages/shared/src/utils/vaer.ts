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
