// Kappløp-vern mellom original- og annoteringsopplasting av SAMME vedlegg
// (Kenneth/orkestrator 2026-10-22, kamera-annotering).
//
// Et kamerabilde legges i opplastingskøen straks det tas (original). Annoterer brukeren
// det rett etter — via «Annoter»-handlingen eller miniatyrstripen i kameraet — legges en
// NY oppføring i kø for SAMME `vedleggId` (den ikke-destruktive erstatningen). Begge
// skriver server-URL der `v.id === vedleggId` ved fullføring. Uten vern kan originalen
// fullføre SIST (f.eks. fordi den lå i backoff) og overskrive den annoterte — et kappløp.
//
// To rene, testbare regler sikrer at den NYESTE oppføringen alltid vinner:
//   1. Ved innlegging: kanseller ikke-fullførte, ikke-pågående oppføringer for samme
//      vedleggId (typisk originalen som ennå venter) FØR den nye settes inn.
//   2. Ved fullføring: skriv URL kun hvis denne oppføringen er den nyeste for sitt
//      vedleggId — dekker vinduet der originalen alt var «laster_opp» da annoteringen kom.

/** Minimal projeksjon av en kø-rad — kun feltene kappløp-reglene trenger. */
export interface KoOppforingRef {
  id: string;
  vedleggId: string;
  /** "venter" | "laster_opp" | "fullfort" | "feilet". */
  status: string;
  /** `opprettet`-tidsstempel (ms). Nyere = høyere. */
  opprettet: number;
  /** Lokal fil oppføringen laster opp. Trengs bare for `beholdLokalSti`. */
  lokalSti?: string;
}

/** En oppføring som pågår akkurat nå kan ikke trygt slettes (den er lest inn i minnet). */
const PAGAAR = "laster_opp";
const FULLFORT = "fullfort";

/**
 * Id-ene til oppføringer som skal KANSELLERES (slettes) før en ny oppføring for `vedleggId`
 * settes inn: alle eksisterende for samme vedlegg som verken er fullført eller pågår. Den
 * vanligste er en original som fortsatt venter i kø når brukeren annoterer bildet. Pågående
 * («laster_opp») røres ikke her — `skalSkriveVedleggUrl` hindrer at den vinner ved fullføring.
 * `beholdLokalSti`: originalen til en redigerbar annotering kanselleres ikke.
 */
export function oppforingerAaKansellere(
  vedleggId: string,
  eksisterende: KoOppforingRef[],
  beholdLokalSti?: string,
): string[] {
  return eksisterende
    .filter(
      (o) =>
        o.vedleggId === vedleggId &&
        o.status !== FULLFORT &&
        o.status !== PAGAAR &&
        // Redigerbar annotering (2026-10-28): originalen som laget er tegnet på skal opp — den
        // blir `originalUrl` når den er ferdig (skriver aldri `url`, se skalSkriveVedleggUrl).
        (beholdLokalSti === undefined || o.lokalSti !== beholdLokalSti),
    )
    .map((o) => o.id);
}

/**
 * Skal denne oppføringens server-URL skrives til vedlegget ved fullføring? KUN hvis den er
 * den NYESTE oppføringen for sitt vedleggId. Finnes en annen med høyere `opprettet` (en
 * annotering som ble lagt til etterpå), skal den gamle (originalen) aldri skrive — uansett
 * om den nyere alt er fullført eller fortsatt venter. Nyeste vinner, ingen overskriving.
 */
export function skalSkriveVedleggUrl(
  denne: KoOppforingRef,
  alle: KoOppforingRef[],
): boolean {
  return !alle.some(
    (o) =>
      o.vedleggId === denne.vedleggId &&
      o.id !== denne.id &&
      o.opprettet > denne.opprettet,
  );
}
