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

// ──────────────────────────────────────────────────────────────────────────
//  LAG 2 — reise-sporet som følger raden (felt-typer delt av server + L2-B/L2-C).
//  Verdiene speiler db-timer-kolonnene; de bor her så web, mobil og api aldri
//  divergerer på hva «ut»/«matrise»/«utledet» betyr.
// ──────────────────────────────────────────────────────────────────────────

/** Etappens retning. Lag 4 utvider med "mellom" (mellometapper). */
export type ReiseRetning = "ut" | "retur";

/** Hvor reise-tallene (kjøretid/avstand) kom fra. */
export type ReiseKilde = "matrise" | "manuell";

/**
 * V8 tidskilde på en rad. "utledet" = vindu fra GPS ± matrise (ser målt ut, er
 * det ikke) · "stempel" = ekte ankomst (lag 4) · "manuell" = arbeider satte tiden.
 */
export type TidKilde = "stempel" | "utledet" | "manuell";

/**
 * Lønnsnormens kilde-status på en sedel (B6.3). "server" = frisk norm fra API ·
 * "cachet" = siste kjente svar · "ukjent" = ingen norm (overtid ikke fordelt).
 */
export type NormStatus = "server" | "cachet" | "ukjent";

/**
 * Snapshot av reise-regelen slik den var da raden ble laget (db-timer
 * SheetTimer.reiseRegel). Json i basen; eksporten trenger kun `kategori`.
 */
export interface ReiseRegelSnapshot {
  enhet: ReiseEnhet;
  terskelMin: number;
  terskelM: number | null;
  underType: ReiseKategori;
  overType: ReiseKategori;
  kategori: ReiseKategori;
  /** true når en grensepunkt-art (avstandsbånd) avgjorde lønnsarten. */
  grensepunktTreff: boolean;
}

/**
 * Normens snapshot på en sedel (db-timer DailySheet.normSnapshot). Json i basen.
 */
export interface NormSnapshot {
  dagsnorm: number;
  normKilde: string;
  dato: string;
  hentetAt: string;
}

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

/**
 * Firmaets kontekst for å avgjøre om en lønnsart ER en reise-art (LAG 2).
 * Speiler backfill-SQL-ens to grener: konfigurert art (reiseLonnsartId ∪
 * grensepunkt-arter) + navne-match (kun når reiseLonnsartId mangler).
 */
export interface ErReiseKontekst {
  /** OrganizationSetting.reiseLonnsartId (null = ikke konfigurert). */
  reiseLonnsartId: string | null;
  /** Ikke-null lonnsartId-er fra OrganizationReiseGrense (grensepunkt-artene). */
  grensepunktLonnsartIds: string[];
}

/**
 * Avgjør om en timer-rad er en reise ut fra lønnsarten — ÉN definisjon delt av
 * backfill-SQL (migreringen) og alle serverens skrivestier (dagsseddel.ts). Uten
 * delt kilde ville SQL og TS kunne drifte uten at noen test fanger det.
 *
 * Reglen SPEILER dagens leser (M3), ikke en ny gjetning:
 *   1. lønnsarten er firmaets konfigurerte reise-art, ELLER
 *   2. lønnsarten er en grensepunkt-art (avstandsbånd), ELLER
 *   3. KUN når firmaet IKKE har konfigurert reiseLonnsartId: navnet matcher
 *      REISE_LONNSART_REGEX (arver dagens falske positive — derfor gatet på
 *      «ingen konfigurert art», og backfill-tallet leses før prod).
 *
 * 🔴 Dette er leser-regelen frosset til et EKSPLISITT flagg — etter lag 2 skal
 * ingen leser gjette reise fra lønnsart/regex på nytt.
 */
export function erReiseLonnsart(
  lonnsartId: string,
  lonnsartNavn: string,
  ktx: ErReiseKontekst,
): boolean {
  if (ktx.reiseLonnsartId != null && lonnsartId === ktx.reiseLonnsartId) {
    return true;
  }
  if (ktx.grensepunktLonnsartIds.includes(lonnsartId)) {
    return true;
  }
  // Navne-match KUN for firmaer uten konfigurert reise-art (reise.ts:30-38).
  if (ktx.reiseLonnsartId == null && REISE_LONNSART_REGEX.test(lonnsartNavn)) {
    return true;
  }
  return false;
}

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
  const beste = finnBesteGrensepunkt(avstandM, grensepunkter);
  // Ingen brukbar avstand / under laveste grense / treff på et hull
  // (lonnsartId null) → fallback.
  if (beste == null) return fallbackLonnsartId;
  return beste.lonnsartId ?? fallbackLonnsartId;
}

/**
 * Det HØYESTE grensepunktet som ikke overstiger avstanden, eller `null` når
 * avstanden mangler/er negativ, det ikke finnes grensepunkter, eller avstanden
 * er under laveste grense. Delt kjerne for `løsReiseLonnsartId` og
 * `grensepunktTraff` — begge må lese grensene likt.
 */
function finnBesteGrensepunkt(
  avstandM: number | null,
  grensepunkter: ReiseGrensepunkt[],
): ReiseGrensepunkt | null {
  if (avstandM == null || avstandM < 0 || grensepunkter.length === 0) {
    return null;
  }
  let beste: ReiseGrensepunkt | null = null;
  for (const g of grensepunkter) {
    if (g.grenseM <= avstandM && (beste == null || g.grenseM > beste.grenseM)) {
      beste = g;
    }
  }
  return beste;
}

/**
 * LAG 2 (B1): avgjorde et avstandsbånd (grensepunkt med en art) lønnsarten for
 * denne avstanden? → `reiseRegel.grensepunktTreff` i radens snapshot. `true` KUN
 * når et grensepunkt med `lonnsartId != null` treffer; et hull eller
 * under/uten avstand gir `false` (da bestemte fallback-arten). Samme grense-
 * lesing som `løsReiseLonnsartId` (delt `finnBesteGrensepunkt`), så snapshotet
 * aldri sier «bånd» der resolveren falt tilbake.
 */
export function grensepunktTraff(
  avstandM: number | null,
  grensepunkter: ReiseGrensepunkt[],
): boolean {
  const beste = finnBesteGrensepunkt(avstandM, grensepunkter);
  return beste != null && beste.lonnsartId != null;
}
