// ============================================================================
//  Overtidsgrunnlag — «beregnet vs. valgt» klassifisering (ORDRE 2, § D2).
//
//  Backstop-prinsippet (Kenneth-presisering): serveren BEREGNER klassifisering
//  for alle rader og gjør den etterprøvbar — men OVERSTYRER aldri brukerens
//  lonnsartId. Avviket mellom beregnet og valgt er noe attestanten skal SE,
//  ikke noe systemet retter stille. Denne modulen er ren aritmetikk over
//  ferdig-uthentede rader — den rører ingen data, gjør ingen DB-kall.
//
//  · «valgt»    = det brukeren faktisk førte (rad.overtidsnivaa fra lonnsart)
//  · «beregnet» = det regelen (klassifiserArbeidstid) sier ut fra norm
//
//  Norm er dagsnorm (dag-nivå, lese-avledning i visningene) ELLER ukenorm
//  (uke-nivå, snapshot ved attestering) — samme regnestykke, ulik norm.
// ============================================================================

import { klassifiserArbeidstid } from "./lonnsregel";

/** En timer-rad redusert til det klassifiseringen trenger. */
export interface OvertidRad {
  timer: number;
  /** Fra lonnsart. null = ordinær/normaltid; 50/100 = overtid-tier. */
  overtidsnivaa: number | null;
  /**
   * LAG 2 / V1: reise er ALDRI overtid. Reise-rader holdes helt utenfor
   * overtidsgrunnlaget — de teller hverken i arbeidstimer, sumOvertid eller
   * klassifiseringen. 🔴 PÅKREVD (gate RETUR 1 avvik 2): garantien ligger i
   * typen, ikke i disiplinen til neste kaller — en manglende verdi skal aldri
   * kunne la en reise-rad telle som arbeid. Begge serverkallerne setter den.
   */
  erReise: boolean;
  /**
   * Kort-id-spec § 11.10.4 F-F1: fravær (lønnsart-type `fravaer`, med og uten tak) er
   * ikke arbeid — holdes utenfor arbeidstimer, sumOrdinaert, sumOvertid og beregnet
   * overtid, og summeres i `fravaerTimer`. Påkrevd, som `erReise`.
   */
  erFravaer: boolean;
}

