/**
 * LAG 0b (2026-10-02) — REN utregning av dagsseddel-forslag.
 *
 * Skilt ut fra `StartSluttDagKort.genererForslag`, som tidligere FLETTET
 * regnestykket sammen med DB-skrivingen (inne i `opprettDagsseddelForSegment`).
 * Konsekvensen var at «Slutt dag» markerte arbeidsdagen `avsluttet` FØR utfallet
 * av skrivingen var kjent — feilet radopprettelsen var GPS-økta oppbrukt og
 * dagens timer borte (H7 i timer-gps-helhetsplan.md).
 *
 * `beregnDagsforslag` er 🟢 **REN**: all utregning, **null DB-skriving og null
 * DB-lesing**. Alle kataloger, org-setting, matrise-oppslag og eksisterende-
 * sedel-status leses ut av kalleren (`samleDagsforslagInput`, `dagsforslagInput.ts`) og
 * sendes inn som argumenter. Da er funksjonen fullt testbar uten React Native og
 * uten database — vakten mot at skrive-/lese-splitten endrer utregningen stille.
 *
 * 🔴 **NULL atferdsendring:** denne funksjonen reproduserer dagens utregning
 * 1:1, INKLUDERT de bevisste feilene som skal bort SENERE (men da ett sted, ikke
 * femten): reise-unntaket (fra/til = null), `reisetidTellerOvertid`-fradraget,
 * luftlinje/50-reservemålingen, `prosjekter[0]`-fallbacken uten koordinater, og
 * nærmeste-prosjekt-uten-avstandsgrense. Endres noe av det her, kan ingen se om
 * splitten var riktig. V-reglene fra helhetsplanen (V1–V14) hører IKKE her.
 *
 * GPS gir FORSLAG til sted, prosjekt og reise. Forslaget blir lønnsgrunnlag
 * først når arbeideren bekrefter i `/timer/bekreft-dag` (helhetsplan § 3 G1,
 * Kenneth 2026-11-06). Arbeider-valget i skjermen er autoritativt — det kommer
 * inn som `input.retting` (L3-A) og vinner over GPS-utledningen.
 *
 * Selve persisteringen ligger i `anvendDagsforslag` (`dagsforslagAnvend.ts`) og
 * kjører kun ved [Bekreft og lagre] (`bekreftDag.ts`).
 */
import {
  klassifiserReise,
  velgOvertidLonnsart,
  carveArbeidstider,
  dagPauseMinForNyttArbeid,
  pauseFraForRad,
  fastPauseFraFor,
  hhmmTilMin,
  pauseOverlappMin,
  finnOverlappendeTidsrom,
  minTilHhmm,
  løsReiseLonnsartId,
  grensepunktTraff,
  klassifiserManuellReise,
  DEFAULT_PAUSE_ETTER_TIMER,
  type ReiseKategori,
  type ReiseEnhet,
  type ReiseGrensepunkt,
  type ManuellReiseSpor,
  type ReiseRegelSnapshot,
  type NormSnapshot,
  type Startsted,
  type Sluttsted,
  type Destinasjon,
  type ArbeidstidSegment,
  type OppmoteResultat,
  type Overforing,
  byggOverforingOppslag,
  type DagsforslagOverforingOppslag,
  OVERTID_NIVAA_50,
  sekvenserReisekjede,
  type KjedeKort,
} from "@sitedoc/shared";
import { rundTidspunktTilNarmeste } from "./tidsrunding";
import { klassifiserMotDognet } from "./overtidMotDognet";
import type { NyKoOppforing } from "../providers/OpplastingsKoProvider";
import { splittVedMidnatt, kappGlemtDagSlutt } from "./dagsegment";

/**
 * UF-2 trinn 8 — hard enkelt-skift-cap (timer). Spenn over dette tolkes som
 * glemt avslutning og kappes (se `kappGlemtDagSlutt`). Konstant inntil videre;
 * å gjøre den til en firma-setting (AML/tariff per firma) krever server +
 * migrering → egen runde.
 */
export const MAKS_ENKELTSKIFT_TIMER = 16;

// Lokale kopier av de to triviale tid-helperne fra `useArbeidsdag` — importeres
// IKKE derfra, fordi den fila drar inn React Native (hooks + expo-location) og
// ville gjort denne rene modulen uleselig for vitest-node. Samme mønster som
// `dagsegment.ts`, som også holder sin egen `formatIsoDato`.
function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}
function tilHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Arbeidsvinduet (ms) i et segment: ut-reisen skyver start fram, retur-reisen
 * skyver slutt tilbake, og hver kant rundes for seg til tidsrunding-grid. En
 * kant som berører en reise-etappe rundes ikke (reisen må møte arbeidet).
 * Én kilde for pause-avgjørelsen (`beregnDagsforslag`) og radene (`beregnSegment`).
 */
function arbeidsvinduMs(
  segment: { startIso: string; sluttIso: string },
  utReise: { kjoretidMin: number } | null,
  returReise: { kjoretidMin: number } | null,
  tidsrundingMinutter: number | null,
): { startMs: number; sluttMs: number } {
  const raaStartMs =
    new Date(segment.startIso).getTime() + (utReise ? utReise.kjoretidMin : 0) * 60_000;
  const raaSluttMs =
    new Date(segment.sluttIso).getTime() - (returReise ? returReise.kjoretidMin : 0) * 60_000;
  return {
    startMs: utReise ? raaStartMs : rundTidspunktTilNarmeste(raaStartMs, tidsrundingMinutter),
    sluttMs: returReise ? raaSluttMs : rundTidspunktTilNarmeste(raaSluttMs, tidsrundingMinutter),
  };
}

/** Ett prosjekt-kandidat for Haversine-valget (plain data, ingen Drizzle). */
export type DagsforslagProsjekt = {
  id: string;
  lat: number | null;
  lng: number | null;
};

/** Aktiv aktivitet-kandidat (kalleren har alt filtrert `aktiv = true`). */
export type DagsforslagAktivitet = { id: string; navn: string };

/** Lønnsart-kandidat — feltene `velgOvertidLonnsart` + id trenger. */
export type DagsforslagLonnsart = {
  id: string;
  /** Visningsnavn — nivå-chipsene i Bekreft dag (ORDRE 34 pkt 4). */
  navn?: string;
  overtidsnivaa: number | null;
  aktiv: boolean;
  type: string;
  rekkefolge: number;
};

/** Delmengden av org-setting utregningen bruker (plain data). */
export type DagsforslagRegel = {
  reiseTerskelEnhet: string;
  reiseTerskelMin: number;
  reiseTerskelM: number | null;
  reiseUnderTerskelType: string;
  reiseOverTerskelType: string;
  tidsrundingMinutter: number | null;
  standardPauseEtterTimer: number | null;
};

/**
 * Effektiv arbeidstid for én dag — det cachede server-svaret (B6 v3). `dagsnorm`
 * ≤ 0 (eller `normStatus === "ukjent"`) → ingen normaltid/overtid-splitt (trinn
 * 3): alt på standard-lønnsarten, feilretning er UNDERbetaling → markør kreves.
 */
export type DagsforslagEffektiv = {
  startTid: string;
  sluttTid: string;
  pauseMin: number;
  dagsnorm: number;
  /** B3 (V6): pausevinduets referanse. Default "ankomst" (fra arbeidsstart). */
  pauseReferanse?: "fastStart" | "ankomst";
  /**
   * RETUR 2026-11-13: firmaets `standardPauseEtterTimer` slik svar-cachen har
   * den (server `hentEffektivArbeidstid`). Vinner over org-setting-cachen, samme
   * rekkefølge som manuell føring (`matpauseKontekst`). Mangler → regelen →
   * `DEFAULT_PAUSE_ETTER_TIMER`.
   */
  pauseEtterTimer?: number;
  /** B6.3: svarets opphav — "server" (dagens dato), "cachet" (≤30d), "ukjent" (ingen). */
  normStatus?: "server" | "cachet" | "ukjent";
  /**
   * B5 (L2-B): normens snapshot slik svar-cachen hadde den (dagsnorm/normKilde/
   * dato/hentetAt). null ved "ukjent" (ingen norm → ingen snapshot). Skrives på
   * sedelen av `anvendDagsforslag` og synkes opp.
   */
  normSnapshot?: NormSnapshot | null;
};

/**
 * Hvorfor en reise-etappe IKKE ble foreslått (B5, V12/V13). Vises på flaten
 * arbeideren ser (varsel etter «Slutt dag»), lag 3 flytter den til bekreftelses-
 * skjermen. `null` = etappe(r) ble foreslått, eller reise er ikke aktuelt.
 */
export type ReiseAarsak =
  | "posisjon_utilgjengelig"
  | "mangler_matrise"
  | "uoppnaaelig"
  | "mangler_avstand"
  /**
   * POST (12)/(13) B: etappen er reisetid, men firmaet har verken et treffende
   * avstandsbånd eller en reise-lønnsart (`reiseLonnsartId`/navne-match).
   * Tidligere forsvant reisen stille (null) — nå navngis årsaken.
   */
  | "mangler_reise_lonnsart";

/**
 * Én reise-etappe (B1, V7/V10). `ut` = oppmøtested → destinasjon,
 * `retur` = destinasjon → oppmøtested. `kategori` fra `klassifiserReise` pr.
 * etappe; kun `reisetid`-etapper gir reise-rad og trekker arbeidsvinduet.
 */
export type Etappe = {
  retning: "ut" | "retur";
  oppmotestedId: string;
  byggeplassId: string;
  kjoretidMin: number;
  avstandM: number | null;
  kategori: ReiseKategori;
  kilde: "matrise";
};

/**
 * En reisetid-etappe som har fått en lønnsart (B1) — alt beregnSegment trenger
 * for å skrive reise-raden og dens spor. Erstatter den gamle reduksjonen til
 * `{ kjoretidMin, lonnsartId }`. `reiseKilde` er alltid "matrise" her (auto-
 * etapper); manuelle reise-rader lages i UI (B4), ikke her.
 */
type ReiseRadResolvert = {
  lonnsartId: string;
  retning: "ut" | "retur";
  oppmotestedId: string;
  byggeplassId: string;
  kjoretidMin: number;
  avstandM: number | null;
  reiseRegel: ReiseRegelSnapshot;
};

/**
 * Ferdig-leste reise-oppslag (stedstolkning + matriseceller + grensepunkt-
 * katalog). `null` når reise ikke er aktuelt (ingen org-setting). Stedene (A3/A4)
 * og destinasjonen (A5) er tolket av lese-fasen; cellene er slått opp i matrisen.
 */
export type DagsforslagReiseOppslag = {
  /** A3: startposisjonen tolket mot oppmøtesteder/byggeplasser. */
  start: Startsted;
  /** A4: sluttposisjonen tolket. Grunnlag for retur (V7). */
  slutt: Sluttsted;
  /** A5: valgt destinasjon (byggeplass) eller ukjent med årsak. */
  destinasjon: Destinasjon;
  /** Matrisecelle for ut-etappen (start-oppmøtested → destinasjon). null = mangler. */
  utCelle: { kjoretidMin: number; avstandM: number | null } | null;
  /** Matrisecelle for retur-etappen (slutt-oppmøtested → destinasjon). null = mangler. */
  returCelle: { kjoretidMin: number; avstandM: number | null } | null;
  /** Firmaets reise-avstandsbånd (for lønnsart-valg). */
  grensepunkter: ReiseGrensepunkt[];
  /** `regel.reiseLonnsartId ?? navne-match` — resolvert av kalleren (DB). */
  fallbackReiseLonnsartId: string | null;
};

/** Eksisterende dagsseddel for én dato, lest FØR beregningen (snapshot). */
export type DagsforslagEksisterendeSedel = {
  /** true = sedel finnes alt for (userId, dato) (idempotens-treff). */
  finnes: boolean;
  /** Sedelens status (draft/returned/sent/accepted/…). null når !finnes. */
  status: string | null;
  /** Sedelens rader (fra/til) — for overlapp-vakten mot manuelt førte timer.
   *  `pauseMin` (2026-11-13): dag-pausen avgjøres mot disse — teller med i
   *  dagsbrutto, og bærer en av dem alt pause, trekkes den ikke igjen. */
  eksisterendeRader: Array<{
    fraTid: string | null;
    tilTid: string | null;
    pauseMin?: number | null;
    /** Reise-rad: teller i dagsbrutto (5,5-grensen), ikke i de 4
     *  arbeidstimene som plasserer pausen (ORDRE 2026-11-14). */
    erReise?: boolean | null;
  }>;
  /**
   * ORDRE (27b), spec § 6 L1: timer som alt bruker av normen (alle kort, også
   * overtid; ikke reise, ikke `erstattet`). Satt av manuell Bekreft dag
   * (`forberedManuellDag`); udefinert = 0 (GPS-dagen til ordre a2).
   */
  bruktAvNorm?: number;
};

