/**
 * U2 — CSV/Excel-eksport for timer-rapport på firmanivå.
 *
 * Bygger fil i nettleseren fra rapport-data uten server-roundtrip.
 * Bruker exceljs (~/apps/web/package.json) for både CSV og .xlsx.
 *
 * Lazy-importes fra page.tsx for å unngå at exceljs-bundle øker
 * initial page-load for brukere som aldri klikker eksport.
 */

import {
  byggDetaljRader,
  grupperDetaljRader,
  losTimerKolonner,
  TIMER_KOL_KEYS,
  TIMER_KOL_I18N,
  INTERNE_TIMER_KOLONNER,
  ALLE_RADTYPER,
  type DetaljRad,
  type DetaljRadType,
  type DetaljGruppe,
  type Gruppering,
  type TimerKolKey,
} from "@sitedoc/shared";

/** Fase 4-akser som styrer eksport-utformingen (mottaker + gruppering). Radvalget
 *  ligger separat i `radTyper`. `format`/`orientering`/`topptekst` er PDF-only. */
export type EksportOpts = {
  radTyper?: readonly DetaljRadType[];
  mottaker?: "intern" | "ekstern";
  gruppering?: Gruppering;
  /** Malens `config.kolonner` — valgt kolonnesett + rekkefølge (flateparitet).
   *  Tom/utelatt → dagens fulle kolonnesett (Excel viste alt). */
  valgteKolonner?: string[];
};

type StatusFordeling = { kladd: number; sent: number; attestert: number };

export type AnsattRapportRad = {
  userId: string;
  navn: string | null;
  email: string;
  ansattnummer: string | null;
  totalTimer: number;
  antallSedler: number;
  sistRegistrert: string | null;
  statusFordeling: StatusFordeling;
  perProsjekt: Array<{
    prosjektId: string;
    prosjektNavn: string;
    // SD (unik nøkkel til regnskap) + internt (nummeret menneskene kjenner igjen).
    prosjektNummer: string | null;
    internProsjektNummer: string | null;
    timer: number;
  }>;
  perDag: Array<{ dato: string; timer: number }>;
};

export type EksportInput = {
  ansatte: AnsattRapportRad[];
  fra: string;
  til: string;
  firmanavn: string;
};

/**
 * Oversetter injisert fra kall-stedet (page.tsx har react-i18next `t`). Denne
 * libben lazy-importeres uten React-kontekst, så `t()` kan ikke kalles direkte
 * her — arknavn (synlige strenger, i18n gjelder også ikke-JSX) sendes gjennom
 * denne. Minimal signatur: i18next-`t` er kompatibel.
 */
export type OversettFn = (nøkkel: string, opts?: Record<string, string>) => string;

/** Maskin-rad uten (gyldig eller eksporterbar) timerad — samme form i begge
 *  «løse» bøttene (uten timerad · på ikke-eksporterbar timerad). */
type LøsMaskinRad = {
  id: string;
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  navn: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  radstatus: string;
};

/**
 * Rå detalj-rader fra timer.rapport.detaljEksport (server). Strukturelt lik
 * prosedyre-returen — timerader med maskin nøstet under, egne lister for
 * tillegg/utlegg. Feeder detalj-arkene (Timerader/Tillegg/Utlegg).
 */
export type DetaljEksport = {
  timerader: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    lonnsart: string;
    aktivitet: string;
    fraTid: string | null; // "HH:MM" per-rad klokkeslett
    tilTid: string | null;
    timer: number;
    beskrivelse: string | null;
    radstatus: string; // T.3 attestertStatus per rad, ikke sedel-status
    maskiner: Array<{
      id: string;
      navn: string;
      timer: number; // maskintimer — egen kolonne, aldri i timer-kolonnen
      mengde: number | null;
      enhet: string | null;
      radstatus: string;
    }>;
  }>;
  maskinUtenTimerad: LøsMaskinRad[];
  // Maskin på en timerad som ble ekskludert av skalEksporteres — EGEN linje,
  // ikke «uten timerad» (den bøtta er anomali-signal «maskin uten arbeid»).
  maskinIkkeEksporterbar: LøsMaskinRad[];
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
    seddelstatus: string; // utlegg har ingen rad-status → sedel-status
  }>;
};

