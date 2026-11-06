import { eq } from "drizzle-orm";
import { arbeidsdagLocal } from "../db/schema";
import {
  samleDagsforslagInput,
  type LokalDb,
  type DagsforslagInputDag,
} from "../services/dagsforslagInput";
import {
  beregnDagsforslag,
  avgjorSluttDagHandling,
  skalMarkereAvsluttet,
  type BeregnDagsforslagInput,
  type Dagsforslag,
  type DagsforslagRetting,
  type SluttDagHandling,
  type AnvendDagsforslagResultat,
} from "./dagsforslag";
import { anvendDagsforslag } from "./dagsforslagAnvend";
import type { MaskinBrudd } from "@sitedoc/shared";
import {
  maskinBruddForTillegg,
  vaktGrunnlag,
  type BekreftDagTillegg,
} from "./bekreftDagTillegg";

/** L3-D: maskin > arbeid + pause → ingenting skrives, skjermen står (spec § 8 nr. 21). */
export type BekreftDagHandling = SluttDagHandling | { type: "maskinBrudd"; brudd: MaskinBrudd[] };

/**
 * L3-A «Bekreft dag» (spec § 10, helhetsplan § 3 G1, Kenneth 2026-11-06).
 *
 * GPS gir FORSLAG til sted, prosjekt og reise. Forslaget blir lønnsgrunnlag
 * først når arbeideren bekrefter i `/timer/bekreft-dag`. Arbeider-valget i
 * skjermen er autoritativt.
 *
 * Invariant: `forberedBekreftDag` gjør KUN select + ren utregning. All skriving
 * (sedler, rader, arbeidsdagens status) skjer i `bekreftDag`/`avsluttDagUtenSedel`,
 * som kun kalles fra [Bekreft og lagre] / [Avslutt dag]. Avbrudd = dagen står
 * `paagaar`.
 */

export type ForberedBekreftDagParam = {
  userId: string;
  orgId: string;
  dag: DagsforslagInputDag;
  sluttIso: string;
  endLat: number | null;
  endLng: number | null;
  kontekstByggeplassId: string | null;
  aktivtProsjektId: string | null;
  sisteSegmentKilde: "bruker" | "system";
  /** A2: arbeiderens byggeplassvalg — ny lese-fase (select) ved bytte. */
  valgtByggeplassId?: string | null;
};

/** LES + REGN. Ingen skriving. Skjermen kaller på nytt ved hver retting. */
export function forberedBekreftDag(
  db: LokalDb,
  p: ForberedBekreftDagParam,
  retting?: DagsforslagRetting,
): { input: BeregnDagsforslagInput; forslag: Dagsforslag } {
  const input = samleDagsforslagInput(db, p);
  return { input, forslag: beregnDagsforslag({ ...input, retting }) };
}

/** SKRIV — kun fra [Bekreft og lagre]. Avslutter dagen når H7 sier det. */
export function bekreftDag(
  db: LokalDb,
  forslag: Dagsforslag,
  ctx: {
    userId: string;
    orgId: string;
    erAnsatt: boolean | null;
    nyId: () => string;
    naa: () => number;
    arbeidsdagId: string;
    sluttIso: string;
    endLat: number | null;
    endLng: number | null;
  },
  tillegg?: BekreftDagTillegg,
):
  | { handling: SluttDagHandling; resultat: AnvendDagsforslagResultat }
  | { handling: { type: "maskinBrudd"; brudd: MaskinBrudd[] }; resultat: null } {
  // Vakten kjøres FØR noe skrives — samme regel som serveren ville avvist med.
  if (tillegg && tillegg.maskiner.length > 0) {
    const brudd = maskinBruddForTillegg(vaktGrunnlag(db, ctx.userId, forslag), tillegg.maskiner);
    if (brudd.length > 0) return { handling: { type: "maskinBrudd", brudd }, resultat: null };
  }
  const resultat = anvendDagsforslag(db, forslag, ctx, tillegg);
  // H7: avgjør handlingen FØR arbeidsdagen røres. Sendt sedel, ikke ansatt og
  // manglende kilde/prosjekt holder dagen åpen (A4 venter Kenneth).
  const handling = avgjorSluttDagHandling(resultat);
  if (skalMarkereAvsluttet(handling)) {
    db.update(arbeidsdagLocal)
      .set({
        endAt: ctx.sluttIso,
        endLat: ctx.endLat,
        endLng: ctx.endLng,
        status: "avsluttet",
        generertDagsseddelId: resultat.startSheetId,
        sistEndretLokalt: ctx.naa(),
      })
      .where(eq(arbeidsdagLocal.id, ctx.arbeidsdagId))
      .run();
  }
  return { handling, resultat };
}

/** [Avslutt dag] ved tomt forslag / ikke ansatt (K14 a): lukker dagen uten sedel. */
export function avsluttDagUtenSedel(
  db: LokalDb,
  p: {
    arbeidsdagId: string;
    sluttIso: string;
    endLat: number | null;
    endLng: number | null;
    naa: () => number;
  },
): void {
  db.update(arbeidsdagLocal)
    .set({
      endAt: p.sluttIso,
      endLat: p.endLat,
      endLng: p.endLng,
      status: "avsluttet",
      generertDagsseddelId: null,
      sistEndretLokalt: p.naa(),
    })
    .where(eq(arbeidsdagLocal.id, p.arbeidsdagId))
    .run();
}

/**
 * A4-grenen (isolert): alle datoer har sendt/godkjent sedel. H7 beholdes inntil
 * Kenneth avgjør — skjermen viser lesemodus og [Lukk], ingenting opprettes.
 */
export function erAlleDatoerSendt(forslag: Dagsforslag): boolean {
  return forslag.datoer.length > 0 && forslag.datoer.every((d) => d.blokkert);
}

/**
 * «Ingen timer å føre»: ingen rader på noen åpen dato. Tomt `datoer` (katalog
 * mangler) teller som tomt; `prosjektUkjent` gjør IKKE — der er veien ut å
 * velge prosjekt i skjermen.
 */
export function erTomtForslag(forslag: Dagsforslag): boolean {
  if (forslag.prosjektUkjent || erAlleDatoerSendt(forslag)) return false;
  return forslag.datoer
    .filter((d) => !d.blokkert)
    .every((d) => d.rader.length === 0 && d.raderDroppetUtenLonnsart === 0);
}
