/**
 * Service-lag for Timer-modulen.
 *
 * Eneste tillatte importpath for andre moduler. Direkte import av
 * prismaTimer utenfor timer-mappen er forbudt — se arkitektur-syntese § 6.1.1.
 *
 * Fase 3 Infrastruktur-commit (2026-05-01): kun moduleGate. Mer service-API
 * (sheet-utils, eksport-adaptere, attestering) tilføyes i Runde 1A/1B/1C.
 */

export {
  erTimerAktivert,
  krevTimerAktivert,
  TimerModulIkkeAktivertError,
} from "./moduleGate";
