// ============================================================================
//  Terskel og avstandsbånd på «+ Reise» (ordre 2026-11-14 (9), Kenneth-vedtak
//  «Arbeidstid, erReise false»)
//
//  ÉN delt regel for en manuelt ført reise — mobilens prosjektkort (DagSeksjon)
//  og bekreft-dag manuell modus kaller samme funksjon, så de aldri divergerer.
//
//    - Terskelen i begge enheter: «minutter» måler de innførte reisetimene,
//      «km» måler matrise-avstanden oppmøtested × kortets byggeplass.
//    - Kategori «arbeidstid» → egen rad på firmaets standard ordinære lønnsart,
//      erReise false, uten reiseKilde (serverens vakt i tilfoyTimerRad og
//      C2-invarianten slipper den uendret gjennom).
//    - Kategori «reisetid» → erReise true, reiseKilde "manuell", lønnsart fra
//      avstandsbåndet når avstanden er kjent, ellers resolverens art.
//    - km uten kjent avstand → regel (c) i `klassifiserReise`: under terskel.
// ============================================================================

import {
  grensepunktTraff,
  klassifiserReise,
  løsReiseLonnsartId,
  type ReiseGrensepunkt,
  type ReiseKategori,
  type ReiseRegelSnapshot,
  type ReiseRegelsett,
} from "./reise";
import { leggTilDager, type OppmoteResultat, type Overforing } from "./oppmote";
import { finnOverlappendeTidsrom } from "./tidsromValidering";

export interface ManuellReiseInput {
  regel: ReiseRegelsett;
  /** Innførte reisetimer (desimal). Brukes når terskelen måles i minutter. */
  reisetimer: number;
  /**
   * Matrise-avstand i meter (oppmøtested × byggeplass). null = ukjent (ingen
   * oppmøtested, byggeplass eller matrisecelle); negativ = uoppnåelig → ukjent.
   */
  avstandM: number | null;
  grensepunkter: ReiseGrensepunkt[];
  /** «+ Reise»-resolverens art (`løsReiseKnappLonnsart`). */
  resolverLonnsartId: string | null;
  /** Firmaets standard ordinære lønnsart (erStandardvalg). */
  standardLonnsartId: string | null;
  /**
   * O1 TILLEGG (§ 8.22, Kenneth 2026-11-21: «reise under terskel er forslag, arbeideren
   * velger»): arbeiderens valg reisetid/arbeidstid. Utelatt/null = regelen (som før).
   */
  kategoriValg?: ReiseKategori | null;
}

/** Hvorfor raden ble som den ble — grunnlaget for den grå forklaringslinja. */
export type ManuellReiseForklaring =
  | { type: "ukjentAvstand" }
  | { type: "under"; enhet: "minutter"; terskelMin: number }
  | { type: "under"; enhet: "km"; terskelM: number }
  | { type: "over"; enhet: "minutter"; terskelMin: number }
  | { type: "over"; enhet: "km"; terskelM: number };

export interface ManuellReiseKlassifisering {
  kategori: ReiseKategori;
  /** O1 TILLEGG: det regelen foreslo (terskel og regelsett) — forvalget i reisevinduet. */
  regelKategori: ReiseKategori;
  /** null = ingen art å føre på (standardart mangler / resolver tom) → blokkér lagring. */
  lonnsartId: string | null;
  erReise: boolean;
  reiseKilde: "manuell" | null;
  /** Kun på reise-rader (DB-CHECK: ikke-reise-rad bærer aldri avstand). */
  reiseAvstandM: number | null;
  reiseRegel: ReiseRegelSnapshot;
  forklaring: ManuellReiseForklaring;
}

function brukbarAvstand(avstandM: number | null): number | null {
  return avstandM != null && avstandM >= 0 ? avstandM : null;
}

/**
 * Klassifiser en manuelt ført reise mot firmaets regelsett og bånd.
 * Skarp grense som `klassifiserReise`: nøyaktig på terskelen = over.
 */
export function klassifiserManuellReise(
  input: ManuellReiseInput,
): ManuellReiseKlassifisering {
  const { regel } = input;
  const avstandM = brukbarAvstand(input.avstandM);
  const reisetidMin = Math.round(Math.max(0, input.reisetimer) * 60);
  const regelKategori = klassifiserReise({ reisetidMin, avstandM }, regel);
  // O1 TILLEGG: arbeiderens valg går foran regelen; terskelfaktaene (forklaring) står.
  const kategori = input.kategoriValg ?? regelKategori;

  let forklaring: ManuellReiseForklaring;
  if (regel.reiseTerskelEnhet === "km") {
    if (avstandM == null || regel.reiseTerskelM == null) {
      forklaring = { type: "ukjentAvstand" };
    } else {
      forklaring = {
        type: avstandM < regel.reiseTerskelM ? "under" : "over",
        enhet: "km",
        terskelM: regel.reiseTerskelM,
      };
    }
  } else {
    forklaring = {
      type: reisetidMin < regel.reiseTerskelMin ? "under" : "over",
      enhet: "minutter",
      terskelMin: regel.reiseTerskelMin,
    };
  }

  const erReise = kategori === "reisetid";
  const traff = erReise && grensepunktTraff(avstandM, input.grensepunkter);
  const reiseRegel: ReiseRegelSnapshot = {
    enhet: regel.reiseTerskelEnhet,
    terskelMin: regel.reiseTerskelMin,
    terskelM: regel.reiseTerskelM,
    underType: regel.reiseUnderTerskelType,
    overType: regel.reiseOverTerskelType,
    kategori,
    grensepunktTreff: traff,
    // O1 TILLEGG: sporbarhet — arbeideren valgte annet enn regelen.
    ...(kategori !== regelKategori ? { regelKategori } : {}),
  };

  if (!erReise) {
    return {
      kategori,
      regelKategori,
      lonnsartId: input.standardLonnsartId,
      erReise: false,
      reiseKilde: null,
      reiseAvstandM: null,
      reiseRegel,
      forklaring,
    };
  }
  return {
    kategori,
    regelKategori,
    lonnsartId: løsReiseLonnsartId(
      avstandM,
      input.grensepunkter,
      input.resolverLonnsartId,
    ),
    erReise: true,
    reiseKilde: "manuell",
    reiseAvstandM: avstandM,
    reiseRegel,
    forklaring,
  };
}

