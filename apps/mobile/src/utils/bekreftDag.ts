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
import { nesteLokaleMidnatt } from "./dagsegment";
import { lokalIsoDato } from "./dato";
import type { MaskinBrudd } from "@sitedoc/shared";
import {
  maskinBruddForTillegg,
  vaktGrunnlag,
  type BekreftDagTillegg,
} from "./bekreftDagTillegg";
import { kortMedArbeid } from "./beskrivelseKort";
import { kortNokkel } from "../lib/prosjektkortMobil";
import { avsluttBesok, type BesokSted } from "../services/arbeidsdagBesok";

/**
 * L3-D: maskin > arbeid + pause → ingenting skrives, skjermen står (spec § 8 nr. 21).
 * ORDRE 36a: tom beskrivelse på et prosjekt med arbeid → ingenting skrives.
 */
export type BekreftDagHandling =
  | SluttDagHandling
  | { type: "maskinBrudd"; brudd: MaskinBrudd[] }
  | { type: "manglerBeskrivelse"; nokler: string[] };

/**
 * ORDRE 36a (spec § 3): prosjektene som har arbeid (ikke reise) på en åpen
 * dato, i forslagets rekkefølge. Fjernet arbeid (`fjernArbeid`) har ingen
 * arbeidsrader og teller ikke.
 */
export function prosjekterMedArbeid(forslag: Dagsforslag): string[] {
  const ider: string[] = [];
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (!r.erReise && r.timer > 0 && !ider.includes(r.projectId)) ider.push(r.projectId);
    }
  }
  return ider;
}

/**
 * ORDRE 36a/36b: beskrivelse-nøklene (ett pr. kort med arbeid) der teksten er
 * tom etter trim. Ett kort pr. prosjekt → nøkkelen er projectId (som 36a).
 */
export function manglerBeskrivelse(forslag: Dagsforslag): string[] {
  return kortMedArbeid(forslag)
    .map((k) => k.nokkel)
    .filter((n) => !forslag.beskrivelsePerKort?.[n]?.trim());
}

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

/** ORDRE 36a: prosjektbytte flytter teksten når det nye prosjektet ikke har egen. */
export function flyttBeskrivelse(
  b: Record<string, string> | undefined,
  fra: string | null,
  til: string | null,
): Record<string, string> | undefined {
  if (!b || !fra || !til || fra === til || !b[fra]?.trim() || b[til]?.trim()) return b;
  return { ...b, [til]: b[fra]! };
}

/**
 * RETUR 4 (P6): prosjektbytte når det gamle prosjektet har flere kort. Teksten
 * står da under kortnøkkelen til kortet som arver dagens byggeplass, ikke under
 * `projectId` — begge kildene flyttes (projectId først), aldri over eksisterende.
 */
