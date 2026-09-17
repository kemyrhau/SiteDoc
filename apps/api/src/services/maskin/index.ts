/**
 * Service-lag for Maskin-modulen.
 *
 * Eneste tillatte importpath for andre moduler (Timer, Aktivitetsfeed,
 * Planlegger). Direkte import av prismaMaskin utenfor maskin-mappen
 * er forbudt — se arkitektur-syntese § 6.1.1.
 */

export {
  erMaskinAktivert,
  krevMaskinAktivert,
  ModulIkkeAktivertError,
} from "./moduleGate";

export {
  hentKjoretoyData,
  parseForhandsvisning,
  extractKjennemerke,
  VegvesenIkkeFunnetError,
  VegvesenRateLimitError,
  VegvesenApiError,
  VegvesenApiNokkelMangler,
} from "./vegvesen-api";
export type { ForhandsvisningFelter } from "./vegvesen-api";

export {
  forhandsvisningSynkron,
  koerOppdatering,
} from "./vegvesen";
export type { ForhandsvisningResultat } from "./vegvesen";

export { startVegvesenWorker } from "./vegvesen-worker";

export {
  beregnNesteService,
  beregnServiceVarsel,
  SERVICE_VARSEL_SNART_TIMER,
  SERVICE_VARSEL_PLANLAGT_TIMER,
} from "./service-varsel";
export type { ServiceVarselStatus } from "./service-varsel";
