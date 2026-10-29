// Vedleggets annoterings-regler — ÉN kilde for web og mobil (redigerbar annotering på mobil,
// Kenneth 2026-10-28). Før lå reglene i web (`annotering-lag.ts`), og mobil åpnet alltid den
// innbrente JPEG-en uten lag.
//
// Tre artefakter (se `lag.ts`): `originalUrl` (originalfoto), `annotering` (laget) og `url`
// (utflatet JPEG). Laget er tegnet i koordinatene til bildet det ble åpnet på, så laget og
// basisbildet må alltid høre sammen.
import type { AnnoteringsLag } from "./lag";

/** Det annoteringen trenger av et vedlegg (web- og mobil-typen er begge strukturelt slik). */
export interface AnnoterbartVedlegg {
  url: string;
  originalUrl?: string;
  annotering?: AnnoteringsLag;
}

/** Har vedlegget et redigerbart lag? Annotert før laget fantes (mobil før 2026-10-28) → nei. */
export function erAnnotert(vedlegg: AnnoterbartVedlegg): boolean {
  return vedlegg.annotering != null;
}

/**
 * Bildet en annotering ÅPNES på. Med lag: originalen (laget legges på den, objektene er
 * redigerbare). Uten lag: `url`, det innbrente bildet. 🔴 Også når `originalUrl` finnes uten lag
 * (mobil-annotert 2026-10-21 → 10-28): åpnes originalen da, forsvinner de innbrente
 * markeringene uten at noe lag kan gjenskape dem.
 */
export function annoteringsKilde(vedlegg: AnnoterbartVedlegg): string {
  return vedlegg.annotering ? (vedlegg.originalUrl ?? vedlegg.url) : vedlegg.url;
}

/**
 * Patchen som lagres etter Ferdig. `url` blir den nye JPEG-en, og `originalUrl` settes ÉN gang
 * (re-annotering peker fortsatt på det ekte originalfotoet). Laget lagres bare når bildet det
 * ble tegnet på ER originalen. Ellers (innbrent bilde med en egen `originalUrl`) ville
 * gjenåpning lagt laget på feil bilde, så vedlegget forblir flatt, som før.
 */
export function byggAnnoteringsPatch(
  eksisterende: AnnoterbartVedlegg,
  nyUrl: string,
  lag: AnnoteringsLag,
): { url: string; originalUrl: string; annotering: AnnoteringsLag | undefined } {
  const originalUrl = eksisterende.originalUrl ?? eksisterende.url;
  return {
    url: nyUrl,
    originalUrl,
    annotering: annoteringsKilde(eksisterende) === originalUrl ? lag : undefined,
  };
}