/**
 * ORDRE (28), spec § 6.1 V1/V7: arbeidslinjene i et kort — normaltid (opp til
 * normen) og overtid (etter normen / etter «Overtid fra»). Linjen er nøkkelen
 * arbeiderens lønnsartvalg huskes på (`DagsforslagRettingDato.lonnsartPerLinje`).
 * RETUR (28) B9: står normallinja på fravær, bruker den ikke normen; arbeidet
 * etter den er linja `arbeid` (normaltid til normen er brukt), deretter overtid.
 */
export type ArbeidLinje = "normal" | "arbeid" | "overtid";

/** Én foreslått timer-rad (uten id/sedel — fylles av `anvendDagsforslag`). */
export type DagsforslagRad = {
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  pauseMin: number;
  /** true = reise-rad. Eksplisitt flagg (M3) — ikke lenger gjettet fra lønnsart. */
  erReise: boolean;
  // LAG 2 (B1) — reise-sporet. Null på arbeidsrader. På reise-rader (kilde
  // "matrise") settes alle av `beregnSegment` fra `Etappe` + regelen.
  reiseRetning: "ut" | "retur" | null;
  reiseOppmotestedId: string | null;
  /** Destinasjonen (reise-rad). null på arbeidsrader → arver sedel-nivå. */
  byggeplassId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseKilde: "matrise" | "manuell" | "overforing" | null;
  reiseRegel: ReiseRegelSnapshot | null;
  /** V8: "utledet" på auto-reise-rader (vindu fra GPS ± matrise). null ellers. */
  tidKilde: "stempel" | "utledet" | "manuell" | null;
  /**
   * PRESISERING TILLEGG (2026-11-13): arbeidsradens stabile identitet i
   * forslaget = carve-vinduets opprettelsesrekkefølge, ikke posisjon etter
   * tid. Bærer `radTilleggNokkel`, så maskin/vare følger raden når tiden
   * rettes. Utelatt på reise-rader.
   */
  radIndeks?: number;
  /**
   * ORDRE (28) V1: arbeidslinjen raden hører til. Satt på arbeidsrader fra
   * `beregnSegment`; utelatt på reise-rader. Lagres ikke.
   */
  linje?: ArbeidLinje;
  /**
   * POST (13) L2 TILLEGG: overføringsrad (første/siste dag i en periode).
   * Kun UI-markør — Bekreft dag viser den som «Overføring {fra} → {til}» og
   * kan fjerne den (`fjernOverforing`). Lagres ikke; sporet ligger i
   * `reiseKilde`/`reiseRegel.overforing`.
   */
  overforing?: { retning: "ut" | "retur"; fraNavn: string; tilNavn: string };
  /**
   * Ordre 2026-11-15 (17): kortets nøkkel i reisekjeden — `reise-ut`/
   * `reise-retur` (auto-reise), `manuell-<i>` (reise-kortet), `overforing-ut`/
   * `overforing-retur`. Utelatt på arbeidsrader. Nøkkelen bærer arbeiderens
   * retting (`DagsforslagRettingDato.reiseTid`). Lagres ikke.
   */
  kjedeNokkel?: string;
  /** Ordre (17): kjedesiden — før arbeid («ut») eller etter («retur»). */
  kjedeSide?: "ut" | "retur";
};

/**
 * Ordre 2026-11-15 (17) punkt 2: hvorfor dagen ikke kan bekreftes. «Bekreft og
 * lagre» sperres og begrunnelsen vises i kortet — raden droppes aldri stille.
 */
export type DagsforslagKjedeKonflikt =
  | {
      type: "overlapp";
      fraTid: string;
      tilTid: string;
      annenFraTid: string;
      annenTilTid: string;
    }
  /** `erOverforing`: kortet over midnatt er en overføring — kan fjernes (`fjernOverforing`). */
  | { type: "overMidnatt"; retning: "ut" | "retur"; erOverforing: boolean };

// POST (13) L2 commit 8: oppslaget bor i @sitedoc/shared (delt med web-reisekortet).
export type { DagsforslagOverforingOppslag };
export { byggOverforingOppslag };

/** Forslaget for én kalenderdag (ett midnatt-segment). */
export type DagsforslagDag = {
  dato: string;
  erStartSegment: boolean;
  /** Segmentets reelle start/slutt (ISO) — brukes av anvend til sedel-vindu. */
  segmentStartIso: string;
  segmentSluttIso: string;
  /** true = sedelen er sendt/godkjent → kan ikke appendes (ingen rader). */
  blokkert: boolean;
  eksisterendeStatus: string | null;
  /** true = ingen sedel finnes for datoen ennå (ny opprettes av anvend). */
  erNy: boolean;
  /** true = sedelen HADDE rader før denne økta (pre-fylt — skiller «for kort»-copy). */
  harEksisterendeRader: boolean;
  byggeplassId: string | null;
  /** Fordelt segment-pause (sedel-nivå prefill). */
  pauseMin: number;
  deltVedMidnatt: boolean;
  sluttTidKilde: "bruker" | "midnatt" | "system";
  /** B5 (L2-B): normens kilde-status + snapshot for DENNE datoen (fra svar-cachen). */
  normStatus: "server" | "cachet" | "ukjent" | null;
  normSnapshot: NormSnapshot | null;
  /** Tidsrom der en play-rad vek for en overlappende manuell rad. */
  vekForOverlapp: Array<{ fraTid: string; tilTid: string }>;
  /** Arbeidsrader som ble hoppet over fordi lønnsarten manglet (aldri gjettet). */
  raderDroppetUtenLonnsart: number;
  /**
   * ORDRE (28) V2/T19: de samme linjene, med tid — Bekreft dag viser dem med
   * amber «Velg lønnsart» og sperrer lagring til arbeideren har valgt. Tellingen
   * over står for Slutt dag-meldingen. Utelatt = ingen.
   */
  linjerUtenLonnsart?: DagsforslagLinjeUtenLonnsart[];
  /**
   * RETUR (28) B9: normallinja står på fravær — slutten på fraværet
   * (delingspunktet arbeideren kan flytte, «Fravær til»; lik kortets slutt når
   * fraværet dekker hele kortet). Utelatt = normallinja står ikke på fravær.
   */
  fravaerTil?: string;
  rader: DagsforslagRad[];
  /** Ordre (17) punkt 2: satt → Bekreft sperres med begrunnelse. */
  kjedeKonflikt?: DagsforslagKjedeKonflikt | null;
};

/** ORDRE (28) V2: en arbeidslinje uten lønnsart (firmaet mangler arten). */
export type DagsforslagLinjeUtenLonnsart = {
  linje: ArbeidLinje;
  fraTid: string;
  tilTid: string;
  timer: number;
};

/** Hele forslaget — én dag normalt, flere ved midnatt-splitt. */
export type Dagsforslag = {
  /** null = kunne ikke utlede prosjekt/aktivitet offline (manuell opprettelse). */
  prosjektId: string | null;
  aktivitetId: string | null;
  /** true = spennet ble kappet (glemt avslutning) → siste kilde "system". */
  kappet: boolean;
  /**
   * §2: true når prosjektet ikke kunne utledes (A5 ga ingen destinasjon OG
   * ingen `aktivtProsjektId`). Skiller «velg prosjekt og prøv igjen» fra
   * `kildeManglet` (db/aktivitet mangler). Holder dagen åpen med egen melding.
   */
  prosjektUkjent: boolean;
  /** B5: hvorfor ingen reise-etappe ble foreslått (V12/V13). null = etappe(r) foreslått. */
  reiseAarsak: ReiseAarsak | null;
  /** B5: A5-årsak når destinasjonen ikke kunne velges. null = destinasjon valgt. */
  destinasjonAarsak: "flere_byggeplasser" | "ingen_byggeplass_med_punkt" | null;
  /**
   * B6.3: normens opphav for START-dagen — "server"/"cachet"/"ukjent". `null`
   * når forslaget ikke ble laget. Markøren (varsel + banner) vises når ≠ "server";
   * "ukjent" betyr at forslaget er uten overtid-splitt (UNDERbetaling-risiko).
   */
  normStatus: "server" | "cachet" | "ukjent" | null;
  datoer: DagsforslagDag[];
  /**
   * ORDRE 36a/36b: arbeiderens «Hva gjorde du i dag?» pr. kort, fra
   * `retting.beskrivelse`. Nøkkel = projectId når prosjektet har ett kort,
   * ellers kortnøkkelen (`utils/beskrivelseKort.ts`). Utelatt = ingen retting.
   * `anvendDagsforslag` skriver teksten på kortets arbeidsrader.
   */
  beskrivelsePerKort?: Record<string, string>;
};

/** Alt `beregnDagsforslag` trenger — ferdig lest ut av kalleren (ingen DB her). */
export type BeregnDagsforslagInput = {
  dag: {
    startAt: string;
    startLat: number | null;
    startLng: number | null;
    oppmotestedId: string | null;
    byggeplassId: string | null;
  };
  sluttIso: string;
  endLat: number | null;
  endLng: number | null;
  /** F4: global aktiv byggeplass + aktivt prosjekt (for D2-match-sjekk). */
  kontekstByggeplassId: string | null;
  aktivtProsjektId: string | null;
  /**
   * §2 (A5): prosjektet destinasjonens byggeplass hører til, resolvert av
   * lese-fasen. `null` når A5 ikke ga en destinasjon. Prosjektvalget er
   * `destinasjonProsjektId ?? aktivtProsjektId ?? prosjektUkjent` — ingen
   * `prosjekter[0]`-fallback lenger (H1 stille feil).
   */
  destinasjonProsjektId: string | null;
  /** Kilde for SISTE segments slutt-tid ("bruker" normal, "system" glemt-dag). */
  sisteSegmentKilde: "bruker" | "system";
  prosjekter: DagsforslagProsjekt[];
  aktiviteter: DagsforslagAktivitet[];
  alleLonnsarter: DagsforslagLonnsart[];
  /** Firmaets standard-lønnsart (normaltid). null → normaltid-rader hoppes over. */
  standardLonnsartId: string | null;
  /**
   * RETUR (28) A1: firmaets reise-arter (`erReiseLonnsart`: konfigurert
   * reise-art, grensepunktartene, navne-match uten konfigurert art), resolvert
   * av lese-fasen. En linje kan aldri velges til reise. Utelatt = ingen.
   */
  reiseLonnsartIder?: string[];
  regel: DagsforslagRegel | null;
  reiseOppslag: DagsforslagReiseOppslag | null;
  /** POST (13) L2: overføringer (første/siste dag i en periode). Utelatt = ingen. */
  overforinger?: DagsforslagOverforingOppslag[];
  /** Effektiv arbeidstid per dato — MÅ dekke startdato + alle segment-datoer. */
  effektivPerDato: Record<string, DagsforslagEffektiv>;
  eksisterendeSedelPerDato: Record<string, DagsforslagEksisterendeSedel>;
  /**
   * L3-A: arbeiderens rettinger fra `/timer/bekreft-dag`. Utelatt = forslaget
   * slik GPS-utledningen gir det (uendret utdata). Arbeider-valget er
   * autoritativt — det vinner over destinasjon, aktivt prosjekt og default.
   */
  retting?: DagsforslagRetting;
};

/** L3-A: rettedybde B — prosjekt, byggeplass, aktivitet og per dato fra/til, pause, fjern. */
export type DagsforslagRetting = {
  prosjektId?: string;
  aktivitetId?: string;
  /** undefined = default-kjeden; null = ingen byggeplass. */
  byggeplassId?: string | null;
  perDato?: Record<string, DagsforslagRettingDato>;
  /** ORDRE 36a/36b: beskrivelse pr. kort (påkrevd før Bekreft) — se `beskrivelsePerKort`. */
  beskrivelse?: Record<string, string>;
  /**
   * POST 2026-11-14 (8) punkt 1: «+ Reise» i Nytt prosjektkort (manuell modus).
   * Reise-rader arbeideren har ført selv; legges på første åpne dato som
   * `erReise` + `reiseKilde "manuell"` — samme spor som `settInnTimerRad` gir
   * fra det lagrede kortet (`DagSeksjon`). Rører ikke arbeidsradene.
   */
  manuellReise?: DagsforslagManuellReise[];
};

/** Én manuelt ført reise-rad (fra `TimerRadModal` i reise-modus). */
export type DagsforslagManuellReise = {
  projectId: string;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  /**
   * Ordre (9): terskel/bånd-sporet (`klassifiserManuellReise`). Satt → raden
   * føres etter det (under terskel: erReise false, standard ordinær art).
   * Udefinert (regelsett ikke synket / eldre utkast) → reise-rad som før.
   */
  reiseSpor?: ManuellReiseSpor;
};

/**
 * POST (8) punkt 1 — REN: legger arbeiderens manuelle reise-rader på første
 * dato som ikke er blokkert (sendt/godkjent). Feltene speiler `settInnTimerRad`
 * for en reise-lønnsart: `erReise`, `reiseKilde "manuell"`, `tidKilde
 * "manuell"`, ingen pause. POST (13) L2: retning/kjøretid/oppmøtested fra
 * reise-kortets spor på reise-rader.
 */
