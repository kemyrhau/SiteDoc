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
    prosjektNummer: string | null;
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

const PER_PROSJEKT_HEADER = [
  "Ansatt",
  "Ansattnr",
  "Prosjekt",
  "Prosjektnummer",
  "Timer",
] as const;

const PER_DAG_HEADER = ["Ansatt", "Ansattnr", "Dato", "Timer"] as const;

/** CSV-eksport (semikolon-separert for Excel-kompatibilitet, kun sammendrag). */
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

/** Excel-eksport (3 ark: Sammendrag + Per prosjekt + Per dag). */
export async function eksporterXlsx(input: EksportInput): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS =
    (ExcelJSModule as unknown as { default?: typeof import("exceljs") }).default ??
    (ExcelJSModule as unknown as typeof import("exceljs"));
  const wb = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();

  // Ark 1: Sammendrag
  const wsSam = wb.addWorksheet("Sammendrag");
  wsSam.addRow([...SAMMENDRAG_HEADER]);
  wsSam.getRow(1).font = { bold: true };
  for (const rad of sammendragRader(input.ansatte)) {
    wsSam.addRow(rad);
  }
  wsSam.columns.forEach((col) => {
    col.width = 18;
  });

  // Ark 2: Per prosjekt (én rad per ansatt × prosjekt)
  const wsPro = wb.addWorksheet("Per prosjekt");
  wsPro.addRow([...PER_PROSJEKT_HEADER]);
  wsPro.getRow(1).font = { bold: true };
  for (const a of input.ansatte) {
    for (const p of a.perProsjekt.slice().sort((x, y) => y.timer - x.timer)) {
      wsPro.addRow([
        a.navn ?? a.email,
        a.ansattnummer ?? "",
        p.prosjektNavn,
        p.prosjektNummer ?? "",
        formaterNorsk(p.timer),
      ]);
    }
  }
  wsPro.columns.forEach((col) => {
    col.width = 22;
  });

  // Ark 3: Per dag (én rad per ansatt × dag)
  const wsDag = wb.addWorksheet("Per dag");
  wsDag.addRow([...PER_DAG_HEADER]);
  wsDag.getRow(1).font = { bold: true };
  for (const a of input.ansatte) {
    for (const d of a.perDag) {
      wsDag.addRow([
        a.navn ?? a.email,
        a.ansattnummer ?? "",
        d.dato,
        formaterNorsk(d.timer),
      ]);
    }
  }
  wsDag.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await wb.xlsx.writeBuffer();
  lastNed(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    lagFilnavn(input.firmanavn, input.fra, input.til, "xlsx"),
  );
}
