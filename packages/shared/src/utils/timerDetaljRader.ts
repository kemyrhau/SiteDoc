/**
 * Printmotor fase 2 — delt radbygger for timer-detaljeksport.
 *
 * ÉN sannhet for radsettet + kronologisk rekkefølge i BÅDE Excel og PDF.
 * Ordren (2026-08-26): tre detaljark (Timerader/Tillegg/Utlegg) slås sammen til
 * ETT kronologisk ark med en Type-kolonne; maskin beholder nøstingen under sin
 * timerad. Radvalget (hvilke radtyper som skal med) legger seg OPPÅ det
 * eksisterende `skalEksporteres`-filteret (som allerede er kjørt server-side i
 * detaljEksport) — det kan bare TREKKE FRA, aldri huke på en type oppsettet slo av.
 *
 * Renderes to steder: Excel-arket (apps/web, alle kolonner) og PDF-en
 * (packages/pdf, dropper tomme kolonner). Begge kaller DENNE for radsettet, så
 * de aldri kan drive fra hverandre. packages/pdf importerer bevisst IKKE
 * @sitedoc/shared — den mottar ferdig-bygde `DetaljRad[]` som data (api mapper).
 */

export type DetaljRadType = "timer" | "maskin" | "tillegg" | "utlegg";

/** Maskin-rad slik detaljEksport bærer den (nøstet eller løs). */
export type KildeMaskin = {
  id: string;
  navn: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  radstatus: string;
};

/** Løs maskin (uten gyldig timerad, eller på ikke-eksporterbar timerad) — bærer
 *  egen identitet (dato/ansatt/prosjekt), i motsetning til den nøstede. */
export type KildeLosMaskin = KildeMaskin & {
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
};

/** Kilde = returstrukturen fra timer.rapport.detaljEksport. */
export type DetaljEksportKilde = {
  timerader: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    lonnsart: string;
    aktivitet: string;
    timer: number;
    beskrivelse: string | null;
    radstatus: string;
    maskiner: KildeMaskin[];
  }>;
  maskinUtenTimerad: KildeLosMaskin[];
  maskinIkkeEksporterbar: KildeLosMaskin[];
  tillegg: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    tillegg: string;
    antall: number;
    kommentar: string | null;
    radstatus: string;
  }>;
  utlegg: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    kategori: string;
    belop: number | null;
    kommentar: string | null;
    seddelstatus: string;
  }>;
};

/**
 * Hvordan en maskin-rad skal merkes/vises:
 *  - "noster"          → nøstet under sin (viste) timerad, innrykket
 *  - "utenTimerad"     → maskin brukt uten registrert arbeid (anomali-signal)
 *  - "ikkeEksporterbar"→ maskin på en timerad ekskludert av skalEksporteres
 *  - null              → normal maskin-rad (timeraden er skjult av RADVALG, ikke en anomali)
 */
export type MaskinMerke = "noster" | "utenTimerad" | "ikkeEksporterbar" | null;

/**
 * Én flat rad i det sammenslåtte «Detaljer»-arket. Bærer ALLE felt for alle
 * typer — hver renderer projiserer de kolonnene den vil ha. Type-kolonnen sier
 * hva raden er, så tomme type-fremmede felt er uproblematiske.
 */
export type DetaljRad = {
  type: DetaljRadType;
  /** 0 = normal rad · 1 = maskin nøstet under sin timerad (renderes innrykket). */
  nivaa: 0 | 1;
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  /** Lønnsart · maskinnavn · tilleggsnavn · utleggskategori. */
  betegnelse: string;
  aktivitet: string | null; // kun timer
  timer: number | null; // kun timer (arbeidstimer — kontrollsum mot Sammendrag)
  maskintimer: number | null; // kun maskin (egen størrelse)
  antall: number | null; // kun tillegg
  belop: number | null; // kun utlegg
  mengde: number | null; // maskin
  enhet: string | null; // maskin
  /** Beskrivelse (timer) · kommentar (tillegg/utlegg). */
  beskrivelse: string | null;
  /** Radstatus (timer/maskin/tillegg) · seddelstatus (utlegg). */
  status: string;
  /** Koblingsnøkkel (sheetTimer.id/sheetMachine.id o.l.) — Excel-only, aldri PDF. */
  id: string;
  maskinMerke: MaskinMerke;
};

/** Er alle fire radtyper alltid gyldige valg (rekkefølge = visningsrekkefølge). */
export const ALLE_RADTYPER: readonly DetaljRadType[] = [
  "timer",
  "maskin",
  "tillegg",
  "utlegg",
] as const;

type Blokk = { dato: string; rader: DetaljRad[] };

/**
 * Bygg det kronologiske, sammenslåtte radsettet fra detaljEksport-kilden,
 * filtrert på de valgte radtypene.
 *
 * Rekkefølge: kronologisk (dato asc). En timerad + dens nøstede maskiner er én
 * blokk som holdes samlet; tillegg/utlegg/løse maskiner er egne blokker. Stabil
 * sortering på dato bevarer kildens rekkefølge innen samme dato.
 *
 * Maskin-håndtering:
 *  - «timer» valgt → timerad vises, nøstet maskin under den (nivaa 1, «noster»).
 *  - «timer» IKKE valgt, «maskin» valgt → den nøstede maskinen blir en egen
 *    normal rad (nivaa 0, merke null) — timeraden er skjult av VALGET, ikke en anomali.
 *  - løse maskiner (uten timerad / ikke-eksporterbar) vises kun når «maskin» er valgt.
 */