export function leggTilManuellReise(
  datoer: DagsforslagDag[],
  reiser: DagsforslagManuellReise[] | undefined,
): DagsforslagDag[] {
  if (!reiser || reiser.length === 0) return datoer;
  const idx = datoer.findIndex((d) => !d.blokkert);
  if (idx === -1) return datoer;
  const rader: DagsforslagRad[] = reiser.map((r, i) => ({
    projectId: r.projectId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    timer: r.timer,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    pauseMin: 0,
    erReise: r.reiseSpor ? r.reiseSpor.erReise : true,
    // POST (13) L2: reise-kortets retning/kjøretid følger med på reise-rader.
    reiseRetning: r.reiseSpor?.erReise ? r.reiseSpor.reiseRetning : null,
    // Ordre (9): ikke-reise-rad bærer aldri avstand/oppmøtested (C2 + DB-CHECK).
    reiseOppmotestedId: r.reiseSpor?.erReise ? r.reiseSpor.reiseOppmotestedId : null,
    byggeplassId: r.byggeplassId,
    reiseKjoretidMin: r.reiseSpor?.erReise ? r.reiseSpor.reiseKjoretidMin : null,
    reiseAvstandM: r.reiseSpor?.erReise ? r.reiseSpor.reiseAvstandM : null,
    reiseKilde: r.reiseSpor ? r.reiseSpor.reiseKilde : "manuell",
    reiseRegel: r.reiseSpor ? r.reiseSpor.reiseRegel : null,
    tidKilde: "manuell",
    kjedeNokkel: `manuell-${i}`,
  }));
  return datoer.map((d, i) => (i === idx ? { ...d, rader: [...d.rader, ...rader] } : d));
}

export type DagsforslagRettingDato = {
  /** Arbeidsvinduets start "HH:MM". Reise ut forankres her (A1). */
  arbeidFra?: string;
  /** Arbeidsvinduets slutt "HH:MM". Reise retur forankres her (A1). */
  arbeidTil?: string;
  /** Erstatter fordelt pause for datoen (0–120). */
  pauseMin?: number;
  /** Fjerner datoens arbeidsrader. Reiseradene står (K12 a). */
  fjernArbeid?: boolean;
  /**
   * ORDRE 34 pkt 4: arbeiderens rettede overtid-start "HH:MM". Splitter
   * normaltid/overtid her i stedet for ved dagsnormen.
   */
  overtidFra?: string;
  /**
   * ORDRE 34 pkt 4: valgt overtid-lønnsart. Kun lønnsart med `overtidsnivaa`
   * godtas — ellers faller valget tilbake til `velgOvertidLonnsart`.
   */
  overtidLonnsartId?: string;
  /**
   * ORDRE (27b) V5a: arbeideren har slått overtiden av med nivå-knappen — hele
   * arbeidet føres som standardart. `overtidFra` står som minne, så et nytt
   * trykk på et nivå legger overtiden tilbake der den var.
   */
  overtidAv?: boolean;
  /**
   * ORDRE (28), spec § 6.1 V7: lønnsarten arbeideren har valgt pr. linje.
   * Vinner over forhåndsvalget (standardart / overtidsart). Overtidsarter på
   * overtidslinja føres i `overtidLonnsartId` (samme valg som nivå-chipsene,
   * V5) — her står ordinære og fravær-arter. Forsvinner linja, ryddes valget
   * (`ryddLonnsartPerLinje`). Utelatt = forhåndsvalget.
   */
  lonnsartPerLinje?: Partial<Record<ArbeidLinje, string>>;
  /**
   * RETUR (28) B9: slutten på fraværet når normallinja står på en fravær-art.
   * Settes når fraværet velges (linjas slutt) og flyttes med «Fravær til».
   * Leses bare mens normallinja står på fravær; utelatt = linjas slutt slik
   * delingen ellers gir den.
   */
  fravaerTil?: string;
  /** POST (13) L2: overføringsrader arbeideren har fjernet for datoen. */
  fjernOverforing?: Array<"ut" | "retur">;
  /**
   * Kenneth-vedtak 2026-11-15: reisekort arbeideren har rettet, pr.
   * `kjedeNokkel`. Rettet kort er fast punkt; beregnede naboer flytter seg
   * (`sekvenserReisekjede`).
   */
  reiseTid?: Record<string, { fraTid: string; tilTid: string }>;
};

/**
 * POST (13) L2 TILLEGG — REN: legger overføringsradene på datoene sine.
 *
 *  - Klassifiseres som en manuell reise (`klassifiserManuellReise`): under
 *    terskel → ordinær standard-art, `erReise` false; over → reise-art fra bånd
 *    eller fallback, `reiseKilde "overforing"`.
 *  - `ut` legges FØR dagens tidligste rad, `retur` ETTER dagens seneste, med
 *    kjøretiden som lengde. Krysser den midnatt eller overlapper en eksisterende
 *    rad, foreslås den ikke (arbeideren fører den med «+ Reise»).
 *  - Mangler celle → `mangler_matrise`; kjøretid < 0 → `uoppnaaelig`; reise uten
 *    art → `mangler_reise_lonnsart`. Første årsak vinner (som auto-reisen).
 *  - Blokkerte datoer og fjernede retninger hoppes over.
 */
export function leggTilOverforinger(
  datoer: DagsforslagDag[],
  oppslag: DagsforslagOverforingOppslag[] | undefined,
  ctx: {
    regel: DagsforslagRegel | null;
    grensepunkter: ReiseGrensepunkt[];
    fallbackReiseLonnsartId: string | null;
    standardLonnsartId: string | null;
    prosjektId: string;
    aktivitetId: string;
    eksisterendeSedelPerDato: Record<string, DagsforslagEksisterendeSedel>;
    perDato: Record<string, DagsforslagRettingDato> | undefined;
  },
): { datoer: DagsforslagDag[]; aarsak: ReiseAarsak | null } {
  if (!oppslag || oppslag.length === 0 || !ctx.regel) return { datoer, aarsak: null };
  const regel = ctx.regel;
  let aarsak: ReiseAarsak | null = null;
  const nye = datoer.map((d) => {
    if (d.blokkert) return d;
    const fjernet = ctx.perDato?.[d.dato]?.fjernOverforing ?? [];
    const tillegg: DagsforslagRad[] = [];
    let konflikt: DagsforslagKjedeKonflikt | null = null;
    for (const o of oppslag) {
      if (o.dato !== d.dato || fjernet.includes(o.overforing.retning)) continue;
      if (o.celle == null) {
        aarsak ??= "mangler_matrise";
        continue;
      }
      if (o.celle.kjoretidMin < 0) {
        aarsak ??= "uoppnaaelig";
        continue;
      }
      const kjoretid = o.celle.kjoretidMin;
      const k = klassifiserManuellReise({
        regel: reiseRegelsett(regel),
        reisetimer: kjoretid / 60,
        avstandM: o.celle.avstandM,
        grensepunkter: ctx.grensepunkter,
        resolverLonnsartId: ctx.fallbackReiseLonnsartId,
        standardLonnsartId: ctx.standardLonnsartId,
      });
      if (!k.lonnsartId) {
        if (k.erReise) aarsak ??= "mangler_reise_lonnsart";
        continue;
      }
      const tider = d.rader
        .flatMap((r) => [r.fraTid, r.tilTid])
        .filter((t): t is string => t != null)
        .map(hhmmTilMin);
      const ut = o.overforing.retning === "ut";
      const ankerMin = tider.length > 0
        ? (ut ? Math.min(...tider) : Math.max(...tider))
        : null;
      if (ankerMin == null) continue;
      const fraMin = ut ? ankerMin - kjoretid : ankerMin;
      const tilMin = ut ? ankerMin : ankerMin + kjoretid;
      // Ordre (17) punkt 2: over midnatt → ingen rad, men varsel (aldri stille).
      // Overlapp med lagret rad avgjøres etter sekvenseringen (`sekvenserDag`).
      if (fraMin < 0 || tilMin > 24 * 60) {
        konflikt ??= { type: "overMidnatt", retning: o.overforing.retning, erOverforing: true };
        continue;
      }
      const fraTid = minTilHhmm(fraMin);
      const tilTid = minTilHhmm(tilMin);
      const reiseRegel: ReiseRegelSnapshot = {
        ...k.reiseRegel,
        overforing: {
          fra: o.overforing.fra,
          til: o.overforing.til,
          periodeId: o.overforing.periodeId,
        },
      };
      tillegg.push({
        projectId: ctx.prosjektId,
        lonnsartId: k.lonnsartId,
        aktivitetId: ctx.aktivitetId,
        timer: Math.round((kjoretid / 60) * 100) / 100,
        fraTid,
        tilTid,
        pauseMin: 0,
        erReise: k.erReise,
        reiseRetning: k.erReise ? o.overforing.retning : null,
        reiseOppmotestedId: k.erReise ? o.oppmotestedId : null,
        byggeplassId: o.byggeplassId,
        reiseKjoretidMin: k.erReise ? kjoretid : null,
        reiseAvstandM: k.reiseAvstandM,
        reiseKilde: k.erReise ? "overforing" : null,
        reiseRegel,
        tidKilde: "utledet",
        overforing: {
          retning: o.overforing.retning,
          fraNavn: o.fraNavn,
          tilNavn: o.tilNavn,
        },
        kjedeNokkel: `overforing-${o.overforing.retning}`,
      });
    }
    const medKonflikt = konflikt ? { ...d, kjedeKonflikt: konflikt } : d;
    return tillegg.length > 0
      ? { ...medKonflikt, rader: [...d.rader, ...tillegg] }
      : medKonflikt;
  });
  return { datoer: nye, aarsak };
}

/**
 * ORDRE 34 pkt 4: normaltid/overtid-segmenter når arbeideren har rettet
 * overtid-starten. Normaltid = arbeid fra arbeidsstart til `overtidFra` minus
 * pausen som faller i det spennet; resten er overtid. Avgrenset til [0, arbeid].
 */
/**
 * ORDRE 36e pkt. 4: et pausevindu som ikke starter inne i arbeidstiden
 * (kort dag: `pauseVinduFra` havner etter slutt; sen ankomst med
 * `fastStart`: før start) gir ingen rad med klokke-gap, så F5-bæreren blir 0
 * mens pausen alt er trukket fra timene. Da legges pausen midt i arbeidstiden.
 * Vinduer inne i arbeidstiden (vanlig dag) returneres uendret.
 */
export function klemPauseInnIArbeid(args: {
  arbeidsstartHHMM: string;
  /** Netto arbeidstimer (pausen alt trukket). */
  arbeidstimer: number;
  pauseFra: string;
  pauseMin: number;
}): string {
  if (args.pauseMin <= 0) return args.pauseFra;
  const startMin = hhmmTilMin(args.arbeidsstartHHMM);
  const arbeidMin = Math.round(args.arbeidstimer * 60);
  const pauseFraMin = hhmmTilMin(args.pauseFra);
  // `tilFraAntall` legger pausen inn bare når arbeid gjenstår ved pausestart.
  if (pauseFraMin >= startMin && pauseFraMin < startMin + arbeidMin) return args.pauseFra;
  return minTilHhmm(startMin + Math.floor(arbeidMin / 2));
}

export function segmenterVedOvertidFra(args: {
  arbeidstimer: number;
  arbeidsstartHHMM: string;
  overtidFra: string;
  pauseFra: string;
  pauseMin: number;
}): ArbeidstidSegment[] {
  const { arbeidstimer } = args;
  if (arbeidstimer <= 0) return [];
  const startMin = hhmmTilMin(args.arbeidsstartHHMM);
  const fraMin = hhmmTilMin(args.overtidFra);
  const brutto = Math.max(0, fraMin - startMin);
  const pause = pauseOverlappMin(startMin, fraMin, hhmmTilMin(args.pauseFra), args.pauseMin);
  const normal = Math.min(
    arbeidstimer,
    Math.round((Math.max(0, brutto - pause) / 60) * 100) / 100,
  );
  const overtid = Math.round((arbeidstimer - normal) * 100) / 100;
  const segmenter: ArbeidstidSegment[] = [];
  if (normal > 0) segmenter.push({ overtidsnivaa: null, timer: normal });
  if (overtid > 0) segmenter.push({ overtidsnivaa: OVERTID_NIVAA_50, timer: overtid });
  return segmenter;
}

/**
 * ORDRE 34 pkt 4: flytt overtid-starten ett steg (firmaets tidsrunding, ellers
 * 15 min), avgrenset til arbeidsvinduet [fra, til]. ORDRE 35 C2: «+» helt til
 * `til` gir 0 timer overtid (merket faller bort, «Legg til overtid» kommer
 * tilbake); «+» flytter aldri starten bakover.
 */