/** Reise-sporet som lagres på raden (mobil `NyRad.reiseSpor` / bekreft-dag). */
export interface ManuellReiseSpor {
  erReise: boolean;
  /** POST (13) L2 TILLEGG: "overforing" fra reise-kortets overføringsvalg. */
  reiseKilde: "manuell" | "overforing" | null;
  reiseAvstandM: number | null;
  /** Kun på reise-rader (ikke-reise-rad bærer aldri oppmøtested — C2/DB-CHECK). */
  reiseOppmotestedId: string | null;
  /**
   * POST (13) L2: Tur → "ut", Retur → "retur". Kun på reise-rader — DB-CHECK
   * (lag 2) krever null retning på ikke-reise-rad.
   */
  reiseRetning: "ut" | "retur" | null;
  /**
   * POST (13) L2: matrisens/kontor-avstandens kjøretid (min). Kun på
   * reise-rader (DB-CHECK: ikke-reise-rad bærer ingen kjøretid).
   */
  reiseKjoretidMin: number | null;
  reiseRegel: ReiseRegelSnapshot;
}

export function tilManuellReiseSpor(
  k: ManuellReiseKlassifisering,
  oppmotestedId: string | null,
  retning: "ut" | "retur" | null = null,
  kjoretidMin: number | null = null,
): ManuellReiseSpor {
  return {
    erReise: k.erReise,
    reiseKilde: k.reiseKilde,
    reiseAvstandM: k.reiseAvstandM,
    reiseOppmotestedId: k.erReise ? oppmotestedId : null,
    reiseRetning: k.erReise ? retning : null,
    reiseKjoretidMin: k.erReise ? kjoretidMin : null,
    reiseRegel: k.reiseRegel,
  };
}


// ============================================================================
//  POST 2026-11-15 (13) L2: reise-kortet (Tur/Retur).
//
//  Erstatter «+ Reise» med manuelt timefelt og oppmøtested-nedtrekk. Den
//  ansatte velger bare retning; oppmøtestedet kommer fra perioderesolveren
//  (`løsOppmote`), tiden fra kjøretiden i matrisen og dagens arbeidsrader:
//    - Tur:   tilTid = dagStart,  fraTid = dagStart − kjøretid
//    - Retur: fraTid = dagSlutt,  tilTid = dagSlutt + kjøretid
//  Mobil og web kaller samme funksjon; plattformene henter bare data.
// ============================================================================

export type ReiseKortRetning = "tur" | "retur";

/**
 * w15b (B42 A): «Når kjørte du?». «forArbeid» legger reisen før dagens første arbeid
 * (`dagStart`), «etterArbeid» etter dagens siste (`dagSlutt`). Utelatt = som retningen
 * sier (tur → før, retur → etter), slik regelen var før w15b.
 */
export type ReiseKortNaar = "forArbeid" | "etterArbeid";

/**
 * Hvorfor reise-kortet ikke kan lagres. null = kan lagres.
 *  - byggeplassPeriode: den ansatte møter på byggeplassen — ingen reise.
 *  - manglerKjoretid: ingen byggeplass, ingen matrisecelle eller uoppnåelig
 *    par. Ingen estimat-fallback (V13).
 *  - manglerDagstid: sedelen har ingen arbeidsrad med tid å regne fra.
 *  - utenforDognet: Tur før 00:00 eller Retur etter 24:00.
 *  - manglerArt: ingen lønnsart å føre på (jf. `manuellReiseManglerArt`).
 *  - manglerRegel: firmaets regelsett er ikke lastet/cachet.
 */
export type ReiseKortSperre =
  | "byggeplassPeriode"
  | "manglerKjoretid"
  | "manglerDagstid"
  | "utenforDognet"
  | "manglerArt"
  | "manglerRegel";

export interface ReiseKortInput {
  retning: ReiseKortRetning;
  oppmote: OppmoteResultat;
  /** HH:MM — første fraTid blant sedelens ikke-reise-rader (`finnDagsramme`). */
  dagStart: string | null;
  /** HH:MM — siste tilTid blant sedelens ikke-reise-rader. */
  dagSlutt: string | null;
  byggeplassId: string | null;
  /** Matrise: oppmøtested × byggeplass → minutter. null = ukjent, < 0 = uoppnåelig. */
  kjoretidFor: (oppmotestedId: string, byggeplassId: string) => number | null;
  /** Matrise: oppmøtested × byggeplass → meter. null = ukjent. */
  avstandFor: (oppmotestedId: string, byggeplassId: string) => number | null;
  regel: ReiseRegelsett | null;
  grensepunkter: ReiseGrensepunkt[];
  resolverLonnsartId: string | null;
  standardLonnsartId: string | null;
  /** w15b: når reisen ble kjørt. Utelatt = som retningen sier. Endrer aldri sporets retning. */
  naar?: ReiseKortNaar | null;
  /** w15b: arbeiderens start (HH:MM). Utelatt/ugyldig = forslaget fra dagens rader. */
  startTid?: string | null;
  /** w15b: arbeiderens slutt (HH:MM). Utelatt/ugyldig = start + firmaets kjøretid. */
  sluttTid?: string | null;
  /** O1 TILLEGG: arbeiderens valg reisetid/arbeidstid. Utelatt = regelen. */
  kategoriValg?: ReiseKategori | null;
  /**
   * O12 (vedtak-timer-web.md § Reisevinduet pkt 14): web-vinduet. Mangler firmaets kjøretid
   * (eller kortet har ingen byggeplass), sperres ikke kortet: tidspunktet som henger på arbeidet
   * fylles ut, og arbeideren skriver det andre (`startTid`/`sluttTid`). Utelatt/false = som før
   * (`manglerKjoretid`) — mobilens kall sender den ikke.
   */
  tillatUtenKjoretid?: boolean;
  /**
   * O19 (vedtak-timer-web.md § Reisevinduet pkt 23–24): web-vinduet deler en reise som krysser
   * midnatt. Tiden får da ligge utenfor 0–24:00 (`deles` i resultatet) i stedet for sperren
   * `utenforDognet`. `omvendt` sier hvordan Slutt før Start leses: «fram» = slutten er dagen etter
   * («Fra byggeplass», «Til annet oppmøtested»), «bak» = starten var kvelden før («Til byggeplass»).
   * Utelatt = som før (mobil sender den ikke og sperrer fortsatt).
   */
  tillatDeling?: { omvendt: MidnattVei };
}