/** 0-basert kolonneindeks → Excel-kolonnebokstav (0→A, 26→AA). */
function kolonneBokstav(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function lagFilnavn(firmanavn: string, fra: string, til: string, ext: "csv" | "xlsx"): string {
  return `SiteDoc-timer-${slugify(firmanavn)}-${fra}-${til}.${ext}`;
}

export function formaterNorsk(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function lastNed(blob: Blob, filnavn: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sammendrags-rader. `ekstern` (mottaker=ekstern, ut av huset) dropper både
 *  Ansattnr (pseudonymiseringsnøkkel) og status-tellingene (Kladd/Sendt/Attestert
 *  = intern arbeidsflyt-status). Ansattnavn beholdes. Fase 4 + oppfølger. */
function sammendragRader(
  ansatte: AnsattRapportRad[],
  ekstern: boolean,
): Array<Array<string | number>> {
  return ansatte.map((a) => [
    a.navn ?? a.email,
    ...(ekstern ? [] : [a.ansattnummer ?? ""]),
    formaterNorsk(a.totalTimer),
    a.antallSedler,
    a.sistRegistrert ? a.sistRegistrert.slice(0, 10) : "",
    ...(ekstern
      ? []
      : [a.statusFordeling.kladd, a.statusFordeling.sent, a.statusFordeling.attestert]),
    a.perProsjekt
      .slice()
      .sort((x, y) => y.timer - x.timer)
      .map((p) => `${p.prosjektNavn}: ${formaterNorsk(p.timer)}`)
      .join(" · "),
  ]);
}

/**
 * Kolonne-etikett fra i18n. Nøklene lever i `timer.eksport.kol*` — SAMME
 * navnemønster som PDF-ens `firma.timer.rapport.pdf.kol*` (den gjorde dette
 * riktig først). Hver eksportvei eier sitt navnerom, men speiler den andres
 * navngivning slik at et grep på tvers avslører drift (jf. den allerede
 * mirror'ede `maskinIkkeEksporterbar`). Skjer en endring i én kolonneetikett
 * skal søster-nøkkelen finnes med samme leaf-navn i det andre navnerommet.
 */
export const kolTekst =
  (t: OversettFn) =>
  (nøkkel: string): string =>
    t(`timer.eksport.${nøkkel}`);

/** Header + stabile kolonnenøkler (til i18n-trygt indeks-oppslag — `indexOf`
 *  på den OVERSATTE strengen ryker når fanen ikke er norsk). */
/** Sammendrags-kolonner. Ekstern (ut av huset) dropper Ansattnr (pseudonymiserings-
 *  nøkkel) + status-tellingene (Kladd/Sendt/Attestert) — samme regel som Detaljer-
 *  arkets Ansattnr/Status. Ansattnavn beholdes. Fase 4 + oppfølger. */
function sammendragKol(ekstern: boolean): string[] {
  return [
    "kolAnsatt",
    ...(ekstern ? [] : ["kolAnsattnr"]),
    "kolTotalTimer",
    "kolSedler",
    "kolSistRegistrert",
    ...(ekstern ? [] : ["kolKladd", "kolSent", "kolAttestert"]),
    "ark.etterProsjekt", // gjenbruk av eksisterende arknavn-nøkkel (samme etikett)
  ];
}

const PER_PROSJEKT_KOL = [
  "kolAnsatt",
  "kolAnsattnr",
  "kolProsjekt",
  "kolProsjektnummer",
  "kolInternProsjektnummer",
  "kolTimer",
] as const;

const PER_DAG_KOL = ["kolAnsatt", "kolAnsattnr", "kolDato", "kolTimer"] as const;

/** CSV-eksport (semikolon-separert for Excel-kompatibilitet, kun sammendrag).
 *  CSV er ett flatt bord → detalj-arkene (Timerader/Tillegg/Utlegg) finnes kun
 *  i .xlsx. CSV forblir sammendrags-eksporten. */
export function eksporterCsv(
  input: EksportInput,
  t: OversettFn,
  opts: { mottaker?: "intern" | "ekstern" } = {},
): void {
  const sep = ";";
  const kol = kolTekst(t);
  const ekstern = opts.mottaker === "ekstern";
  const linjer: string[] = [];
  linjer.push(sammendragKol(ekstern).map(kol).join(sep));
  for (const rad of sammendragRader(input.ansatte, ekstern)) {
    linjer.push(
      rad
        .map((v) => {
          const s = String(v);
          // Quote hvis inneholder semikolon, anførselstegn eller linjeskift
          if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(sep),
    );
  }
  // BOM for at Excel-Windows skal lese UTF-8 korrekt
  const csv = "﻿" + linjer.join("\r\n");
  lastNed(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    lagFilnavn(input.firmanavn, input.fra, input.til, "csv"),
  );
}

type Worksheet = import("exceljs").Worksheet;

/**
 * Levende kontroll-sum: SUBTOTAL(109; …) fremfor ferdigregnet tall. 109 =
 * SUM som RESPEKTERER Excel-filtrering — lønn filtrerer til én ansatt og ser
 * summen oppdatere seg. Regnet fra RADENE (ikke kopiert fra serveraggregatet):
 * avviker den fra «Sammendrag», har de to kodeveiene drevet fra hverandre, og
 * det skal være synlig i fila i stedet for å oppdages i lønnskjøringen.
 */
function leggTilSumrad(
  ws: Worksheet,
  antallKol: number,
  sumKolIndekser: number[],
  førsteData: number,
  sisteData: number,
  etikett: string,
): void {
  if (sisteData < førsteData) return; // ingen datarader → ingen sum
  const rad: Array<string | number> = new Array(antallKol).fill("");
  rad[0] = etikett;
  const sumRad = ws.addRow(rad);
  for (const idx of sumKolIndekser) {
    const kol = kolonneBokstav(idx);
    sumRad.getCell(idx + 1).value = {
      formula: `SUBTOTAL(109,${kol}${førsteData}:${kol}${sisteData})`,
    };
  }
  sumRad.font = { bold: true };
}

function settBredder(ws: Worksheet, bredder: number[]): void {
  ws.columns.forEach((col, i) => {
    col.width = bredder[i] ?? 16;
  });
}

/** Type-etikett (Type-kolonnen) fra radtypen. */
export function typeEtikett(t: OversettFn, type: DetaljRadType): string {
  return t(`timer.eksport.type${type.charAt(0).toUpperCase()}${type.slice(1)}`);
}

/**
 * Status-VERDIENE er rå DB-koder (pending/sent/…) — ikke norsk. Status-kolonnen
 * blander to vokabular: rad-status (timer/maskin/tillegg = attestertStatus) og
 * sedel-status (utlegg = DailySheet.status). ÉN mapping her, gjenbrukt av Excel
 * (oversetter direkte) OG PDF (bygger etikett-map via `byggStatusEtiketter`, sendt
 * inn i `tekster` fordi api ikke har `t()`) — så flatene aldri kan drive fra hverandre.
 */
const STATUS_I18N: Record<string, string> = {
  // rad-status (attestertStatus)
  pending: "timer.attestering.radStatus.pending",
  attestert: "timer.attestering.radStatus.attestert",
  returnert: "timer.attestering.radStatus.returnert",
  // sedel-status (DailySheet.status)
  draft: "timer.statusType.draft",
  sent: "timer.statusType.sent",
  returned: "timer.statusType.returned",
  accepted: "timer.statusType.accepted",
};

/** Oversett én status-verdi; ukjent/ny verdi → rå streng (skjul aldri en verdi vi ikke kjenner). */
export function statusEtikett(t: OversettFn, verdi: string): string {
  const nøkkel = STATUS_I18N[verdi];
  return nøkkel ? t(nøkkel) : verdi;
}

/** Ferdig-oversatt verdi→etikett-map for PDF (injiseres i `tekster.statusEtiketter`). */
export function byggStatusEtiketter(t: OversettFn): Record<string, string> {
  const ut: Record<string, string> = {};
  for (const [verdi, nøkkel] of Object.entries(STATUS_I18N)) ut[verdi] = t(nøkkel);
  return ut;
}

/**
 * Betegnelse-cellen: lønnsart/tilleggsnavn/kategori direkte, men maskin-navnet
 * merkes etter opprinnelse (nøstet «↳», uten timerad, ikke-eksporterbar) med
 * SAMME i18n-strenger som før sammenslåingen (behold anomali-signalene synlige).
 *
 * Fase 4-oppfølger: `utenTimerad`/`ikkeEksporterbar` er INTERNE anomali-signaler
 * (vår egen datakvalitet). Ved `mottaker=ekstern` undertrykkes merkelappen — kun
 * maskinnavnet står igjen. RADEN blir uendret; det er bare etiketten som er intern.
 * Nøstingsmerket «↳» beholdes (rent visnings-innrykk, ikke et anomali-signal).
 */
export function betegnelse(t: OversettFn, r: DetaljRad, ekstern: boolean): string {
  if (r.type !== "maskin") return r.betegnelse;
  switch (r.maskinMerke) {
    case "noster":
      return t("timer.eksport.maskinNoster", { navn: r.betegnelse });
    case "utenTimerad":
      return ekstern
        ? r.betegnelse
        : t("timer.eksport.maskinUtenTimerad", { navn: r.betegnelse });
    case "ikkeEksporterbar":
      return ekstern
        ? r.betegnelse
        : t("timer.eksport.maskinIkkeEksporterbar", { navn: r.betegnelse });
    default:
      return r.betegnelse; // timeraden er skjult av radvalget — normal maskin-rad
  }
}

/**
 * Ark «Detaljer»: ÉN kronologisk tabell med Type-kolonne (Timer · Maskin ·
 * Tillegg · Utlegg) — erstatter de tre gamle detaljarkene (fase 2, 2026-08-26).
 * Maskin beholder nøstingen under sin timerad. Radsettet + rekkefølgen kommer
 * fra @sitedoc/shared `byggDetaljRader`, SAMME kilde som PDF-en, så de aldri kan
 * drive fra hverandre. Excel viser ALLE kolonner (bredde er gratis her); PDF
 * dropper de tomme.
 *
 * Fire kontrollsummer (Timer/Maskintimer/Antall/Beløp) via SUBTOTAL(109) —
 * respekterer Excel-filtrering, så en Type-filtrert visning oppdaterer summen.
 * Timer-summen må fortsatt stemme mot Sammendrag når Timer-rader er med.
 */
/** Per-kolonne descriptor for Excel-detaljarket: header-i18n, kolonnebredde,
 *  om kolonnen summeres (kontrollsum), og celle-verdien. Nøklene = @sitedoc/shared
 *  `TimerKolKey` (flateparitet). `id`-kolonnen håndteres separat (Excel-only). */
type ExcelKolDesc = {
  i18n: string;
  bredde: number;
  sum?: boolean;
  verdi: (r: DetaljRad, t: OversettFn, ekstern: boolean) => string | number;
};

const EXCEL_KOL: Record<TimerKolKey, ExcelKolDesc> = {
  dato: { i18n: "kolDato", bredde: 12, verdi: (r) => r.dato },
  ansatt: { i18n: "kolAnsatt", bredde: 22, verdi: (r) => r.ansatt },
  ansattnr: { i18n: "kolAnsattnr", bredde: 10, verdi: (r) => r.ansattnr ?? "" },
  prosjekt: { i18n: "kolProsjekt", bredde: 22, verdi: (r) => r.prosjekt },
  type: { i18n: "kolType", bredde: 10, verdi: (r, t) => typeEtikett(t, r.type) },
  betegnelse: { i18n: "kolBetegnelse", bredde: 24, verdi: (r, t, ekstern) => betegnelse(t, r, ekstern) },
  aktivitet: { i18n: "kolAktivitet", bredde: 18, verdi: (r) => r.aktivitet ?? "" },
  fraTid: { i18n: "kolFra", bredde: 7, verdi: (r) => r.fraTid ?? "" },
  tilTid: { i18n: "kolTil", bredde: 7, verdi: (r) => r.tilTid ?? "" },
  timer: { i18n: "kolTimer", bredde: 9, sum: true, verdi: (r) => r.timer ?? "" },
  maskintimer: { i18n: "kolMaskintimer", bredde: 11, sum: true, verdi: (r) => r.maskintimer ?? "" },
  antall: { i18n: "kolAntall", bredde: 9, sum: true, verdi: (r) => r.antall ?? "" },
  belop: { i18n: "kolBelop", bredde: 11, sum: true, verdi: (r) => r.belop ?? "" },
  mengde: { i18n: "kolMengde", bredde: 10, verdi: (r) => r.mengde ?? "" },
  enhet: { i18n: "kolEnhet", bredde: 8, verdi: (r) => r.enhet ?? "" },
  beskrivelse: { i18n: "kolBeskrivelse", bredde: 34, verdi: (r) => r.beskrivelse ?? "" },
  status: { i18n: "kolStatus", bredde: 12, verdi: (r, t) => statusEtikett(t, r.status) },
};

function byggDetaljerArk(
  ws: Worksheet,
  grupper: DetaljGruppe[],
  t: OversettFn,
  mottaker: "intern" | "ekstern",
  gruppering: Gruppering,
  valgteKolonner?: string[],
): void {
  const kol = kolTekst(t);
  const ekstern = mottaker === "ekstern";
  const alleRader = grupper.flatMap((g) => g.rader);

  // Kolonnesett + rekkefølge (flateparitet, config v3): malens `valgteKolonner`
  // ordrett — nøyaktig samme kolonner som skjerm/PDF. Mangler valget: dagens fulle
  // sett (Excel viste ALT; beholdt uendret for maler uten kolonnevalg). Ekstern-
  // regelen (Status/Ansattnr) filtreres bort strukturelt i begge veier.
  const harValg = !!(valgteKolonner && valgteKolonner.length > 0);
  const koler: TimerKolKey[] = harValg
    ? losTimerKolonner(alleRader, mottaker, valgteKolonner)
    : TIMER_KOL_KEYS.filter((k) => !(ekstern && INTERNE_TIMER_KOLONNER.includes(k)));

  // ID-kolonnen (tynn koblingsnøkkel) er Excel-only og aldri valgbar — kun i legacy
  // intern-modus. Ved eksplisitt kolonnevalg finnes den ikke (skjerm/PDF har ingen ID).
  const medId = !harValg && !ekstern;

  const noekler = koler.map((k) => EXCEL_KOL[k].i18n);
  if (medId) noekler.push("kolId");
  ws.addRow(noekler.map(kol));
  ws.getRow(1).font = { bold: true };
  const antallKol = noekler.length;

  // Sum-kolonner = posisjonene til de summerbare kolonnene som faktisk er med.
  const sumKol = koler
    .map((k, i) => (EXCEL_KOL[k].sum ? i : -1))
    .filter((i) => i !== -1);

  const radVerdier = (r: DetaljRad): Array<string | number> => {
    const base: Array<string | number> = koler.map((k) => EXCEL_KOL[k].verdi(r, t, ekstern));
    if (medId) base.push(r.id);
    return base;
  };

  // Første datarad (etter header) — grand total SUBTOTAL(109) spenner herfra.
  // SUBTOTAL(109) ignorerer nøstede SUBTOTAL-celler → gruppe-subtotaler
  // dobbelttelles ikke i grand total (Excel-native, ikke en spesialkasse her).
  const førsteData = 2;
  for (const g of grupper) {
    if (gruppering !== "ingen" && g.overskrift !== null) {
      const hdr = ws.addRow([g.overskrift]);
      hdr.font = { bold: true };
    }
    const grFørste = ws.rowCount + 1;
    for (const r of g.rader) ws.addRow(radVerdier(r));
    const grSiste = ws.rowCount;
    // Gruppe-subtotal kun når faktisk gruppert («ingen» får bare grand total).
    if (gruppering !== "ingen" && g.overskrift !== null) {
      leggTilSumrad(
        ws,
        antallKol,
        sumKol,
        grFørste,
        grSiste,
        `${t("timer.eksport.subtotal")}: ${g.overskrift}`,
      );
    }
  }

  leggTilSumrad(ws, antallKol, sumKol, førsteData, ws.rowCount, t("timer.eksport.sumKontroll"));

  // Bredder følger kolonnesettet 1:1 (ID = 14 til slutt i legacy intern-modus).
  const bredder = koler.map((k) => EXCEL_KOL[k].bredde);
  if (medId) bredder.push(14);
  settBredder(ws, bredder);
}

/**
 * Excel-eksport (4 ark: Sammendrag + Per prosjekt + Per dag + Detaljer).
 *
 * Aggregat-arkene (Sammendrag/Per prosjekt/Per dag) beholdes — vi vet ikke hvem
 * som bruker dem, og å fjerne output på en slutning er den stille bruddformen.
 * Detalj-arket (ett kronologisk «Detaljer» med Type-kolonne, fase 2) matet av
 * timer.rapport.detaljEksport hentet ved eksport-klikk, filtrert på `valgteRadTyper`
 * (radvalget fra Tilpasset-modalen; default = alle fire typer).
 */
export async function eksporterXlsx(
  input: EksportInput,
  detalj: DetaljEksport,
  t: OversettFn,
  opts: EksportOpts = {},
): Promise<void> {
  const valgteRadTyper = opts.radTyper ?? ALLE_RADTYPER;
  const mottaker = opts.mottaker ?? "intern";
  const gruppering: Gruppering = opts.gruppering ?? "ingen";
  const ekstern = mottaker === "ekstern";

  const ExcelJSModule = await import("exceljs");
  const ExcelJS =
    (ExcelJSModule as unknown as { default?: typeof import("exceljs") }).default ??
    (ExcelJSModule as unknown as typeof import("exceljs"));
  const wb = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();

  const kol = kolTekst(t);

  // Ark 1: Sammendrag. Ekstern (fase 4) dropper status-tellingene (Kladd/Sendt/Attestert).
  const wsSam = wb.addWorksheet(t("timer.eksport.ark.sammendrag"));
  wsSam.addRow(sammendragKol(ekstern).map(kol));
  wsSam.getRow(1).font = { bold: true };
  for (const rad of sammendragRader(input.ansatte, ekstern)) {
    wsSam.addRow(rad);
  }
  wsSam.columns.forEach((col) => {
    col.width = 18;
  });

  // Ark 2: Per prosjekt (aggregat, uendret — én rad per ansatt × prosjekt)
  const wsPro = wb.addWorksheet(t("timer.eksport.ark.etterProsjekt"));
  wsPro.addRow(PER_PROSJEKT_KOL.map(kol));
  wsPro.getRow(1).font = { bold: true };
  for (const a of input.ansatte) {
    for (const p of a.perProsjekt.slice().sort((x, y) => y.timer - x.timer)) {
      wsPro.addRow([
        a.navn ?? a.email,
        a.ansattnummer ?? "",
        p.prosjektNavn,
        p.prosjektNummer ?? "",
        p.internProsjektNummer ?? "",
        formaterNorsk(p.timer),
      ]);
    }
  }
  wsPro.columns.forEach((col) => {
    col.width = 22;
  });

  // Ark 3: Per dag (aggregat, uendret — én rad per ansatt × dag)
  const wsDag = wb.addWorksheet(t("timer.eksport.ark.etterDag"));
  wsDag.addRow(PER_DAG_KOL.map(kol));
  wsDag.getRow(1).font = { bold: true };
  for (const a of input.ansatte) {
    for (const d of a.perDag) {
      wsDag.addRow([a.navn ?? a.email, a.ansattnummer ?? "", d.dato, formaterNorsk(d.timer)]);
    }
  }
  wsDag.columns.forEach((col) => {
    col.width = 18;
  });

  // Ark 4: Detaljer (ett kronologisk ark med Type-kolonne, radvalg-filtrert).
  // SAMME radsett/rekkefølge som PDF-en (delt @sitedoc/shared byggDetaljRader),
  // pakket i grupper (fase 4) via SAMME grupperDetaljRader som PDF-en.
  const detaljRader = byggDetaljRader(detalj, valgteRadTyper);
  const grupper = grupperDetaljRader(detaljRader, gruppering);
  byggDetaljerArk(
    wb.addWorksheet(t("timer.eksport.ark.detaljer")),
    grupper,
    t,
    mottaker,
    gruppering,
    opts.valgteKolonner,
  );

  const buffer = await wb.xlsx.writeBuffer();
  lastNed(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    lagFilnavn(input.firmanavn, input.fra, input.til, "xlsx"),
  );
}
