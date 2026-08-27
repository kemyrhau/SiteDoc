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
    fraTid: string | null; // "HH:MM" — per-rad klokkeslett (SheetTimer.fraTid)
    tilTid: string | null; // "HH:MM"
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
  fraTid: string | null; // "HH:MM" — kun timer (per-rad klokkeslett)
  tilTid: string | null; // "HH:MM" — kun timer
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
    fraTid: null,
    tilTid: null,
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
        fraTid: r.fraTid,
        tilTid: r.tilTid,
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
            fraTid: null,
            tilTid: null,
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
            fraTid: null,
            tilTid: null,
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
  fraTid: boolean;
  tilTid: boolean;
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
    fraTid: rader.some((r) => r.fraTid !== null && r.fraTid !== ""),
    tilTid: rader.some((r) => r.tilTid !== null && r.tilTid !== ""),
    timer: rader.some((r) => r.timer !== null),
    maskintimer: rader.some((r) => r.maskintimer !== null),
    antall: rader.some((r) => r.antall !== null),
    belop: rader.some((r) => r.belop !== null),
    mengde: rader.some((r) => r.mengde !== null),
    enhet: rader.some((r) => r.enhet !== null && r.enhet !== ""),
    beskrivelse: rader.some((r) => r.beskrivelse !== null && r.beskrivelse !== ""),
  };
}

/* ------------------------------------------------------------------ */
/*  Fase 4 — gruppering (presentasjonslag OVER byggDetaljRader)        */
/* ------------------------------------------------------------------ */

/**
 * Grupperings-dimensjonen (fase 4). Ren PRESENTASJON: sortering + subtotal-
 * innskudd. `grupperDetaljRader` PAKKER `byggDetaljRader`-outputen — den rører
 * ALDRI radsettet eller radenes rekkefølge innen en gruppe (designlås 2). «Én
 * sannhet for Excel og PDF» består: begge flater grupperer via denne, så subtotaler
 * og gruppe-rekkefølge kan aldri drive fra hverandre.
 */
export type Gruppering = "ingen" | "ansatt" | "prosjekt";

/** Subtotal for en gruppe (og grand total): null der ingen rad i gruppen bærer
 *  den størrelsen, så renderere kan la irrelevante kolonner stå tomme. */
export type DetaljSubtotal = {
  timer: number | null;
  maskintimer: number | null;
  antall: number | null;
  belop: number | null;
};

export type DetaljGruppe = {
  /** Gruppenøkkel (ansatt-/prosjektnavn). "" når gruppering = "ingen". */
  nokkel: string;
  /** Vises som gruppe-overskrift. null når gruppering = "ingen" (ingen overskrift). */
  overskrift: string | null;
  rader: DetaljRad[];
  subtotal: DetaljSubtotal;
};

function subtotalAv(rader: DetaljRad[]): DetaljSubtotal {
  const sumHvis = (velg: (r: DetaljRad) => number | null): number | null => {
    let noen = false;
    let sum = 0;
    for (const r of rader) {
      const v = velg(r);
      if (v !== null) {
        noen = true;
        sum += v;
      }
    }
    return noen ? sum : null;
  };
  return {
    timer: sumHvis((r) => r.timer),
    maskintimer: sumHvis((r) => r.maskintimer),
    antall: sumHvis((r) => r.antall),
    belop: sumHvis((r) => r.belop),
  };
}

/**
 * Grupper det ferdig-byggede radsettet.
 *
 *  - "ingen"    → én gruppe, `overskrift = null` (renderer viser ingen gruppe-
 *                 overskrift, kun grand total). Rekkefølgen er byggDetaljRaders
 *                 kronologiske — uendret.
 *  - "ansatt"   → bøtter på `rad.ansatt`, gruppene sortert på navn (localeCompare).
 *  - "prosjekt" → bøtter på `rad.prosjekt`, gruppene sortert på navn.
 *
 * Rekkefølgen INNEN en gruppe er kildens (kronologisk). En nøstet maskin bærer
 * samme ansatt/prosjekt som sin timerad, så den havner i samme bøtte, rett etter
 * timeraden — nøstingen bevares. Stabil bøtte-oppbygging (Map bevarer innsettings-
 * rekkefølge; radene pushes i kildeorden).
 */
export function grupperDetaljRader(
  rader: DetaljRad[],
  gruppering: Gruppering,
): DetaljGruppe[] {
  if (gruppering === "ingen") {
    return [{ nokkel: "", overskrift: null, rader, subtotal: subtotalAv(rader) }];
  }
  const nokkelAv = (r: DetaljRad): string =>
    gruppering === "ansatt" ? r.ansatt : r.prosjekt;

  const bøtter = new Map<string, DetaljRad[]>();
  for (const r of rader) {
    const k = nokkelAv(r);
    const liste = bøtter.get(k);
    if (liste) liste.push(r);
    else bøtter.set(k, [r]);
  }

  return Array.from(bøtter.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "nb"))
    .map(([nokkel, gruppeRader]) => ({
      nokkel,
      overskrift: nokkel,
      rader: gruppeRader,
      subtotal: subtotalAv(gruppeRader),
    }));
}

/* ------------------------------------------------------------------ */
/*  Flat visuell rad-liste (for virtualisering på skjerm)             */
/* ------------------------------------------------------------------ */

/**
 * Én visuell rad i den flate lista en virtualisert skjerm-renderer itererer over.
 * Gruppe-overskrifter, subtotaler og grand total er IKKE `DetaljRad` i seg selv
 * (de er struktur på `DetaljGruppe`), men et vindus-bibliotek trenger ÉN flat
 * indeksert liste. `flatDetaljRader` pakker `grupperDetaljRader`-outputen til den
 * lista uten å røre radsettet — samme «én sannhet» som Excel/PDF, tredje konsument.
 */
export type DetaljVisuellRad =
  | { kind: "header"; nokkel: string; overskrift: string }
  | { kind: "rad"; rad: DetaljRad }
  | { kind: "subtotal"; nokkel: string; subtotal: DetaljSubtotal }
  | { kind: "grandtotal"; subtotal: DetaljSubtotal };

/**
 * Flat ut grupper til en indeksert visuell-rad-liste:
 *  - hver gruppe med `overskrift !== null` gir en `header`-rad først og en
 *    `subtotal`-rad sist (som i PDF); `overskrift === null` (gruppering "ingen")
 *    gir verken header eller subtotal — kun radene.
 *  - alltid en avsluttende `grandtotal` over ALLE rader (speiler PDF-ens grand total).
 *
 * Grand total regnes fra alle radene på tvers av grupper (samme `subtotalAv`).
 */
export function flatDetaljRader(grupper: DetaljGruppe[]): DetaljVisuellRad[] {
  const ut: DetaljVisuellRad[] = [];
  for (const g of grupper) {
    if (g.overskrift !== null) {
      ut.push({ kind: "header", nokkel: g.nokkel, overskrift: g.overskrift });
    }
    for (const rad of g.rader) ut.push({ kind: "rad", rad });
    if (g.overskrift !== null) {
      ut.push({ kind: "subtotal", nokkel: g.nokkel, subtotal: g.subtotal });
    }
  }
  const alleRader = grupper.flatMap((g) => g.rader);
  ut.push({ kind: "grandtotal", subtotal: subtotalAv(alleRader) });
  return ut;
}
