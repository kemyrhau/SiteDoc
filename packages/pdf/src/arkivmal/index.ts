/**
 * @sitedoc/pdf — arkivmal (RENT LAG for dokumentgenerering, fase 3).
 * Ingen Prisma. Prisma-leserne bor i apps/api/src/services/arkiv/.
 */

export type {
  ArkivHendelseKilde,
  HendelseRad,
  Segment,
  EndringRad,
  EndringsØkt,
  RåEndring,
  EkspandertEndring,
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

// Innholds-renderer (Stage 2)
export { byggInnhold } from "./innhold";
export { byggRepeaterTabell, skalarCelle } from "./repeater";
export { byggRadkort, repeaterErRik } from "./radkort";
export { byggArkivTegningsposisjon, byggLokasjonsblokk } from "./tegningsfelt";
export type { LokasjonsData } from "./tegningsfelt";
export { byggTegningsside, byggTegningssider, velgHelsider } from "./tegningsside";
export type { TegningssideData, TegningssideMarkor } from "./tegningsside";

// Loggseksjon + signatur + sammenstilling (Stage 3)
export { byggLoggseksjon, byggMangelMerknad } from "./loggseksjon";
export { byggSignaturblokk } from "./signatur";
export { byggArkivDokument, byggArkivSide, byggArkivSamling } from "./dokument";
export type { ArkivSignatur, ArkivDokumentInput } from "./typer";

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
  oppsummerLoggverdi,
} from "./logg";

export { ekspanderEndring, normaliserForDiff, likForDiff, byggKolonnerPerFelt, segmenterTilTekst } from "./endringsdiff";
export type { KolonneDef, DiffRad } from "./endringsdiff";
