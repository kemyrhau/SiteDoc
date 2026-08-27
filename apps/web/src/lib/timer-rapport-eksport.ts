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
  ALLE_RADTYPER,
  type DetaljRad,
  type DetaljRadType,
} from "@sitedoc/shared";

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

function formaterNorsk(n: number): string {
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

function sammendragRader(ansatte: AnsattRapportRad[]): Array<Array<string | number>> {
  return ansatte.map((a) => [
    a.navn ?? a.email,
    a.ansattnummer ?? "",
    formaterNorsk(a.totalTimer),
    a.antallSedler,
    a.sistRegistrert ? a.sistRegistrert.slice(0, 10) : "",
    a.statusFordeling.kladd,
    a.statusFordeling.sent,
    a.statusFordeling.attestert,
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
const kolTekst =
  (t: OversettFn) =>
  (nøkkel: string): string =>
    t(`timer.eksport.${nøkkel}`);

/** Header + stabile kolonnenøkler (til i18n-trygt indeks-oppslag — `indexOf`
 *  på den OVERSATTE strengen ryker når fanen ikke er norsk). */
const SAMMENDRAG_KOL = [
  "kolAnsatt",
  "kolAnsattnr",
  "kolTotalTimer",
  "kolSedler",
  "kolSistRegistrert",
  "kolKladd",
  "kolSent",
  "kolAttestert",
  "ark.etterProsjekt", // gjenbruk av eksisterende arknavn-nøkkel (samme etikett)
] as const;

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
export function eksporterCsv(input: EksportInput, t: OversettFn): void {
  const sep = ";";
  const kol = kolTekst(t);
  const linjer: string[] = [];
  linjer.push(SAMMENDRAG_KOL.map(kol).join(sep));
  for (const rad of sammendragRader(input.ansatte)) {
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
function typeEtikett(t: OversettFn, type: DetaljRadType): string {
  return t(`timer.eksport.type${type.charAt(0).toUpperCase()}${type.slice(1)}`);
}

/**
 * Betegnelse-cellen: lønnsart/tilleggsnavn/kategori direkte, men maskin-navnet
 * merkes etter opprinnelse (nøstet «↳», uten timerad, ikke-eksporterbar) med
 * SAMME i18n-strenger som før sammenslåingen (behold anomali-signalene synlige).
 */
function betegnelse(t: OversettFn, r: DetaljRad): string {
  if (r.type !== "maskin") return r.betegnelse;
  switch (r.maskinMerke) {
    case "noster":
      return t("timer.eksport.maskinNoster", { navn: r.betegnelse });
    case "utenTimerad":
      return t("timer.eksport.maskinUtenTimerad", { navn: r.betegnelse });
    case "ikkeEksporterbar":
      return t("timer.eksport.maskinIkkeEksporterbar", { navn: r.betegnelse });
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
function byggDetaljerArk(
  ws: Worksheet,
  rader: DetaljRad[],
  t: OversettFn,
): void {
  const kol = kolTekst(t);
  const noekler = [
    "kolDato",
    "kolAnsatt",
    "kolAnsattnr",
    "kolProsjekt",
    // ← framtidig «Underprosjekt» slottes inn her (data fra server-raden).
    "kolType",
    "kolBetegnelse", // lønnsart · maskinnavn · tilleggsnavn · kategori
    "kolAktivitet",
    "kolTimer",
    "kolMaskintimer", // egen kolonne — holder Timer-kolonnen (kontrollsum) ren
    "kolAntall",
    "kolBelop",
    "kolMengde",
    "kolEnhet",
    "kolBeskrivelse",
    "kolStatus", // rad-status (timer/maskin/tillegg) · seddelstatus (utlegg)
    "kolId", // tynn koblingsnøkkel — Excel-only, aldri PDF
  ];
  ws.addRow(noekler.map(kol));
  ws.getRow(1).font = { bold: true };
  // Indeks slås opp på den STABILE nøkkelen, ikke den oversatte strengen —
  // robust mot både innskutte kolonner OG ikke-norske faner.
  const sumKol = [
    noekler.indexOf("kolTimer"),
    noekler.indexOf("kolMaskintimer"),
    noekler.indexOf("kolAntall"),
    noekler.indexOf("kolBelop"),
  ];

  for (const r of rader) {
    ws.addRow([
      r.dato,
      r.ansatt,
      r.ansattnr ?? "",
      r.prosjekt,
      typeEtikett(t, r.type),
      betegnelse(t, r),
      r.aktivitet ?? "",
      r.timer ?? "", // NUMERISK der satt — SUBTOTAL ignorerer tomme/tekst-celler
      r.maskintimer ?? "",
      r.antall ?? "",
      r.belop ?? "",
      r.mengde ?? "",
      r.enhet ?? "",
      r.beskrivelse ?? "",
      r.status,
      r.id,
    ]);
  }

  leggTilSumrad(ws, noekler.length, sumKol, 2, ws.rowCount, t("timer.eksport.sumKontroll"));
  settBredder(ws, [12, 22, 10, 22, 10, 24, 18, 9, 11, 9, 11, 10, 8, 34, 12, 14]);
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
  valgteRadTyper: readonly DetaljRadType[] = ALLE_RADTYPER,
): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS =
    (ExcelJSModule as unknown as { default?: typeof import("exceljs") }).default ??
    (ExcelJSModule as unknown as typeof import("exceljs"));
  const wb = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();

  const kol = kolTekst(t);

  // Ark 1: Sammendrag (uendret)
  const wsSam = wb.addWorksheet(t("timer.eksport.ark.sammendrag"));
  wsSam.addRow(SAMMENDRAG_KOL.map(kol));
  wsSam.getRow(1).font = { bold: true };
  for (const rad of sammendragRader(input.ansatte)) {
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
  // SAMME radsett/rekkefølge som PDF-en (delt @sitedoc/shared byggDetaljRader).
  const detaljRader = byggDetaljRader(detalj, valgteRadTyper);
  byggDetaljerArk(wb.addWorksheet(t("timer.eksport.ark.detaljer")), detaljRader, t);

  const buffer = await wb.xlsx.writeBuffer();
  lastNed(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    lagFilnavn(input.firmanavn, input.fra, input.til, "xlsx"),
  );
}
