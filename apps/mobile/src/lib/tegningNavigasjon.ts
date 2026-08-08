import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Del A (device-funn 2026-08-08) — én delt inngang for «åpne tegning X».
 *
 * Brukt av Tegninger-lista (trykk på rad), «Fortsett i …»-snarveien og
 * fremtidige innganger, slik at param-byggingen ikke dupliseres tre steder.
 * Sender tegning-id (+ byggeplass-id når den er kjent) som route-param til
 * lokasjoner-skjermen, som initialiserer valgt tegning fra param og åpner den
 * direkte i stedet for å tvinge et nytt byggeplass-/tegningsvalg.
 *
 * Guard-ansvaret ligger hos kalleren og lokasjoner-skjermen: kall kun med en
 * tegning som finnes i prosjektet, og lokasjoner faller tilbake til velgeren
 * hvis param-tegningen ikke lar seg åpne (slettet / annet prosjekt).
 */
export function aapneTegning(
  router: Router,
  tegningId: string,
  byggeplassId?: string | null,
): void {
  router.push({
    pathname: "/lokasjoner",
    params: {
      tegningId,
      ...(byggeplassId ? { byggeplassId } : {}),
      // Nonce: lokasjoner er en tab-skjerm som beholdes montert, så params
      // oppdateres uten remount. En unik `ts` per trykk gjør at samme tegning
      // kan åpnes på nytt etter at den er lukket, mens ren tab-veksling (uten
      // ny navigasjon) ikke re-åpner den.
      ts: String(Date.now()),
    },
  });
}
