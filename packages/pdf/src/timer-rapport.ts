/**
 * Timer-rapport PDF — ny mal på den eksisterende HTML→PDF-motoren
 * (arkiv.rendr-rørledningen: `.ark`-HTML → pdf-render-containeren via page.pdf).
 *
 * FASE 2 (2026-08-26): detaljene er ETT kronologisk «Detaljer»-avsnitt med en
 * Type-kolonne (Timer · Maskin · Tillegg · Utlegg) i stedet for tre tabeller.
 * Radsettet + rekkefølgen bygges av @sitedoc/shared `byggDetaljRader` (SAMME
 * kilde som Excel-arket) og mates hit ferdig-flatet — denne pakken importerer
 * bevisst IKKE @sitedoc/shared (null runtime-avhengigheter), den mottar rader som
 * data. Radvalget fra Tilpasset-modalen er allerede anvendt i `detaljRader`.
 *
 * PDF-forskjell mot Excel: kolonner som er HELT tomme for de valgte radtypene
 * droppes (16 kolonner på A4 er uleselig — velger man bare Timer er Beløp/Antall/
 * Mengde/Enhet tomme hele veien). ID-kolonnen er aldri med (koblingsnøkkel for DB).
 *
 * Ren HTML-streng, null runtime-avhengigheter (som resten av @sitedoc/pdf).
 * Serveren eier innholdet; oversatte overskrifter (`tekster`) injiseres fra
 * kall-stedet (klienten har react-i18next `t`) — samme mønster som arkiv.
 */

import { esc } from "./hjelpere";

/* ------------------------------------------------------------------ */
/*  Data + tekster (injisert)                                          */
/* ------------------------------------------------------------------ */

export type TimerRapportAnsatt = {
  navn: string;
  ansattnr: string | null;
  totalTimer: number;
  antallSedler: number;
  sistRegistrert: string | null; // YYYY-MM-DD eller null
  kladd: number;
  sent: number;
  attestert: number;
};

export type TimerRapportRadType = "timer" | "maskin" | "tillegg" | "utlegg";
export type TimerRapportMaskinMerke =
  | "noster"
  | "utenTimerad"
  | "ikkeEksporterbar"
  | null;

/**
 * Én flat detaljrad — strukturelt identisk med @sitedoc/shared `DetaljRad`, men
 * definert her for å holde pakken fri for shared-avhengigheten. Api-en mapper
 * shared-radene til denne før byggingen. ID-feltet er bevisst utelatt (aldri PDF).
 */
export type TimerRapportDetaljRad = {
  type: TimerRapportRadType;
  nivaa: 0 | 1;
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  betegnelse: string;
  aktivitet: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number | null;
  maskintimer: number | null;
  antall: number | null;
  belop: number | null;
  mengde: number | null;
  enhet: string | null;
  beskrivelse: string | null;
  status: string;
  maskinMerke: TimerRapportMaskinMerke;
};

/** Subtotal for en gruppe (og grand total) — strukturelt lik @sitedoc/shared
 *  `DetaljSubtotal`; null der ingen rad i gruppen bærer størrelsen. */
export type TimerRapportSubtotal = {
  timer: number | null;
  maskintimer: number | null;
  antall: number | null;
  belop: number | null;
};

/** Én gruppe i «Detaljer» — strukturelt lik @sitedoc/shared `DetaljGruppe`.
 *  `overskrift = null` ⇒ gruppering «ingen» (ingen gruppe-overskrift, kun grand total). */
export type TimerRapportGruppe = {
  overskrift: string | null;
  rader: TimerRapportDetaljRad[];
  subtotal: TimerRapportSubtotal;
};

/** Fase 4: hvem dokumentet går til. `ekstern` ⇒ status utelates STRUKTURELT i
 *  begge tabeller (Detaljer OG Sammendrag) — regel, ikke avhuking (designlås 1). */
export type TimerRapportMottaker = "intern" | "ekstern";

export type TimerRapportData = {
  firmanavn: string;
  fra: string;
  til: string;
  prosjektFilter: string | null; // navn hvis filtrert, null = alle
  ansattFilter: string | null;
  ansatte: TimerRapportAnsatt[];
  /** Fase 4: grupperte detaljrader (byggDetaljRader → grupperDetaljRader, mappet av api). */
  grupper: TimerRapportGruppe[];
  /** Fase 4: hvem dokumentet går til (ekstern skjuler status). */
  mottaker: TimerRapportMottaker;
  /** Fase 4: ferdig-flettet topptekst ({firma}/{periode}/{prosjekt} allerede satt inn).
   *  Tom liste ⇒ standard firmatopp (firmanavn + doktittel + meta). */
  topptekstLinjer: string[];
};

