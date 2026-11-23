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
import type { OppmoteResultat, Overforing } from "./oppmote";

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
 *  - oppmoteIkkeValgt: den ansatte har ikke valgt oppmøtested (første valg
 *    ikke gjort, enheten offline). Kenneth-vedtak 2026-11-15: Lagre sperres —
 *    kortet har ikke noe tidsfelt, så uten oppmøtested finnes ingen kjøretid.
 *  - manglerKjoretid: ingen byggeplass, ingen matrisecelle eller uoppnåelig
 *    par. Ingen estimat-fallback (V13).
 *  - manglerDagstid: sedelen har ingen arbeidsrad med tid å regne fra.
 *  - utenforDognet: Tur før 00:00 eller Retur etter 24:00.
 *  - manglerArt: ingen lønnsart å føre på (jf. `manuellReiseManglerArt`).
 *  - manglerRegel: firmaets regelsett er ikke lastet/cachet.
 */
export type ReiseKortSperre =
  | "byggeplassPeriode"
  | "oppmoteIkkeValgt"
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
}

/** O12 pkt 14: hvorfor forslaget mangler når `tillatUtenKjoretid` er satt. */
export type ReiseKortUtenKjoretid = "mangler" | "utenByggeplass";

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
  /** O12 pkt 14: satt når kjøretiden mangler og kalleren tillot det (web). Ellers utelatt. */
  utenKjoretid?: ReiseKortUtenKjoretid;
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

  // 2. Uten oppmøtested finnes ingen kjøretid — og ikke noe manuelt timefelt å
  //    falle tilbake på. Egen sperre, så kortet kan be om nett (vedtak 2026-11-15).
  if (k.oppmote.kilde === "ikkeValgt") return tom("oppmoteIkkeValgt");

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
  const til = klokkeTilMin(k.sluttTid) ?? fra + kjoretidMin;
  if (fra < 0 || til > 24 * 60) return tom("utenforDognet", oppmotestedId);

  const timer = Math.max(0, til - fra) / 60;
  const basis = {
    timer,
    fraTid: minTilKlokke(fra),
    tilTid: minTilKlokke(til),
    oppmotestedId,
    kjoretidMin,
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
  const fra = klokkeTilMin(k.startTid) ?? (naar === "etterArbeid" ? anker : null);
  const til = klokkeTilMin(k.sluttTid) ?? (naar === "forArbeid" ? anker : null);
  const basis = {
    fraTid: fra == null ? null : minTilKlokke(fra),
    tilTid: til == null ? null : minTilKlokke(til),
    oppmotestedId,
    kjoretidMin: null,
    utenKjoretid,
  };
  if (fra == null || til == null) {
    return { ...basis, timer: 0, klassifisering: null, spor: null, sperre: null };
  }
  if (fra < 0 || til > 24 * 60) {
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
