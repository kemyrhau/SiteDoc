import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { forklaringSomVises } from "./sperret-forklaring";

/**
 * Mobil-motstykket til web-`KnappMedForklaring`. En telefon har ingen hover, så en
 * tooltip virker ikke — i stedet står forklaringen som en kort grå tekstlinje RETT
 * UNDER knappen, bare mens knappen er sperret pga. manglende input, og forsvinner
 * når den blir aktiv. Samme API som web (`sperret`/`forklaring`/`children`), slik at
 * ordrene kan si det samme på begge flater.
 *
 * Utseende: liten, grå tekst (`text-xs text-gray-400`, samme som andre hjelpetekster
 * på skjermen), ingen boks, ingen ikon, ingen farge. Ikke amber — amber betyr «noen
 * må ta stilling» (ui-standarder § Feltstatus).
 *
 * Linjen legger seg UNDER knappen og flytter den ikke: den vises/forsvinner uten å
 * endre knappens plassering. Står flere sperrede knapper på rad, send hele raden som
 * `children` (én felles betingelse) — da blir det én linje under raden, ikke én per
 * knapp.
 *
 * 🔴 `sperret` skal være sann BARE når påkrevd input mangler — ikke mens en mutasjon
 * kjører (da er spinneren signalet). Er knappen disabled av en annen grunn, send
 * `sperret={false}`.
 */
export function KnappMedForklaring({
  sperret,
  forklaring,
  children,
}: {
  sperret: boolean;
  forklaring: string;
  children: ReactNode;
}) {
  const linje = forklaringSomVises(sperret, forklaring);
  return (
    <View>
      {children}
      {linje ? <Text className="mt-1 text-xs text-gray-400">{linje}</Text> : null}
    </View>
  );
}
