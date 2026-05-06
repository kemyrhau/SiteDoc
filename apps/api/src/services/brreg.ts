/**
 * Brønnøysund Enhetsregisteret — firma-oppslag på organisasjonsnummer.
 *
 * API: https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
 * Åpent REST-API, ingen autentisering kreves for grunndata.
 *
 * Vi henter kun feltene vi trenger for autofyll i firmaprofil.
 * Brreg sender enheten i camelCase JSON.
 */

const BRREG_BASE_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";
const REQUEST_TIMEOUT_MS = 8000;

export interface BrregFirmaInfo {
  orgnr: string;
  navn: string;
  orgform: string | null;
  adresse: string | null;
  postnummer: string | null;
  poststed: string | null;
  /** True hvis enheten ikke er slettet eller under avvikling. */
  aktiv: boolean;
}

export class BrregError extends Error {
  constructor(
    message: string,
    public readonly kode:
      | "UGYLDIG_ORGNR"
      | "IKKE_FUNNET"
      | "TIMEOUT"
      | "NETTVERK"
      | "UKJENT",
  ) {
    super(message);
    this.name = "BrregError";
  }
}

/**
 * Validér norsk organisasjonsnummer: 9 siffer + Modulus-11-sjekksum.
 * Vekter (fra venstre): 3, 2, 7, 6, 5, 4, 3, 2.
 * Niende siffer er kontrollsifferet (11 - (sum mod 11)). Hvis kontroll = 11, er nummeret gyldig
 * når niende siffer = 0. Hvis kontroll = 10, er orgnummeret ugyldig.
 */
export function erGyldigOrgnr(input: string): boolean {
  const renset = input.replace(/\s/g, "");
  if (!/^\d{9}$/.test(renset)) return false;

  const vekter = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(renset[i]) * vekter[i]!;
  }
  const rest = sum % 11;
  const kontroll = rest === 0 ? 0 : 11 - rest;
  if (kontroll === 10) return false;
  return kontroll === Number(renset[8]);
}

interface BrregEnhetRespons {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode?: string };
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  };
  slettedato?: string;
  underAvvikling?: boolean;
}

export async function hentFirmaFraBrreg(orgnr: string): Promise<BrregFirmaInfo> {
  const renset = orgnr.replace(/\s/g, "");
  if (!erGyldigOrgnr(renset)) {
    throw new BrregError(
      "Ugyldig organisasjonsnummer (krever 9 siffer + gyldig kontrollsiffer)",
      "UGYLDIG_ORGNR",
    );
  }

  const url = `${BRREG_BASE_URL}/${encodeURIComponent(renset)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (response.status === 404 || response.status === 410) {
      throw new BrregError("Firma ikke funnet i Brønnøysund", "IKKE_FUNNET");
    }
    if (!response.ok) {
      throw new BrregError(
        `Brønnøysund svarte ${response.status}`,
        "NETTVERK",
      );
    }

    const data = (await response.json()) as BrregEnhetRespons;
    const adresseLinjer = data.forretningsadresse?.adresse;
    const adresse =
      adresseLinjer && adresseLinjer.length > 0 ? adresseLinjer.join(", ") : null;

    return {
      orgnr: data.organisasjonsnummer,
      navn: data.navn,
      orgform: data.organisasjonsform?.kode ?? null,
      adresse,
      postnummer: data.forretningsadresse?.postnummer ?? null,
      poststed: data.forretningsadresse?.poststed ?? null,
      aktiv: !data.slettedato && !data.underAvvikling,
    };
  } catch (e) {
    if (e instanceof BrregError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new BrregError("Brønnøysund svarte ikke innen rimelig tid", "TIMEOUT");
    }
    throw new BrregError(
      e instanceof Error ? e.message : "Ukjent feil mot Brønnøysund",
      "UKJENT",
    );
  } finally {
    clearTimeout(timeout);
  }
}
