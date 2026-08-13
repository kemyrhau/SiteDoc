/**
 * @sitedoc/pdf — arkivmal (RENT LAG for dokumentgenerering, fase 3).
 * Ingen Prisma. Prisma-leserne bor i apps/api/src/services/arkiv/.
 */

export type {
  ArkivHendelseKilde,
  HendelseRad,
  EndringRad,
  EndringsØkt,
  RåEndring,
  PunktRad,
  RevisjonRad,
  SistEndret,
  ArkivLogg,
  ArkivKategori,
  ArkivFirma,
  ArkivDokumentMeta,
  ArkivProsjektblokk,
  StatusCelle,
} from "./typer";

// Ramme-byggeklosser (Stage 1)
export { ARKIV_FARGER, hentArkivCss } from "./arkiv-css";
export {
  statusTekst,
  statusSemantiskFarge,
  byggTopptekst,
  byggProsjektblokk,
  byggStatusblokk,
  byggFortsettelsesHeader,
  byggBunntekst,
} from "./ramme";

export { avledHandling } from "./handling";

export {
  INNSTILLINGSNØKLER,
  tolkInnstillinger,
} from "./innstillinger";
export type {
  Innstillingsnøkkel,
  LøsteInnstillinger,
  TolkOpsjoner,
} from "./innstillinger";

export {
  grupperØkter,
  tellFeltendringer,
  finnSistEndret,
  byggArkivLogg,
} from "./logg";
