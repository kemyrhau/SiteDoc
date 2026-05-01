import { createHash } from "crypto";
import { parse as parseCsv } from "csv-parse/sync";
import {
  KOMPETANSE_KATEGORIER,
  type KompetanseKategori,
} from "@sitedoc/shared";

/**
 * CSV/Excel-import-hjelpere for AnsattKompetanse (Fase 0.5 § 2 + A.28 — Runde 2.5)
 *
 * Påkrevde kolonner: ansattnummer, kompetansetype
 * Valgfrie: kategori, utstedt, utloper, utstederOrgan, sertifikatNr, notat
 *
 * Atomisk-policy: hele importen avvises hvis ansattnumre ikke matcher.
 * Auto-opprettelse av ukjente kompetansetyper styres av flagg.
 */

export type ParsetRad = {
  radnummer: number; // 1-indexed (header er rad 0, første data-rad er 1)
  ansattnummer: string;
  kompetansetype: string;
  kategori: KompetanseKategori | null;
  utstedt: Date | null;
  utloper: Date | null;
  utstederOrgan: string | null;
  sertifikatNr: string | null;
  notat: string | null;
};

export type Parseresultat = {
  rader: ParsetRad[];
  valideringsfeil: string[];
};

const PÅKREVDE_KOLONNER = ["ansattnummer", "kompetansetype"] as const;
const ALIASER: Record<string, string> = {
  ansatt_nr: "ansattnummer",
  ansattnr: "ansattnummer",
  kompetanse: "kompetansetype",
  type: "kompetansetype",
  utstedt_dato: "utstedt",
  utløper: "utloper",
  utlop: "utloper",
  utsteder: "utstederOrgan",
  utsteder_organ: "utstederOrgan",
  sertifikat: "sertifikatNr",
  sertifikatnr: "sertifikatNr",
  sertifikat_nr: "sertifikatNr",
  kommentar: "notat",
};

function normaliserHeader(s: string): string {
  const trimmet = s.trim().toLowerCase().replace(/\s+/g, "_");
  return ALIASER[trimmet] ?? trimmet;
}

/**
 * Parser dato-string. Aksepterer:
 *   - ISO YYYY-MM-DD
 *   - Norsk DD.MM.YYYY
 * Returnerer null for tomme strenger. Kaster ved ambiguøse formater.
 */
function parseDato(verdi: string | null | undefined, kontekst: string): Date | null {
  if (!verdi) return null;
  const trimmet = String(verdi).trim();
  if (!trimmet) return null;

  // ISO YYYY-MM-DD
  const isoMatch = trimmet.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const dato = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (isNaN(dato.getTime())) {
      throw new Error(`Ugyldig ISO-dato i ${kontekst}: «${trimmet}»`);
    }
    return dato;
  }

  // Norsk DD.MM.YYYY
  const norskMatch = trimmet.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (norskMatch) {
    const [, d, m, y] = norskMatch;
    const dato = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (isNaN(dato.getTime())) {
      throw new Error(`Ugyldig norsk dato i ${kontekst}: «${trimmet}»`);
    }
    return dato;
  }

  throw new Error(
    `Ugyldig dato-format i ${kontekst}: «${trimmet}». Aksepterer YYYY-MM-DD eller DD.MM.YYYY.`,
  );
}

function parseKategori(verdi: string | null | undefined): KompetanseKategori | null {
  if (!verdi) return null;
  const trimmet = String(verdi).trim().toUpperCase();
  if (!trimmet) return null;
  if ((KOMPETANSE_KATEGORIER as readonly string[]).includes(trimmet)) {
    return trimmet as KompetanseKategori;
  }
  // Ukjent kategori → ignorer (auto-opprettelse vil bruke EGENDEFINERT)
  return null;
}

