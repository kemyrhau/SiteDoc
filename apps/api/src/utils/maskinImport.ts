import { createHash } from "crypto";
import { erGyldigRegnummer, normaliserRegnummer } from "@sitedoc/shared";

/**
 * SmartDok maskin-import-parser (Excel).
 *
 * Excel-kolonner fra SmartDok-eksport:
 *   Maskin, Internnummer, Reg.nr, Maskinkode, Årsmodell, Lokasjon,
 *   Sist endret, Maskinansvarlig 1, Maskinansvarlig 2, Timetall,
 *   Km.stand, Notat, Status
 *
 * Filtrerings- og kategoriseringsregler er dokumentert i
 * docs/claude/maskin.md § «SmartDok-import».
 *
 * Ingen API-skriving her — kun parsing + matching-rapport.
 */

export type MaskinKategori = "kjoretoy" | "anleggsmaskin" | "smautstyr";
export type MaskinEierskap = "eid" | "leid";

export type ParsetMaskinRad = {
  radnummer: number;
  navn: string;
  internnummerRaw: string;
  internnummer: string | null; // null for 0XXX-placeholder
  regnummerRaw: string;
  regnummer: string | null; // normalisert (kun hvis erGyldigRegnummer)
  harGyldigRegnummer: boolean;
  kategori: MaskinKategori;
  eierskap: MaskinEierskap;
  aarsmodell: number | null;
  lokasjon: string | null;
  ansvarlig1Navn: string | null;
  ansvarlig2Navn: string | null;
  timetall: number | null;
  kmStand: number | null;
  notat: string | null;
};

export type Parseresultat = {
  rader: ParsetMaskinRad[];
  /** Rader som ble filtrert ut (testdata, ugyldige) — for rapport */
  filtrerte: Array<{ radnummer: number; navn: string; grunn: string }>;
  valideringsfeil: string[];
};

const PÅKREVDE_KOLONNER = ["maskin", "internnummer"] as const;

const ALIASER: Record<string, string> = {
  navn: "maskin",
  intern_nummer: "internnummer",
  internnr: "internnummer",
  regnr: "reg.nr",
  reg_nr: "reg.nr",
  registreringsnummer: "reg.nr",
  aarsmodell: "årsmodell",
  årsmodell: "årsmodell",
  ansvarlig: "maskinansvarlig 1",
  ansvarlig_1: "maskinansvarlig 1",
  ansvarlig_2: "maskinansvarlig 2",
  km: "km.stand",
  km_stand: "km.stand",
  kmstand: "km.stand",
  driftstimer: "timetall",
  kommentar: "notat",
};

function normaliserHeader(s: string): string {
  const trimmet = s.trim().toLowerCase();
  if (ALIASER[trimmet]) return ALIASER[trimmet]!;
  // Behold mellomrom og punktum (kolonner som "reg.nr", "maskinansvarlig 1")
  return trimmet;
}

export function beregnFilHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Utled kategori basert på regnummer + internnummer + navn.
 *
 * Regler (basert på A.Markussen 2026-05-01-eksport, 126 maskiner):
 *  - Gyldig regnummer        → kjoretoy (Vegvesen-oppslag bekrefter)
 *  - 7000–7599 (uten regnr)  → kjoretoy (bilpark uten registrering)
 *  - 7600–7699 (uten regnr)  → anleggsmaskin (truck, hjullaster, dumper)
 *  - 7700–7999 (uten regnr)  → smautstyr (redskap, GPS, hammer, klipe)
 *  - 9XXX                    → anleggsmaskin (leide hovedmaskiner)
 *  - 0XXX-placeholder        → utled fra 4-sifret prefiks i navn-feltet
 *  - Fallback                → smautstyr
 *
 * Bruker kan korrigere via Blokk C2 etter import.
 */
export function utledKategori(
  internnummerRaw: string,
  navn: string,
  harGyldigRegnummer: boolean,
): MaskinKategori {
  if (harGyldigRegnummer) return "kjoretoy";

  // 9XXX = leide hovedmaskiner
  if (/^9\d/.test(internnummerRaw)) return "anleggsmaskin";

  // Forsøk 4-sifret prefiks fra internnummer eller (for 0XXX) fra navn
  let nummer = parseInt(internnummerRaw, 10);
  if (
    !Number.isFinite(nummer) ||
    internnummerRaw === "0" ||
    /^0\d/.test(internnummerRaw)
  ) {
    const navnPrefiks = navn.match(/^(\d{4})\b/);
    if (navnPrefiks?.[1]) nummer = parseInt(navnPrefiks[1], 10);
  }

  if (Number.isFinite(nummer)) {
    if (nummer >= 7000 && nummer <= 7599) return "kjoretoy";
    if (nummer >= 7600 && nummer <= 7699) return "anleggsmaskin";
    if (nummer >= 7700 && nummer <= 7999) return "smautstyr";
  }

  return "smautstyr";
}