/**
 * O12 pkt 14: hvorfor forslaget mangler når `tillatUtenKjoretid` er satt. O22 pkt 28:
 * «utenOppmote» = den ansatte har ikke oppmøtested — gjelder alltid (web og mobil), uten flagget.
 */
export type ReiseKortUtenKjoretid = "mangler" | "utenByggeplass" | "utenOppmote";

export interface ReiseKortResultat {
  /**
   * Desimaltimer: (slutt − start) / 60 — lik kjøretid / 60 når arbeideren ikke har rettet
   * slutten. 0 når sperret uten kjøretid, og når slutten ikke er etter starten (kalleren sperrer).
   */
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  oppmotestedId: string | null;
  kjoretidMin: number | null;
  klassifisering: ManuellReiseKlassifisering | null;
  spor: ManuellReiseSpor | null;
  sperre: ReiseKortSperre | null;
  /**
   * O12 pkt 14: satt når kjøretiden mangler og kalleren tillot det (web). O22: alltid
   * «utenOppmote» når oppmøtested ikke er valgt. Ellers utelatt.
   */
  utenKjoretid?: ReiseKortUtenKjoretid;
  /**
   * O19 pkt 23–24: satt når reisen krysser midnatt og kalleren tillot deling. `fraTid`/`tilTid`
   * er da klokkeslettene (start og slutt), `timer` hele reisen. «fram» = del 2 dagen etter,
   * «bak» = del 1 dagen før. Se `delVedMidnatt`.
   */
  deles?: MidnattVei;
}

/** "HH:MM" → minutter etter midnatt; null ved ugyldig format. */
export function klokkeTilMin(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const t = Number(m[1]);
  const min = Number(m[2]);
  if (t > 24 || min > 59 || (t === 24 && min > 0)) return null;
  return t * 60 + min;
}

