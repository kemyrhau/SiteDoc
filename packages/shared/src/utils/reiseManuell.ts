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
  const kategori = klassifiserReise({ reisetidMin, avstandM }, regel);

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
  };

  if (!erReise) {
    return {
      kategori,
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
  reiseKilde: "manuell" | null;
  reiseAvstandM: number | null;
  /** Kun på reise-rader (ikke-reise-rad bærer aldri oppmøtested — C2/DB-CHECK). */
  reiseOppmotestedId: string | null;
  reiseRegel: ReiseRegelSnapshot;
}

export function tilManuellReiseSpor(
  k: ManuellReiseKlassifisering,
  oppmotestedId: string | null,
): ManuellReiseSpor {
  return {
    erReise: k.erReise,
    reiseKilde: k.reiseKilde,
    reiseAvstandM: k.reiseAvstandM,
    reiseOppmotestedId: k.erReise ? oppmotestedId : null,
    reiseRegel: k.reiseRegel,
  };
}

/** Resultat av oppmøtested-valget for en manuell reise. */
export type OppmotestedValg =
  | { modus: "ingen" }
  | { modus: "auto"; oppmotestedId: string }
  | { modus: "velg"; valgtId: string | null; ider: string[] };

/**
 * Hvilket oppmøtested avstanden måles fra.
 *  - Ingen oppmøtesteder → `ingen` (avstand ukjent).
 *  - Nøyaktig ett → `auto`, brukes uten spørsmål.
 *  - Flere → `velg`: nedtrekk, siste valg forhåndsvalgt når det fortsatt
 *    finnes. Uten gyldig siste valg er ingenting valgt — vi gjetter ikke.
 */
export function velgOppmotested(
  oppmotesteder: readonly { id: string }[],
  sisteValgId: string | null | undefined,
): OppmotestedValg {
  if (oppmotesteder.length === 0) return { modus: "ingen" };
  if (oppmotesteder.length === 1) {
    return { modus: "auto", oppmotestedId: oppmotesteder[0]!.id };
  }
  const ider = oppmotesteder.map((o) => o.id);
  const valgtId = sisteValgId && ider.includes(sisteValgId) ? sisteValgId : null;
  return { modus: "velg", valgtId, ider };
}

// ============================================================================
//  Ordre 2026-11-14 (11) A: hele «+ Reise»-oppslaget som ÉN delt funksjon.
//  Mobilens `useManuellReise` (lokal cache) og webens `useManuellReiseWeb`
//  (tRPC) henter bare data og kaller denne — oppmøtested-valg, avstand og
//  klassifisering avgjøres aldri i plattformkoden.
// ============================================================================

export interface ManuellReiseKontekst {
  /** Firmaets regelsett; null = ikke lastet/cachet → ingen klassifisering. */
  regel: ReiseRegelsett | null;
  oppmotesteder: readonly { id: string }[];
  /** Siste valg husket på enheten (undefined = ikke lest ennå). */
  sisteValgId: string | null | undefined;
  /** Valget i nedtrekket (kun brukt når nedtrekket vises). */
  valgtId: string | null;
  byggeplassId: string | null;
  /** Matrise-oppslag oppmøtested × byggeplass → meter, null = ukjent. */
  avstandFor: (oppmotestedId: string, byggeplassId: string) => number | null;
  reisetimer: number;
  grensepunkter: ReiseGrensepunkt[];
  resolverLonnsartId: string | null;
  standardLonnsartId: string | null;
}

export interface ManuellReiseResultat {
  klassifisering: ManuellReiseKlassifisering | null;
  spor: ManuellReiseSpor | null;
  oppmotestedId: string | null;
  valg: OppmotestedValg;
  /** Nedtrekket vises kun når terskelen måles i km og firmaet har flere steder. */
  visVelger: boolean;
}

export function løsManuellReise(k: ManuellReiseKontekst): ManuellReiseResultat {
  const valg = velgOppmotested(k.oppmotesteder, k.sisteValgId);
  const visVelger = !!k.regel && k.regel.reiseTerskelEnhet === "km" && valg.modus === "velg";
  const oppmotestedId =
    valg.modus === "auto" ? valg.oppmotestedId : visVelger ? k.valgtId : null;
  const avstandM =
    oppmotestedId && k.byggeplassId ? k.avstandFor(oppmotestedId, k.byggeplassId) : null;
  const klassifisering = k.regel
    ? klassifiserManuellReise({
        regel: k.regel,
        reisetimer: k.reisetimer,
        avstandM,
        grensepunkter: k.grensepunkter,
        resolverLonnsartId: k.resolverLonnsartId,
        standardLonnsartId: k.standardLonnsartId,
      })
    : null;
  return {
    klassifisering,
    spor: klassifisering ? tilManuellReiseSpor(klassifisering, oppmotestedId) : null,
    oppmotestedId,
    valg,
    visVelger,
  };
}

/** i18next-kompatibel oversetter (samme form som `grenseSjekk`). */
type Oversett = (key: string, opts?: Record<string, unknown>) => string;

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
  const terskel =
    f.enhet === "km"
      ? t("timer.reiseTerskel.km", { km: (f.terskelM / 1000).toLocaleString("nb-NO") })
      : t("timer.reiseTerskel.min", { min: f.terskelMin });
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
