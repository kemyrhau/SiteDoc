// Kontrollplan-fremdrift — LØFTET til @sitedoc/shared (2026-08-23) så mobil-tegningsvisningen kan
// fargelegge kontrollpunkt-markørene med SAMME tilstandsmodell som web (liste/rutenett/tegning).
// Ren logikk, ingen DOM. Denne filen re-eksporterer for bakoverkompat — de 8 web-importørene er
// uendret. Nye importer (mobil) går rett på @sitedoc/shared.
export {
  avledSjekklisteFremdrift,
  avledPunktFremdrift,
  tellGodkjente,
  ukerTilFrist,
  isoUkeRef,
  avledPunktTilstand,
  OVER_FRIST_KANT,
  type PunktFremdrift,
  type PunktTilstand,
  type TilstandVisning,
  type UkeRef,
} from "@sitedoc/shared";