export function byggDetaljRader(
  kilde: DetaljEksportKilde,
  valgteRadTyper: readonly DetaljRadType[],
): DetaljRad[] {
  const vil = (t: DetaljRadType): boolean => valgteRadTyper.includes(t);
  const blokker: Blokk[] = [];

  const maskinRad = (
    m: KildeMaskin,
    id: { dato: string; ansatt: string; ansattnr: string | null; prosjekt: string },
    nivaa: 0 | 1,
    merke: MaskinMerke,
  ): DetaljRad => ({
    type: "maskin",
    nivaa,
    dato: id.dato,
    ansatt: id.ansatt,
    ansattnr: id.ansattnr,
    prosjekt: id.prosjekt,
    betegnelse: m.navn,
    aktivitet: null,
    timer: null,
    maskintimer: m.timer,
    antall: null,
    belop: null,
    mengde: m.mengde,
    enhet: m.enhet,
    beskrivelse: null,
    status: m.radstatus,
    id: m.id,
    maskinMerke: merke,
  });

  // Timerader (+ nøstede maskiner). Behandles selv når «timer» er avvalgt, fordi
  // de nøstede maskinene kan trenges når «maskin» er valgt.
  for (const r of kilde.timerader) {
    const ident = { dato: r.dato, ansatt: r.ansatt, ansattnr: r.ansattnr, prosjekt: r.prosjekt };
    const rader: DetaljRad[] = [];
    if (vil("timer")) {
      rader.push({
        type: "timer",
        nivaa: 0,
        dato: r.dato,
        ansatt: r.ansatt,
        ansattnr: r.ansattnr,
        prosjekt: r.prosjekt,
        betegnelse: r.lonnsart,
        aktivitet: r.aktivitet,
        timer: r.timer,
        maskintimer: null,
        antall: null,
        belop: null,
        mengde: null,
        enhet: null,
        beskrivelse: r.beskrivelse,
        status: r.radstatus,
        id: r.id,
        maskinMerke: null,
      });
      if (vil("maskin")) {
        for (const m of r.maskiner) rader.push(maskinRad(m, ident, 1, "noster"));
      }
    } else if (vil("maskin")) {
      // Timeraden er skjult av valget → maskinen er en normal, egen rad.
      for (const m of r.maskiner) rader.push(maskinRad(m, ident, 0, null));
    }
    if (rader.length > 0) blokker.push({ dato: r.dato, rader });
  }

  if (vil("maskin")) {
    for (const m of kilde.maskinUtenTimerad) {
      blokker.push({ dato: m.dato, rader: [maskinRad(m, m, 0, "utenTimerad")] });
    }
    for (const m of kilde.maskinIkkeEksporterbar) {
      blokker.push({ dato: m.dato, rader: [maskinRad(m, m, 0, "ikkeEksporterbar")] });
    }
  }

  if (vil("tillegg")) {
    for (const r of kilde.tillegg) {
      blokker.push({
        dato: r.dato,
        rader: [
          {
            type: "tillegg",
            nivaa: 0,
            dato: r.dato,
            ansatt: r.ansatt,
            ansattnr: r.ansattnr,
            prosjekt: r.prosjekt,
            betegnelse: r.tillegg,
            aktivitet: null,
            timer: null,
            maskintimer: null,
            antall: r.antall,
            belop: null,
            mengde: null,
            enhet: null,
            beskrivelse: r.kommentar,
            status: r.radstatus,
            id: r.id,
            maskinMerke: null,
          },
        ],
      });
    }
  }

  if (vil("utlegg")) {
    for (const r of kilde.utlegg) {
      blokker.push({
        dato: r.dato,
        rader: [
          {
            type: "utlegg",
            nivaa: 0,
            dato: r.dato,
            ansatt: r.ansatt,
            ansattnr: r.ansattnr,
            prosjekt: r.prosjekt,
            betegnelse: r.kategori,
            aktivitet: null,
            timer: null,
            maskintimer: null,
            antall: null,
            belop: r.belop,
            mengde: null,
            enhet: null,
            beskrivelse: r.kommentar,
            status: r.seddelstatus,
            id: r.id,
            maskinMerke: null,
          },
        ],
      });
    }
  }

  // Stabil kronologisk sortering på dato — bevarer kildens rekkefølge innen dato,
  // og holder timerad + dens nøstede maskiner samlet (én blokk = én sorteringsnøkkel).
  const indeksert = blokker.map((b, i) => ({ b, i }));
  indeksert.sort((x, y) => x.b.dato.localeCompare(y.b.dato) || x.i - y.i);
  return indeksert.flatMap((e) => e.b.rader);
}

/** Hvilke av de fire numeriske/type-spesifikke kolonnene har innhold i radsettet.
 *  PDF bruker dette til å droppe helt tomme kolonner (A4-lesbarhet); Excel viser alt. */
export type KolonneTilstedevaerelse = {
  aktivitet: boolean;
  timer: boolean;
  maskintimer: boolean;
  antall: boolean;
  belop: boolean;
  mengde: boolean;
  enhet: boolean;
  beskrivelse: boolean;
};

export function kolonnerMedInnhold(rader: DetaljRad[]): KolonneTilstedevaerelse {
  return {
    aktivitet: rader.some((r) => r.aktivitet !== null && r.aktivitet !== ""),
    timer: rader.some((r) => r.timer !== null),
    maskintimer: rader.some((r) => r.maskintimer !== null),
    antall: rader.some((r) => r.antall !== null),
    belop: rader.some((r) => r.belop !== null),
    mengde: rader.some((r) => r.mengde !== null),
    enhet: rader.some((r) => r.enhet !== null && r.enhet !== ""),
    beskrivelse: rader.some((r) => r.beskrivelse !== null && r.beskrivelse !== ""),
  };
}