export interface Overtidsgrunnlag {
  /** Normen sammenligningen skjer mot: dagsnorm (dag) eller ukenorm (uke). */
  norm: number;
  /** Alle timer (arbeid + reise) — uendret betydning, for visning. */
  totaltimer: number;
  /** LAG 2 / V1: timer på ikke-reise-rader — grunnlaget overtid beregnes fra. */
  arbeidstimer: number;
  /** LAG 2 / V1: timer på reise-rader — holdt UTENFOR overtidsfordelingen. */
  reisetimer: number;
  /** F-F1: timer på fraværsrader — holdt UTENFOR overtidsfordelingen. */
  fravaerTimer: number;
  /**
   * F-F1 uke-nivå: timene raden(e) teller med i en ukesum — arbeid pluss fravær som bare
   * fyller normen, aldri mer: arbeid + min(fravær, max(0, norm − arbeid)). Uten reise (A4, B85).
   * Meningsfull på dag-nivå (norm = dagsnorm); ukesbadgen summerer den.
   */
  ukeTimer: number;
  /** Valgt: timer ført på ikke-reise-rader UTEN overtidsnivaa. */
  sumOrdinaert: number;
  /** Valgt: timer ført på ikke-reise-rader MED overtidsnivaa (bruker-tagget overtid). */
  sumOvertid: number;
  /** Beregnet: timer regelen legger over normen (klassifiserArbeidstid på arbeidstimer). */
  beregnetOvertid: number;
  /** true når beregnet og valgt overtid spriker (utover 0,01 t). */
  avvik: boolean;
  /**
   * A4 (B85): ukeregnestykket, bare på uke-grunnlaget serveren fryser i attestert-snapshotet.
   * Lesesiden bruker `lesUkeregnestykkeFraSnapshot`.
   */
  ukeregnestykke?: Ukeregnestykke;
  /** A4 (B53 A): var uka komplett da regnestykket ble fryst? Lesesiden: `lesFrossetUkeFraSnapshot`. */
  ukeKomplett?: boolean;
  /** A4: arbeidsdagene som manglet sendt eller attestert sedel da regnestykket ble fryst (ISO). */
  ukeManglerDager?: string[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Beregn overtidsgrunnlag for et sett rader mot en norm. REN — muterer ikke
 * input, gjør ingen DB-kall, rører ingen lonnsartId.
 */
export function beregnOvertidsgrunnlag(
  rader: OvertidRad[],
  norm: number,
): Overtidsgrunnlag {
  // V1: reise-rader holdes HELT utenfor overtidsgrunnlaget. De teller i reisetimer
  // (for visning), men aldri i arbeidstimer, sumOvertid eller klassifiseringen.
  // F-F1: fravær (ikke reise) likeså — summeres i fravaerTimer.
  const arbeidRader = rader.filter((r) => !r.erReise && !r.erFravaer);
  const reiseRader = rader.filter((r) => r.erReise);
  const fravaerRader = rader.filter((r) => !r.erReise && r.erFravaer);
  const arbeidstimer = round2(arbeidRader.reduce((s, r) => s + r.timer, 0));
  const reisetimer = round2(reiseRader.reduce((s, r) => s + r.timer, 0));
  const fravaerTimer = round2(fravaerRader.reduce((s, r) => s + r.timer, 0));
  const totaltimer = round2(arbeidstimer + reisetimer + fravaerTimer);
  // A4 (B85, retter AM12): ukesummen er uten reise — arbeid + fravær som fyller normen.
  const ukeTimer = round2(arbeidstimer + fravaerINorm(fravaerTimer, arbeidstimer, norm));
  const sumOvertid = round2(
    arbeidRader
      .filter((r) => r.overtidsnivaa !== null)
      .reduce((s, r) => s + r.timer, 0),
  );
  const sumOrdinaert = round2(arbeidstimer - sumOvertid);
  const segmenter = klassifiserArbeidstid({ arbeidstimer, dagsnorm: norm });
  const beregnetOvertid = round2(
    segmenter.filter((s) => s.overtidsnivaa !== null).reduce((s, x) => s + x.timer, 0),
  );
  const avvik = Math.abs(beregnetOvertid - sumOvertid) > 0.01;
  return {
    norm,
    totaltimer,
    arbeidstimer,
    reisetimer,
    fravaerTimer,
    ukeTimer,
    sumOrdinaert,
    sumOvertid,
    beregnetOvertid,
    avvik,
  };
}

/** Fraværet som fyller normen: min(fravær, max(0, norm − arbeid)). Ukjent norm → 0. */
function fravaerINorm(fravaer: number, arbeid: number, norm: number): number {
  if (!(norm > 0)) return 0;
  return round2(Math.min(fravaer, Math.max(0, norm - arbeid)));
}

/**
 * F-F1 uke-nivå (§ 11.10.4): fravær kan ikke bare strykes fra ukegrunnlaget — da gir en
 * uke med én egenmeldingsdag og ført overtid de andre dagene et falskt avvik. Hver dag
 * teller `arbeid + min(fravær, max(0, dagsnorm − arbeid))`, med og uten tak likt.
 * `arbeidstimer` er rent arbeid; klassifiseringen går på arbeid + fravær i normen.
 */
export function beregnUkeOvertidsgrunnlag(
  dager: readonly { dagsnorm: number; rader: readonly OvertidRad[] }[],
  ukenorm: number,
): Overtidsgrunnlag {
  const perDag = dager.map((d) => beregnOvertidsgrunnlag([...d.rader], d.dagsnorm));
  const sum = (f: (g: Overtidsgrunnlag) => number) => round2(perDag.reduce((a, g) => a + f(g), 0));
  const arbeidstimer = sum((g) => g.arbeidstimer);
  const reisetimer = sum((g) => g.reisetimer);
  const fravaerTimer = sum((g) => g.fravaerTimer);
  const iNorm = round2(
    perDag.reduce((a, g) => a + fravaerINorm(g.fravaerTimer, g.arbeidstimer, g.norm), 0),
  );
  const sumOvertid = sum((g) => g.sumOvertid);
  const sumOrdinaert = round2(arbeidstimer - sumOvertid);
  const beregnetOvertid = round2(
    klassifiserArbeidstid({ arbeidstimer: round2(arbeidstimer + iNorm), dagsnorm: ukenorm })
      .filter((s) => s.overtidsnivaa !== null)
      .reduce((a, s) => a + s.timer, 0),
  );
  const totaltimer = round2(arbeidstimer + reisetimer + fravaerTimer);
  return {
    norm: ukenorm,
    totaltimer,
    arbeidstimer,
    reisetimer,
    fravaerTimer,
    // A4 (B85, retter AM12): uten reise.
    ukeTimer: round2(arbeidstimer + iNorm),
    sumOrdinaert,
    sumOvertid,
    beregnetOvertid,
    avvik: Math.abs(beregnetOvertid - sumOvertid) > 0.01,
  };
}

/**
 * Les overtidsgrunnlag ut av et attestertSnapshot-Json. GATE (§ D2): eldre
 * snapshots ble skrevet FØR dette feltet fantes — de mangler `overtidsgrunnlag`.
 * Da returneres `null` (aldri et fabrikkert 0 som ser ut som et faktum).
 * Lesesiden må behandle `null` som «ikke registrert», ikke som «0 timer».
 */
export function lesOvertidsgrunnlagFraSnapshot(
  snapshot: unknown,
): Overtidsgrunnlag | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const o = (snapshot as Record<string, unknown>).overtidsgrunnlag;
  if (!o || typeof o !== "object") return null;
  const g = o as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const norm = num(g.norm);
  const totaltimer = num(g.totaltimer);
  const sumOrdinaert = num(g.sumOrdinaert);
  const sumOvertid = num(g.sumOvertid);
  const beregnetOvertid = num(g.beregnetOvertid);
  // Krev at alle tall-feltene finnes — ellers er dette en gammel snapshot-form.
  if (
    norm === null ||
    totaltimer === null ||
    sumOrdinaert === null ||
    sumOvertid === null ||
    beregnetOvertid === null
  ) {
    return null;
  }
  // LAG 2: arbeidstimer/reisetimer kom til i lag 2. Eldre snapshots mangler dem —
  // da fantes ikke reise-splittet, så reise var talt som arbeid: arbeidstimer =
  // totaltimer, reisetimer = 0 (ærlig gjengivelse av det som faktisk ble attestert).
  const arbeidstimer = num(g.arbeidstimer);
  const reisetimer = num(g.reisetimer);
  // F-F1: fravaerTimer kom til i b. Eldre snapshots telte fravær som arbeid → 0 er
  // det som faktisk ble attestert; ukeTimer = totaltimer av samme grunn.
  const fravaerTimer = num(g.fravaerTimer);
  const ukeTimer = num(g.ukeTimer);
  return {
    norm,
    totaltimer,
    arbeidstimer: arbeidstimer ?? totaltimer,
    reisetimer: reisetimer ?? 0,
    fravaerTimer: fravaerTimer ?? 0,
    ukeTimer: ukeTimer ?? totaltimer,
    sumOrdinaert,
    sumOvertid,
    beregnetOvertid,
    avvik: g.avvik === true,
  };
}

// ============================================================================
//  Uke-avvik — attestantvarselet (ORDRE 2 STEG 3 ledd 2, designnotat § D2).
//
//  Bygd som per-sedel-grunnlaget aggregert til UKE: attestanten skal se at en
//  ukes overtid ikke stemmer med normen, uten å regne selv. Trukket hit fra en
//  privat funksjon i AttesteringPivot.tsx (web) så web SeddelKort/pivot, mobil-
//  liste og detalj-banner deler ÉN kilde — ellers fødes kopi nummer to.
//
//  Semantikk (fabel-vedtak, pivot-kommentaren): varselet er MISFORHOLD mellom
//  FØRT og BEREGNET overtid — ikke «over norm». En ansatt som fører overtiden
//  riktig har intet avvik. Dette er den forfinede tolkningen av D2s (a).
// ============================================================================

/** Én sedel redusert til det uke-avviket trenger (dag-grunnlag + ukenorm). */
export interface UkeSedelInput {
  totaltimer: number;
  /**
   * F-F1: dagens timer der fravær bare fyller normen (`Overtidsgrunnlag.ukeTimer`).
   * Valgfri — uten den brukes totaltimer som før (kaller som ikke er oppdatert).
   */
  ukeTimer?: number;
  /** Ukenormen sedelens uke måles mot (fra beregnUkenorm, servert per sedel). */
  ukenorm: number;
  /** Ført (valgt) overtid denne sedelen — dag-grunnlagets sumOvertid. */
  sumOvertid: number;
}

/** Uke-nivå avvik (D2): misforhold mellom FØRT og BEREGNET overtid. */
export interface UkeAvvik {
  norm: number;
  ukesum: number;
  sumOrdinaert: number;
  /** Ført (valgt) overtid over uken. */
  sumOvertid: number;
  /** Beregnet overtid = regelen (klassifiserArbeidstid) over ukesum mot norm. */
  beregnetOvertid: number;
  /** beregnet − ført; >0 = overtid ikke ført, <0 = ført under norm. */
  avvikTimer: number;
}

/**
 * Aggreger et sett sedler (samme bruker, samme uke) til uke-avviket. REN.
 * `beregnetOvertid` går via `klassifiserArbeidstid` — SAMME regel som
 * `beregnOvertidsgrunnlag`, så terskelen «hvor mye SKAL være overtid» har ett
 * hjem og følger en fremtidig nivå 1/2-tariff automatisk.
 */
export function beregnUkeAvvik(sedler: UkeSedelInput[]): UkeAvvik {
  const norm = sedler[0]?.ukenorm ?? 0;
  const ukesum = round2(sedler.reduce((a, s) => a + (s.ukeTimer ?? s.totaltimer), 0));
  const sumOvertid = round2(sedler.reduce((a, s) => a + s.sumOvertid, 0));
  const sumOrdinaert = round2(ukesum - sumOvertid);
  const beregnetOvertid = round2(
    klassifiserArbeidstid({ arbeidstimer: ukesum, dagsnorm: norm })
      .filter((s) => s.overtidsnivaa !== null)
      .reduce((a, s) => a + s.timer, 0),
  );
  const avvikTimer = round2(beregnetOvertid - sumOvertid);
  return { norm, ukesum, sumOrdinaert, sumOvertid, beregnetOvertid, avvikTimer };
}

/**
 * Retningen på et avvik — én kilde delt av badge (web+mobil) og banner.
 * `null` = intet varsel (norm ukjent, eller ført == beregnet innen 0,01 t).
 * Godtar både `UkeAvvik` og `Overtidsgrunnlag` (begge bærer de tre feltene).
 */
export function avvikRetning(g: {
  norm: number;
  beregnetOvertid: number;
  sumOvertid: number;
}): "over" | "under" | null {
  if (g.norm <= 0) return null;
  const d = round2(g.beregnetOvertid - g.sumOvertid);
  if (d > 0.01) return "over";
  if (d < -0.01) return "under";
  return null;
}

// ============================================================================
//  Avvik pekes ut (kort-id-spec § 12.2 «Avvik pekes ut», T26).
//
//  Hvilke rader ukeavviket gjelder. Regnestykket over (beregnUkeAvvik) er
//  uendret; dette bare peker ut radene.
//  - «under» (ført overtid > beregnet): alle ukas overtidsrader.
//  - «over» (beregnet > ført): de ordinære arbeidsradene etter at ukenormen er
//    passert, i tidsrekkefølge (dato, fraTid, opprettet).
//  Reise teller aldri. Fravær merkes aldri, og teller i ukesummen bare så langt
//  det fyller dagens norm (F-F1).
// ============================================================================

export interface UkeAvvikRadInput {
  id: string;
  /** ISO-dato YYYY-MM-DD. */
  dato: string;
  fraTid?: string | null;
  createdAt?: Date | string | null;
  timer: number;
  overtidsnivaa: number | null;
  erReise: boolean;
  erFravaer: boolean;
}

/**
 * Id-ene til radene ukeavviket gjelder, i tidsrekkefølge. Tom liste når det
 * ikke er avvik. `dagsnorm(iso)` gir dagens norm for F-F1; uten den teller
 * fravær fullt.
 */
export function ukeAvvikRader(
  rader: readonly UkeAvvikRadInput[],
  g: { norm: number; beregnetOvertid: number; sumOvertid: number },
  dagsnorm?: (iso: string) => number,
): string[] {
  const retning = avvikRetning(g);
  if (retning === null) return [];
  const sortert = sorterRader(rader);
  if (retning === "under") {
    return overtidsRader(sortert);
  }

  return raderEtterNorm(sortert, g.norm, dagsnorm);
}

/** Ukas rader i tidsrekkefølge (dato, fraTid, opprettet, id). */
function sorterRader<R extends UkeAvvikRadInput>(rader: readonly R[]): R[] {
  const ms = (t: Date | string | null | undefined): number =>
    t == null ? Number.POSITIVE_INFINITY : typeof t === "string" ? Date.parse(t) : t.getTime();
  return [...rader].sort(
    (a, b) =>
      (a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : 0) ||
      ((a.fraTid ?? "99:99") < (b.fraTid ?? "99:99") ? -1 : (a.fraTid ?? "99:99") > (b.fraTid ?? "99:99") ? 1 : 0) ||
      ms(a.createdAt) - ms(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Ukas overtidslinjer: arbeid (ikke reise, ikke fravær) med overtidsnivå. */
function overtidsRader(sortert: readonly UkeAvvikRadInput[]): string[] {
  return sortert.filter((r) => !r.erReise && !r.erFravaer && r.overtidsnivaa !== null).map((r) => r.id);
}

/** De ordinære arbeidsradene etter at `norm` er passert (sortert input). */
function raderEtterNorm(
  sortert: readonly UkeAvvikRadInput[],
  norm: number,
  dagsnorm?: (iso: string) => number,
): string[] {
  // F-F1: fravær fyller bare dagens norm — beregn hvor mye fravær som teller pr. dato.
  const fravaerKreditt = new Map<string, number>();
  if (dagsnorm) {
    const perDato = new Map<string, { arbeid: number; fravaer: number }>();
    for (const r of sortert) {
      if (r.erReise) continue;
      const d = perDato.get(r.dato) ?? { arbeid: 0, fravaer: 0 };
      if (r.erFravaer) d.fravaer += r.timer;
      else d.arbeid += r.timer;
      perDato.set(r.dato, d);
    }
    for (const [iso, d] of perDato) {
      fravaerKreditt.set(iso, Math.min(d.fravaer, Math.max(0, dagsnorm(iso) - d.arbeid)));
    }
  }

  const merket: string[] = [];
  let sum = 0;
  for (const r of sortert) {
    if (r.erReise) continue;
    if (r.erFravaer) {
      if (!dagsnorm) {
        sum += r.timer;
        continue;
      }
      const igjen = fravaerKreditt.get(r.dato) ?? 0;
      const teller = Math.min(r.timer, igjen);
      fravaerKreditt.set(r.dato, igjen - teller);
      sum += teller;
      continue;
    }
    sum = round2(sum + r.timer);
    if (r.overtidsnivaa === null && sum > norm + 0.005) merket.push(r.id);
  }
  return merket;
}

// ============================================================================
//  A4 — ukeregnestykket (plan § 4.17 del B «Ukevarselet og hvor overtid kan
//  trekkes», Kenneth B85 ja 2026-11-24; retter AM12).
//
//  ÉN funksjon for skjerm og server: mandag–søndag, uten reise. Serveren regner
//  den (`lastUkeOvertid`), sender den til attesteringen og fryser den i
//  attestert-snapshotet; skjermen viser serverens tall og regner ikke selv.
//
//  · ukesum       = arbeid (ordinært + overtid) + fravær som fyller dagens norm
//  · mangler      = ukenorm − ukesum (aldri under 0)
//  · overDagsnorm = summen av dagenes «+»-merker: max(0, arbeid + fravær − dagsnorm)
//  · godtatt      = overDagsnorm − mangler (aldri under 0)
//  · kanTrekkes   = ført overtid − godtatt (aldri under 0), bare når uka er under
//                   ukenorm. Dagen viser ukas tall, aldri mer enn dagens førte overtid.
//  · overIkkeFort = overtid regelen gir over ukenorm, minus ført overtid — «over
//                   ukenorm uten ført overtid», som før.
// ============================================================================

/** Én dag i uka: datoens dagsnorm og radene (reise og fravær merket). */
export interface UkeregnestykkeDagInput {
  /** ISO-dato YYYY-MM-DD. */
  dato: string;
  dagsnorm: number;
  rader: readonly OvertidRad[];
}

export interface UkeregnestykkeDag {
  dato: string;
  dagsnorm: number;
  arbeid: number;
  fravaer: number;
  reise: number;
  /** Ført overtid den dagen (arbeid med overtidsnivå). */
  overtid: number;
  /** Dagens normmerke: arbeid + fravær − dagsnorm. */
  avvik: number;
  /** Timer av ukas «kan trekkes» som kan trekkes her: min(uka, dagens overtid). */
  kanTrekkes: number;
}

export interface Ukeregnestykke {
  ukenorm: number;
  /** Arbeid + fravær som fyller normen, uten reise. */
  ukesum: number;
  /** Reisen i uka — står for seg, teller ikke i ukesummen. */
  reise: number;
  sumOrdinaert: number;
  /** Ført overtid i uka. */
  sumOvertid: number;
  fravaer: number;
  /** Timene uka mangler til ukenorm (0 når uka er på eller over). */
  mangler: number;
  /** Summen av dagenes «+»-merker. */
  overDagsnorm: number;
  /** Overtid som er godtatt: overDagsnorm − mangler. */
  godtattOvertid: number;
  /** Ført overtid som kan trekkes (B85). 0 når uka er på eller over ukenorm. */
  kanTrekkes: number;
  /** Timer over ukenorm som ikke er ført som overtid. */
  overIkkeFort: number;
  dager: UkeregnestykkeDag[];
}

/** Ukeregnestykket (B85) for dagene i uka mot ukenormen. REN. */
export function beregnUkeregnestykke(
  dager: readonly UkeregnestykkeDagInput[],
  ukenorm: number,
): Ukeregnestykke {
  const perDag = [...dager]
    .sort((a, b) => (a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : 0))
    .map((d) => ({ d, g: beregnOvertidsgrunnlag([...d.rader], d.dagsnorm) }));
  const sum = (f: (g: Overtidsgrunnlag) => number) => round2(perDag.reduce((a, x) => a + f(x.g), 0));
  const ukesum = sum((g) => g.ukeTimer);
  const sumOvertid = sum((g) => g.sumOvertid);
  const arbeid = sum((g) => g.arbeidstimer);
  const mangler = ukenorm > 0 ? round2(Math.max(0, ukenorm - ukesum)) : 0;
  const overDagsnorm = round2(
    perDag.reduce((a, { d, g }) => a + (d.dagsnorm > 0 ? Math.max(0, g.arbeidstimer + g.fravaerTimer - d.dagsnorm) : 0), 0),
  );
  const godtattOvertid = round2(Math.max(0, overDagsnorm - mangler));
  const kanTrekkes = mangler > 0.005 ? round2(Math.max(0, sumOvertid - godtattOvertid)) : 0;
  const beregnet = ukenorm > 0
    ? round2(
        klassifiserArbeidstid({ arbeidstimer: ukesum, dagsnorm: ukenorm })
          .filter((s) => s.overtidsnivaa !== null)
          .reduce((a, s) => a + s.timer, 0),
      )
    : 0;
  return {
    ukenorm,
    ukesum,
    reise: sum((g) => g.reisetimer),
    sumOrdinaert: round2(arbeid - sumOvertid),
    sumOvertid,
    fravaer: sum((g) => g.fravaerTimer),
    mangler,
    overDagsnorm,
    godtattOvertid,
    kanTrekkes,
    overIkkeFort: round2(Math.max(0, beregnet - sumOvertid)),
    dager: perDag.map(({ d, g }) => ({
      dato: d.dato,
      dagsnorm: d.dagsnorm,
      arbeid: g.arbeidstimer,
      fravaer: g.fravaerTimer,
      reise: g.reisetimer,
      overtid: g.sumOvertid,
      avvik: round2(g.arbeidstimer + g.fravaerTimer - d.dagsnorm),
      kanTrekkes: round2(Math.min(kanTrekkes, g.sumOvertid)),
    })),
  };
}

/** Har uka et ukevarsel (overtid som kan trekkes, eller timer over ukenorm uten overtid)? */
export function harUkevarsel(r: Pick<Ukeregnestykke, "kanTrekkes" | "overIkkeFort">): boolean {
  return r.kanTrekkes > 0.005 || r.overIkkeFort > 0.005;
}

/**
 * Linjene ukevarselet peker på (A4, erstatter `ukeAvvikRader` i attesteringen):
 * «kan trekkes» → alle ukas overtidslinjer; «over ukenorm uten overtid» → de
 * ordinære arbeidslinjene etter at ukenormen er passert. Reise pekes aldri ut.
 */
export function ukevarselRader(
  rader: readonly UkeAvvikRadInput[],
  r: Pick<Ukeregnestykke, "ukenorm" | "kanTrekkes" | "overIkkeFort">,
  dagsnorm?: (iso: string) => number,
): string[] {
  const sortert = sorterRader(rader);
  if (r.kanTrekkes > 0.005) return overtidsRader(sortert);
  if (r.overIkkeFort > 0.005) return raderEtterNorm(sortert, r.ukenorm, dagsnorm);
  return [];
}

/**
 * Les det frosne ukeregnestykket ut av et attestertSnapshot (`overtidsgrunnlag.ukeregnestykke`,
 * A4). Snapshots fra før A4 har det ikke → `null` (lesesiden regner live).
 */
export function lesUkeregnestykkeFraSnapshot(snapshot: unknown): Ukeregnestykke | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const o = (snapshot as Record<string, unknown>).overtidsgrunnlag;
  if (!o || typeof o !== "object") return null;
  const u = (o as Record<string, unknown>).ukeregnestykke;
  if (!u || typeof u !== "object") return null;
  const g = u as Record<string, unknown>;
  const tall = ["ukenorm", "ukesum", "mangler", "sumOvertid", "kanTrekkes", "overIkkeFort"] as const;
  if (tall.some((k) => typeof g[k] !== "number") || !Array.isArray(g.dager)) return null;
  return u as Ukeregnestykke;
}

/** Det frosne ukeregnestykket med uka-status slik den var ved attestering (A4, B53 A). */
export interface FrossetUkeregnestykke {
  regnestykke: Ukeregnestykke;
  /** Var uka komplett da den ble fryst? Mangler feltet, regnes den som ikke komplett. */
  komplett: boolean;
  manglerDager: string[];
}

/**
 * Les ukeregnestykket og om uka var komplett ut av et attestertSnapshot. Et frosset
 * regnestykke fra en uke som ikke var komplett, skal ikke peke ut linjer (B53 A).
 */
export function lesFrossetUkeFraSnapshot(snapshot: unknown): FrossetUkeregnestykke | null {
  const regnestykke = lesUkeregnestykkeFraSnapshot(snapshot);
  if (!regnestykke) return null;
  const o = (snapshot as { overtidsgrunnlag: Record<string, unknown> }).overtidsgrunnlag;
  const mangler = Array.isArray(o.ukeManglerDager) ? o.ukeManglerDager.filter((d): d is string => typeof d === "string") : [];
  return { regnestykke, komplett: o.ukeKomplett === true, manglerDager: mangler };
}
