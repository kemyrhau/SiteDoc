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
 * Enheten firmaets reise-terskel måles i. "minutter" = klassisk tid-terskel
 * (default, uendret oppførsel); "km" = avstands-terskel (A.Markussen-krav
 * 2026-09-08). Firmaet velger — begge finnes side om side.
 */
export type ReiseEnhet = "minutter" | "km";

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
  /**
   * Hvilken enhet terskelen måles i. Bestemmer HVILKET felt på målingen som
   * sammenlignes — reisetidMin (minutter) eller avstandM (km). Uten dette ville
   * «terskel» vært et tall uten å si hva slags terskel — en felle.
   */
  reiseTerskelEnhet: ReiseEnhet;
  /** Terskel i minutter (OrganizationSetting.reiseTerskelMin, default 30). Aktiv når enhet = "minutter". */
  reiseTerskelMin: number;
  /**
   * Terskel i METER (OrganizationSetting.reiseTerskelM). Aktiv når enhet = "km"
   * (7,5 km = 7500). null når firmaet ikke måler i km.
   */
  reiseTerskelM: number | null;
  /** Klassifisering for reise UNDER terskelen. */
  reiseUnderTerskelType: ReiseKategori;
  /** Klassifisering for reise OVER/LIK terskelen. */
  reiseOverTerskelType: ReiseKategori;
}

/**
 * En målt reise. Varighet er alltid tilgjengelig; avstand er det bare når
 * matrisen (OSRM `distances`) eller GPS-estimatet ga den — den kan mangle
 * uavhengig av varigheten. Klassifiseringen plukker dimensjonen enheten peker på.
 */
export interface ReiseMaaling {
  /** Reisevarighet i minutter. */
  reisetidMin: number;
  /** Kjøreavstand i METER, eller null når ukjent (uoppnåelig par: -1). */
  avstandM: number | null;
}

/**
 * Klassifiser en målt reise mot firmaets regelsett.
 *
 * Enheten på regelsettet bestemmer dimensjonen: "minutter" → reisetidMin mot
 * reiseTerskelMin (som før); "km" → avstandM mot reiseTerskelM.
 *
 * Skarp grense: nøyaktig på terskelen regnes som "over" (≥), begge enheter.
 *
 * 🔴 km-enhet uten brukbar avstand (avstandM null/uoppnåelig, eller terskelen
 * ikke satt) → reiseUnderTerskelType. Gate-vedtak (c) 2026-09-08: tiden
 * registreres uansett, men klassifiseres konservativt — å foreslå en reisetid-
 * lønnsart uten faktisk avstand er verre enn å la arbeider legge den til selv.
 */
export function klassifiserReise(
  maaling: ReiseMaaling,
  regel: ReiseRegelsett,
): ReiseKategori {
  if (regel.reiseTerskelEnhet === "km") {
    const { avstandM } = maaling;
    if (regel.reiseTerskelM == null || avstandM == null || avstandM < 0) {
      return regel.reiseUnderTerskelType;
    }
    return avstandM < regel.reiseTerskelM
      ? regel.reiseUnderTerskelType
      : regel.reiseOverTerskelType;
  }
  return maaling.reisetidMin < regel.reiseTerskelMin
    ? regel.reiseUnderTerskelType
    : regel.reiseOverTerskelType;
}

/**
 * Ett grensepunkt i firmaets reise-avstandsskala (A.Markussen-krav 2026-09-11).
 *
 * GRENSEPUNKTER, ikke intervaller (Kenneth-vedtak): hver rad sier «fra og med
 * `grenseM` meter føres reisen på `lonnsartId`, til neste grensepunkt tar over».
 * Overlapp er da strukturelt umulig — det finnes ingen intervaller som KAN
 * overlappe — så ingen DB-extension (btree_gist) trengs; UNIQUE(orgId, grenseM)
 * i tabellen holder. Et hull uttrykkes med `lonnsartId = null`:
 *   7500→A · 15000→null · 20000→B  gir bånd 7,5–15 km = A, hull 15–20 km
 *   (fallback), 20 km+ = B. Samme uttrykkskraft som intervaller, ett punkt mer.
 */
export interface ReiseGrensepunkt {
  /** Nedre grense i METER, inklusiv. Reise med avstandM ≥ grenseM (og < neste grenseM) treffer denne. */
  grenseM: number;
  /**
   * Reise-lønnsart for denne grensen (svak FK → timer.Lonnsart). null = HULL:
   * ingen art over denne grensen, fallback (reiseLonnsartId/navne-match) gjelder.
   */
  lonnsartId: string | null;
}

/**
 * Løs firmaets reise-lønnsart fra en målt avstand og firmaets grensepunkter.
 * Delt kilde, som `klassifiserReise` — samme funksjon på web (SQL-ekvivalent),
 * mobil (array fra lokal cache) og server, så leserne aldri divergerer.
 *
 * Speiler serverens oppslag `WHERE grenseM ≤ avstandM ORDER BY grenseM DESC
 * LIMIT 1`: finn det HØYESTE grensepunktet som ikke overstiger avstanden.
 *
 * 🔴 Konservativ, samme regel som `klassifiserReise` (:80-84): uten brukbar
 * avstand (null/negativ) eller uten grensepunkter faller vi tilbake på
 * `fallbackLonnsartId` (firmaets `reiseLonnsartId`, ev. navne-match som kalleren
 * har regnet ut). Å gjette en art uten faktisk avstand er verre enn å la
 * arbeider velge. Bånd slår `fallbackLonnsartId` KUN når avstand finnes OG et
 * grensepunkt med en art (ikke hull) treffer.
 */
export function løsReiseLonnsartId(
  avstandM: number | null,
  grensepunkter: ReiseGrensepunkt[],
  fallbackLonnsartId: string | null,
): string | null {
  if (avstandM == null || avstandM < 0 || grensepunkter.length === 0) {
    return fallbackLonnsartId;
  }
  // Høyeste grenseM ≤ avstandM (uavhengig av innkommende rekkefølge).
  let beste: ReiseGrensepunkt | null = null;
  for (const g of grensepunkter) {
    if (g.grenseM <= avstandM && (beste == null || g.grenseM > beste.grenseM)) {
      beste = g;
    }
  }
  // Under laveste grense → fallback. Treff på et hull (lonnsartId null) → fallback.
  if (beste == null) return fallbackLonnsartId;
  return beste.lonnsartId ?? fallbackLonnsartId;
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