/** Alle synlige strenger (overskrifter/etiketter) — injisert oversatt fra klient. */
export type TimerRapportTekster = {
  dokumentTittel: string;
  periode: string;
  prosjekt: string;
  ansatt: string;
  alle: string;
  ingenData: string;
  sum: string;
  // Sammendrag
  sammendrag: string;
  kolAnsattnr: string;
  kolTotalTimer: string;
  kolSedler: string;
  kolSistRegistrert: string;
  kolKladd: string;
  kolSent: string;
  kolAttestert: string;
  // Detaljer (merged)
  detaljer: string;
  subtotal: string; // gruppe-subtotal-etikett (fase 4)
  kolDato: string;
  kolType: string;
  kolBetegnelse: string;
  kolAktivitet: string;
  kolFra: string;
  kolTil: string;
  kolTimer: string;
  kolMaskintimer: string;
  kolAntall: string;
  kolBelop: string;
  kolMengde: string;
  kolEnhet: string;
  kolBeskrivelse: string;
  kolStatus: string;
  // Type-etiketter
  typeTimer: string;
  typeMaskin: string;
  typeTillegg: string;
  typeUtlegg: string;
  // Maskin-merker
  maskinUtenTimerad: string;
  maskinIkkeEksporterbar: string;
  // Status-VERDIENE oversatt (verdi→etikett). Ukjent verdi → rå streng.
  statusEtiketter: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/*  Formatering                                                        */
/* ------------------------------------------------------------------ */

const nf = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tall = (n: number): string => nf.format(n);
const tallEllerTom = (n: number | null): string => (n === null ? "" : nf.format(n));

/* ------------------------------------------------------------------ */
/*  CSS — dokument, ikke regneark                                      */
/* ------------------------------------------------------------------ */

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 10px; }
.topp { border-bottom: 2px solid #26327e; padding-bottom: 10px; margin-bottom: 16px; }
.firmanavn { font-size: 18px; font-weight: 700; color: #26327e; }
.doktittel { font-size: 12px; font-weight: 600; margin-top: 2px; }
.meta { margin-top: 6px; font-size: 9px; color: #374151; }
.meta span { margin-right: 16px; }
.meta b { color: #111827; }
h2 { font-size: 12px; color: #26327e; margin: 18px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; }
th { background: #f3f4f6; text-align: left; font-weight: 600; font-size: 8.5px; text-transform: uppercase; letter-spacing: .02em; color: #374151; padding: 4px 5px; border-bottom: 1px solid #d1d5db; }
td { padding: 3px 5px; border-bottom: 1px solid #f0f1f3; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.sum td { font-weight: 700; border-top: 1.5px solid #9ca3af; background: #f9fafb; }
.mrk { color: #6b7280; }
.nest td:nth-child(6) { padding-left: 16px; }
.slate { display: inline-block; background: #e2e8f0; color: #475569; font-size: 7.5px; font-weight: 700; text-transform: uppercase; padding: 0 4px; border-radius: 3px; margin-right: 4px; }
.tom { color: #9ca3af; font-style: italic; padding: 8px 0; }
/* Fase 4: topptekst (erstatter standard firmatopp når satt). */
.topptekst .t0 { font-size: 18px; font-weight: 700; color: #26327e; }
.topptekst .tn { font-size: 10px; color: #374151; margin-top: 2px; }
/* Fase 4: gruppe-overskrift + subtotal i Detaljer. */
.grp td { background: #eef1f8; font-weight: 700; color: #26327e; font-size: 9px; padding: 5px; border-top: 1px solid #c7d0ea; }
.sub td { font-weight: 600; border-top: 1px solid #d1d5db; background: #fafbfe; }
`;

/* ------------------------------------------------------------------ */
/*  Sammendrag                                                        */
/* ------------------------------------------------------------------ */

function th(...celler: string[]): string {
  return `<tr>${celler.map((c) => `<th>${c}</th>`).join("")}</tr>`;
}

function sammendragTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  if (d.ansatte.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  // Fase 4 (+ oppfølger): ekstern (ut av huset) skjuler Ansattnr (pseudonymiserings-
  // nøkkel) OG status-fordelingen (Kladd/Sendt/Attestert = intern arbeidsflyt-status).
  // Ansattnavn beholdes (dokumentasjon av hvem som utførte arbeidet).
  const ekstern = d.mottaker === "ekstern";
  const nrHead = ekstern ? [] : [t.kolAnsattnr];
  const statusHead = ekstern ? [] : [t.kolKladd, t.kolSent, t.kolAttestert];
  const rader = d.ansatte
    .map(
      (a) => `<tr>
      <td>${esc(a.navn)}</td>
      ${ekstern ? "" : `<td>${esc(a.ansattnr ?? "")}</td>`}
      <td class="num">${tall(a.totalTimer)}</td>
      <td class="num">${a.antallSedler}</td>
      <td>${esc(a.sistRegistrert ?? "")}</td>
      ${ekstern ? "" : `<td class="num">${a.kladd}</td><td class="num">${a.sent}</td><td class="num">${a.attestert}</td>`}
    </tr>`,
    )
    .join("");
  const sumTimer = d.ansatte.reduce((s, a) => s + a.totalTimer, 0);
  const sumSedler = d.ansatte.reduce((s, a) => s + a.antallSedler, 0);
  const sumNrCelle = ekstern ? "" : "<td></td>";
  const sumStatusCeller = ekstern ? "" : "<td></td><td></td><td></td>";
  return `<table>
    <thead>${th(t.ansatt, ...nrHead, t.kolTotalTimer, t.kolSedler, t.kolSistRegistrert, ...statusHead)}</thead>
    <tbody>${rader}
      <tr class="sum"><td>${esc(t.sum)}</td>${sumNrCelle}<td class="num">${tall(sumTimer)}</td><td class="num">${sumSedler}</td><td></td>${sumStatusCeller}</tr>
    </tbody>
  </table>`;
}

/* ------------------------------------------------------------------ */
/*  Detaljer (merged Type-tabell, tomme kolonner droppes)             */
/* ------------------------------------------------------------------ */

/** Kolonne-descriptor: header, celle-verdi, evt. sum, og om den kan droppes når
 *  tom. `alltid` = identitets-/type-kolonner som aldri droppes. */
type KolDef = {
  header: string;
  num: boolean;
  alltid: boolean;
  /** true hvis noen valgt rad har innhold i kolonnen (ellers droppes den). */
  tilstede: (rader: TimerRapportDetaljRad[]) => boolean;
  celle: (r: TimerRapportDetaljRad, t: TimerRapportTekster) => string;
  /** hvis satt: kolonnen får en SUM-celle i sum-/subtotal-raden. `felt` peker på
   *  hvilken subtotal-størrelse gruppens subtotal-rad henter (fase 4). */
  felt?: keyof TimerRapportSubtotal;
  sum?: (rader: TimerRapportDetaljRad[]) => number;
};

function typeEtikett(r: TimerRapportDetaljRad, t: TimerRapportTekster): string {
  switch (r.type) {
    case "timer":
      return t.typeTimer;
    case "maskin":
      return t.typeMaskin;
    case "tillegg":
      return t.typeTillegg;
    case "utlegg":
      return t.typeUtlegg;
  }
}

/** Betegnelse-cellen — maskin-navn får merke etter opprinnelse. Fase 4-oppfølger:
 *  `utenTimerad`/`ikkeEksporterbar` er INTERNE anomali-signaler (vår datakvalitet);
 *  ved `mottaker=ekstern` undertrykkes merkelappen — kun maskinnavnet står igjen.
 *  Nøstingsmerket «↳» beholdes (rent innrykk, ikke et anomali-signal). */
function betegnelseCelle(
  r: TimerRapportDetaljRad,
  t: TimerRapportTekster,
  mottaker: TimerRapportMottaker,
): string {
  if (r.type !== "maskin") return esc(r.betegnelse);
  const ekstern = mottaker === "ekstern";
  switch (r.maskinMerke) {
    case "utenTimerad":
      return ekstern
        ? esc(r.betegnelse)
        : `<span class="slate">${esc(t.maskinUtenTimerad)}</span>${esc(r.betegnelse)}`;
    case "ikkeEksporterbar":
      return ekstern
        ? esc(r.betegnelse)
        : `<span class="slate">${esc(t.maskinIkkeEksporterbar)}</span>${esc(r.betegnelse)}`;
    case "noster":
      return `↳ ${esc(r.betegnelse)}`; // innrykk via .nest-klasse
    default:
      return esc(r.betegnelse);
  }
}

const harTekst = (v: string | null): boolean => v !== null && v !== "";
const harTall = (v: number | null): boolean => v !== null;

function kolonner(t: TimerRapportTekster, mottaker: TimerRapportMottaker): KolDef[] {
  const ekstern = mottaker === "ekstern";
  const kols: KolDef[] = [
    { header: t.kolDato, num: false, alltid: true, tilstede: () => true, celle: (r) => esc(r.dato) },
    { header: t.ansatt, num: false, alltid: true, tilstede: () => true, celle: (r) => esc(r.ansatt) },
    // Fase 4-oppfølger: Ansattnr (pseudonymiseringsnøkkel) ut av eksterne dokumenter.
    ...(ekstern
      ? []
      : [{ header: t.kolAnsattnr, num: false, alltid: true, tilstede: () => true, celle: (r: TimerRapportDetaljRad) => esc(r.ansattnr ?? "") } as KolDef]),
    { header: t.prosjekt, num: false, alltid: true, tilstede: () => true, celle: (r) => esc(r.prosjekt) },
    { header: t.kolType, num: false, alltid: true, tilstede: () => true, celle: (r, tk) => esc(typeEtikett(r, tk)) },
    { header: t.kolBetegnelse, num: false, alltid: true, tilstede: () => true, celle: (r, tk) => betegnelseCelle(r, tk, mottaker) },
    {
      header: t.kolAktivitet, num: false, alltid: false,
      tilstede: (rader) => rader.some((r) => harTekst(r.aktivitet)),
      celle: (r) => esc(r.aktivitet ?? ""),
    },
    {
      header: t.kolFra, num: false, alltid: false,
      tilstede: (rader) => rader.some((r) => harTekst(r.fraTid)),
      celle: (r) => esc(r.fraTid ?? ""),
    },
    {
      header: t.kolTil, num: false, alltid: false,
      tilstede: (rader) => rader.some((r) => harTekst(r.tilTid)),
      celle: (r) => esc(r.tilTid ?? ""),
    },
    {
      header: t.kolTimer, num: true, alltid: false, felt: "timer",
      tilstede: (rader) => rader.some((r) => harTall(r.timer)),
      celle: (r) => tallEllerTom(r.timer),
      sum: (rader) => rader.reduce((s, r) => s + (r.timer ?? 0), 0),
    },
    {
      header: t.kolMaskintimer, num: true, alltid: false, felt: "maskintimer",
      tilstede: (rader) => rader.some((r) => harTall(r.maskintimer)),
      celle: (r) => tallEllerTom(r.maskintimer),
      sum: (rader) => rader.reduce((s, r) => s + (r.maskintimer ?? 0), 0),
    },
    {
      header: t.kolAntall, num: true, alltid: false, felt: "antall",
      tilstede: (rader) => rader.some((r) => harTall(r.antall)),
      celle: (r) => tallEllerTom(r.antall),
      sum: (rader) => rader.reduce((s, r) => s + (r.antall ?? 0), 0),
    },
    {
      header: t.kolBelop, num: true, alltid: false, felt: "belop",
      tilstede: (rader) => rader.some((r) => harTall(r.belop)),
      celle: (r) => tallEllerTom(r.belop),
      sum: (rader) => rader.reduce((s, r) => s + (r.belop ?? 0), 0),
    },
    {
      header: t.kolMengde, num: true, alltid: false,
      tilstede: (rader) => rader.some((r) => harTall(r.mengde)),
      celle: (r) => tallEllerTom(r.mengde),
    },
    {
      header: t.kolEnhet, num: false, alltid: false,
      tilstede: (rader) => rader.some((r) => harTekst(r.enhet)),
      celle: (r) => esc(r.enhet ?? ""),
    },
    {
      header: t.kolBeskrivelse, num: false, alltid: false,
      tilstede: (rader) => rader.some((r) => harTekst(r.beskrivelse)),
      celle: (r) => esc(r.beskrivelse ?? ""),
    },
  ];
  // Fase 4: ekstern (ut av huset) dropper Status-kolonnen STRUKTURELT (designlås 1).
  // ID er aldri i PDF (koblingsnøkkel) — så ekstern-regelen for PDF er kun status.
  if (mottaker !== "ekstern") {
    kols.push({
      header: t.kolStatus, num: false, alltid: true, tilstede: () => true,
      // Oversett rå status-verdi (pending/sent/…); ukjent → rå (skjul aldri en verdi).
      celle: (r) => esc(t.statusEtiketter[r.status] ?? r.status),
    });
  }
  return kols;
}

/** Sum-/subtotal-rad: etikett i første kolonne, tall i de summerbare. `hentSum`
 *  gir verdien pr. kolonne (grand total leser fra alle rader; gruppe-subtotal fra
 *  gruppens forhåndsberegnede subtotal). */
function sumRadHtml(
  kols: KolDef[],
  klasse: string,
  etikett: string,
  hentSum: (k: KolDef) => number | null,
): string {
  const celler = kols
    .map((k, i) => {
      if (i === 0) return `<td>${esc(etikett)}</td>`;
      const v = hentSum(k);
      if (v !== null) return `<td class="num">${tall(v)}</td>`;
      return "<td></td>";
    })
    .join("");
  return `<tr class="${klasse}">${celler}</tr>`;
}

function detaljerTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  const alleRader = d.grupper.flatMap((g) => g.rader);
  if (alleRader.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  // Kolonne-tilstedeværelse måles over ALLE rader (uavhengig av gruppering), så
  // kolonnesettet er stabilt på tvers av grupper.
  const kols = kolonner(t, d.mottaker).filter((k) => k.alltid || k.tilstede(alleRader));

  const head = th(...kols.map((k) => k.header));

  const radHtml = (r: TimerRapportDetaljRad): string => {
    const nest = r.type === "maskin" && r.nivaa === 1 ? " nest mrk" : "";
    const mrk = r.type === "maskin" && r.nivaa !== 1 ? " mrk" : "";
    const celler = kols
      .map((k) => `<td class="${k.num ? "num" : ""}">${k.celle(r, t)}</td>`)
      .join("");
    return `<tr class="${(nest || mrk).trim()}">${celler}</tr>`;
  };

  const body = d.grupper
    .map((g) => {
      const grpHead =
        g.overskrift !== null
          ? `<tr class="grp"><td colspan="${kols.length}">${esc(g.overskrift)}</td></tr>`
          : "";
      const rader = g.rader.map(radHtml).join("");
      // Gruppe-subtotal kun når gruppert (overskrift satt) — «ingen» får bare grand total.
      const sub =
        g.overskrift !== null
          ? sumRadHtml(
              kols,
              "sub",
              `${t.subtotal}: ${g.overskrift}`,
              (k) => (k.felt ? g.subtotal[k.felt] : null),
            )
          : "";
      return grpHead + rader + sub;
    })
    .join("");

  // Grand total over alle rader (SUM-kolonner). Utelates når ingen summerbar kolonne finnes.
  const grandRad = kols.some((k) => k.sum)
    ? sumRadHtml(kols, "sum", t.sum, (k) => (k.sum ? k.sum(alleRader) : null))
    : "";

  return `<table><thead>${head}</thead><tbody>${body}${grandRad}</tbody></table>`;
}

/* ------------------------------------------------------------------ */
/*  Dokument                                                          */
/* ------------------------------------------------------------------ */

export function byggTimerRapportHtml(
  d: TimerRapportData,
  t: TimerRapportTekster,
): string {
  const filtre: string[] = [
    `<span><b>${esc(t.periode)}:</b> ${esc(d.fra)}–${esc(d.til)}</span>`,
    `<span><b>${esc(t.prosjekt)}:</b> ${esc(d.prosjektFilter ?? t.alle)}</span>`,
    `<span><b>${esc(t.ansatt)}:</b> ${esc(d.ansattFilter ?? t.alle)}</span>`,
  ];

  // Fase 4: lagret topptekst (ferdig-flettet) erstatter standard firmatopp når satt
  // — den bærer allerede firma/periode/prosjekt slik malen ville det. Tom ⇒ standard.
  const topp =
    d.topptekstLinjer.length > 0
      ? `<div class="topptekst">${d.topptekstLinjer
          .map((l, i) => `<div class="${i === 0 ? "t0" : "tn"}">${esc(l)}</div>`)
          .join("")}</div>`
      : `<div class="firmanavn">${esc(d.firmanavn)}</div>
      <div class="doktittel">${esc(t.dokumentTittel)}</div>
      <div class="meta">${filtre.join("")}</div>`;

  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="ark-side">
    <div class="topp">
      ${topp}
    </div>

    <h2>${esc(t.sammendrag)}</h2>
    ${sammendragTabell(d, t)}

    <h2>${esc(t.detaljer)}</h2>
    ${detaljerTabell(d, t)}
  </div>
</body></html>`;
}