export function stegOvertidFra(
  naa: string,
  retning: -1 | 1,
  fra: string,
  til: string,
  tidsrundingMinutter: number | null,
): string {
  const steg = tidsrundingMinutter && tidsrundingMinutter > 0 ? tidsrundingMinutter : 15;
  const min = hhmmTilMin(fra);
  const maks = Math.max(min, hhmmTilMin(til));
  const naaMin = hhmmTilMin(naa);
  const kandidat = Math.min(maks, Math.max(min, naaMin + retning * steg));
  const ny = retning === 1 ? Math.max(naaMin, kandidat) : kandidat;
  const t = Math.floor(ny / 60);
  const m = ny % 60;
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * ORDRE 35 (RETUR 1a): rettingen «Legg til overtid» gir — overtid fra
 * arbeidsstart. Finnes ikke firmaets standardnivå (50 %), velges første
 * nivå-valg, ellers ville radene droppes som «mangler lønnsart».
 */
export function leggTilOvertidRetting(
  fra: string,
  alleLonnsarter: DagsforslagLonnsart[],
  overtidValg: Array<{ id: string }>,
): DagsforslagRettingDato {
  const forste = overtidValg[0];
  if (velgOvertidLonnsart(alleLonnsarter, OVERTID_NIVAA_50) || !forste)
    return { overtidFra: fra, overtidAv: false };
  return { overtidFra: fra, overtidLonnsartId: forste.id, overtidAv: false };
}

/**
 * ORDRE (27b) V5a (Kenneth 2026-11-16: «Hvorfor ikke bare trykke en gang til på
 * blått felt, så blir feltet hvitt?»): rettingen et trykk på en nivå-knapp gir.
 *
 *  - Blå knapp (nivået kortet står på) → overtiden av; «Overtid fra» huskes.
 *  - Hvit knapp mens overtiden er av → nivået velges og overtiden legges
 *    tilbake fra forrige «Overtid fra», ellers arbeidsstart.
 *  - Hvit knapp mens overtiden er på → bare nivået byttes (som før).
 */
export function vekslOvertidNivaa(args: {
  trykketId: string;
  /** Lønnsarten kortets første overtidsrad står på; null = ingen overtid. */
  valgtId: string | null;
  /** Første overtidsrads fra-tid (forslaget). */
  forsteOtFra: string | null;
  rettetOvertidFra: string | undefined;
  arbeidFra: string;
}): DagsforslagRettingDato {
  if (args.valgtId !== null && args.trykketId === args.valgtId) {
    return { overtidAv: true, overtidFra: args.forsteOtFra ?? args.rettetOvertidFra ?? args.arbeidFra };
  }
  if (args.valgtId !== null) return { overtidLonnsartId: args.trykketId };
  return {
    overtidAv: false,
    overtidLonnsartId: args.trykketId,
    overtidFra: args.rettetOvertidFra ?? args.arbeidFra,
  };
}

/**
 * ORDRE 35 (RETUR 1b): overtid-starten editoren viser — fra radene, ellers
 * arbeiderens retting. Editoren og nivå-valget er da tilgjengelige også når
 * ingen overtidsrad ble laget (nivået finnes ikke).
 */
export function overtidEditorFra(
  forsteOtFra: string | null | undefined,
  rettetOvertidFra: string | undefined,
): string | null {
  return forsteOtFra ?? rettetOvertidFra ?? null;
}

/** ORDRE 34 pkt 4: arbeiderens overtid-lønnsart — kun med overtidsnivå, aktiv. */
export function godtattOvertidLonnsart(
  lonnsarter: DagsforslagLonnsart[],
  id: string | null,
): DagsforslagLonnsart | null {
  if (!id) return null;
  const l = lonnsarter.find((x) => x.id === id);
  return l && l.aktiv && l.overtidsnivaa != null ? l : null;
}

/**
 * ORDRE (28) V4-⚠️: lønnsart arbeideren kan velge på en linje — aktiv, i
 * firmaets katalog (`alleLonnsarter` er firmafiltrert), type ordinær eller
 * fravær, og ikke reise (RETUR (28) A1: reise-arter har `type = "ordinaer"`,
 * så `reiseIder` — `BeregnDagsforslagInput.reiseLonnsartIder` — avgjør).
 * Annet (ukjent id, reise, feriepenger, diett) faller tilbake til forhåndsvalget.
 */
export function godtattLinjeLonnsart(
  lonnsarter: DagsforslagLonnsart[],
  id: string | null | undefined,
  reiseIder?: ReadonlySet<string>,
): DagsforslagLonnsart | null {
  if (!id || reiseIder?.has(id)) return null;
  const l = lonnsarter.find((x) => x.id === id);
  return l && l.aktiv && (l.type === "ordinaer" || l.type === "fravaer") ? l : null;
}

/** Delmengden av `DagsforslagRegel` som `klassifiserReise` trenger. */
function reiseRegelsett(regel: DagsforslagRegel) {
  return {
    reiseTerskelEnhet: regel.reiseTerskelEnhet as ReiseEnhet,
    reiseTerskelMin: regel.reiseTerskelMin,
    reiseTerskelM: regel.reiseTerskelM ?? null,
    reiseUnderTerskelType: regel.reiseUnderTerskelType as ReiseKategori,
    reiseOverTerskelType: regel.reiseOverTerskelType as ReiseKategori,
  };
}

/**
 * Bygg én etappe fra en matrisecelle, eller gi årsaken til at den ikke kunne
 * bygges (V13). Celle null → `mangler_matrise`; `kjoretidMin < 0` →
 * `uoppnaaelig`; km-enhet uten avstand → `mangler_avstand`. Ellers klassifiseres
 * cellen én gang (V10).
 */
function byggEtappe(
  retning: "ut" | "retur",
  oppmotestedId: string,
  byggeplassId: string,
  celle: { kjoretidMin: number; avstandM: number | null } | null,
  regel: DagsforslagRegel,
): { etappe: Etappe | null; aarsak: ReiseAarsak | null } {
  if (celle == null) return { etappe: null, aarsak: "mangler_matrise" };
  if (celle.kjoretidMin < 0) return { etappe: null, aarsak: "uoppnaaelig" };
  if (regel.reiseTerskelEnhet === "km" && celle.avstandM == null) {
    return { etappe: null, aarsak: "mangler_avstand" };
  }
  const kategori = klassifiserReise(
    { reisetidMin: celle.kjoretidMin, avstandM: celle.avstandM },
    reiseRegelsett(regel),
  );
  return {
    etappe: {
      retning,
      oppmotestedId,
      byggeplassId,
      kjoretidMin: celle.kjoretidMin,
      avstandM: celle.avstandM,
      kategori,
      kilde: "matrise",
    },
    aarsak: null,
  };
}

/**
 * POST 2026-11-15 (13) L2, Kenneth-beslutning 1: perioderesolveren
 * (`løsOppmote`) styrer også den automatiske reisen i Bekreft dag, så «+ Reise»
 * og Bekreft dag sier det samme om samme dag.
 *
 *  - Byggeplass-periode på dagens prosjekt → den ansatte møter på byggeplassen:
 *    start og slutt tolkes som byggeplass (ingen ut-, ingen retur-etappe, ingen
 *    årsak — V11).
 *  - GPS-start ukjent → startstedet blir resolverens kontor (midlertidig/fast)
 *    i stedet for `posisjon_utilgjengelig`. GPS-start på byggeplass/utenfor
 *    beholdes (V11). `ikkeValgt` → uendret.
 *  - Retur bygges fortsatt bare fra GPS-slutt på kontor — den finnes ikke uten
 *    at den ansatte faktisk kom tilbake.
 */
export function brukOppmoteResolver(
  start: Startsted,
  slutt: Sluttsted,
  destinasjon: Destinasjon,
  oppmote: OppmoteResultat,
): { start: Startsted; slutt: Sluttsted } {
  if (oppmote.kilde === "byggeplass") {
    const paaPlass: Startsted =
      destinasjon.type === "byggeplass"
        ? { type: "byggeplass", byggeplassId: destinasjon.byggeplassId }
        : { type: "utenfor" };
    return { start: paaPlass, slutt: paaPlass };
  }
  if (
    start.type === "ukjent" &&
    (oppmote.kilde === "midlertidig" || oppmote.kilde === "fast")
  ) {
    return {
      start: { type: "kontor", oppmotestedId: oppmote.oppmotestedId, byggeplassId: null },
      slutt,
    };
  }
  return { start, slutt };
}



/**
 * B1 — bygg reise-etappene for en dag (V7/V10/V11/V12/V15).
 *
 * `ut`: start er kontor OG destinasjonen er en ANNEN byggeplass enn den kontoret
 * ligger i (V15: samme → ingen etappe, avstand 0). `retur`: slutt er kontor →
 * celle (slutt-oppmøtested → destinasjon). `start.type ∈ {byggeplass, utenfor}`
 * → ingen ut-etappe (V11); `start.type === "ukjent"` → `posisjon_utilgjengelig`
 * (V12). `aarsak` settes KUN for ut-etappen (B5 gjelder `start === kontor`).
 */
export function beregnReiseEtapper(
  start: Startsted,
  slutt: Sluttsted,
  destinasjon: Destinasjon,
  utCelle: { kjoretidMin: number; avstandM: number | null } | null,
  returCelle: { kjoretidMin: number; avstandM: number | null } | null,
  regel: DagsforslagRegel,
): { etapper: Etappe[]; aarsak: ReiseAarsak | null } {
  const etapper: Etappe[] = [];
  let aarsak: ReiseAarsak | null = null;

  // UT-etappe.
  if (start.type === "ukjent") {
    aarsak = "posisjon_utilgjengelig"; // V12
  } else if (start.type === "kontor" && destinasjon.type === "byggeplass") {
    if (start.byggeplassId !== destinasjon.byggeplassId) {
      // V15: kontoret ligger IKKE i destinasjonen → ut-etappe.
      const r = byggEtappe(
        "ut",
        start.oppmotestedId,
        destinasjon.byggeplassId,
        utCelle,
        regel,
      );
      if (r.etappe) etapper.push(r.etappe);
      else aarsak = r.aarsak;
    }
  }
  // start.type ∈ { "byggeplass", "utenfor" } → ingen ut-etappe (V11), ingen årsak.

  // RETUR-etappe (V7): slutt er kontor → destinasjon → slutt-oppmøtested.
  if (
    slutt.type === "kontor" &&
    destinasjon.type === "byggeplass" &&
    slutt.byggeplassId !== destinasjon.byggeplassId
  ) {
    const r = byggEtappe(
      "retur",
      slutt.oppmotestedId,
      destinasjon.byggeplassId,
      returCelle,
      regel,
    );
    if (r.etappe) etapper.push(r.etappe);
    // Retur-mangel setter ikke overordnet årsak (B5-gaten gjelder ut/start=kontor).
  }

  return { etapper, aarsak };
}

/**
 * Fordel dagens pause over midnatt-segmentene (lengste-først) slik at intet
 * segment får negativ arbeidstid. Et kort start-segment (sen start nær midnatt)
 * kunne ikke bære pausen → `Math.max(0, …)` kappet arbeidstimene til 0 og timene
 * forsvant; derfor omfordeling til lengste-først med rest-overflyt.
 *
 * 🔴 L1-B (B2): reisen er IKKE lenger et fradrag her — ut-etappen trekkes fra
 * start-segmentets vindu og retur-etappen fra slutt-segmentets (i
 * `beregnDagsforslag`), reise-raden legges på det segmentet etappen hører til.
 * Denne funksjonen fordeler KUN pausen. «Én trekkmekanisme: vinduet.»
 *
 * Pause kappes til hvert segments gjenværende kapasitet og rest omfordeles —
 * aldri kapp-og-mist. Ett segment (normalt dagskift) → alt på det ene.
 */
export function fordelPause(
  bruttoTimer: number[],
  pauseTotalMin: number,
): { pauseMin: number[] } {
  const n = bruttoTimer.length;
  const kapasitet = bruttoTimer.slice();
  const pauseTimerPer = new Array<number>(n).fill(0);

  // Terskel-gaten (AML §10-9) ligger hos KALLEREN (2026-11-13): den må se hele
  // dagen — også rader som alt står på sedelen — ikke bare denne økta. Kalleren
  // sender 0 når dagen er under terskel eller pausen alt er ført
  // (`dagPauseMinForNyttArbeid`, samme regel som manuell føring).
  const effektivPauseTotalMin = pauseTotalMin;

  const lengsteForst = bruttoTimer
    .map((b, i) => ({ b, i }))
    .sort((a, z) => z.b - a.b)
    .map((x) => x.i);

  // Pause: lengste-først. Bruker den terskel-gatede pausen (0 når dagen < 5,5t).
  let restPauseTimer = Math.max(0, effektivPauseTotalMin) / 60;
  for (const i of lengsteForst) {
    if (restPauseTimer <= 0) break;
    const ta = Math.min(restPauseTimer, kapasitet[i]!);
    pauseTimerPer[i]! += ta;
    kapasitet[i]! -= ta;
    restPauseTimer -= ta;
  }

  return { pauseMin: pauseTimerPer.map((t) => Math.round(t * 60)) };
}

/**
 * REN utregning av et dagsseddel-forslag fra en avsluttet arbeidsdag-økt.
 *
 * Slice 4a: en økt som krysser midnatt deles i én dagsseddel per kalenderdag
 * (`splittVedMidnatt`); timene summerer til reell total. Reise + firma-pause
 * fordeles over segmentene (pause→lengste, reise→start m/ overflyt). Per dag
 * gjelder dagens auto-fordeling: Timelønn opp til dagsnorm + «Overtid 50%» for
 * overskytende. Prosjekt = nærmeste via Haversine (start-GPS, ellers slutt-GPS).
 *
 * `prosjektId: null` = prosjekt/aktivitet kunne ikke utledes → kalleren går til
 * manuell opprettelse (samme som dagens `genererForslag` returnerte `id: null`).
 */
function beregnDagsforslagKjerne(input: BeregnDagsforslagInput): Dagsforslag {
  const reiseIder: ReadonlySet<string> = new Set(input.reiseLonnsartIder ?? []);
  const tomt: Dagsforslag = {
    prosjektId: null,
    aktivitetId: null,
    kappet: false,
    prosjektUkjent: false,
    reiseAarsak: null,
    destinasjonAarsak: null,
    normStatus: null,
    datoer: [],
  };
  const { dag, sluttIso, regel } = input;

  // Ingen prosjekt/aktivitet-katalog → kildeManglet (som før; anvend → startSheetId null).
  if (input.prosjekter.length === 0) return tomt;
  if (input.aktiviteter.length === 0) return tomt;

  // 1. Prosjektvalg (§2): destinasjonens prosjekt (A5) → arbeiderens aktive
  //    prosjekt → prosjektUkjent. 🔴 `prosjekter[0]`-fallbacken (H1 stille feil)
  //    og `velgNaermesteProsjekt` (nærmeste-uten-grense) er fjernet.
  const destinasjonAarsak =
    input.reiseOppslag?.destinasjon.type === "ukjent"
      ? input.reiseOppslag.destinasjon.aarsak
      : null;
  // L3-A: arbeiderens valg i bekreft-skjermen vinner.
  const retting = input.retting;
  // (15): globalt aktivt prosjekt kan være et gjesteprosjekt (annet firma) som
  // ikke finnes i timer-katalogen. Da ignoreres det → prosjektUkjent («velg
  // prosjekt»), aldri et timerprosjekt som feiler ved lagring/sync.
  const aktivtTimerProsjektId =
    input.aktivtProsjektId != null &&
    input.prosjekter.some((p) => p.id === input.aktivtProsjektId)
      ? input.aktivtProsjektId
      : null;
  const prosjektId =
    retting?.prosjektId ??
    input.destinasjonProsjektId ??
    aktivtTimerProsjektId;
  if (prosjektId == null) {
    // Dagen holdes åpen; meldingen navngir veien ut (velg prosjekt, prøv igjen).
    return { ...tomt, prosjektUkjent: true, destinasjonAarsak };
  }

  // 2. Aktivitet — default «Anleggsarbeid» eller første.
  const aktivitet =
    (retting?.aktivitetId
      ? input.aktiviteter.find((a) => a.id === retting.aktivitetId)
      : undefined) ??
    input.aktiviteter.find((a) => a.navn === "Anleggsarbeid") ??
    input.aktiviteter[0]!;

  // 3. Reise-etapper (B1): ut + retur, klassifisert pr. etappe (V10). Kun
  //    reisetid-etapper trekker vinduet og gir reise-rad; arbeidstid-etapper
  //    (V3) teller som arbeid og ligger i prosjektraden.
  let etapper: Etappe[] = [];
  let reiseAarsak: ReiseAarsak | null = null;
  const reiseOppslag = input.reiseOppslag;
  if (regel && reiseOppslag) {
    const r = beregnReiseEtapper(
      reiseOppslag.start,
      reiseOppslag.slutt,
      reiseOppslag.destinasjon,
      reiseOppslag.utCelle,
      reiseOppslag.returCelle,
      regel,
    );
    etapper = r.etapper;
    reiseAarsak = r.aarsak;
  }
  // Løs lønnsart pr. reisetid-etappe (samme kilde som før: avstandsbånd →
  // fallbackReiseLonnsartId). Uten lønnsart → ingen reise-rad, ingen vindu-trekk.
  //
  // B1: etappen reduseres IKKE lenger til { kjoretidMin, lonnsartId } — hele
  // sporet (retning, oppmøtested, byggeplass, avstand, regel-snapshot) bæres til
  // beregnSegment, som skriver det på raden. reiseRegel er regelen slik den var
  // da raden ble laget (ReiseRegelSnapshot).
  const reiseForRetning = (
    retning: "ut" | "retur",
  ): ReiseRadResolvert | null => {
    if (!reiseOppslag || !regel) return null;
    const e = etapper.find(
      (x) => x.retning === retning && x.kategori === "reisetid",
    );
    if (!e) return null;
    const lonnsartId = løsReiseLonnsartId(
      e.avstandM,
      reiseOppslag.grensepunkter,
      reiseOppslag.fallbackReiseLonnsartId,
    );
    if (!lonnsartId) {
      // POST (13) B: aldri stille — reisetid-etappen fantes, men ingen art å
      // føre den på. Første årsak vinner (ut-årsaken settes av beregnReiseEtapper).
      reiseAarsak ??= "mangler_reise_lonnsart";
      return null;
    }
    const reiseRegel: ReiseRegelSnapshot = {
      enhet: regel.reiseTerskelEnhet as ReiseEnhet,
      terskelMin: regel.reiseTerskelMin,
      terskelM: regel.reiseTerskelM ?? null,
      underType: regel.reiseUnderTerskelType as ReiseKategori,
      overType: regel.reiseOverTerskelType as ReiseKategori,
      kategori: e.kategori,
      grensepunktTreff: grensepunktTraff(e.avstandM, reiseOppslag.grensepunkter),
    };
    return {
      lonnsartId,
      retning: e.retning,
      oppmotestedId: e.oppmotestedId,
      byggeplassId: e.byggeplassId,
      kjoretidMin: e.kjoretidMin,
      avstandM: e.avstandM,
      reiseRegel,
    };
  };
  const utReise = reiseForRetning("ut");
  const returReise = reiseForRetning("retur");

  // 4. UF-2: enkelt-skift-cap FØR midnatt-splitt. Glemt-dag-kapplengde =
  //    ut-reise + dagsnorm + pause (M13 → B2): kappet skal romme reisen og
  //    pausen, ikke bare normen.
  const startDato = formatIsoDato(new Date(dag.startAt));
  const effektivStartDag = input.effektivPerDato[startDato];
  if (!effektivStartDag) return tomt;
  const normForKapp =
    effektivStartDag.dagsnorm > 0 ? effektivStartDag.dagsnorm : 7.5;
  const kappLengdeTimer =
    (utReise ? utReise.kjoretidMin / 60 : 0) +
    normForKapp +
    effektivStartDag.pauseMin / 60;
  const { sluttIso: effektivSluttIso, kappet } = kappGlemtDagSlutt(
    dag.startAt,
    sluttIso,
    { deteksjonsTimer: MAKS_ENKELTSKIFT_TIMER, kappLengdeTimer },
  );
  const effektivSisteKilde: "bruker" | "system" = kappet
    ? "system"
    : input.sisteSegmentKilde;

  // Midnatt-splitt (Slice 4a): én dagsseddel per kalenderdag. KUN pausen fordeles
  // over segmentene (reisen er ikke lenger et fradrag — B2).
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);
  const deltVedMidnatt = segmenter.length > 1;
  const bruttoPerSeg = segmenter.map(
    (s) =>
      (new Date(s.sluttIso).getTime() - new Date(s.startIso).getTime()) /
      3_600_000,
  );
  // ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer» — SAMME regel som
  // manuell føring (`avgjorRadPause`) og serveren (`vurderRadTimer`):
  //   1) dagsbrutto = rader som alt står på sedelen (arbeid OG reise) +
  //      ARBEIDET i økta (rettet arbeidsvindu; fjernet arbeid = 0) + økta sine
  //      reisetid-etapper > 5,5 t. ORDRE 2026-11-14 (Kenneth: «den gamle koden
  //      var rett»): reisen teller mot grensen, som da terskelen ble målt på
  //      GPS-spennet. `arbeidstid`-etapper ligger alt i arbeidsvinduet.
  //   2) bæreren er segmentet der summert arbeid (sedelens rader før + tidligere
  //      segmenter) passerer firmaets grense; ellers siste segment med arbeid.
  //      Pausepunktet = `pauseFraForRad` — et gap mellom økter er ingen pause.
  //   3) ingen eksisterende rad bærer alt pausen (én pr. dag)
  // Lagrede rader endres aldri — pausen legges på den nye økta.
  const andreRader = segmenter.flatMap(
    (s) => input.eksisterendeSedelPerDato[s.dato]?.eksisterendeRader ?? [],
  );
  const sisteSegIdx = segmenter.length - 1;
  const arbeidPerSeg = segmenter.map((seg, i) => {
    const rettDato = retting?.perDato?.[seg.dato];
    if (rettDato?.fjernArbeid === true) return null;
    const segUt = seg.erStartSegment ? utReise : null;
    const segRetur = i === sisteSegIdx ? returReise : null;
    const v = arbeidsvinduMs(
      rettSegmentVindu(seg, rettDato, segUt, segRetur),
      segUt,
      segRetur,
      regel?.tidsrundingMinutter ?? null,
    );
    if (v.sluttMs <= v.startMs) return null;
    const fraMin = hhmmTilMin(tilHHMM(new Date(v.startMs).toISOString()));
    return { fraMin, min: Math.round((v.sluttMs - v.startMs) / 60_000) };
  });
  // Reisetid-etappene som blir reise-rader (ut på start-segmentet, retur på
  // siste) — samme kjøretid som `beregnSegment` skriver som radens timer.
  const nyReiseMin = segmenter.reduce(
    (sum, seg, i) =>
      sum +
      (seg.erStartSegment && utReise ? utReise.kjoretidMin : 0) +
      (i === sisteSegIdx && returReise ? returReise.kjoretidMin : 0),
    0,
  );
  const dagPauseMin = dagPauseMinForNyttArbeid({
    andreRader,
    nyBruttoTimer: arbeidPerSeg.reduce((s, a) => s + (a ? a.min : 0), 0) / 60,
    nyReiseTimer: nyReiseMin / 60,
    standardPauseMin: effektivStartDag.pauseMin,
  });
  const pauseEtterTimerFor = (dato: string) =>
    input.effektivPerDato[dato]?.pauseEtterTimer ??
    regel?.standardPauseEtterTimer ??
    DEFAULT_PAUSE_ETTER_TIMER;
  // Arbeid før hvert segment: sedelens rader før segmentstart + tidligere segmenter.
  let arbeidTidligereSeg = 0;
  const arbeidForSeg = arbeidPerSeg.map((a) => {
    const her = arbeidTidligereSeg;
    arbeidTidligereSeg += a ? a.min : 0;
    return her;
  });
  const passererGrensen = (i: number): boolean => {
    const a = arbeidPerSeg[i];
    if (!a) return false;
    const rader = input.eksisterendeSedelPerDato[segmenter[i]!.dato]?.eksisterendeRader ?? [];
    const radArbeid = rader.reduce((sum, r) => {
      // Grensen er 4 ARBEIDStimer — lagrede reise-rader teller ikke her.
      if (!r.fraTid || !r.tilTid || r.erReise === true) return sum;
      const f = hhmmTilMin(r.fraTid);
      const t = hhmmTilMin(r.tilTid);
      return t > f && f < a.fraMin ? sum + (Math.min(t, a.fraMin) - f) : sum;
    }, 0);
    const foer = arbeidForSeg[i]! + radArbeid;
    const grense = Math.round(pauseEtterTimerFor(segmenter[i]!.dato) * 60);
    return foer < grense && foer + a.min > grense;
  };
  let baererIdx = segmenter.findIndex((_, i) => passererGrensen(i));
  if (baererIdx < 0) {
    baererIdx = arbeidPerSeg.reduce((sist, a, i) => (a ? i : sist), -1);
  }
  // Spennkrav (VILKÅR 1, gate 2026-11-14): bæreren må ha arbeid LENGRE enn
  // pausen, ellers pause 0 og fullt spenn (samme krav som `dagPauseMinForNyttArbeid`).
  const baererKanBaere = (arbeidPerSeg[baererIdx]?.min ?? 0) > dagPauseMin;
  const pauseFordelt = segmenter.map((_, i) =>
    i === baererIdx && baererKanBaere ? dagPauseMin : 0,
  );
  // Pausepunktet pr. segment (brukes av `beregnSegment` for bærerens pauseFra).
  const pauseFraPerSeg = segmenter.map((seg, i) => {
    const a = arbeidPerSeg[i];
    if (!a) return null;
    const effektiv = input.effektivPerDato[seg.dato];
    const pauseEtterTimer = pauseEtterTimerFor(seg.dato);
    return pauseFraForRad({
      fraTid: minTilHhmm(a.fraMin),
      tilTid: minTilHhmm(a.fraMin + a.min),
      andreRader: input.eksisterendeSedelPerDato[seg.dato]?.eksisterendeRader ?? [],
      pauseEtterTimer,
      pauseMin: retting?.perDato?.[seg.dato]?.pauseMin ?? effektivStartDag.pauseMin,
      fastPauseFra: effektiv
        ? fastPauseFraFor({
            startTid: effektiv.startTid,
            pauseEtterTimer,
            pauseReferanse: effektiv.pauseReferanse ?? "ankomst",
          })
        : null,
      arbeidForEkstraMin: arbeidForSeg[i]!,
    });
  });

  // F4: byggeplass-default-kjede → GPS (arbeidsdag) → global kontekst → ingen.
  // D2: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt.
  const byggeplassDefault =
    retting?.byggeplassId !== undefined
      ? retting.byggeplassId
      : (dag.byggeplassId ??
        (prosjektId === input.aktivtProsjektId
          ? input.kontekstByggeplassId
          : null));

  const sisteIdx = segmenter.length - 1;
  const datoer = segmenter.map((seg, i) => {
    const erSiste = i === sisteIdx;
    const sluttTidKilde: "bruker" | "midnatt" | "system" = erSiste
      ? effektivSisteKilde
      : "midnatt";
    const eksisterende = input.eksisterendeSedelPerDato[seg.dato] ?? {
      finnes: false,
      status: null,
      eksisterendeRader: [],
    };
    // Ut-etappen hører til start-segmentet, retur-etappen til slutt-segmentet.
    const segUt = seg.erStartSegment ? utReise : null;
    const segRetur = erSiste ? returReise : null;
    const rettDato = retting?.perDato?.[seg.dato];
    return beregnSegment({
      segment: rettSegmentVindu(seg, rettDato, segUt, segRetur),
      prosjektId,
      aktivitetId: aktivitet.id,
      byggeplassId: byggeplassDefault,
      pauseMin: rettDato?.pauseMin ?? pauseFordelt[i]!,
      pauseFra: pauseFraPerSeg[i] ?? null,
      fjernArbeid: rettDato?.fjernArbeid === true,
      overtidFra: rettDato?.overtidFra ?? null,
      overtidLonnsartId: rettDato?.overtidLonnsartId ?? null,
      overtidAv: rettDato?.overtidAv === true,
      lonnsartPerLinje: rettDato?.lonnsartPerLinje,
      fravaerTil: rettDato?.fravaerTil ?? null,
      reiseLonnsartIder: reiseIder,
      utReise: segUt,
      returReise: segRetur,
      tidsrundingMinutter: regel?.tidsrundingMinutter ?? null,
      deltVedMidnatt,
      sluttTidKilde,
      effektiv: input.effektivPerDato[seg.dato],
      alleLonnsarter: input.alleLonnsarter,
      standardLonnsartId: input.standardLonnsartId,
      eksisterende,
    });
  });

  // POST (13) L2 TILLEGG: overføring første/siste dag i perioden — egen
  // forslagsrad, aldri automatisk lagret (arbeideren bekrefter/fjerner den).
  const medOverforing = leggTilOverforinger(datoer, input.overforinger, {
    regel,
    grensepunkter: reiseOppslag?.grensepunkter ?? [],
    fallbackReiseLonnsartId: reiseOppslag?.fallbackReiseLonnsartId ?? null,
    standardLonnsartId: input.standardLonnsartId,
    prosjektId,
    aktivitetId: aktivitet.id,
    eksisterendeSedelPerDato: input.eksisterendeSedelPerDato,
    perDato: retting?.perDato,
  });
  reiseAarsak ??= medOverforing.aarsak;

  return {
    prosjektId,
    aktivitetId: aktivitet.id,
    kappet,
    prosjektUkjent: false,
    reiseAarsak,
    destinasjonAarsak,
    normStatus: effektivStartDag.normStatus ?? null,
    datoer: leggTilManuellReise(medOverforing.datoer, retting?.manuellReise),
    ...(retting?.beskrivelse ? { beskrivelsePerKort: retting.beskrivelse } : {}),
  };
}

