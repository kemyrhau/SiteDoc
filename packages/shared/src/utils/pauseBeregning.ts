/**
 * Pause-bevisst tidsberegning for timer-rader.
 *
 * 30 min pause (`standardPauseMin`) er obligatorisk i løpet av arbeidsdagen og
 * ligger i vinduet [`pauseVinduFra(skiftStart, standardPauseEtterTimer)`,
 * +`standardPauseMin`] — dvs. relativt til skiftets start (default 4,0 t inn →
 * 07:00-start gir 11:00–11:30). Når en timer-rad faktisk spenner over
 * pausevinduet, trekkes overlappen fra radens effektive timer:  antall =
 * spennvidde − overlapp (eks. 10:00–12:00 med pause 11:00–11:30 → 1,50 t).
 *
 * Full auto-synk mellom «antall timer» og «fra/til»:
 *   - endrer fra/til → antall = effektiveTimerFraSpenn(...)
 *   - skriver antall → til   = tilFraAntall(...) (pausevinduet skyves inn når
 *     arbeidet krysser lunsj)
 *
 * Opprinnelig mobil-only (`apps/mobile/src/utils/pauseBeregning.ts`); løftet hit
 * for web-paritet (D3, timer web-vs-mobil-paritet 2026-07-08). Ren, uten
 * avhengigheter — deles av mobil og web, jf. `maskinKapasitet.ts`.
 */

/** Firma-default: pause starter 4,0 t inn i skiftet når org ikke har konfigurert. */
export const DEFAULT_PAUSE_ETTER_TIMER = 4.0;

/**
 * F-e (2026-07-13, AML §10-9): pausefradrag gjelder først når den DAGLIGE
 * arbeidstiden overstiger 5,5 t. Under terskelen trekkes ingen pause. Fast
 * lovkonstant (ikke per-firma) — kan promoteres til org-innstilling senere om en
 * tariff-kunde krever det (jf. `arbeidstidVarselTimer`-mønsteret; BACKLOG-post).
 */
export const PAUSE_TERSKEL_TIMER = 5.5;

/**
 * Effektiv pause-lengde (min) for en dag, gitt dagens TOTALE brutto arbeidstimer
 * (sum av rad-spenn FØR fradrag). Returnerer `standardPauseMin` over terskel,
 * ellers 0 (ingen pause). Gaten ligger her fordi den er DAGSTOTAL-basert, ikke
 * per rad — en dag splittet i flere rader skal verken miste eller få pause
 * avhengig av rad-splitten (F-e; radspenn-basis avvist = 38-min-avviket).
 * Kalleren summerer sedelens rader og sender totalen inn; de rene per-rad-
 * helperne (`effektiveTimerFraSpenn`/`tilFraAntall`) får da `pauseMin=0` når
 * terskelen ikke er nådd, og trekker dermed ingen pause.
 */
export function pauseMinForDag(
  dagsTotalBruttoTimer: number,
  standardPauseMin: number,
): number {
  return dagsTotalBruttoTimer > PAUSE_TERSKEL_TIMER ? standardPauseMin : 0;
}

/**
 * Pausevindu-start (HH:MM) = skiftstart + `etterTimer` timer. Erstatter det
 * gamle faste klokkeslettet (`standardPauseFra`) — pausen faller nå naturlig
 * innenfor skiftet uansett tid på døgnet (07:00-start → 11:00; nattskift
 * 21:00-start → 01:00).
 */
export function pauseVinduFra(skiftStart: string, etterTimer: number): string {
  return minTilHhmm(hhmmTilMin(skiftStart) + Math.round(etterTimer * 60));
}

/** HH:MM → minutter siden midnatt. Ugyldig input → 0. */
export function hhmmTilMin(hhmm: string): number {
  const deler = hhmm.split(":");
  const t = Number(deler[0] ?? 0);
  const m = Number(deler[1] ?? 0);
  if (isNaN(t) || isNaN(m)) return 0;
  return t * 60 + m;
}

