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