/**
 * Ordre 2026-11-15 (17) P1 + Kenneth-vedtak 2026-11-15: forslaget med
 * reisekjeden lagt etter hverandre (overføring → reise → arbeid → reise →
 * overføring). Kortet arbeideren har rettet (`perDato.reiseTid`) er fast
 * punkt; beregnede naboer flytter seg, rettede naboer står. Flytter en rettet
 * reise arbeidsstart/-slutt, regnes kjernen ut på nytt med det nye
 * arbeidsvinduet (arbeidstimer, pause og overtid følger).
 */
export function beregnDagsforslag(input: BeregnDagsforslagInput): Dagsforslag {
  const forste = beregnDagsforslagKjerne(input);
  const perDato = input.retting?.perDato ?? {};
  const injisert: Record<string, DagsforslagRettingDato> = {};
  for (const d of forste.datoer) {
    const plan = planleggKjede(d, perDato[d.dato]);
    if (!plan) continue;
    const rett = perDato[d.dato];
    const arbeid = plan.ut.find((k) => k.type === "arbeid");
    if (!arbeid) continue;
    const ramme = plan.ramme;
    const nyFra = !rett?.arbeidFra && arbeid.fraMin !== ramme.fraMin ? minTilHhmm(arbeid.fraMin) : undefined;
    const nyTil = !rett?.arbeidTil && arbeid.tilMin !== ramme.tilMin ? minTilHhmm(arbeid.tilMin) : undefined;
    if (nyFra || nyTil) {
      injisert[d.dato] = {
        ...rett,
        ...(nyFra ? { arbeidFra: nyFra } : {}),
        ...(nyTil ? { arbeidTil: nyTil } : {}),
      };
    }
  }
  const forslag =
    Object.keys(injisert).length === 0
      ? forste
      : beregnDagsforslagKjerne({
          ...input,
          retting: { ...input.retting, perDato: { ...perDato, ...injisert } },
        });
  return {
    ...forslag,
    datoer: forslag.datoer.map((d) =>
      sekvenserDag(d, perDato[d.dato], input.eksisterendeSedelPerDato[d.dato]?.eksisterendeRader ?? []),
    ),
  };
}