/** Minutter etter midnatt → "HH:MM" (0–1440). */
export function minTilKlokke(min: number): string {
  const t = Math.floor(min / 60);
  const m = min % 60;
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================================================
//  O19 (vedtak-timer-web.md § Reisevinduet pkt 23–24): reise over midnatt deles ved 24:00.
//  Del 1 (start–24:00) står på startdagens sedel, del 2 (00:00–slutt) på dagen etter. Paret
//  kjennes på `reiseRegel.midnatt = { delId, del }` — samme delId på begge radene. Tiden alene
//  holder ikke: en vanlig retur kan slutte 24:00 uten å være delt.
// ============================================================================

const DOGN_MIN = 24 * 60;

/** O19 pkt 23–24: Slutt før Start er en reise over midnatt når kalleren deler og arbeideren skrev
 *  tiden som krysser — Start ved «bak» (pkt 24), Slutt ved «fram». */
function krysserMidnatt(k: { tillatDeling?: { omvendt: MidnattVei }; startTid?: string | null; sluttTid?: string | null }, fra: number, til: number): boolean {
  if (!k.tillatDeling || til >= fra) return false;
  return k.tillatDeling.omvendt === "bak" ? k.startTid != null : k.sluttTid != null;
}

/** «fram» = del 2 på dagen etter vinduets dato; «bak» = del 1 på dagen før. */
export type MidnattVei = "fram" | "bak";

/** Minutter (kan ligge utenfor døgnet) → minutter i døgnet (0–1439). */
function iDognet(min: number): number {
  return ((min % DOGN_MIN) + DOGN_MIN) % DOGN_MIN;
}

/** null = innenfor døgnet; «ugyldig» = lengre enn ett midnattskryss (krysser begge kanter). */
function midnattVei(fra: number, til: number): MidnattVei | "ugyldig" | null {
  const forFoer = fra < 0;
  const etterEtter = til > DOGN_MIN;
  if (!forFoer && !etterEtter) return null;
  if (forFoer && etterEtter) return "ugyldig";
  if (forFoer) return fra > -DOGN_MIN && til > 0 ? "bak" : "ugyldig";
  return fra < DOGN_MIN && til < 2 * DOGN_MIN ? "fram" : "ugyldig";
}

export interface MidnattDel {
  /** Sedelens dato (YYYY-MM-DD). */
  dato: string;
  fraTid: string;
  tilTid: string;
  /** Desimaltimer for delen (reise bærer aldri pause). */
  timer: number;
}

export interface MidnattDeling {
  vei: MidnattVei;
  /** Start–24:00. */
  del1: MidnattDel;
  /** 00:00–slutt. */
  del2: MidnattDel;
}

/**
 * O19 pkt 23–24: delene til en reise over midnatt. `dato` er vinduets sedel; `fraTid`/`tilTid`
 * er klokkeslettene (som i `ReiseKortResultat` med `deles`). «fram»: del 1 på `dato`, del 2 dagen
 * etter. «bak»: del 1 dagen før, del 2 på `dato`. null ved ugyldig tid eller når en del blir 0 min.
 */
export function delVedMidnatt(a: { dato: string; vei: MidnattVei; fraTid: string; tilTid: string }): MidnattDeling | null {
  const fra = klokkeTilMin(a.fraTid);
  const til = klokkeTilMin(a.tilTid);
  if (fra == null || til == null || fra >= DOGN_MIN || fra === 0 || til === 0 || til >= DOGN_MIN) return null;
  const timer = (min: number) => Math.round((min / 60) * 10000) / 10000;
  const dag1 = a.vei === "fram" ? a.dato : leggTilDager(a.dato, -1);
  const dag2 = a.vei === "fram" ? leggTilDager(a.dato, 1) : a.dato;
  return {
    vei: a.vei,
    del1: { dato: dag1, fraTid: minTilKlokke(fra), tilTid: "24:00", timer: timer(DOGN_MIN - fra) },
    del2: { dato: dag2, fraTid: "00:00", tilTid: minTilKlokke(til), timer: timer(til) },
  };
}

/** O19 pkt 23: kjennetegnet på en delt reise i `reiseRegel`. */
export interface MidnattMerke {
  delId: string;
  del: 1 | 2;
}

/** Leser `reiseRegel.midnatt` defensivt. null = ikke del av en delt reise. */
export function lesMidnattDel(reiseRegel: unknown): MidnattMerke | null {
  if (reiseRegel == null || typeof reiseRegel !== "object") return null;
  const m = (reiseRegel as Record<string, unknown>).midnatt;
  if (m == null || typeof m !== "object") return null;
  const { delId, del } = m as Record<string, unknown>;
  if (typeof delId !== "string" || delId === "" || (del !== 1 && del !== 2)) return null;
  return { delId, del };
}

/**
 * O19 pkt 23: visningen av en delt rad — «fortsetter {dato}» (del 1) / «fortsatt fra {dato}» (del 2).
 * `sedelDato` er radens sedel (YYYY-MM-DD eller ISO); gir den andre delens dato. null = ikke delt.
 */
export function midnattPartnerDato(sedelDato: string, reiseRegel: unknown): { del: 1 | 2; dato: string } | null {
  const merke = lesMidnattDel(reiseRegel);
  if (!merke) return null;
  const dag = sedelDato.slice(0, 10);
  return { del: merke.del, dato: leggTilDager(dag, merke.del === 1 ? 1 : -1) };
}

/**
 * O19 (vedtak pkt 25): «Til byggeplass» overlapper en kontorreise (kontor → kontor, pkt 21) som
 * ender ved jobbstart. Den nye reisen og kontorreisen kan ikke begge stemme: arbeideren er på
 * kontoret når reisen til kortets byggeplass skulle startet. Gir kontoret og klokkeslettet den
 * ender, ellers null. Andre overlapp (arbeid, «Til byggeplass», «Fra byggeplass» til kontoret)
 * gir null — de har dagens overlapp-tekst.
 */
export function finnReiseSomEnderPaaKontor(
  ny: { fraTid: string | null; tilTid: string | null },
  rader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean; reiseRegel?: unknown }[],
): { kontorId: string; tilTid: string } | null {
  for (const r of rader) {
    if (!r.erReise || !r.tilTid) continue;
    const rute = kontorReiseRute(r.reiseRegel);
    if (!rute) continue;
    if (finnOverlappendeTidsrom(ny.fraTid, ny.tilTid, [r])) return { kontorId: rute.tilKontorId, tilTid: r.tilTid };
  }
  return null;
}

// ============================================================================
//  O20 (vedtak-timer-web.md § Reisevinduet pkt 26): en reise ført fra et kort som bare overlapper
//  kanten av jobben i SAMME kort, gir knappen «Flytt jobbens start/slutt». Jobben er kortets
//  arbeidsrader (ikke reise, ikke arbeidstid-reise, ikke erstattet). «Til byggeplass» flytter
//  starten på den tidligste raden til reisens slutt; «Fra byggeplass» slutten på den seneste til
//  reisens start. Overlapper reisen noe annet etter flyttingen, finnes ingen flytting (sperren
//  står). Én regel for vinduet og serveren (`tilfoyTimerRad` `flyttRad`).
// ============================================================================

/** En rad på sedelen, slik kantflyttingen ser den. */
export interface KantFlyttRad {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  erReise: boolean;
  /** Reise ført som arbeidstid (`arbeidReiseRetning` satt) — er ikke jobb. */
  arbeidReise?: boolean;
  kortId?: string | null;
  attestertStatus?: string | null;
  /** Radens timer. Utelatt → jobbens timer regnes ikke. */
  timer?: number | null;
}

/** Flyttingen knappen gjør, og jobben etterpå. */
export interface KantFlytt {
  radId: string;
  /** «start»: radens Fra blir `tid`. «slutt»: radens Til blir `tid`. */
  kant: "start" | "slutt";
  tid: string;
  /** Den flyttede radens timer etter flyttingen (pausen står). null når timer mangler. */
  radTimer: number | null;
  /** Jobbens Fra–til og sum timer etter flyttingen. */
  jobbFra: string;
  jobbTil: string;
  jobbTimer: number | null;
}

const runde2 = (v: number) => Math.round(v * 100) / 100;