/** Minutter siden midnatt → HH:MM. Clampes til 00:00–23:59 (samme dag). */
export function minTilHhmm(min: number): string {
  const clamped = Math.max(0, Math.min(Math.round(min), 23 * 60 + 59));
  const t = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Overlapp i minutter mellom radens spenn [fraMin, tilMin] og pausevinduet
 * [pauseFraMin, pauseFraMin + pauseMin]. 0 når raden ikke berører pausen.
 */
export function pauseOverlappMin(
  fraMin: number,
  tilMin: number,
  pauseFraMin: number,
  pauseMin: number,
): number {
  const pauseSlutt = pauseFraMin + pauseMin;
  return Math.max(0, Math.min(tilMin, pauseSlutt) - Math.max(fraMin, pauseFraMin));
}

/**
 * Effektive arbeidstimer for en rad = (spennvidde − pauseoverlapp) / 60.
 * Returnerer 0 når til ≤ fra. Avrundet til 2 desimaler.
 */
export function effektiveTimerFraSpenn(
  fra: string,
  til: string,
  pauseFra: string,
  pauseMin: number,
): number {
  const fraMin = hhmmTilMin(fra);
  const tilMin = hhmmTilMin(til);
  if (tilMin <= fraMin) return 0;
  const overlapp = pauseOverlappMin(fraMin, tilMin, hhmmTilMin(pauseFra), pauseMin);
  return Math.round(((tilMin - fraMin - overlapp) / 60) * 100) / 100;
}

/**
 * V20/PK5 — pausevinduets START (HH:MM) for en hel dag, én kilde for mobil
 * manuell rad, web og server. Erstatter at manuell mobil-rad alltid brukte
 * fastStart (P6) mens GPS-forslaget fulgte `pauseReferanse`:
 *   - `"fastStart"` → firmaets sesongjusterte starttid + `pauseEtterTimer`
 *   - `"ankomst"`   → første rad-`fraTid` på dagen + `pauseEtterTimer`
 *                     (når arbeidet faktisk begynte, etter evt. reise)
 * Ingen rader med tid (eller alle tomme) → faller tilbake til `startTid` som
 * ramme, slik at vinduet alltid er definert. Kenneths «4 timer» = `pauseEtterTimer`.
 */
export function pauseVinduForDag(
  rader: readonly { fraTid?: string | null }[],
  dag: {
    startTid: string;
    pauseEtterTimer: number;
    pauseReferanse: "fastStart" | "ankomst";
  },
): string {
  if (dag.pauseReferanse === "ankomst") {
    const forsteFra = rader
      .map((r) => r.fraTid)
      .filter((f): f is string => !!f)
      .reduce<string | null>(
        (min, f) => (min === null || hhmmTilMin(f) < hhmmTilMin(min) ? f : min),
        null,
      );
    return pauseVinduFra(forsteFra ?? dag.startTid, dag.pauseEtterTimer);
  }
  return pauseVinduFra(dag.startTid, dag.pauseEtterTimer);
}

/**
 * V20/PK7 — «Arbeidstid i dag» som VISNING utledet av radene (ikke hodet).
 * Tar sedelens timebaserte rader (fra+til satt) og gir: første fraTid, siste
 * tilTid, Σ pauseMin og netto Σ timer. Rader uten begge tider teller kun i
 * `nettoTimer` (de har ingen spenn å vise i tidsrammen). Tom input → null-ramme
 * med 0 timer, slik at kalleren kan falle tilbake til sedelens `startAt/endAt`.
 */
export function utledArbeidstidFraRader(
  rader: readonly {
    fraTid?: string | null;
    tilTid?: string | null;
    pauseMin?: number | null;
    timer: number;
  }[],
): {
  startTid: string | null;
  sluttTid: string | null;
  sumPauseMin: number;
  nettoTimer: number;
} {
  let startMin: number | null = null;
  let sluttMin: number | null = null;
  let sumPauseMin = 0;
  let nettoTimer = 0;
  for (const r of rader) {
    nettoTimer += r.timer;
    sumPauseMin += r.pauseMin ?? 0;
    if (r.fraTid && r.tilTid) {
      const fm = hhmmTilMin(r.fraTid);
      const tm = hhmmTilMin(r.tilTid);
      if (startMin === null || fm < startMin) startMin = fm;
      if (sluttMin === null || tm > sluttMin) sluttMin = tm;
    }
  }
  return {
    startTid: startMin === null ? null : minTilHhmm(startMin),
    sluttTid: sluttMin === null ? null : minTilHhmm(sluttMin),
    sumPauseMin,
    nettoTimer: Math.round(nettoTimer * 100) / 100,
  };
}

/**
 * ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer» — HVOR pausen ligger i
 * raden som bærer den. Kenneth: «Morgen 07:00–10:00 og kveld 16:00–19:00 gir 0
 * pause og 3,0 t. -> dette kan ikke være rett -> dette er totalt 6 timer arbeid
 * -> her er det krav om 0,5 timer pause» · «Ja, etter 4 arbeidstimer».
 *
 * Punktet er der SUMMERT arbeid (radene sortert på `fraTid`) passerer firmaets
 * `pauseEtterTimer` — ikke et klokkeslett etter ankomst, og et gap mellom økter
 * teller ikke som pause. Arbeidet på `andreRader` som starter før raden teller
 * med. Er grensen alt passert før raden, ligger pausen først i raden. Punktet
 * klemmes inn i raden ([fra, til − pauseMin]) slik at bærerens timer alltid er
 * spenn − pause (`effektiveTimerFraSpenn`), uansett hvor grensen falt.
 *
 * `fastPauseFra` (firma med `pauseReferanse = "fastStart"`): firmaets faste
 * klokkeslett (starttid + grense) brukes når det faller inne i raden; ellers
 * gjelder arbeidstimene som for alle andre.
 */
export function pauseFraForRad(args: {
  fraTid: string;
  tilTid: string;
  /** Dagens ANDRE rader (uten raden selv). */
  andreRader: readonly { fraTid?: string | null; tilTid?: string | null }[];
  pauseEtterTimer: number;
  pauseMin: number;
  fastPauseFra?: string | null;
  /** Arbeid (min) før raden som ikke står i `andreRader` — midnattsdelt økt:
   *  arbeidet på forrige dato teller med (Bekreft dag). */
  arbeidForEkstraMin?: number;
}): string {
  const fraMin = hhmmTilMin(args.fraTid);
  const tilMin = hhmmTilMin(args.tilTid);
  const sisteStart = Math.max(fraMin, tilMin - Math.max(0, args.pauseMin));
  const klem = (min: number) => minTilHhmm(Math.min(Math.max(min, fraMin), sisteStart));
  if (args.fastPauseFra) {
    const fastMin = hhmmTilMin(args.fastPauseFra);
    if (fastMin >= fraMin && fastMin < tilMin) return klem(fastMin);
  }
  const arbeidFor = args.andreRader.reduce((sum, r) => {
    if (!r.fraTid || !r.tilTid) return sum;
    const f = hhmmTilMin(r.fraTid);
    const t = hhmmTilMin(r.tilTid);
    if (t <= f || f >= fraMin) return sum;
    // Kun arbeidet FØR raden starter (en overlappende rad telles til radstart).
    return sum + (Math.min(t, fraMin) - f);
  }, args.arbeidForEkstraMin ?? 0);
  const grenseMin = Math.round(args.pauseEtterTimer * 60);
  return klem(fraMin + Math.max(0, grenseMin - arbeidFor));
}

/**
 * V20/PK2 + ORDRE 2026-11-13 — skal denne raden BÆRE dagens matpause når den
 * lagres, og hvor ligger den? Bæreren får `standardPauseMin`, alle andre 0
 * (kun-én-pr.-dag). Regelen:
 *   1) dagsbrutto INKL. denne raden > 5,5 t (`pauseMinForDag`, AML §10-9) —
 *      regnet på radenes faktiske fra/til
 *   2) ingen ANNEN rad på sedelen bærer pausen alt
 * Lagrede rader endres aldri: faller grensen i en lagret rad uten pause, legges
 * pausen på raden som lagres nå. Plasseringen (`pauseFra`) = `pauseFraForRad`.
 * Det gamle kravet «raden krysser pausevinduet» er borte (klokkevindu i et gap
 * ga 0 pause på en 6-timersdag).
 *
 * Ren/plattformuavhengig — delt av mobil (`matpause.ts` re-eksporterer) og web
 * (`TimerRadDialog`). Rør ALDRI hodet (`dagsseddel.pauseMin`) — PK6/V20-S utleder
 * det server-side.
 */
export function avgjorRadPause(args: {
  /** Alle rader på sedelen (DB- eller state-snapshot). */
  alleRader: readonly {
    id: string;
    fraTid?: string | null;
    tilTid?: string | null;
    pauseMin: number;
  }[];
  /** Raden som lagres — `null` for ny rad (ekskluderes fra «andre»). */
  radId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  standardPauseMin: number;
  /** Firmaets `standardPauseEtterTimer` (effektiv arbeidstid / svar-cache). */
  pauseEtterTimer: number;
  /** Kun `pauseReferanse = "fastStart"`: firmaets starttid + grense. */
  fastPauseFra?: string | null;
}): { pauseMin: number; pauseFra: string } {
  const { alleRader, radId, fraTid, tilTid, standardPauseMin } = args;
  if (!fraTid || !tilTid) return { pauseMin: 0, pauseFra: fraTid ?? "00:00" };
  const andreRader = alleRader.filter((r) => r.id !== radId);
  const pauseMin = dagPauseMinForNyttArbeid({
    andreRader,
    nyBruttoTimer: Math.max(0, hhmmTilMin(tilTid) - hhmmTilMin(fraTid)) / 60,
    standardPauseMin,
  });
  const pauseFra = pauseFraForRad({
    fraTid,
    tilTid,
    andreRader,
    pauseEtterTimer: args.pauseEtterTimer,
    pauseMin: standardPauseMin,
    fastPauseFra: args.fastPauseFra ?? null,
  });
  return { pauseMin, pauseFra };
}

/** `avgjorRadPause` når kalleren bare trenger lengden. */
export function avgjorRadPauseMin(args: Parameters<typeof avgjorRadPause>[0]): number {
  return avgjorRadPause(args).pauseMin;
}

/**
 * `fastStart`-firmaets faste pausepunkt (starttid + grense), ellers null —
 * argumentet `fastPauseFra` til `pauseFraForRad`/`avgjorRadPause`.
 */
export function fastPauseFraFor(dag: {
  startTid: string;
  pauseEtterTimer: number;
  pauseReferanse: "fastStart" | "ankomst";
}): string | null {
  return dag.pauseReferanse === "fastStart"
    ? pauseVinduFra(dag.startTid, dag.pauseEtterTimer)
    : null;
}

/**
 * Dag-delen av pauseregelen (punkt 1 og 2 i `avgjorRadPause`), skilt ut så
 * Bekreft dag og manuell føring bruker ÉN regel (ORDRE dobbel pause 2026-11-13):
 *   1) dagsbrutto = Σ spenn på sedelens andre rader + det nye arbeidet > 5,5 t
 *   2) ingen annen rad på sedelen bærer pausen alt (kun én pr. sedel)
 * Returnerer `standardPauseMin` når begge holder og det nye arbeidet har spenn
 * lengre enn pausen (spennkravet), ellers 0. Plasseringen
 * (`pauseFraForRad`) ligger hos kalleren.
 */
export function dagPauseMinForNyttArbeid(args: {
  /** Radene som står på sedelen fra før (uten kandidaten). */
  andreRader: readonly {
    fraTid?: string | null;
    tilTid?: string | null;
    pauseMin?: number | null;
  }[];
  /** Brutto spenn (timer) på det nye arbeidet, før pausefradrag. */
  nyBruttoTimer: number;
  standardPauseMin: number;
}): number {
  const { andreRader, nyBruttoTimer, standardPauseMin } = args;
  // (0) Spennkrav (VILKÅR 1, gate 2026-11-14): bæreren må ha spenn LENGRE enn
  // pausen. En for kort rad får pause 0 og fullt spenn — ellers blir 20 min
  // arbeid 0 t og serveren gir `kast`. Samme krav som serverens `stemmerNy`
  // og mobilens `radKanBaerePause`.
  if (Math.round(Math.max(0, nyBruttoTimer) * 60) <= standardPauseMin) return 0;
  const bruttoAndre = andreRader.reduce((sum, r) => {
    if (!r.fraTid || !r.tilTid) return sum;
    const spenn = hhmmTilMin(r.tilTid) - hhmmTilMin(r.fraTid);
    return spenn > 0 ? sum + spenn / 60 : sum;
  }, 0);
  // (1) Dagsterskel (AML §10-9).
  if (pauseMinForDag(bruttoAndre + Math.max(0, nyBruttoTimer), standardPauseMin) === 0) {
    return 0;
  }
  // (3) Bærer en ANNEN rad pausen alt? (kun-én-pr.-dag — flytt, ikke dupliser.)
  if (andreRader.some((r) => (r.pauseMin ?? 0) > 0)) return 0;
  return standardPauseMin;
}

/**
 * Til-tid gitt fra + antall ARBEIDStimer, med pausevinduet skjøvet inn når
 * arbeidet krysser lunsj. Speiler `effektiveTimerFraSpenn` (invers):
 *   fra 10:00 + 1,5 t → 12:00  (30 min lunsj legges til når vi passerer 11:00)
 *   fra 09:00 + 2,0 t → 11:00  (rekker akkurat frem til lunsj, ingen pause)
 *   fra 11:15 + 2,0 t → 13:30  (starter inne i vinduet — kun resterende pause
 *                               11:15–11:30 skyves inn, ikke hele 30 min)
 * Starter raden i/etter pauseslutt, legges ingen (ny) pause inn.
 */
export function tilFraAntall(
  fra: string,
  antallTimer: number,
  pauseFra: string,
  pauseMin: number,
): string {
  const fraMin = hhmmTilMin(fra);
  const antallMin = Math.round(antallTimer * 60);
  const pauseFraMin = hhmmTilMin(pauseFra);
  const pauseSlutt = pauseFraMin + pauseMin;
  // Starter raden i eller etter HELE pausevinduet → pausen ligger før raden.
  // (Grensefiks 2026-07-09: tidligere `>= pauseFraMin` hoppet over pausen når
  // raden startet nøyaktig ved pausestart eller inne i vinduet → ikke lenger
  // invers av effektiveTimerFraSpenn ved fraMin i [pauseFraMin, pauseSlutt).)
  if (fraMin >= pauseSlutt) return minTilHhmm(fraMin + antallMin);
  // Arbeidskapasitet før lunsj — clampes til 0 når raden starter inne i vinduet.
  const forPause = Math.max(0, pauseFraMin - fraMin);
  if (antallMin <= forPause) return minTilHhmm(fraMin + antallMin);
  // Krysser (eller starter inne i) lunsj → skyv resten forbi pausevinduet.
  return minTilHhmm(pauseSlutt + (antallMin - forPause));
}
