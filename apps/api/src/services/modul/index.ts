/**
 * Service-lag for delt modul-resolver (steg 2, modulhierarki-designnotat).
 *
 * Én kilde for effektiv modultilstand med to familier og to formler. De tre
 * firmagatene (timer/maskin/varelager moduleGate) leser denne i stedet for å
 * duplisere firmatak ∧ prosjektbryter-formelen hver for seg.
 */
export {
  effektivTilstand,
  modulFamilie,
  FIRMAMODUL_SLUGS,
  type ModulFamilie,
  type EffektivTilstandOpts,
} from "./resolver";