/** Jobben i kortet: arbeidsrader (ikke reise, ikke reise ført som arbeidstid) med begge tider. */
function jobbRader<T extends KantFlyttRad>(rader: readonly T[], kortId: string): T[] {
  return rader.filter(
    (r) =>
      r.kortId === kortId &&
      !r.erReise &&
      !r.arbeidReise &&
      klokkeTilMin(r.fraTid) != null &&
      klokkeTilMin(r.tilTid) != null,
  );
}

/**
 * O21 (vedtak-timer-web.md § Reisevinduet pkt 27): «Til byggeplass», ny reise. Arbeideren retter
 * Start til et klokkeslett inne i jobben i samme kort (`jobbStart ≤ Start < jobbSlutt`, samme jobb
 * som `finnKantFlytt`) — da følger Slutt: Start + kjøretiden, uten avrunding. Gir den nye Slutt,
 * eller null når Slutt står (pkt 6: Start før jobben; pkt 24: Start etter jobben; ingen jobb;
 * ingen kjøretid).
 *  - `folger` = Slutt er satt av denne regelen og ikke rettet av arbeideren siden. Da følger den
 *    også når Start < Slutt — et tidsfelt går gjennom mellomverdier mens timene og minuttene
 *    skrives (06:56 → 07:56 → 07:00), og Slutt skal ende på 07:04, ikke 08:00.
 *  - Ellers bare når Start ≥ Slutt (Slutt er arbeiderens egen og står så lenge den er etter Start).
 */
export function sluttEtterStartIJobb(a: {
  startTid: string | null;
  sluttTid: string | null;
  kjoretidMin: number | null;
  folger: boolean;
  kortId: string | null | undefined;
  rader: readonly KantFlyttRad[];
}): string | null {
  const s = klokkeTilMin(a.startTid);
  if (s == null || !a.kortId || a.kjoretidMin == null || a.kjoretidMin <= 0) return null;
  const sl = klokkeTilMin(a.sluttTid);
  if (!a.folger && sl != null && s < sl) return null;
  const jobb = jobbRader(
    a.rader.filter((r) => r.attestertStatus !== "erstattet"),
    a.kortId,
  );
  if (jobb.length === 0) return null;
  const jobbStart = Math.min(...jobb.map((r) => klokkeTilMin(r.fraTid) as number));
  const jobbSlutt = Math.max(...jobb.map((r) => klokkeTilMin(r.tilTid) as number));
  if (s < jobbStart || s >= jobbSlutt) return null;
  const ny = s + a.kjoretidMin;
  return ny > DOGN_MIN ? null : minTilKlokke(ny);
}

/**
 * Finner kantflyttingen for en ny reise i kortet `kortId`, ellers null.
 *  - «ut» (Til byggeplass): reisen starter på eller før den tidligste radens start og slutter
 *    etter starten, men før radens slutt.
 *  - «retur» (Fra byggeplass): speilvendt mot den seneste radens slutt.
 * Raden må bli minst 1 minutt og beholde timer over 0. En attestert rad flyttes ikke.
 */
export function finnKantFlytt(a: {
  reise: { fraTid: string | null; tilTid: string | null };
  retning: "ut" | "retur";
  kortId: string | null | undefined;
  rader: readonly KantFlyttRad[];
}): KantFlytt | null {
  const rF = klokkeTilMin(a.reise.fraTid);
  const rT = klokkeTilMin(a.reise.tilTid);
  if (!a.kortId || rF == null || rT == null || rT <= rF) return null;
  const aktive = a.rader.filter((r) => r.attestertStatus !== "erstattet");
  const jobb = jobbRader(aktive, a.kortId);
  if (jobb.length === 0) return null;
  const fra = (r: KantFlyttRad) => klokkeTilMin(r.fraTid) as number;
  const til = (r: KantFlyttRad) => klokkeTilMin(r.tilTid) as number;
  const kant =
    a.retning === "ut"
      ? [...jobb].sort((x, y) => fra(x) - fra(y))[0]!
      : [...jobb].sort((x, y) => til(y) - til(x))[0]!;
  if (kant.attestertStatus === "attestert") return null;
  const kF = fra(kant);
  const kT = til(kant);
  let nyF = kF;
  let nyT = kT;
  if (a.retning === "ut") {
    if (!(rF <= kF && rT > kF && rT < kT)) return null;
    nyF = rT;
  } else {
    if (!(rT >= kT && rF < kT && rF > kF)) return null;
    nyT = rF;
  }
  const bortMin = nyF - kF + (kT - nyT);
  const radTimer = kant.timer == null ? null : runde2(kant.timer - bortMin / 60);
  if (radTimer != null && radTimer <= 0) return null;
  const tid = minTilKlokke(a.retning === "ut" ? nyF : nyT);
  // Etter flyttingen kan reisen ikke overlappe noe (andre kort, rader midt i jobben, reiser).
  const etter = aktive.map((r) =>
    r.id === kant.id ? { ...r, fraTid: minTilKlokke(nyF), tilTid: minTilKlokke(nyT) } : r,
  );
  if (finnOverlappendeTidsrom(a.reise.fraTid, a.reise.tilTid, etter)) return null;
  const jobbEtter = jobb.map((r) => (r.id === kant.id ? { f: nyF, t: nyT, timer: radTimer } : { f: fra(r), t: til(r), timer: r.timer ?? null }));
  const harTimer = jobbEtter.every((r) => r.timer != null);
  return {
    radId: kant.id,
    kant: a.retning === "ut" ? "start" : "slutt",
    tid,
    radTimer,
    jobbFra: minTilKlokke(Math.min(...jobbEtter.map((r) => r.f))),
    jobbTil: minTilKlokke(Math.max(...jobbEtter.map((r) => r.t))),
    jobbTimer: harTimer ? runde2(jobbEtter.reduce((s, r) => s + (r.timer as number), 0)) : null,
  };
}