type KjedePlan = {
  /** Kortene i kjederekkefølge, sekvensert. */
  ut: KjedeKort[];
  /** Arbeidsrammen før sekvensering (min fra / maks til av arbeidsradene). */
  ramme: { fraMin: number; tilMin: number };
  /** Kortnøkkel → radindekser i `dag.rader`. */
  rader: Map<string, number[]>;
};

/** Bygger og sekvenserer dagens kjede. `null` = ingen kjede (ingen arbeid eller ingen reise). */
function planleggKjede(
  d: DagsforslagDag,
  rett: DagsforslagRettingDato | undefined,
): KjedePlan | null {
  const erKjedeRad = (r: DagsforslagRad) => r.kjedeNokkel != null || r.erReise;
  const arbeidIdx = d.rader
    .map((r, i) => (!erKjedeRad(r) && r.fraTid && r.tilTid ? i : -1))
    .filter((i) => i !== -1);
  const kjedeIdx = d.rader
    .map((r, i) => (erKjedeRad(r) && r.fraTid && r.tilTid ? i : -1))
    .filter((i) => i !== -1);
  if (arbeidIdx.length === 0 || kjedeIdx.length === 0) return null;
  const fraMin = Math.min(...arbeidIdx.map((i) => hhmmTilMin(d.rader[i]!.fraTid!)));
  const tilMin = Math.max(...arbeidIdx.map((i) => hhmmTilMin(d.rader[i]!.tilTid!)));
  const midt = (fraMin + tilMin) / 2;

  type Kandidat = { nokkel: string; side: "ut" | "retur"; ytterst: boolean; fra: number; til: number };
  const kandidater: Kandidat[] = [];
  const rader = new Map<string, number[]>();
  for (const i of kjedeIdx) {
    const r = d.rader[i]!;
    const fra = hhmmTilMin(r.fraTid!);
    const til = hhmmTilMin(r.tilTid!);
    const side: "ut" | "retur" =
      r.overforing?.retning ?? r.reiseRetning ?? ((fra + til) / 2 <= midt ? "ut" : "retur");
    const nokkel = r.kjedeNokkel ?? `reise-${side}`;
    const fins = rader.get(nokkel);
    if (fins) {
      fins.push(i);
      continue;
    }
    rader.set(nokkel, [i]);
    kandidater.push({ nokkel, side, ytterst: r.overforing != null, fra, til });
  }
  // Ut-siden: overføring ytterst, så reisene i tidsrekkefølge. Retur speilet.
  const ut = kandidater
    .filter((k) => k.side === "ut")
    .sort((a, b) => Number(b.ytterst) - Number(a.ytterst) || a.fra - b.fra);
  const retur = kandidater
    .filter((k) => k.side === "retur")
    .sort((a, b) => Number(a.ytterst) - Number(b.ytterst) || a.fra - b.fra);
  const tilKort = (k: Kandidat): KjedeKort => {
    const rettet = rett?.reiseTid?.[k.nokkel];
    return rettet
      ? {
          nokkel: k.nokkel,
          type: "reise",
          fraMin: hhmmTilMin(rettet.fraTid),
          tilMin: hhmmTilMin(rettet.tilTid),
          rettet: true,
        }
      : { nokkel: k.nokkel, type: "reise", fraMin: k.fra, tilMin: k.til };
  };
  const kort: KjedeKort[] = [
    ...ut.map(tilKort),
    {
      nokkel: "arbeid",
      type: "arbeid",
      fraMin,
      tilMin,
      rettetFra: rett?.arbeidFra != null,
      rettetTil: rett?.arbeidTil != null,
    },
    ...retur.map(tilKort),
  ];
  return { ut: sekvenserReisekjede(kort), ramme: { fraMin, tilMin }, rader };
}

/**
 * Etterpass: setter kjedens tider på reise-/overføringsradene, nøkkelen på
 * auto-reisen, og sjekker overlapp mot dagens og lagrede rader (ordre (17)
 * punkt 2 — sperres med begrunnelse, droppes aldri stille).
 */
function sekvenserDag(
  d: DagsforslagDag,
  rett: DagsforslagRettingDato | undefined,
  eksisterende: ReadonlyArray<{ fraTid?: string | null; tilTid?: string | null }>,
): DagsforslagDag {
  if (d.blokkert) return d;
  let rader = d.rader;
  let konflikt = d.kjedeKonflikt ?? null;
  const plan = planleggKjede(d, rett);
  if (plan) {
    rader = [...d.rader];
    const fjern = new Set<number>();
    const arbeidPos = plan.ut.findIndex((k) => k.type === "arbeid");
    for (const [pos, k] of plan.ut.entries()) {
      if (k.type !== "reise") continue;
      const idx = plan.rader.get(k.nokkel) ?? [];
      const overforing = rader[idx[0]!]?.overforing;
      if (k.fraMin < 0 || k.tilMin > 24 * 60) {
        // Retting skjøv en beregnet overføring/reise over midnatt.
        konflikt ??= {
          type: "overMidnatt",
          retning: overforing?.retning ?? (k.fraMin < 0 ? "ut" : "retur"),
          erOverforing: overforing != null,
        };
        if (overforing) idx.forEach((i) => fjern.add(i));
        continue;
      }
      if (idx.length !== 1) continue; // flere rader på samme nøkkel: urørt
      const i = idx[0]!;
      const r = rader[i]!;
      const fraTid = minTilHhmm(k.fraMin);
      const tilTid = minTilHhmm(k.tilMin);
      rader[i] = {
        ...r,
        fraTid,
        tilTid,
        kjedeNokkel: k.nokkel,
        kjedeSide: pos < arbeidPos ? "ut" : "retur",
        ...(k.rettet ? { timer: Math.round(((k.tilMin - k.fraMin) / 60) * 100) / 100 } : {}),
      };
    }
    rader = rader.filter((_, i) => !fjern.has(i));
  }
  if (!konflikt) {
    for (let i = 0; i < rader.length; i++) {
      const r = rader[i]!;
      if (!r.fraTid || !r.tilTid) continue;
      const annen = finnOverlappendeTidsrom(r.fraTid, r.tilTid, [...rader.slice(i + 1), ...eksisterende]);
      if (annen?.fraTid && annen.tilTid) {
        konflikt = {
          type: "overlapp",
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          annenFraTid: annen.fraTid,
          annenTilTid: annen.tilTid,
        };
        break;
      }
    }
  }
  return { ...d, rader, kjedeKonflikt: konflikt };
}

/**
 * L3-A (A1): arbeiderens fra/til er ARBEIDSVINDUET. Segmentet (= sedelens
 * vindu) utvides med reisen i hver ende, slik at ut-reisen slutter ved
 * arbeid-fra og retur-reisen starter ved arbeid-til. Reiselengden (matrisen)
 * og klassifiseringen røres ikke. Uten fra/til → segmentet uendret.
 */
function rettSegmentVindu<
  S extends { dato: string; startIso: string; sluttIso: string },
