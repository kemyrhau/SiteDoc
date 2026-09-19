/**
 * Ren beslutning bak Google-innloggingsknappen på `logg-inn`: skal knappen stå
 * sperret pga. manglende oppsett? Skilt ut i egen `.ts` slik at mobil-harnessen
 * (node-env, `src/**\/*.test.ts`, ingen RN-render) kan teste regelen uten å rendre
 * skjermen — samme mønster som `utledFlytbytteVisning` og `forklaringSomVises`.
 *
 * Bakgrunn: `Google.useAuthRequest` gir `null` som request til den er bygget, og
 * blir stående `null` for godt hvis klient-ID-ene mangler eller er ugyldige i
 * bygget. På native betyr det at knappen aldri kan trykkes — «varig grå» uten noen
 * forklaring til brukeren. Da skal `KnappMedForklaring` vise en linje som sier at
 * innloggingen ikke er tilgjengelig, i stedet for en død knapp.
 *
 * 🔴 `laster` er IKKE en del av dette. Kjører en innlogging, er spinneren signalet,
 * og `KnappMedForklaring`s egen doc sier eksplisitt `sperret={false}` når knappen er
 * disabled av en annen grunn enn manglende input.
 *
 * Web bruker en annen innloggingsvei og gates ikke på `request`, så der er den aldri
 * sperret av denne grunnen.
 */
export function googleKnappSperret(platformOS: string, harGoogleRequest: boolean): boolean {
  return platformOS !== "web" && !harGoogleRequest;
}