/**
 * Dagens ramme for reise-kortet: første fraTid og siste tilTid blant
 * sedelens arbeidsrader (ikke reise, ikke overføring). Rader uten gyldig tid
 * hoppes over.
 *
 * `kjedeStart`/`kjedeSlutt` (ordre (17) P1): første/siste tid blant ALLE
 * rader. En overføring legges ytterst i kjeden — før reisen til byggeplass og
 * etter reisen hjem — og forankres der, så den aldri overlapper en reise.
 * `erOverforing` skiller en overføring under terskel (føres som arbeidstid,
 * `erReise` false) fra arbeid.
 */
export function finnDagsramme(
  rader: readonly {
    fraTid: string | null;
    tilTid: string | null;
    erReise: boolean;
    erOverforing?: boolean;
  }[],
): {
  dagStart: string | null;
  dagSlutt: string | null;
  kjedeStart: string | null;
  kjedeSlutt: string | null;
} {
  let start: number | null = null;
  let slutt: number | null = null;
  let kStart: number | null = null;
  let kSlutt: number | null = null;
  for (const r of rader) {
    const f = klokkeTilMin(r.fraTid);
    const t = klokkeTilMin(r.tilTid);
    if (f != null && (kStart == null || f < kStart)) kStart = f;
    if (t != null && (kSlutt == null || t > kSlutt)) kSlutt = t;
    if (r.erReise || r.erOverforing) continue;
    if (f != null && (start == null || f < start)) start = f;
    if (t != null && (slutt == null || t > slutt)) slutt = t;
  }
  const kl = (v: number | null) => (v == null ? null : minTilKlokke(v));
  return {
    dagStart: kl(start),
    dagSlutt: kl(slutt),
    kjedeStart: kl(kStart),
    kjedeSlutt: kl(kSlutt),
  };
}

export function løsReiseKort(k: ReiseKortInput): ReiseKortResultat {
  const tom = (sperre: ReiseKortSperre, oppmotestedId: string | null = null): ReiseKortResultat => ({
    timer: 0,
    fraTid: null,
    tilTid: null,
    oppmotestedId,
    kjoretidMin: null,
    klassifisering: null,
    spor: null,
    sperre,
  });

  // 1. Byggeplass-periode: møter på byggeplassen, arbeidstid fra første minutt.
  if (k.oppmote.kilde === "byggeplass") return tom("byggeplassPeriode");

  // 2. Uten oppmøtested finnes ingen kjøretid. O22 (vedtak-timer-web.md § Reisevinduet pkt 28,
  //    Kenneth 2026-11-25, retter vedtaket 2026-11-15 om sperre): arbeideren skriver reisetiden
  //    selv mens firmaadmin legger inn stedet — på web og mobil, også offline. Ingen sperre.
  if (k.oppmote.kilde === "ikkeValgt") return løsReiseKortUtenKjoretid(k, null, "utenOppmote");

  // 3. Kjøretid fra oppmøtested × byggeplass.
  const oppmotestedId = k.oppmote.oppmotestedId;
  const kjoretidMin =
    oppmotestedId && k.byggeplassId ? k.kjoretidFor(oppmotestedId, k.byggeplassId) : null;
  if (kjoretidMin == null || kjoretidMin < 0) {
    if (!k.tillatUtenKjoretid) return tom("manglerKjoretid", oppmotestedId);
    return løsReiseKortUtenKjoretid(k, oppmotestedId, k.byggeplassId ? "mangler" : "utenByggeplass");
  }

  // 4. Tidspunkt: forslaget regnes fra dagens arbeidsrader — før arbeid = første fra-tid
  //    minus kjøretiden, etter arbeid = siste til-tid. w15b: arbeiderens start og slutt
  //    går foran forslaget; retter han bare starten, følger slutten (start + kjøretid).
  const naar: ReiseKortNaar = k.naar ?? (k.retning === "tur" ? "forArbeid" : "etterArbeid");
  let fra = klokkeTilMin(k.startTid);
  if (fra == null) {
    const anker = klokkeTilMin(naar === "forArbeid" ? k.dagStart : k.dagSlutt);
    if (anker == null) return tom("manglerDagstid", oppmotestedId);
    fra = naar === "forArbeid" ? anker - kjoretidMin : anker;
  }
  let til = klokkeTilMin(k.sluttTid) ?? fra + kjoretidMin;
  // O19 pkt 23–24: Slutt før Start leses som en reise over midnatt når kalleren deler — men bare
  // når arbeideren selv skrev tiden som krysser (pkt 24: Start ved «bak»). En rettet Slutt før
  // forslagets Start er fortsatt «slutt før start».
  if (k.tillatDeling && krysserMidnatt(k, fra, til)) {
    if (k.tillatDeling.omvendt === "fram") til += DOGN_MIN;
    else fra -= DOGN_MIN;
  }
  const deles = midnattVei(fra, til);
  if (deles === "ugyldig" || (deles && !k.tillatDeling)) return tom("utenforDognet", oppmotestedId);

  const timer = Math.max(0, til - fra) / 60;
  const basis = {
    timer,
    fraTid: minTilKlokke(iDognet(fra)),
    tilTid: minTilKlokke(deles ? iDognet(til) : til),
    oppmotestedId,
    kjoretidMin,
    ...(deles ? { deles } : {}),
  };
  if (!k.regel) {
    return { ...basis, klassifisering: null, spor: null, sperre: "manglerRegel" };
  }

  // 5. Terskel og bånd — samme regel som før (`klassifiserManuellReise`). w15b: terskelen
  //    måles på firmaets kjøretid, ikke på en rettet slutt — likt for alle (plan § 4.15 del B).
  const avstandM = oppmotestedId && k.byggeplassId ? k.avstandFor(oppmotestedId, k.byggeplassId) : null;
  const klassifisering = klassifiserManuellReise({
    regel: k.regel,
    reisetimer: kjoretidMin / 60,
    avstandM,
    grensepunkter: k.grensepunkter,
    resolverLonnsartId: k.resolverLonnsartId,
    standardLonnsartId: k.standardLonnsartId,
    kategoriValg: k.kategoriValg,
  });
  return {
    ...basis,
    klassifisering,
    spor: tilManuellReiseSpor(
      klassifisering,
      oppmotestedId,
      k.retning === "tur" ? "ut" : "retur",
      kjoretidMin,
    ),
    sperre: klassifisering.lonnsartId == null ? "manglerArt" : null,
  };
}

