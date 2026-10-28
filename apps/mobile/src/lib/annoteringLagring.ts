// Redigerbar annotering på mobil (Kenneth 2026-10-28): samme datamodell som web — `url` (utflatet
// JPEG), `originalUrl` (originalfoto, settes ÉN gang) og `annotering` (laget). Før åpnet mobil alltid
// den innbrente JPEG-en uten lag, så tidligere markeringer kunne ikke endres.
//
// Reglene for kilde og patch bor i `@sitedoc/shared` (`annotering/vedlegg.ts`, delt med web); her
// ligger det mobil-spesifikke: lokal original i opplastingskøen og startverktøyet.
import {
  annoteringsKilde,
  bevarOriginalUrl,
  byggAnnoteringsPatch,
  erLokalVedleggUrl,
  type AnnoteringsLag,
} from "@sitedoc/shared";
import type { Vedlegg } from "../hooks/useSjekklisteSkjema";

/** Det Ferdig lagrer i vedlegget i tillegg til ny url/filnavn. */
export interface AnnoteringsFelter {
  originalUrl: string;
  annotering: AnnoteringsLag | undefined;
}

/** Startverktøy i flaten. Et lagret lag åpnes i Flytt (som web): første trykk velger et
 *  objekt i stedet for å tegne et nytt, og dra flytter det. */
export type StartVerktoy = "select" | "arrow";

/** Hva annoteringsflaten åpnes med for dette vedlegget. */
export function annoteringsApning(v: Pick<Vedlegg, "url" | "originalUrl" | "annotering">): {
  kilde: string;
  lag: AnnoteringsLag | undefined;
  startVerktoy: StartVerktoy;
} {
  const lag = v.annotering ?? undefined;
  return { kilde: annoteringsKilde(v), lag, startVerktoy: lag ? "select" : "arrow" };
}

/**
 * Felter som lagres etter Ferdig, og lokalstien til en original som ikke er lastet opp ennå.
 * `beholdLokalSti` gis til opplastingskøen: originalens oppføring skal da IKKE kanselleres av den
 * nye (annoteringen) — originalen må opp, og blir `originalUrl` når den er oppe.
 */
export function byggMobilAnnotering(
  v: Pick<Vedlegg, "url" | "originalUrl" | "annotering">,
  lokalSti: string,
  lag: AnnoteringsLag,
): { felter: AnnoteringsFelter; beholdLokalSti: string | undefined } {
  const { originalUrl, annotering } = byggAnnoteringsPatch(v, lokalSti, lag);
  return {
    felter: { originalUrl, annotering },
    beholdLokalSti: erLokalVedleggUrl(originalUrl) ? originalUrl : undefined,
  };
}

/**
 * Vedlegget etter en ikke-destruktiv erstatning. Med `felter` (annoteringsflaten): laget og
 * originalen derfra. Uten (kamera-annotering, som ikke har lag): bevar server-originalen som før
 * (funn d) og fjern et eventuelt gammelt lag — det hører ikke til det nye bildet.
 */
export function erstattetVedlegg(
  v: Vedlegg,
  nyUrl: string,
  nyttFilnavn: string,
  felter?: AnnoteringsFelter,
): Vedlegg {
  const { annotering: _gammeltLag, ...uten } = v;
  if (felter) {
    return {
      ...uten,
      url: nyUrl,
      filnavn: nyttFilnavn,
      originalUrl: felter.originalUrl,
      ...(felter.annotering ? { annotering: felter.annotering } : {}),
    };
  }
  return { ...uten, url: nyUrl, filnavn: nyttFilnavn, originalUrl: bevarOriginalUrl(v.originalUrl, v.url) };
}
