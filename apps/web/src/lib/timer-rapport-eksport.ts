/**
 * U2 — CSV/Excel-eksport for timer-rapport på firmanivå.
 *
 * Bygger fil i nettleseren fra rapport-data uten server-roundtrip.
 * Bruker exceljs (~/apps/web/package.json) for både CSV og .xlsx.
 *
 * Lazy-importes fra page.tsx for å unngå at exceljs-bundle øker
 * initial page-load for brukere som aldri klikker eksport.
 */

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
    status: string;
    maskiner: Array<{
      id: string;
      navn: string;
      mengde: number | null;
      enhet: string | null;
    }>;
  }>;
  maskinUtenTimerad: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    navn: string;
    mengde: number | null;
    enhet: string | null;
    status: string;
  }>;
  tillegg: Array<{
    id: string;
    dato: string;
    ansatt: string;
    ansattnr: string | null;
    prosjekt: string;
    tillegg: string;
    antall: number;
    kommentar: string | null;
    status: string;
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
    status: string;
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

const SAMMENDRAG_HEADER = [
  "Ansatt",
  "Ansattnr",
  "Total timer",
  "Antall sedler",
  "Sist registrert",
  "Kladd",
  "Sent",
  "Attestert",
  "Per prosjekt",
] as const;

/** CSV-eksport (semikolon-separert for Excel-kompatibilitet, kun sammendrag).
 *  CSV er ett flatt bord → detalj-arkene (Timerader/Tillegg/Utlegg) finnes kun
 *  i .xlsx. CSV forblir sammendrags-eksporten. */
export function eksporterCsv(input: EksportInput): void {
  const sep = ";";
  const linjer: string[] = [];
  linjer.push(SAMMENDRAG_HEADER.join(sep));
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
  sumKolIndex: number,
  førsteData: number,
  sisteData: number,
  etikett: string,
): void {
  if (sisteData < førsteData) return; // ingen datarader → ingen sum
  const rad: Array<string | number> = new Array(antallKol).fill("");
  rad[0] = etikett;
  const sumRad = ws.addRow(rad);
  const kol = kolonneBokstav(sumKolIndex);
  sumRad.getCell(sumKolIndex + 1).value = {
    formula: `SUBTOTAL(109,${kol}${førsteData}:${kol}${sisteData})`,
  };
  sumRad.font = { bold: true };
}

function settBredder(ws: Worksheet, bredder: number[]): void {
  ws.columns.forEach((col, i) => {
    col.width = bredder[i] ?? 16;
  });
}

/**
 * Ark «Timerader»: én rad per SheetTimer, med maskin-rader nøstet UNDER sin
 * timerad (sheetTimerId, samme som dagskort-hoveren). Maskin uten timerad
 * samles nederst — vist ærlig, ikke skjult.
 *
 * DATADREVET gruppering: kolonnene er en liste, ikke hardkodede nivåer. En
 * framtidig proadm-«underprosjekt»-dimensjon legges til som ÉN kolonne her (og
 * som ett felt på server-raden + ett filter) — uten ombygging.
 */
function byggTimeraderArk(ws: Worksheet, detalj: DetaljEksport): void {
  const header = [
    "Dato",
    "Ansatt",
    "Ansattnr",
    "Prosjekt",
    // ← framtidig «Underprosjekt» slottes inn her (data fra server-raden).
    "Lønnsart",
    "Aktivitet",
    "Timer",
    "Beskrivelse",
    "Status",
    "Mengde",
    "Enhet",
    "ID", // tynn koblingsnøkkel (sheetTimer.id / sheetMachine.id), ikke lesestoff
  ];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  const timerKol = header.indexOf("Timer"); // robust mot innskutte kolonner
  const førsteData = 2;

  for (const t of detalj.timerader) {
    ws.addRow([
      t.dato,
      t.ansatt,
      t.ansattnr ?? "",
      t.prosjekt,
      t.lonnsart,
      t.aktivitet,
      t.timer, // NUMERISK — SUBTOTAL kan ikke summere formaterte strenger
      t.beskrivelse ?? "",
      t.status,
      "",
      "",
      t.id,
    ]);
    // Maskin nøstet rett under sin timerad. Timer-kolonnen står TOM (maskin
    // bærer mengde+enhet, ikke arbeidstimer) → kontroll-summen forblir ren.
    for (const m of t.maskiner) {
      ws.addRow([
        t.dato,
        t.ansatt,
        t.ansattnr ?? "",
        t.prosjekt,
        `↳ ${m.navn}`,
        "",
        "",
        "",
        t.status,
        m.mengde ?? "",
        m.enhet ?? "",
        m.id,
      ]);
    }
  }
  for (const m of detalj.maskinUtenTimerad) {
    ws.addRow([
      m.dato,
      m.ansatt,
      m.ansattnr ?? "",
      m.prosjekt,
      `⚠ Maskin uten timerad: ${m.navn}`,
      "",
      "",
      "",
      m.status,
      m.mengde ?? "",
      m.enhet ?? "",
      m.id,
    ]);
  }

  leggTilSumrad(ws, header.length, timerKol, førsteData, ws.rowCount, "SUM (kontroll)");
  settBredder(ws, [12, 22, 10, 24, 20, 20, 9, 40, 12, 10, 8, 14]);
}

function byggTilleggArk(ws: Worksheet, detalj: DetaljEksport): void {
  const header = [
    "Dato",
    "Ansatt",
    "Ansattnr",
    "Prosjekt",
    "Tillegg",
    "Antall",
    "Kommentar",
    "Status",
    "ID",
  ];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  const antallKol = header.indexOf("Antall");
  for (const r of detalj.tillegg) {
    ws.addRow([
      r.dato,
      r.ansatt,
      r.ansattnr ?? "",
      r.prosjekt,
      r.tillegg,
      r.antall,
      r.kommentar ?? "",
      r.status,
      r.id,
    ]);
  }
  leggTilSumrad(ws, header.length, antallKol, 2, ws.rowCount, "SUM (kontroll)");
  settBredder(ws, [12, 22, 10, 24, 22, 9, 40, 12, 14]);
}

function byggUtleggArk(ws: Worksheet, detalj: DetaljEksport): void {
  const header = [
    "Dato",
    "Ansatt",
    "Ansattnr",
    "Prosjekt",
    "Kategori",
    "Beløp",
    "Kommentar",
    "Status",
    "ID",
  ];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  const belopKol = header.indexOf("Beløp");
  for (const r of detalj.utlegg) {
    ws.addRow([
      r.dato,
      r.ansatt,
      r.ansattnr ?? "",
      r.prosjekt,
      r.kategori,
      r.belop ?? "",
      r.kommentar ?? "",
      r.status,
      r.id,
    ]);
  }
  leggTilSumrad(ws, header.length, belopKol, 2, ws.rowCount, "SUM (kontroll)");
  settBredder(ws, [12, 22, 10, 24, 22, 12, 40, 12, 14]);
}

/**
 * Excel-eksport (4 ark: Sammendrag + Timerader + Tillegg + Utlegg).
 *
 * Vedtatt arkstruktur (2026-08-24): Sammendrag beholdes uendret som første ark;
 * de tidligere aggregat-arkene «Per prosjekt» + «Per dag» ERSTATTES av detalj-
 * arkene (detaljradene kan pivoteres i Excel → aggregatene var redundante).
 * `detalj` kommer fra timer.rapport.detaljEksport, hentet ved eksport-klikk.
 */
export async function eksporterXlsx(
  input: EksportInput,
  detalj: DetaljEksport,
): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS =
    (ExcelJSModule as unknown as { default?: typeof import("exceljs") }).default ??
    (ExcelJSModule as unknown as typeof import("exceljs"));
  const wb = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();

  // Ark 1: Sammendrag (uendret)
  const wsSam = wb.addWorksheet("Sammendrag");
  wsSam.addRow([...SAMMENDRAG_HEADER]);
  wsSam.getRow(1).font = { bold: true };
  for (const rad of sammendragRader(input.ansatte)) {
    wsSam.addRow(rad);
  }
  wsSam.columns.forEach((col) => {
    col.width = 18;
  });

  // Ark 2–4: detalj
  byggTimeraderArk(wb.addWorksheet("Timerader"), detalj);
  byggTilleggArk(wb.addWorksheet("Tillegg"), detalj);
  byggUtleggArk(wb.addWorksheet("Utlegg"), detalj);

  const buffer = await wb.xlsx.writeBuffer();
  lastNed(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    lagFilnavn(input.firmanavn, input.fra, input.til, "xlsx"),
  );
}
