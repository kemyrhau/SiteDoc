import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";

/**
 * SmartDok varekatalog-import-parser (SpreadsheetML XML).
 *
 * Filformat: `Varedetaljer.xls.xls` fra SmartDok er SpreadsheetML 2003 XML
 * (ikke binær .xls eller moderne .xlsx).
 *
 * Kolonner: Varenavn | Varenummer | Pris | Internkostnad | Antall |
 *           Varekategori | Enhet | Aktivt | Strekkode
 *
 * Filtrerings- og kategoriseringsregler er dokumentert i
 * docs/claude/steg-4b-plan.md § 7 (Fase 5).
 */

export type ParsetVareRad = {
  radnummer: number;
  navn: string;
  varenummer: string | null;
  enhet: string;
  enhetRaw: string;
  kategori: string;
  pris: number | null;
  internkostnad: number | null;
};

export type UtelattRad = {
  radnummer: number;
  navn: string;
  grunn: "ugyldig-navn" | "heatwork-utleie";
  kategori?: string;
  forventetEquipmentInternnr?: string;
};

export type Parseresultat = {
  rader: ParsetVareRad[];
  utelatte: UtelattRad[];
  kategorier: string[];
  valideringsfeil: string[];
  filhash: string;
};

const PÅKREVDE_KOLONNER = ["varenavn", "enhet", "varekategori"] as const;

const ENHET_NORMALISERING: Record<string, string> = {
  "døgn": "doegn",
  "dogn": "doegn",
  "tonn": "tonn",
  "stk": "stk",
  "sekk": "sekk",
  "meter": "meter",
  "liter": "liter",
  "kilo": "kilo",
  "kg": "kg",
  "m": "m",
  "m2": "m2",
  "m²": "m2",
  "m3": "m3",
  "m³": "m3",
  "timer": "timer",
};

export function normaliserEnhet(verdi: string): string {
  const trimmet = verdi.trim().toLowerCase();
  return ENHET_NORMALISERING[trimmet] ?? trimmet;
}

export function beregnFilHash(filinnhold: string): string {
  return createHash("sha256").update(filinnhold, "utf8").digest("hex");
}

function parseTall(verdi: unknown): number | null {
  if (verdi === null || verdi === undefined || verdi === "") return null;
  const renset = String(verdi).trim().replace(/\s+/g, "").replace(",", ".");
  if (!renset) return null;
  const n = Number(renset);
  return Number.isFinite(n) ? n : null;
}

type Celle = {
  index: number;
  type: string | null;
  value: string;
};

type CellRaw = {
  "@_ss:Index"?: string;
  Data?: string | number | { "#text"?: string | number; "@_ss:Type"?: string };
};

type RowRaw = {
  Cell?: CellRaw | CellRaw[];
};

function celleVerdi(data: CellRaw["Data"]): { value: string; type: string | null } {
  if (data === null || data === undefined) return { value: "", type: null };
  if (typeof data === "string" || typeof data === "number") {
    return { value: String(data), type: null };
  }
  const text = data["#text"];
  return {
    value: text === undefined || text === null ? "" : String(text),
    type: data["@_ss:Type"] ?? null,
  };
}

function leseRad(row: RowRaw): Celle[] {
  const celler = row.Cell;
  if (!celler) return [];
  const liste = Array.isArray(celler) ? celler : [celler];
  const ut: Celle[] = [];
  let kolonne = 0;
  for (const celle of liste) {
    const eksplisittIndex = celle["@_ss:Index"];
    if (eksplisittIndex !== undefined) {
      const n = parseInt(eksplisittIndex, 10);
      if (Number.isFinite(n)) kolonne = n;
    } else {
      kolonne += 1;
    }
    const { value, type } = celleVerdi(celle.Data);
    ut.push({ index: kolonne, type, value });
  }
  return ut;
}

/**
 * Heatwork-utleie-rader filtreres ut og opprettes manuelt som Equipment
 * (Beslutning 3 i steg-4b-plan.md). Vi forsøker å hente internnummer
 * fra navnet (eks. "7626 Heatwork 3600" → "7626") for å gi rapport.
 */
function erHeatworkUtleie(kategori: string): boolean {
  return kategori.trim().toLowerCase() === "utleie heatwork";
}

function trekkUtInternnummerFraNavn(navn: string): string | undefined {
  const treff = navn.trim().match(/^(\d{4})\b/);
  return treff?.[1];
}