/**
 * O12 pkt 14 (web): firmaets kjøretid mangler, eller kortet har ingen byggeplass. Tidspunktet som
 * henger på arbeidet fylles ut (før arbeid: Slutt = dagens første arbeid; etter arbeid: Start =
 * dagens siste), det andre skriver arbeideren. Uten begge tider: ingen sperre, men heller ingen
 * tid (kalleren holder «Lagre» grå til tiden er skrevet). Terskelen i minutter måles på tiden
 * arbeideren skrev — det finnes ingen kjøretid å måle på. Sporet bærer ingen kjøretid.
 */
function løsReiseKortUtenKjoretid(
  k: ReiseKortInput,
  oppmotestedId: string | null,
  utenKjoretid: ReiseKortUtenKjoretid,
): ReiseKortResultat {
  const naar: ReiseKortNaar = k.naar ?? (k.retning === "tur" ? "forArbeid" : "etterArbeid");
  const anker = klokkeTilMin(naar === "forArbeid" ? k.dagStart : k.dagSlutt);
  let fra = klokkeTilMin(k.startTid) ?? (naar === "etterArbeid" ? anker : null);
  let til = klokkeTilMin(k.sluttTid) ?? (naar === "forArbeid" ? anker : null);
  // O19 pkt 23–24: som i `løsReiseKort`.
  if (k.tillatDeling && fra != null && til != null && krysserMidnatt(k, fra, til)) {
    if (k.tillatDeling.omvendt === "fram") til += DOGN_MIN;
    else fra -= DOGN_MIN;
  }
  const deles = fra != null && til != null ? midnattVei(fra, til) : null;
  const basis = {
    fraTid: fra == null ? null : minTilKlokke(iDognet(fra)),
    tilTid: til == null ? null : minTilKlokke(deles ? iDognet(til) : til),
    oppmotestedId,
    kjoretidMin: null,
    utenKjoretid,
    ...(deles && deles !== "ugyldig" && k.tillatDeling ? { deles } : {}),
  };
  if (fra == null || til == null) {
    return { ...basis, timer: 0, klassifisering: null, spor: null, sperre: null };
  }
  if (deles === "ugyldig" || (deles && !k.tillatDeling)) {
    return { ...basis, timer: 0, fraTid: null, tilTid: null, klassifisering: null, spor: null, sperre: "utenforDognet" };
  }
  const timer = Math.max(0, til - fra) / 60;
  if (!k.regel) return { ...basis, timer, klassifisering: null, spor: null, sperre: "manglerRegel" };
  const avstandM = oppmotestedId && k.byggeplassId ? k.avstandFor(oppmotestedId, k.byggeplassId) : null;
  const klassifisering = klassifiserManuellReise({
    regel: k.regel,
    reisetimer: timer,
    avstandM,
    grensepunkter: k.grensepunkter,
    resolverLonnsartId: k.resolverLonnsartId,
    standardLonnsartId: k.standardLonnsartId,
    kategoriValg: k.kategoriValg,
  });
  return {
    ...basis,
    timer,
    klassifisering,
    spor: tilManuellReiseSpor(klassifisering, oppmotestedId, k.retning === "tur" ? "ut" : "retur", null),
    sperre: klassifisering.lonnsartId == null ? "manglerArt" : null,
  };
}

/**
 * POST (13) L2 TILLEGG: reise-kortets overføringsvalg («Overføring Narvik →
 * Tromsø») første/siste dag i en periode. Samme regel som `løsReiseKort`
 * (dagsramme, terskel, bånd), men kjøretiden er gitt av kalleren (kontor-
 * avstand eller matrisecelle, jf. `byggOverforingOppslag`) og sporet bærer
 * `reiseKilde "overforing"` + ruten i `reiseRegel.overforing`. Under terskel
 * blir raden ordinær (erReise false) med ruten fortsatt i regel-snapshoten.
 */
export interface OverforingKortInput {
  overforing: Overforing;
  /** Kontor-enden (fra-kontoret når begge ender er kontor). */
  oppmotestedId: string;
  /** null = ukjent kjøretid (mangler matrise/byggeplass), < 0 = uoppnåelig. */
  kjoretidMin: number | null;
  avstandM: number | null;
  dagStart: string | null;
  dagSlutt: string | null;
  regel: ReiseRegelsett | null;
  grensepunkter: ReiseGrensepunkt[];
  resolverLonnsartId: string | null;
  standardLonnsartId: string | null;
  /** w15b: som i `ReiseKortInput`. */
  naar?: ReiseKortNaar | null;
  startTid?: string | null;
  sluttTid?: string | null;
  /** O16 pkt 4 (web): som i `ReiseKortInput`. Utelatt = som før (mobil sender dem ikke). */
  kategoriValg?: ReiseKategori | null;
  tillatUtenKjoretid?: boolean;
  /** O19 (web): som i `ReiseKortInput`. */
  tillatDeling?: { omvendt: MidnattVei };
}