export function beregnFilHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function parseCsvFil(buffer: Buffer): Parseresultat {
  const valideringsfeil: string[] = [];
  const rader: ParsetRad[] = [];

  const tekst = buffer.toString("utf-8").replace(/^﻿/, ""); // strip BOM

  let raarader: string[][];
  try {
    raarader = parseCsv(tekst, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      delimiter: tekst.includes(";") ? ";" : ",",
    }) as string[][];
  } catch (e) {
    return {
      rader: [],
      valideringsfeil: [
        `CSV-parsing feilet: ${e instanceof Error ? e.message : "ukjent feil"}`,
      ],
    };
  }

  if (raarader.length === 0) {
    return { rader: [], valideringsfeil: ["Filen er tom"] };
  }

  const headerRad = raarader[0];
  if (!headerRad) {
    return { rader: [], valideringsfeil: ["Filen mangler header-rad"] };
  }
  const headere = headerRad.map(normaliserHeader);
  const manglendePåkrevde = PÅKREVDE_KOLONNER.filter((k) => !headere.includes(k));
  if (manglendePåkrevde.length > 0) {
    return {
      rader: [],
      valideringsfeil: [
        `Mangler påkrevde kolonner: ${manglendePåkrevde.join(", ")}`,
      ],
    };
  }

  const idx: Record<string, number> = {};
  for (let i = 0; i < headere.length; i++) {
    idx[headere[i]!] = i;
  }

  for (let i = 1; i < raarader.length; i++) {
    const rad = raarader[i];
    if (!rad) continue;
    const radnummer = i;
    const hent = (k: string): string | null => {
      const j = idx[k];
      if (j === undefined) return null;
      const v = rad[j];
      return v === undefined ? null : String(v).trim();
    };

    const ansattnummer = hent("ansattnummer");
    const kompetansetype = hent("kompetansetype");
    if (!ansattnummer || !kompetansetype) {
      valideringsfeil.push(
        `Rad ${radnummer}: mangler ansattnummer eller kompetansetype`,
      );
      continue;
    }

    try {
      rader.push({
        radnummer,
        ansattnummer,
        kompetansetype,
        kategori: parseKategori(hent("kategori")),
        utstedt: parseDato(hent("utstedt"), `rad ${radnummer}, utstedt`),
        utloper: parseDato(hent("utloper"), `rad ${radnummer}, utloper`),
        utstederOrgan: hent("utstederOrgan") || null,
        sertifikatNr: hent("sertifikatNr") || null,
        notat: hent("notat") || null,
      });
    } catch (e) {
      valideringsfeil.push(e instanceof Error ? e.message : `Rad ${radnummer}: ukjent feil`);
    }
  }

  return { rader, valideringsfeil };
}

export async function parseXlsxFil(buffer: Buffer): Promise<Parseresultat> {
  const valideringsfeil: string[] = [];
  const rader: ParsetRad[] = [];

  const ExcelJSModule = await import("exceljs");
  const ExcelJS =
    (ExcelJSModule as unknown as { default?: typeof import("exceljs") }).default ??
    (ExcelJSModule as unknown as typeof import("exceljs"));
  const workbook = new (ExcelJS as { Workbook: new () => import("exceljs").Workbook }).Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (e) {
    return {
      rader: [],
      valideringsfeil: [
        `Excel-parsing feilet: ${e instanceof Error ? e.message : "ukjent feil"}`,
      ],
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rader: [], valideringsfeil: ["Filen mangler arbeidsark"] };
  }

  // Hent header-rad
  const headerRow = sheet.getRow(1);
  const headere: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (celle, kolonneNr) => {
    headere[kolonneNr - 1] = normaliserHeader(String(celle.value ?? ""));
  });

  const manglendePåkrevde = PÅKREVDE_KOLONNER.filter((k) => !headere.includes(k));
  if (manglendePåkrevde.length > 0) {
    return {
      rader: [],
      valideringsfeil: [
        `Mangler påkrevde kolonner: ${manglendePåkrevde.join(", ")}`,
      ],
    };
  }

  const idx: Record<string, number> = {};
  for (let i = 0; i < headere.length; i++) {
    if (headere[i]) idx[headere[i]!] = i + 1; // ExcelJS er 1-indexed
  }

  const totaltRader = sheet.rowCount;
  for (let r = 2; r <= totaltRader; r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;

    const hent = (k: string): string | null => {
      const j = idx[k];
      if (j === undefined) return null;
      const celle = row.getCell(j);
      const verdi = celle.value;
      if (verdi === null || verdi === undefined || verdi === "") return null;
      // ExcelJS gir Date-objekter for dato-celler — konverter til DD.MM.YYYY for senere parsing
      if (verdi instanceof Date) {
        const dd = String(verdi.getUTCDate()).padStart(2, "0");
        const mm = String(verdi.getUTCMonth() + 1).padStart(2, "0");
        const yyyy = verdi.getUTCFullYear();
        return `${dd}.${mm}.${yyyy}`;
      }
      if (typeof verdi === "object" && "text" in verdi) {
        return String((verdi as { text: string }).text).trim();
      }
      return String(verdi).trim();
    };

    const ansattnummer = hent("ansattnummer");
    const kompetansetype = hent("kompetansetype");
    if (!ansattnummer || !kompetansetype) {
      valideringsfeil.push(
        `Rad ${r - 1}: mangler ansattnummer eller kompetansetype`,
      );
      continue;
    }

    try {
      rader.push({
        radnummer: r - 1,
        ansattnummer,
        kompetansetype,
        kategori: parseKategori(hent("kategori")),
        utstedt: parseDato(hent("utstedt"), `rad ${r - 1}, utstedt`),
        utloper: parseDato(hent("utloper"), `rad ${r - 1}, utloper`),
        utstederOrgan: hent("utstederOrgan"),
        sertifikatNr: hent("sertifikatNr"),
        notat: hent("notat"),
      });
    } catch (e) {
      valideringsfeil.push(e instanceof Error ? e.message : `Rad ${r - 1}: ukjent feil`);
    }
  }

  return { rader, valideringsfeil };
}