export function parseSmartDokVarerXml(filinnhold: string): Parseresultat {
  const valideringsfeil: string[] = [];
  const rader: ParsetVareRad[] = [];
  const utelatte: UtelattRad[] = [];
  const kategorier = new Set<string>();
  const filhash = beregnFilHash(filinnhold);

  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
    });
    parsed = parser.parse(filinnhold);
  } catch (e) {
    return {
      rader: [],
      utelatte: [],
      kategorier: [],
      valideringsfeil: [
        `XML-parsing feilet: ${e instanceof Error ? e.message : "ukjent feil"}`,
      ],
      filhash,
    };
  }

  const workbook = (parsed as { Workbook?: { Worksheet?: unknown } }).Workbook;
  if (!workbook) {
    return {
      rader: [],
      utelatte: [],
      kategorier: [],
      valideringsfeil: ["Filen er ikke et gyldig SpreadsheetML-dokument (mangler <Workbook>)"],
      filhash,
    };
  }

  const worksheetRaw = workbook.Worksheet;
  const worksheet = Array.isArray(worksheetRaw) ? worksheetRaw[0] : worksheetRaw;
  const table = (worksheet as { Table?: { Row?: RowRaw | RowRaw[] } } | undefined)?.Table;
  if (!table?.Row) {
    return {
      rader: [],
      utelatte: [],
      kategorier: [],
      valideringsfeil: ["Filen mangler arbeidsark eller rader"],
      filhash,
    };
  }

  const rowsRaw = Array.isArray(table.Row) ? table.Row : [table.Row];
  if (rowsRaw.length < 2) {
    return {
      rader: [],
      utelatte: [],
      kategorier: [],
      valideringsfeil: ["Filen inneholder ingen datarader"],
      filhash,
    };
  }

  // Header-rad
  const headerCeller = leseRad(rowsRaw[0]!);
  const kolonneIndex: Record<string, number> = {};
  for (const c of headerCeller) {
    const navn = c.value.trim().toLowerCase();
    if (navn) kolonneIndex[navn] = c.index;
  }

  const manglende = PÅKREVDE_KOLONNER.filter((k) => kolonneIndex[k] === undefined);
  if (manglende.length > 0) {
    return {
      rader: [],
      utelatte: [],
      kategorier: [],
      valideringsfeil: [`Mangler påkrevde kolonner: ${manglende.join(", ")}`],
      filhash,
    };
  }

  for (let r = 1; r < rowsRaw.length; r++) {
    const radnummer = r;
    const celler = leseRad(rowsRaw[r]!);
    const kart = new Map<number, string>();
    for (const c of celler) kart.set(c.index, c.value);

    const hent = (kolonne: keyof typeof kolonneIndex | string): string => {
      const idx = kolonneIndex[String(kolonne)];
      if (idx === undefined) return "";
      return (kart.get(idx) ?? "").trim();
    };

    const navn = hent("varenavn");
    if (!navn) continue; // helt tom rad — hopp over uten varsel
    if (navn === ".") {
      utelatte.push({ radnummer, navn, grunn: "ugyldig-navn" });
      continue;
    }

    const kategoriRaw = hent("varekategori");
    if (!kategoriRaw) {
      valideringsfeil.push(`Rad ${radnummer} «${navn}»: mangler varekategori`);
      continue;
    }

    if (erHeatworkUtleie(kategoriRaw)) {
      utelatte.push({
        radnummer,
        navn,
        grunn: "heatwork-utleie",
        kategori: kategoriRaw,
        forventetEquipmentInternnr: trekkUtInternnummerFraNavn(navn),
      });
      continue;
    }

    const enhetRaw = hent("enhet");
    if (!enhetRaw) {
      valideringsfeil.push(`Rad ${radnummer} «${navn}»: mangler enhet`);
      continue;
    }

    const varenummerRaw = hent("varenummer");
    const varenummer = varenummerRaw === "" ? null : varenummerRaw;

    const pris = parseTall(hent("pris"));
    const internkostnad = parseTall(hent("internkostnad"));

    kategorier.add(kategoriRaw);
    rader.push({
      radnummer,
      navn,
      varenummer,
      enhet: normaliserEnhet(enhetRaw),
      enhetRaw,
      kategori: kategoriRaw,
      pris: pris === 0 ? null : pris, // 0 = "ikke satt" i SmartDok-eksport
      internkostnad,
    });
  }

  return {
    rader,
    utelatte,
    kategorier: Array.from(kategorier).sort(),
    valideringsfeil,
    filhash,
  };
}