export function flyttBeskrivelseVedProsjektbytte(
  b: Record<string, string> | undefined,
  fra: string | null,
  til: string | null,
  dagByggeplassId: string | null,
): Record<string, string> | undefined {
  const arvKort = fra ? kortNokkel({ projectId: fra, byggeplassId: dagByggeplassId, ecoId: null }) : null;
  return flyttBeskrivelse(flyttBeskrivelse(b, fra, til), arvKort, til);
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
    /** ORDRE 36c: null = manuell modus (ingen arbeidsdag å avslutte). */
    arbeidsdagId: string | null;
    /** ORDRE 36c: valgt underprosjekt i manuell modus. Utelatt/null = uten. */
    ecoId?: string | null;
    /** RETUR 36c-3: eksplisitt «Ingen byggeplass» (manuell) — løfter sedelens arv. */
    utenByggeplassValgt?: boolean;
    sluttIso: string;
    endLat: number | null;
    endLng: number | null;
    /** L4-A (§ 2.2): byggeplassen slutt-GPS traff (null = ingen treff). */
    sluttSted?: BesokSted | null;
  },
  tillegg?: BekreftDagTillegg,
):
  | { handling: SluttDagHandling; resultat: AnvendDagsforslagResultat }
  | { handling: { type: "maskinBrudd"; brudd: MaskinBrudd[] }; resultat: null }
  | { handling: { type: "manglerBeskrivelse"; nokler: string[] }; resultat: null } {
  // ORDRE 36a: beskrivelsen er påkrevd — sjekkes først, ingenting skrives.
  const mangler = manglerBeskrivelse(forslag);
  if (mangler.length > 0) {
    return { handling: { type: "manglerBeskrivelse", nokler: mangler }, resultat: null };
  }
  // Vakten kjøres FØR noe skrives — samme regel som serveren ville avvist med.
  if (tillegg && tillegg.maskiner.length > 0) {
    const brudd = maskinBruddForTillegg(vaktGrunnlag(db, ctx.userId, forslag), tillegg.maskiner);
    if (brudd.length > 0) return { handling: { type: "maskinBrudd", brudd }, resultat: null };
  }
  const resultat = anvendDagsforslag(db, forslag, ctx, tillegg);
  // H7: avgjør handlingen FØR arbeidsdagen røres. Sendt sedel, ikke ansatt og
  // manglende kilde/prosjekt holder dagen åpen (A4 venter Kenneth).
  const handling = avgjorSluttDagHandling(resultat);
  if (ctx.arbeidsdagId && skalMarkereAvsluttet(handling)) {
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
    // L4-A: besøkene lukkes i samme steg som dagen — H7 holder dagen åpen → ingen avreise.
    avsluttBesok(db, {
      nyId: ctx.nyId,
      arbeidsdagId: ctx.arbeidsdagId,
      sluttIso: ctx.sluttIso,
      sluttSted: ctx.sluttSted ?? null,
      naaIso: new Date(ctx.naa()).toISOString(),
    });
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
    /** L4-A (§ 2.2): byggeplassen slutt-GPS traff (null = ingen treff). */
    sluttSted?: BesokSted | null;
    nyId: () => string;
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
  avsluttBesok(db, {
    nyId: p.nyId,
    arbeidsdagId: p.arbeidsdagId,
    sluttIso: p.sluttIso,
    sluttSted: p.sluttSted ?? null,
    naaIso: new Date(p.naa()).toISOString(),
  });
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

/** DEL 5 a: datoene i forslaget som alt er sendt/godkjent (lagres ikke). */
export function sendteDatoer(forslag: Dagsforslag): string[] {
  return forslag.datoer.filter((d) => d.blokkert).map((d) => d.dato);
}

/**
 * DEL 5 a/c: hvorfor «Bekreft og lagre» ikke kan lagre nå — null = kan lagre.
 * Hver sperre har en melding i skjermen (`timer.bekreftDag.sperre.<årsak>`);
 * ingen sperre er stille. Pågående lagring (dobbelttrykk) er ikke en sperre —
 * knappen viser da laste-indikator.
 */
export type BekreftSperre =
  | "ikkeKlar"
  | "ikkeInnlogget"
  | "dagLukket"
  | "manglerProsjekt"
  | "sluttIkkeGodkjent";

export function bekreftSperre(a: {
  harDb: boolean;
  harBeregnet: boolean;
  harBruker: boolean;
  manuell: boolean;
  harArbeidsdagId: boolean;
  manglerProsjekt: boolean;
  /** c: sluttiden er anslått og ikke godkjent eller rettet av arbeideren. */
  sluttIkkeGodkjent: boolean;
}): BekreftSperre | null {
  if (!a.harDb) return "ikkeKlar";
  if (!a.harBruker) return "ikkeInnlogget";
  if (!a.manuell && !a.harArbeidsdagId) return "dagLukket";
  if (!a.harBeregnet) return "dagLukket";
  if (a.manglerProsjekt) return "manglerProsjekt";
  if (a.sluttIkkeGodkjent) return "sluttIkkeGodkjent";
  return null;
}

/**
 * DEL 5 c: arbeiderens retting av en anslått sluttid — `steg` minutter fram
 * eller tilbake. Aldri før start + 15 min; kan gå forbi midnatt (arbeideren
 * velger det selv — d kapper bare estimatet).
 */
export function stegSluttIso(gjeldendeIso: string, startIso: string, stegMin: number): string {
  const min = new Date(startIso).getTime() + 15 * 60_000;
  return new Date(Math.max(min, new Date(gjeldendeIso).getTime() + stegMin * 60_000)).toISOString();
}

/**
 * DEL 5 c/d: sluttiden slik Bekreft dag viser den. Nøyaktig midnatt etter
 * start vises som «24:00» på startdatoen (estimatet er kappet der); en slutt
 * på en senere dato bærer datoen, så det er tydelig at timer føres der.
 */
export function visSluttTid(
  startIso: string,
  sluttIso: string,
): { tid: string; dato: string | null } {
  const slutt = new Date(sluttIso);
  const hhmm = `${String(slutt.getHours()).padStart(2, "0")}:${String(slutt.getMinutes()).padStart(2, "0")}`;
  if (slutt.getTime() === nesteLokaleMidnatt(startIso).getTime()) {
    return { tid: "24:00", dato: null };
  }
  const startDato = lokalIsoDato(new Date(startIso));
  const sluttDato = lokalIsoDato(slutt);
  return { tid: hhmm, dato: sluttDato === startDato ? null : sluttDato };
}
