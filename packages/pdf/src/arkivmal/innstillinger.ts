/**
 * Innstillings-tolker — modulen er ENESTE sted som tolker
 * `utskriftsinnstillinger` (§1). Presentasjons-nøkler faller til default true;
 * sporbarhetsminimum (§4) tvinges på og kan ikke slås av gjennom det
 * offentlige API-et.
 */

import type { Utskriftsinnstillinger } from "../typer";

/** De sju prosjekt-nøklene modulen tolker (default true når uspesifisert). */
export const INNSTILLINGSNØKLER = [
  "logo",
  "eksternProsjektnummer",
  "prosjektnavn",
  "fraTil",
  "lokasjon",
  "tegningsnummer",
  "vaer",
] as const;

export type Innstillingsnøkkel = (typeof INNSTILLINGSNØKLER)[number];

/**
 * Løst innstillingsobjekt rendreren leser. Presentasjons-nøklene er
 * valgbare; sporbarhetsminimum er `readonly true` — typenivå-garanti mot at
 * de slås av.
 */
export interface LøsteInnstillinger {
  // Presentasjon (kan slås av per prosjekt):
  logo: boolean;
  eksternProsjektnummer: boolean;
  prosjektnavn: boolean;
  fraTil: boolean;
  lokasjon: boolean;
  tegningsnummer: boolean;
  vaer: boolean;
  visSidenummer: boolean;
  // Sporbarhetsminimum (§4 — ALLTID på):
  readonly firmanavn: true;
  readonly orgnr: true;
  readonly dokumentnummer: true;
  readonly statusblokk: true;
  readonly signaturblokk: true;
  readonly generertStempel: true;
}

export interface TolkOpsjoner {
  /** Eksportpakke/arkivdokument → sidetall tvinges på uansett `visSidenummer`. */
  eksport?: boolean;
  /** Løpende utskrift: respekterer prosjektets sidetall-valg (fra PdfConfig). */
  visSidenummer?: boolean;
}

/**
 * Tolker de sju prosjekt-nøklene (default true) og fester
 * sporbarhetsminimumet. `visSidenummer` bor i PdfConfig (ikke i
 * Utskriftsinnstillinger); i eksportpakken settes sidetall alltid.
 */
export function tolkInnstillinger(
  raw: Utskriftsinnstillinger | null | undefined,
  opts: TolkOpsjoner = {},
): LøsteInnstillinger {
  const vis = (k: Innstillingsnøkkel): boolean => raw?.[k] ?? true;
  return {
    logo: vis("logo"),
    eksternProsjektnummer: vis("eksternProsjektnummer"),
    prosjektnavn: vis("prosjektnavn"),
    fraTil: vis("fraTil"),
    lokasjon: vis("lokasjon"),
    tegningsnummer: vis("tegningsnummer"),
    vaer: vis("vaer"),
    visSidenummer: opts.eksport ? true : opts.visSidenummer ?? false,
    firmanavn: true,
    orgnr: true,
    dokumentnummer: true,
    statusblokk: true,
    signaturblokk: true,
    generertStempel: true,
  };
}