export function løsOverforingKort(k: OverforingKortInput): ReiseKortResultat {
  const r = løsReiseKort({
    retning: k.overforing.retning === "ut" ? "tur" : "retur",
    oppmote: { kilde: "fast", oppmotestedId: k.oppmotestedId },
    dagStart: k.dagStart,
    dagSlutt: k.dagSlutt,
    byggeplassId: "overforing",
    kjoretidFor: () => k.kjoretidMin,
    avstandFor: () => k.avstandM,
    regel: k.regel,
    grensepunkter: k.grensepunkter,
    resolverLonnsartId: k.resolverLonnsartId,
    standardLonnsartId: k.standardLonnsartId,
    naar: k.naar,
    startTid: k.startTid,
    sluttTid: k.sluttTid,
    kategoriValg: k.kategoriValg,
    tillatUtenKjoretid: k.tillatUtenKjoretid,
    tillatDeling: k.tillatDeling,
  });
  if (!r.spor) return r;
  const reiseRegel: ReiseRegelSnapshot = {
    ...r.spor.reiseRegel,
    overforing: {
      fra: k.overforing.fra,
      til: k.overforing.til,
      periodeId: k.overforing.periodeId,
    },
  };
  return {
    ...r,
    spor: {
      ...r.spor,
      reiseKilde: r.spor.erReise ? "overforing" : null,
      reiseRegel,
    },
  };
}

/**
 * Del B: kontoroverføringens periode-id er først kjent ved lagring (ny UUID ved
 * «start», den lukkede perioden ved «slutt»). null = sporet beholdes urørt.
 */
export function medOverforingPeriodeId(spor: ManuellReiseSpor, periodeId: string | null): ManuellReiseSpor {
  const ovf = spor.reiseRegel.overforing;
  if (!ovf || periodeId == null) return spor;
  return { ...spor, reiseRegel: { ...spor.reiseRegel, overforing: { ...ovf, periodeId } } };
}

/**
 * O17 (vedtak pkt 21): en reise mellom to kontorer (tur 3, «Til annet oppmøtested») kjennes på
 * ruten i `reiseRegel.overforing` med kontor i begge ender — ikke på `reiseKilde`, som bare er
 * «overforing» over terskel. Leser JSON defensivt (samme form som api-ets `lesOverforingRute`).
 * null = ikke kontor ↔ kontor (L2 kontor ↔ byggeplass, vanlig reise, manglende/ugyldig regel).
 */
export function kontorReiseRute(reiseRegel: unknown): { fraKontorId: string; tilKontorId: string } | null {
  if (reiseRegel == null || typeof reiseRegel !== "object") return null;
  const ov = (reiseRegel as Record<string, unknown>).overforing;
  if (ov == null || typeof ov !== "object") return null;
  const kontorId = (v: unknown): string | null => {
    if (v == null || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    return o.type === "kontor" && typeof o.oppmotestedId === "string" ? o.oppmotestedId : null;
  };
  const fraKontorId = kontorId((ov as Record<string, unknown>).fra);
  const tilKontorId = kontorId((ov as Record<string, unknown>).til);
  if (!fraKontorId || !tilKontorId) return null;
  return { fraKontorId, tilKontorId };
}

/** i18next-kompatibel oversetter (samme form som `grenseSjekk`). */
type Oversett = (key: string, opts?: Record<string, unknown>) => string;

/**
 * O1 (§ 8.22): terskelen som tekst («90 min» / «2,5 km») — samme tekst
 * `manuellReiseForklaringTekst` bruker, så web kan bygge sin egen linje uten egen formatering.
 */
export function manuellReiseTerskelTekst(
  t: Oversett,
  f: Exclude<ManuellReiseForklaring, { type: "ukjentAvstand" }>,
): string {
  return f.enhet === "km"
    ? t("timer.reiseTerskel.km", { km: (f.terskelM / 1000).toLocaleString("nb-NO") })
    : t("timer.reiseTerskel.min", { min: f.terskelMin });
}

/**
 * Grå forklaringslinje: «Under terskel (30 min) — føres som arbeidstid» o.l.
 * Flyttet fra mobilen (ordre (11) A) så web viser nøyaktig samme tekst.
 *
 * Under/over velges etter TERSKELUTFALLET (`forklaring.type`), aldri etter
 * `erReise` — firmaet kan ha under-type «reisetid» eller over-type
 * «arbeidstid». Kategorien settes inn separat (RETUR V1, 2026-11-14).
 */
export function manuellReiseForklaringTekst(
  t: Oversett,
  k: ManuellReiseKlassifisering,
  lonnsartNavn: string | null,
): string {
  const f = k.forklaring;
  if (f.type === "ukjentAvstand") return t("timer.reiseTerskel.ukjentAvstand");
  const terskel = manuellReiseTerskelTekst(t, f);
  const under = f.type === "under";
  if (k.erReise && k.reiseRegel.grensepunktTreff && lonnsartNavn) {
    return t(under ? "timer.reiseTerskel.underBand" : "timer.reiseTerskel.overBand", {
      terskel,
      art: lonnsartNavn,
    });
  }
  const kategori = t(
    k.erReise ? "timer.reiseTerskel.kategoriReise" : "timer.reiseTerskel.kategoriArbeid",
  );
  return t(under ? "timer.reiseTerskel.underFores" : "timer.reiseTerskel.overFores", {
    terskel,
    kategori,
  });
}

/**
 * Ordre (11) C: raden kan ikke lagres fordi det ikke finnes en art å føre på —
 * i praksis at firmaet mangler standard ordinær lønnsart (under terskel →
 * arbeidstid → standardarten). Plattformene viser da `timer.reiseTerskel.manglerArt`
 * (+ lenke for firmaadmin på web) i stedet for en stille sperre.
 */
export function manuellReiseManglerArt(k: ManuellReiseKlassifisering | null): boolean {
  return !!k && k.lonnsartId == null;
}