>(
  seg: S,
  rett: DagsforslagRettingDato | undefined,
  utReise: ReiseRadResolvert | null,
  returReise: ReiseRadResolvert | null,
): S {
  if (!rett?.arbeidFra && !rett?.arbeidTil) return seg;
  const klokke = (hhmm: string) => new Date(`${seg.dato}T${hhmm}:00`).getTime();
  const startIso = rett.arbeidFra
    ? new Date(
        klokke(rett.arbeidFra) - (utReise ? utReise.kjoretidMin : 0) * 60_000,
      ).toISOString()
    : seg.startIso;
  const sluttIso = rett.arbeidTil
    ? new Date(
        klokke(rett.arbeidTil) +
          (returReise ? returReise.kjoretidMin : 0) * 60_000,
      ).toISOString()
    : seg.sluttIso;
  return { ...seg, startIso, sluttIso };
}

/** Utregning av ett dag-segments rader — ren speiling av rad-genereringen i
 *  det gamle `opprettDagsseddelForSegment` (uten find-or-create og DB-insert). */
function beregnSegment(a: {
  segment: {
    dato: string;
    startIso: string;
    sluttIso: string;
    erStartSegment: boolean;
  };
  prosjektId: string;
  aktivitetId: string;
  byggeplassId: string | null;
  pauseMin: number;
  /** ORDRE 2026-11-13: pausepunktet (`pauseFraForRad`) for segmentets arbeid. */
  pauseFra: string | null;
  /** L3-A: arbeideren fjernet datoens arbeidsrader (K12 a — reisen står). */
  fjernArbeid: boolean;
  /** ORDRE 34 pkt 4: rettet overtid-start "HH:MM" — null = split ved dagsnorm. */
  overtidFra: string | null;
  /** ORDRE 34 pkt 4: valgt overtid-lønnsart — null = `velgOvertidLonnsart`. */
  overtidLonnsartId: string | null;
  /** ORDRE (27b) V5a: overtiden slått av — alt arbeid er normaltid. */
  overtidAv?: boolean;
  /** ORDRE (28) V7: arbeiderens lønnsart pr. linje. */
  lonnsartPerLinje?: Partial<Record<ArbeidLinje, string>>;
  /** RETUR (28) B9: slutten på fraværet på normallinja. null = linjas slutt. */
  fravaerTil: string | null;
  /** RETUR (28) A1: reise-arter — aldri en linjes lønnsart. */
  reiseLonnsartIder: ReadonlySet<string>;
  /** Ut-reise (reisetid) på start-segmentet — forskyver arbeidsstart + egen rad. null ellers. */
  utReise: ReiseRadResolvert | null;
  /** Retur-reise (reisetid) på slutt-segmentet — forskyver arbeidsslutt + egen rad. null ellers. */
  returReise: ReiseRadResolvert | null;
  tidsrundingMinutter: number | null;
  deltVedMidnatt: boolean;
  sluttTidKilde: "bruker" | "midnatt" | "system";
  effektiv: DagsforslagEffektiv | undefined;
  alleLonnsarter: DagsforslagLonnsart[];
  standardLonnsartId: string | null;
  eksisterende: DagsforslagEksisterendeSedel;
}): DagsforslagDag {
  const { segment, eksisterende } = a;
  const erNy = !eksisterende.finnes;
  // UF-1: sendt/godkjent → kan ikke appende ny økt (ville gi server-konflikt).
  const blokkert =
    eksisterende.finnes &&
    eksisterende.status !== "draft" &&
    eksisterende.status !== "returned";
  // F-g: sedelen HADDE rader før denne økta (kun i append-grenen, som i dag).
  const harEksisterendeRader =
    eksisterende.finnes && !blokkert && eksisterende.eksisterendeRader.length > 0;

  const base: DagsforslagDag = {
    dato: segment.dato,
    erStartSegment: segment.erStartSegment,
    segmentStartIso: segment.startIso,
    segmentSluttIso: segment.sluttIso,
    blokkert,
    eksisterendeStatus: eksisterende.status,
    erNy,
    harEksisterendeRader,
    byggeplassId: a.byggeplassId,
    pauseMin: a.pauseMin,
    deltVedMidnatt: a.deltVedMidnatt,
    sluttTidKilde: a.sluttTidKilde,
    // B5: normens kilde-status + snapshot for datoen (fra svar-cachen via
    // effektiv). null når normen er ukjent (ingen svar-cache).
    normStatus: a.effektiv?.normStatus ?? null,
    normSnapshot: a.effektiv?.normSnapshot ?? null,
    vekForOverlapp: [],
    raderDroppetUtenLonnsart: 0,
    rader: [],
  };
  // Blokkert → ingen append (speiler den tidlige `blokkertSendt`-returen: 0
  // rader, ingen overlapp-sjekk).
  if (blokkert) return base;

  // B2 — arbeidsvinduet er ENESTE trekkmekanisme. Ut-etappen (reisetid) skyver
  // arbeidsstart fram fra start-GPS; retur-etappen skyver arbeidsslutt tilbake
  // fra slutt-GPS. Reisen trekkes dermed via vinduet, ikke via timene — det gamle
  // `totalTimer − reisetidTimer` er FJERNET (ville trukket reisen to ganger med
  // etapper i begge ender).
  // Avrunding (Kenneth 2026-11-13: «benytt fra til -> rund av til nærmeste 15
  // minutter»): arbeidsstart og arbeidsslutt rundes HVER FOR SEG til firmaets
  // tidsrunding-grid; timene er det rundede spennet minus pausen, så
  // `rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, pauseMin)` holder.
  // Den gamle avrundingen av varigheten er fjernet. En kant som BERØRER en
  // reise-etappe rundes ikke — reise-vinduet er utledet fra GPS ± matrise og må
  // fortsatt møte arbeidet i endepunktet (rører, overlapper ikke).
  const { startMs: arbeidsstartMs, sluttMs: arbeidssluttMs } = arbeidsvinduMs(
    segment,
    a.utReise,
    a.returReise,
    a.tidsrundingMinutter,
  );
  const arbeidsstartIso = new Date(arbeidsstartMs).toISOString();
  const bruttoVinduTimer = Math.max(0, (arbeidssluttMs - arbeidsstartMs) / 3_600_000);
  const arbeidstimer =
    Math.round(Math.max(0, bruttoVinduTimer - a.pauseMin / 60) * 100) / 100;

  const rader: DagsforslagRad[] = [];
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];
  let raderDroppetUtenLonnsart = 0;
  const linjerUtenLonnsart: DagsforslagLinjeUtenLonnsart[] = [];
  let fravaerTil: string | null = null;
  const eksisterendeTidsrom = eksisterende.eksisterendeRader;

  // Auto-fordeling normaltid/overtid (per dag). Overtid velges strukturert på
  // overtidsnivaa — ALDRI fritekst-navn (③a).
  if (arbeidstimer > 0 && !a.fjernArbeid) {
    const effektivDagsnorm = a.effektiv?.dagsnorm ?? 0;
    // V1: reisetid er ALDRI overtid. Normen er alltid `dagsnorm0` — det gamle
    // `reisetidTellerOvertid`-fradraget i terskelen er fjernet (flagget leses ikke).
    // ORDRE (27b) L1–L3: normen er det som er IGJEN etter døgnets registrerte
    // arbeid (`eksisterende.bruktAvNorm`). Ukjent norm og rest 0 er to ulike
    // grener i `klassifiserMotDognet` — aldri «0 = ingen norm» for rest 0.

    // Carve fra ARBEIDSSTART (etter ut-etappen), ikke segment-GPS-start.
    // reisetidTimer=0: vinduet har alt ekskludert reisen (B2).
    const arbeidsstartHHMM = tilHHMM(arbeidsstartIso);
    // ORDRE 2026-11-13: pausepunktet fra `beregnDagsforslag` (der summert
    // arbeid passerer grensen). ORDRE 36e pkt. 4: klemmes inn i arbeidstiden
    // som sikkerhet, så bæreren alltid har pausen i raden.
    const pauseFra = klemPauseInnIArbeid({
      arbeidsstartHHMM,
      arbeidstimer,
      pauseFra: a.pauseFra ?? arbeidsstartHHMM,
      pauseMin: a.pauseMin,
    });
    const vanlige: ArbeidstidSegment[] = a.overtidAv
      ? [{ overtidsnivaa: null, timer: arbeidstimer }]
      : a.overtidFra
      ? segmenterVedOvertidFra({
          arbeidstimer,
          arbeidsstartHHMM,
          overtidFra: a.overtidFra,
          pauseFra,
          pauseMin: a.pauseMin,
        })
      : klassifiserMotDognet({
          arbeidstimer,
          dagsnorm: effektivDagsnorm,
          bruktAvNorm: eksisterende.bruktAvNorm ?? 0,
        });
    // RETUR (28) B9 (Kenneth 2026-11-16): står normallinja på fravær, bruker
    // den ikke normen. Fraværet går til `fravaerTil` (ellers normallinjas slutt
    // slik delingen over gir den); arbeidet etter regnes PÅ NYTT mot den samme
    // normresten — normaltid (linja `arbeid`) til normen er brukt, så overtid.
    // Valgene står på linjene sine (V7); bare tidene på linjene etter flytter.
    // «Overtid fra» leses ikke i denne delingen (overtid følger normen);
    // «overtid av» (V5a) gir alt arbeid etter fraværet som normaltid.
    // RETUR 2 (28) A2: `fravaerTil` klemmes til kortet — tidligst ett
    // tidsrunding-steg (ellers 15 min) etter arbeidsstart — så fraværet aldri
    // blir 0 t, delingen aldri faller bort og en husket «Overtid fra» aldri
    // leses igjen mens fraværet står. Bare uten `fravaerTil` (valget gjøres
    // alltid med punktet, `velgLinjeLonnsart`) brukes normallinja slik delingen
    // over gir den.
    const normalValg = godtattLinjeLonnsart(
      a.alleLonnsarter,
      a.lonnsartPerLinje?.normal,
      a.reiseLonnsartIder,
    );
    let fravaerSeg: ArbeidstidSegment | undefined;
    if (normalValg?.type === "fravaer") {
      if (a.fravaerTil) {
        const steg = a.tidsrundingMinutter && a.tidsrundingMinutter > 0 ? a.tidsrundingMinutter : 15;
        const tidligst = hhmmTilMin(arbeidsstartHHMM) + steg;
        const klemt = Math.max(hhmmTilMin(a.fravaerTil), tidligst);
        const delt = segmenterVedOvertidFra({
          arbeidstimer,
          arbeidsstartHHMM,
          overtidFra: minTilHhmm(Math.min(klemt, 23 * 60 + 59)),
          pauseFra,
          pauseMin: a.pauseMin,
        })[0];
        // Dekker pausen hele første steg, er fraværet hele kortet (aldri 0 t).
        fravaerSeg =
          delt?.overtidsnivaa === null ? delt : { overtidsnivaa: null, timer: arbeidstimer };
      } else if (vanlige[0]?.overtidsnivaa === null) {
        fravaerSeg = vanlige[0];
      }
    }
    let segmenter: Array<ArbeidstidSegment & { linje: ArbeidLinje }>;
    let medFravaerDeling = false;
    if (fravaerSeg && fravaerSeg.overtidsnivaa === null) {
      const rest = Math.round((arbeidstimer - fravaerSeg.timer) * 100) / 100;
      const etter: ArbeidstidSegment[] =
        rest <= 0
          ? []
          : a.overtidAv
          ? [{ overtidsnivaa: null, timer: rest }]
          : klassifiserMotDognet({
              arbeidstimer: rest,
              dagsnorm: effektivDagsnorm,
              bruktAvNorm: eksisterende.bruktAvNorm ?? 0,
            });
      medFravaerDeling = true;
      segmenter = [
        { overtidsnivaa: null, timer: Math.min(fravaerSeg.timer, arbeidstimer), linje: "normal" },
        ...etter.map((s) => ({
          ...s,
          linje: (s.overtidsnivaa === null ? "arbeid" : "overtid") as ArbeidLinje,
        })),
      ];
    } else {
      segmenter = vanlige.map((s) => ({
        ...s,
        linje: (s.overtidsnivaa === null ? "normal" : "overtid") as ArbeidLinje,
      }));
    }
    // carve hopper over segmenter uten timer — fjernes her så linjene følger vinduene.
    segmenter = segmenter.filter((s) => s.timer > 0);
    const carvet = carveArbeidstider({
      startTid: arbeidsstartHHMM,
      reisetidTimer: 0,
      pauseFra,
      pauseMin: a.pauseMin,
      segmenter,
    });
    if (medFravaerDeling && carvet[0]) fravaerTil = carvet[0].tilTid;
    const valgtOvertid = godtattOvertidLonnsart(a.alleLonnsarter, a.overtidLonnsartId);
    for (const [radIndeks, vindu] of carvet.entries()) {
      const linje: ArbeidLinje = segmenter[radIndeks]!.linje;
      // ORDRE (28) V7: arbeiderens valg på linja vinner over forhåndsvalget.
      // Forhåndsvalg (V2): normaltid (overtidsnivaa=null) → firmaets
      // standard-lønnsart; overtid → velg strukturert på overtidsnivaa.
      const linjeValgRaa = godtattLinjeLonnsart(
        a.alleLonnsarter,
        a.lonnsartPerLinje?.[linje],
        a.reiseLonnsartIder,
      );
      // RETUR 2 (28): fravær på `arbeid`-linja godtas ikke (faller tilbake til
      // standardarten). Linja er normaltid som fyller normen; skulle den være
      // fravær, måtte arbeidet etter den regnes om igjen — et nytt fraværsvindu,
      // som a3 ikke har (Kenneth: fravær midt i kortet er ikke et reelt
      // tilfelle). Mer fravær føres ved å flytte «Fravær til».
      const linjeValg =
        linje === "arbeid" && linjeValgRaa?.type === "fravaer" ? null : linjeValgRaa;
      const lonnsartId =
        linjeValg?.id ??
        (vindu.overtidsnivaa === null
          ? a.standardLonnsartId
          : (valgtOvertid?.id ??
            velgOvertidLonnsart(a.alleLonnsarter, vindu.overtidsnivaa)?.id ??
            null));
      // ③a/③b: aldri feil-match, aldri stille drop — uten treff hoppes raden over.
      // Telles, så Slutt dag kan si «mangler lønnsart» i stedet for «for kort»;
      // ORDRE (28) V2: linja vises i Bekreft dag med «Velg lønnsart».
      if (!lonnsartId) {
        raderDroppetUtenLonnsart++;
        linjerUtenLonnsart.push({ linje, fraTid: vindu.fraTid, tilTid: vindu.tilTid, timer: vindu.timer });
        continue;
      }
      // 1b: play viker for overlappende manuell rad. Berøring i endepunkt teller
      // ikke. Ved treff settes IKKE play-raden inn; tidsrommet samles for varsel.
      if (
        finnOverlappendeTidsrom(vindu.fraTid, vindu.tilTid, eksisterendeTidsrom)
      ) {
        vekForOverlapp.push({ fraTid: vindu.fraTid, tilTid: vindu.tilTid });
        continue;
      }
      // F5: bæreren = carve-vinduet som absorberer lunsjen (klokke-gap ≈ pauseMin).
      // Den raden bærer sedelens pauseMin; øvrige rader får 0.
      const gapMin =
        hhmmTilMin(vindu.tilTid) -
        hhmmTilMin(vindu.fraTid) -
        Math.round(vindu.timer * 60);
      const radPauseMin = a.pauseMin > 0 && gapMin >= 1 ? a.pauseMin : 0;
      rader.push({
        projectId: a.prosjektId,
        lonnsartId,
        aktivitetId: a.aktivitetId,
        timer: vindu.timer,
        fraTid: vindu.fraTid,
        tilTid: vindu.tilTid,
        pauseMin: radPauseMin,
        // Arbeidsrad: ingen reise-spor. byggeplassId null → arver sedel-nivå
        // (byggeplassDefault), uendret oppførsel. tidKilde null (ikke reise).
        erReise: false,
        reiseRetning: null,
        reiseOppmotestedId: null,
        byggeplassId: null,
        reiseKjoretidMin: null,
        reiseAvstandM: null,
        reiseKilde: null,
        reiseRegel: null,
        tidKilde: null,
        radIndeks,
        linje,
      });
    }
  }

  // Reise-rader (B1/B2) — én rad pr. reisetid-etappe på dette segmentet (ut på
  // start, retur på slutt). `timer` = etappens kjøretid.
  //
  // B2 V8 — klokkevindu på reise-raden. REISE-UNNTAKET (tidligere null-tider)
  // er REVERSERT med henvisning til V8: reisen har et vindu som BERØRER
  // arbeidsvinduet i endepunktet (ut.tilTid = arbeidsstart, retur.fraTid =
  // arbeidsslutt), så de rører, men overlapper ikke (tidsromOverlapper er
  // streng). 🔴 Vinduet SER målt ut men er UTLEDET fra GPS ± matrise — derfor
  // tidKilde = "utledet"; markøren er det som gjør V8 forenlig med sporbarheten.
  //   ut:    fraTid = segment-start,        tilTid = segment-start + kjøretid
  //   retur: fraTid = segment-slutt − kjøretid, tilTid = segment-slutt
  for (const r of [a.utReise, a.returReise]) {
    if (!r) continue;
    const kjoretidMs = r.kjoretidMin * 60_000;
    let fraIso: string;
    let tilIso: string;
    if (r.retning === "ut") {
      const startMs = new Date(segment.startIso).getTime();
      fraIso = segment.startIso;
      tilIso = new Date(startMs + kjoretidMs).toISOString();
    } else {
      const sluttMs = new Date(segment.sluttIso).getTime();
      fraIso = new Date(sluttMs - kjoretidMs).toISOString();
      tilIso = segment.sluttIso;
    }
    rader.push({
      projectId: a.prosjektId,
      lonnsartId: r.lonnsartId,
      aktivitetId: a.aktivitetId,
      timer: Math.round((r.kjoretidMin / 60) * 100) / 100,
      fraTid: tilHHMM(fraIso),
      tilTid: tilHHMM(tilIso),
      pauseMin: 0,
      erReise: true,
      reiseRetning: r.retning,
      reiseOppmotestedId: r.oppmotestedId,
      byggeplassId: r.byggeplassId,
      reiseKjoretidMin: r.kjoretidMin,
      reiseAvstandM: r.avstandM,
      reiseKilde: "matrise",
      reiseRegel: r.reiseRegel,
      tidKilde: "utledet",
    });
  }

  return {
    ...base,
    vekForOverlapp,
    raderDroppetUtenLonnsart,
    ...(linjerUtenLonnsart.length > 0 ? { linjerUtenLonnsart } : {}),
    ...(fravaerTil ? { fravaerTil } : {}),
    rader,
  };
}

