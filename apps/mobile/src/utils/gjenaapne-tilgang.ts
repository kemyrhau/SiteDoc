/**
 * Avgjør om «Gjenåpne for redigering» skal være tilgjengelig på et dagskort.
 *
 * Ren funksjon (testbar uten RN-render) — brukes av `app/timer/[id].tsx`.
 *
 * Regelen har to ledd:
 *  1. Gjenåpne finnes kun på en SENDT sedel (recall før attestering).
 *  2. 🔴 Blokkert når sedelen står i `conflict`. Server-versjonen har «vunnet»
 *     og de lokale timeradene finnes KUN på telefonen (server-vakten returnerte
 *     før skrivingen — `dagsseddel.ts` accepted/sent-grenene). Å gjenåpne bumper
 *     server-`updatedAt`, og neste pull ville da slette de lokale radene
 *     (`timerSync.ts` pull-guard bevarer conflict, men gjenåpne setter status
 *     bort fra conflict). Arbeideren mister timene ved å prøve å redde dem.
 *     Løsningen på selve konflikten kommer i egen ordre (U-BEKREFT); her
 *     stopper vi bare tapet ved å be arbeideren få lederen til å returnere
 *     sedelen i stedet.
 */
export function kanGjenaapneDagsseddel(
  status: string,
  syncStatus: string,
): boolean {
  if (status !== "sent") return false;
  if (syncStatus === "conflict") return false;
  return true;
}