export function utledEierskap(internnummerRaw: string): MaskinEierskap {
  return /^9\d/.test(internnummerRaw) ? "leid" : "eid";
}

/** 0XXX-placeholder + tom internnummer → null. "x" filtreres allerede ute. */
function rensetInternnummer(raw: string): string | null {
  if (!raw) return null;
  if (raw === "0" || /^0\d/.test(raw)) return null;
  return raw;
}

function parseTall(verdi: string | null): number | null {
  if (!verdi) return null;
  const renset = verdi.trim().replace(/\s+/g, "").replace(",", ".");
  if (!renset) return null;
  const n = Number(renset);
  return Number.isFinite(n) ? n : null;
}

function parseHeltall(verdi: string | null): number | null {
  const n = parseTall(verdi);
  return n === null ? null : Math.round(n);
}

export async function parseSmartDokXlsx(buffer: Buffer): Promise<Parseresultat> {
  const valideringsfeil: string[] = [];
  const rader: ParsetMaskinRad[] = [];
  const filtrerte: Parseresultat["filtrerte"] = [];

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
      filtrerte: [],
      valideringsfeil: [
        `Excel-parsing feilet: ${e instanceof Error ? e.message : "ukjent feil"}`,
      ],
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rader: [], filtrerte: [], valideringsfeil: ["Filen mangler arbeidsark"] };
  }

  const headerRow = sheet.getRow(1);
  const headere: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (celle, kolonneNr) => {
    headere[kolonneNr - 1] = normaliserHeader(String(celle.value ?? ""));
  });

  const manglendePåkrevde = PÅKREVDE_KOLONNER.filter((k) => !headere.includes(k));
  if (manglendePåkrevde.length > 0) {
    return {
      rader: [],
      filtrerte: [],
      valideringsfeil: [
        `Mangler påkrevde kolonner: ${manglendePåkrevde.join(", ")}`,
      ],
    };
  }

  const idx: Record<string, number> = {};
  for (let i = 0; i < headere.length; i++) {
    if (headere[i]) idx[headere[i]!] = i + 1;
  }

  const totaltRader = sheet.rowCount;
  for (let r = 2; r <= totaltRader; r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;
    const radnummer = r - 1;

    const hent = (k: string): string | null => {
      const j = idx[k];
      if (j === undefined) return null;
      const celle = row.getCell(j);
      const verdi = celle.value;
      if (verdi === null || verdi === undefined || verdi === "") return null;
      if (typeof verdi === "object" && verdi !== null && "text" in verdi) {
        return String((verdi as { text: string }).text).trim();
      }
      return String(verdi).trim();
    };

    const navn = hent("maskin");
    const internnummerRaw = hent("internnummer") ?? "";

    if (!navn) {
      valideringsfeil.push(`Rad ${radnummer}: mangler maskin-navn`);
      continue;
    }

    // SmartDok-konvensjon: "x" som internnummer = testdata
    if (internnummerRaw.toLowerCase() === "x") {
      filtrerte.push({ radnummer, navn, grunn: "Testdata (internnummer = «x»)" });
      continue;
    }

    const regnummerRaw = (hent("reg.nr") ?? "").trim();
    const regnummerNorm = regnummerRaw ? normaliserRegnummer(regnummerRaw) : "";
    const harGyldigRegnummer = regnummerNorm
      ? erGyldigRegnummer(regnummerNorm)
      : false;

    rader.push({
      radnummer,
      navn,
      internnummerRaw,
      internnummer: rensetInternnummer(internnummerRaw),
      regnummerRaw,
      regnummer: harGyldigRegnummer ? regnummerNorm : null,
      harGyldigRegnummer,
      kategori: utledKategori(internnummerRaw, navn, harGyldigRegnummer),
      eierskap: utledEierskap(internnummerRaw),
      aarsmodell: parseHeltall(hent("årsmodell")),
      lokasjon: hent("lokasjon"),
      ansvarlig1Navn: hent("maskinansvarlig 1"),
      ansvarlig2Navn: hent("maskinansvarlig 2"),
      timetall: parseHeltall(hent("timetall")),
      kmStand: parseHeltall(hent("km.stand")),
      notat: hent("notat"),
    });
  }

  return { rader, filtrerte, valideringsfeil };
}
