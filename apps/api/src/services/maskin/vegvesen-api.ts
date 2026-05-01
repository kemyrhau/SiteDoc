/**
 * HTTP-klient mot Statens vegvesen kjøretøyoppslag-API.
 *
 * Endepunkt: /ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata
 * Header: SVV-Authorization: Apikey <nøkkel>
 * Rate-limit: 50/t per IP (hard grense fra Vegvesen)
 *
 * Throws strukturerte feil som tRPC-laget kan mappe til riktig TRPCError.
 */
import { normaliserRegnummer } from "@sitedoc/shared";

const VEGVESEN_BASE_URL =
  "https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata";

export class VegvesenApiNokkelMangler extends Error {
  constructor() {
    super("VEGVESEN_API_KEY mangler i miljøvariabler");
    this.name = "VegvesenApiNokkelMangler";
  }
}

export class VegvesenIkkeFunnetError extends Error {
  constructor(public regnummer: string) {
    super(`Kjøretøy ${regnummer} ikke funnet i Vegvesens register`);
    this.name = "VegvesenIkkeFunnetError";
  }
}

export class VegvesenRateLimitError extends Error {
  constructor(public retryAfterSekunder: number) {
    super(`Vegvesen-API rate-limit overskredet, prøv igjen om ${retryAfterSekunder}s`);
    this.name = "VegvesenRateLimitError";
  }
}

export class VegvesenApiError extends Error {
  constructor(public status: number, public detalj: string) {
    super(`Vegvesen-API feilet (${status}): ${detalj}`);
    this.name = "VegvesenApiError";
  }
}

/**
 * Hent rå kjøretøy-data fra Vegvesen.
 * Returnerer parsed JSON-objekt slik Vegvesen leverer det.
 */
export async function hentKjoretoyData(regnummer: string): Promise<unknown> {
  const apiKey = process.env.VEGVESEN_API_KEY;
  if (!apiKey) throw new VegvesenApiNokkelMangler();

  const normalisert = normaliserRegnummer(regnummer);
  const url = `${VEGVESEN_BASE_URL}?kjennemerke=${encodeURIComponent(normalisert)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "SVV-Authorization": `Apikey ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      throw new VegvesenIkkeFunnetError(normalisert);
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "900");
      throw new VegvesenRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 900);
    }
    if (!res.ok) {
      const detalj = await res.text().catch(() => "ukjent feil");
      throw new VegvesenApiError(res.status, detalj.slice(0, 500));
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Hent kjennemerke fra Vegvesen-respons.
 * Returnerer null hvis sti mangler.
 */
export function extractKjennemerke(vegvesenData: unknown): string | null {
  const data = vegvesenData as { kjoretoyId?: { kjennemerke?: unknown } } | null;
  const kjennemerke = data?.kjoretoyId?.kjennemerke;
  return typeof kjennemerke === "string" ? kjennemerke : null;
}

export type ForhandsvisningFelter = {
  registreringsnummer: string;
  vin: string | null;
  merke: string | null;
  modell: string | null;
  farge: string | null;
  drivstoff: string | null;
  kjoretoygruppe: string | null;
  kjoretoygruppeNavn: string | null;
  karosseritype: string | null;
  antallSeter: number | null;
  forsteRegistrering: string | null; // ISO YYYY-MM-DD
  effektKw: number | null;
  euroKlasse: string | null;
  totalvekt: number | null;
  egenvekt: number | null;
  nyttelast: number | null;
  girkasse: string | null;
  co2GramPerKm: number | null;
  forbrukLiterPer10km: number | null;
  euKontrollSist: string | null; // ISO YYYY-MM-DD
  euKontrollFrist: string | null;
};

function s(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isoDato(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  // Aksepterer YYYY-MM-DD (Vegvesen-format) eller annet ISO-format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

/**
 * Map rå Vegvesen-respons til UI-forhåndsvisnings-felter.
 * Tilgir manglende stier — alle felter er nullable.
 */
export function parseForhandsvisning(
  raw: unknown,
  fallbackRegnummer: string,
): ForhandsvisningFelter {
  const r = raw as Record<string, any>;
  const teknisk = r?.tekniskeData ?? {};
  const generelt = teknisk?.generelt ?? {};
  const motor = teknisk?.motorOgDrivverk?.motor?.[0] ?? {};
  const drivstoff = motor?.drivstoff?.[0] ?? {};
  const klassif = teknisk?.kjoretoyklassifisering ?? {};
  const persontall = teknisk?.persontall ?? {};
  const vekter = teknisk?.vekter ?? {};
  const miljo = teknisk?.miljodata?.miljoOgdrivstoffGruppe?.[0]?.forbrukOgUtslipp?.[0] ?? {};
  const periodisk = r?.periodiskKjoretoyKontroll ?? {};
  const reg = r?.forstegangsregistrering ?? {};

  const merke = s(generelt?.merke?.[0]?.merke);
  const modell = s(generelt?.handelsbetegnelse?.[0]);
  const farge = s(teknisk?.karosseriOgLasteplan?.rFarge?.[0]?.kodeNavn);
  const drivstoffNavn = s(drivstoff?.drivstoffKode?.kodeNavn);
  const kjoretoygruppe = s(klassif?.tekniskKode?.kodeVerdi);
  const kjoretoygruppeNavn = s(klassif?.tekniskKode?.kodeNavn);
  const karosseritype = s(klassif?.karosseritype?.kodeNavn);
  const girkasse = s(teknisk?.motorOgDrivverk?.girkassetype?.kodeNavn);
  const euroKlasse = s(teknisk?.miljodata?.euroKlasse?.kodeNavn);

  return {
    registreringsnummer:
      s(r?.kjoretoyId?.kjennemerke) ?? normaliserRegnummerLokalt(fallbackRegnummer),
    vin: s(r?.kjoretoyId?.understellsnummer),
    merke,
    modell,
    farge,
    drivstoff: drivstoffNavn,
    kjoretoygruppe,
    kjoretoygruppeNavn,
    karosseritype,
    antallSeter: n(persontall?.sitteplasserTotalt),
    forsteRegistrering: isoDato(reg?.registrertForstegangNorgeDato),
    effektKw: n(drivstoff?.maksNettoEffekt),
    euroKlasse,
    totalvekt: n(vekter?.tillattTotalvekt),
    egenvekt: n(vekter?.egenvekt),
    nyttelast: n(vekter?.nyttelast),
    girkasse,
    co2GramPerKm: n(miljo?.co2BlandetKjoring),
    forbrukLiterPer10km: n(miljo?.forbrukBlandetKjoring),
    euKontrollSist: isoDato(periodisk?.sistGodkjent),
    euKontrollFrist: isoDato(periodisk?.kontrollfrist),
  };
}

// Lokal normalisering uten avhengighet — brukes kun som fallback i parseForhandsvisning.
function normaliserRegnummerLokalt(input: string): string {
  return input.replace(/\s+/g, "").replace(/-/g, "").toUpperCase().trim();
}
