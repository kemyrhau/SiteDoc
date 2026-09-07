/**
 * Reise-klassifisering (Fase 3 / T.10 § B).
 *
 * Ren, plattform-uavhengig logikk delt av web + mobil + API. Reisetid mellom
 * oppmøtested (kontor) og byggeplass klassifiseres mot firmaets terskel:
 *   reisetid < terskel  → reiseUnderTerskelType
 *   reisetid ≥ terskel  → reiseOverTerskelType
 *
 * "arbeidstid" = reisen inngår som vanlig arbeidstid (timelønn-art).
 * "reisetid"   = reisen føres på egen reise-lønnsart, utenfor overtid by default
 *                (jf. timer.md:282 — reisetid er lønnsart, ikke avstands-/
 *                godtgjørelse-sats; km-godtgjørelse er separate arter, regnskap
 *                eier satsene).
 *
 * Terskel/retning/lovlighet er avtale-avhengig (tariff) → konfigurerbart per
 * firma, ikke hardkodet. Klassifiseringen produserer KUN et forslag — arbeider
 * beslutter, aldri auto-rad (T.8).
 */

export type ReiseKategori = "arbeidstid" | "reisetid";

/**
 * Navne-match for reise-lønnsart når firmaet ikke har satt en eksplisitt
 * `reiseLonnsartId`. ÉN kilde delt av tre steder: mobilens resolver
 * (`hentReiseLonnsartId`), mobilens reise-merking (render) og serverens
 * tvetydighets-telling (`organisasjon.hentSetting`). Skriv den ALDRI av —
 * importer herfra. Bevisst bred (matcher «Reise/transport til prosjekter» så vel
 * som «Transport av masser»); å stramme den ville brutt umålte firmaer, så
 * tvetydighet håndteres i stedet med et varsel + eksplisitt valg (firma-admin).
 */
export const REISE_LONNSART_REGEX = /reise|transport/i;

export interface ReiseRegelsett {
  /** Terskel i minutter (OrganizationSetting.reiseTerskelMin, default 30). */
  reiseTerskelMin: number;
  /** Klassifisering for reisetid UNDER terskelen. */
  reiseUnderTerskelType: ReiseKategori;
  /** Klassifisering for reisetid OVER/LIK terskelen. */
  reiseOverTerskelType: ReiseKategori;
}

/**
 * Klassifiser en reisevarighet (minutter) mot firmaets regelsett.
 * Skarp grense: nøyaktig terskel regnes som "over" (≥).
 */
export function klassifiserReise(
  reisetidMin: number,
  regel: ReiseRegelsett,
): ReiseKategori {
  return reisetidMin < regel.reiseTerskelMin
    ? regel.reiseUnderTerskelType
    : regel.reiseOverTerskelType;
}

/**
 * MVP fast-estimat: avled reisetid (minutter) fra kjøreavstand (meter) ved en
 * antatt snitthastighet. GPS-faktisk reisetid (ankomst − avreise) er senere
 * oppfølger når ankomst-på-byggeplass fanges (jf. Fase 3-plan avvik C). Default
 * 50 km/t passer landevei/anleggsvei på byggeplass-skala. Arbeider justerer alltid.
 */
export function estimerReisetidMin(
  avstandM: number,
  snittKmT: number = 50,
): number {
  if (avstandM <= 0 || snittKmT <= 0) return 0;
  const km = avstandM / 1000;
  return Math.round((km / snittKmT) * 60);
}