/** Utfallet av å anvende forslaget (returneres av `anvendDagsforslag`). */
export type AnvendDagsforslagResultat = {
  /** Start-dagens sedel-id (for navigering). null = kunne ikke utlede/skrive. */
  startSheetId: string | null;
  /** UF-1: minst én dato var alt sendt/godkjent → økta kunne ikke appendes. */
  blokkertSendt: boolean;
  /** Økta førte 0 rader totalt (for kort etter pause/runding). */
  ingenRader: boolean;
  /** Minst én sedel HADDE rader før denne økta (pre-fylt — «for kort»-copy). */
  harEksisterendeRader: boolean;
  /** Tidsrom der en play-rad vek for en overlappende manuell rad. */
  vekForOverlapp: Array<{ fraTid: string; tilTid: string }>;
  /**
   * §2: forslaget kunne ikke velge prosjekt (A5 ga ingen destinasjon + ingen
   * aktivtProsjektId). Skiller `prosjektUkjent`-handlingen fra `kildeManglet`
   * (begge har `startSheetId == null`).
   */
  prosjektUkjent: boolean;
  /**
   * Brukeren er ikke ansatt i firmaet → ingen sedel er skrevet (`startSheetId`
   * null). Vinner over alle andre utfall; dagen står åpen.
   */
  ikkeAnsatt: boolean;
  /** Minst én arbeidsrad ble hoppet over fordi lønnsarten manglet. */
  manglerLonnsart: boolean;
  /** DEL 5 a: datoer der sedelen ble skrevet (ny eller redigerbar). */
  lagredeDatoer: string[];
  /** DEL 5 a: datoer som var sendt/godkjent og derfor ikke ble skrevet. */
  blokkerteDatoer: string[];
  /** DEL 5 a: sedelen for første skrevne dato (navigasjonsmål ved delvis lagring). */
  forsteLagredeSheetId: string | null;
  /**
   * ORDRE Tillegg/Utlegg i Bekreft dag: lønnstillegg/utlegg ble skrevet på
   * `forsteLagredeSheetId`. Utelatt/false = ikke skrevet (ingen åpen sedel).
   */
  lonnUtleggSkrevet?: boolean;
  /** Kvitterings-køoppføringer — kalleren legger dem i køen etter vellykket Bekreft. */
  utleggKo?: NyKoOppforing[];
};

/**
 * H7 — handlingen «Slutt dag» skal utføre, utledet fra anvend-utfallet. REN og
 * injiserbar så rekkefølge-logikken kan testes uten React Native.
 *
 * 🔴 KJERNEN I H7: dagen markeres `avsluttet` KUN når skrivingen lyktes
 * (`suksess`/`delvisSendt`/`playVek`/`forKort` — sedel finnes, det skrevne er
 * lagret; `delvisSendt` sier i tillegg hvilke datoer som var sendt). To utfall
 * holder dagen ÅPEN så GPS-økta ikke går tapt:
 *  - `blokkertSendt`: sedelen er alt sendt → økta kunne ikke appendes. Timene
 *    reddes ved at lederen returnerer sedelen (→ draft → appendbar).
 *  - `kildeManglet` (`startSheetId == null`): db/prosjekt/aktivitet manglet →
 *    ingen sedel, ingen rader. I dag forsvinner dagen STILT; nå står den åpen
 *    OG brukeren varsles (ellers er en forsvunnet dag verre enn en blokkert).
 *  - `ikkeAnsatt`: brukeren er ikke ansatt i firmaet → ingen sedel skrives (den
 *    kunne aldri synkes). Dagen står åpen.
 * `manglerLonnsart` lukker dagen som `forKort`: sedelen finnes, (d)-banneret
 * på sedelen sier hva som mangler.
 */
export type SluttDagHandling =
  | { type: "suksess"; sheetId: string }
  | { type: "blokkertSendt"; sheetId: string }
  | { type: "delvisSendt"; sheetId: string; lagret: string[]; blokkert: string[] }
  | { type: "playVek"; sheetId: string; intervaller: string }
  | { type: "forKort"; sheetId: string; preFylt: boolean }
  | { type: "manglerLonnsart"; sheetId: string }
  | { type: "ikkeAnsatt" }
  | { type: "kildeManglet" }
  | { type: "prosjektUkjent" };

/** true = dagen skal markeres `avsluttet` (skrivingen lyktes, ingenting tapt). */
export function skalMarkereAvsluttet(handling: SluttDagHandling): boolean {
  return (
    handling.type === "suksess" ||
    handling.type === "delvisSendt" ||
    handling.type === "playVek" ||
    handling.type === "forKort" ||
    handling.type === "manglerLonnsart"
  );
}

/**
 * Avgjør «Slutt dag»-handlingen fra anvend-utfallet. Prioritet: ikkeAnsatt →
 * null sedel (prosjektUkjent/kildeManglet) → blokkertSendt → vekForOverlapp →
 * ingenRader med droppet lønnsart (manglerLonnsart) → ingenRader (forKort).
 * «Ikke ansatt» vinner fordi ingen annen melding hjelper brukeren da.
 */
export function avgjorSluttDagHandling(
  resultat: AnvendDagsforslagResultat,
): SluttDagHandling {
  if (resultat.ikkeAnsatt) return { type: "ikkeAnsatt" };
  const sheetId = resultat.startSheetId;
  if (sheetId == null) {
    // §2: prosjektet kunne ikke velges → egen melding («velg prosjekt, prøv
    // igjen»). Ellers manglet db/aktivitet-katalogen → kildeManglet. Begge
    // holder dagen åpen.
    return resultat.prosjektUkjent
      ? { type: "prosjektUkjent" }
      : { type: "kildeManglet" };
  }
  // DEL 5 a: noe ble skrevet og noe var sendt → egen, sann melding; økten
  // lukkes (det skrevne er lagret). Den lagrede sedelen er navigasjonsmålet.
  if (resultat.blokkertSendt && resultat.lagredeDatoer.length > 0) {
    return {
      type: "delvisSendt",
      sheetId: resultat.forsteLagredeSheetId ?? sheetId,
      lagret: resultat.lagredeDatoer,
      blokkert: resultat.blokkerteDatoer,
    };
  }
  // UF-1: alt var sendt → ingenting ble skrevet, økten står åpen.
  if (resultat.blokkertSendt) return { type: "blokkertSendt", sheetId };
  // 1b: play vek for manuelt førte timer — si HVA som vek.
  if (resultat.vekForOverlapp.length > 0) {
    const intervaller = resultat.vekForOverlapp
      .map((v) => `${v.fraTid}–${v.tilTid}`)
      .join(", ");
    return { type: "playVek", sheetId, intervaller };
  }
  // 0 rader fordi lønnsarten manglet — ikke «for kort».
  if (resultat.ingenRader && resultat.manglerLonnsart) {
    return { type: "manglerLonnsart", sheetId };
  }
  // F-c: økta førte 0 rader (for kort etter pause/runding).
  if (resultat.ingenRader) {
    return { type: "forKort", sheetId, preFylt: resultat.harEksisterendeRader };
  }
  return { type: "suksess", sheetId };
}
