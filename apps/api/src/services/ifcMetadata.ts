/**
 * IFC-metadatautvinning
 *
 * Parser IFC-filer (STEP-format) og trekker ut:
 * - Prosjektnavn, beskrivelse, fase (IFCPROJECT)
 * - Organisasjon/forfatter (IFCORGANIZATION, FILE_NAME)
 * - GPS-koordinater (IFCSITE)
 * - Bygning (IFCBUILDING)
 * - Etasjer med høyder (IFCBUILDINGSTOREY)
 * - Forfatterprogram og tidsstempel (FILE_NAME)
 */

import { readFile } from "fs/promises";

export interface IfcEtasje {
  navn: string;
  høyde: number | null;
}

export interface IfcMetadata {
  prosjektnavn: string | null;
  prosjektbeskrivelse: string | null;
  fase: string | null;
  organisasjon: string | null;
  forfatter: string | null;
  programvare: string | null;
  tidsstempel: string | null;
  gpsBreddegrad: number | null;
  gpsLengdegrad: number | null;
  gpsHøyde: number | null;
  bygningNavn: string | null;
  etasjer: IfcEtasje[];
  fagdisiplin: string | null;
  originalFilnavn: string | null;
}

/**
 * Konverter IFC DMS-koordinater (grader, minutter, sekunder, milliondeler)
 * til desimalgrader. IFC lagrer GPS som (grad, min, sek, milliondeler-av-sek).
 */
function dmsTilDesimal(grad: number, min: number, sek: number, mikro: number): number {
  return grad + min / 60 + (sek + mikro / 1_000_000) / 3600;
}

/**
 * Dekod IFC-encoded streng (f.eks. \X\F8 → ø, \X2\00E6\X0\ → æ)
 */
function dekodIfcStreng(s: string): string {
  // \X\HH — enkelt-byte ISO 8859-1
  let resultat = s.replace(/\\X\\([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  // \X2\HHHH...\X0\ — dobbelt-byte Unicode
  resultat = resultat.replace(/\\X2\\((?:[0-9A-Fa-f]{4})+)\\X0\\/g, (_m, hex: string) => {
    let tekst = "";
    for (let i = 0; i < hex.length; i += 4) {
      tekst += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
    }
    return tekst;
  });
  // \S\c — Latin supplement (ISO 8859-1, offset 128)
  resultat = resultat.replace(/\\S\\(.)/g, (_m, c: string) =>
    String.fromCharCode(c.charCodeAt(0) + 128)
  );
  return resultat;
}

/**
 * Rens IFC-strengverdi (fjern enkle anførselstegn, dekod, trim)
 */
function rensStreng(s: string | undefined): string | null {
  if (!s) return null;
  let renset = s.replace(/^'|'$/g, "").trim();
  if (!renset || renset === "$" || renset === "''" || renset === "''") return null;
  renset = dekodIfcStreng(renset);
  // Fjern delte backslash-escaping fra filstier
  renset = renset.replace(/\\\\/g, "\\");
  return renset;
}

/**
 * Gjett fagdisiplin fra filnavn
 */
function gjettDisiplin(filnavn: string): string | null {
  const øvre = filnavn.toUpperCase();
  // Bruk separator-bevisste mønstre (-, _, ., mellomrom, start/slutt)
  const sep = "(?:^|[-_. ])";
  const end = "(?:[-_. ]|$)";
  const mønster: [RegExp, string][] = [
    [new RegExp(sep + "IARK" + end), "IARK"],
    [new RegExp(sep + "LARK" + end), "LARK"],
    [new RegExp(sep + "ARK" + end), "ARK"],
    [new RegExp(sep + "RIVA" + end), "RIV"],
    [new RegExp(sep + "RIBr" + end, "i"), "RIBr"],
    [new RegExp(sep + "RIB" + end), "RIB"],
    [new RegExp(sep + "RIV" + end), "RIV"],
    [new RegExp(sep + "RIE" + end), "RIE"],
    [new RegExp(sep + "RIG" + end), "RIG"],
    [new RegExp(sep + "RIAku" + end, "i"), "RIAku"],
  ];
  for (const [re, disiplin] of mønster) {
    if (re.test(øvre)) return disiplin;
  }
  return null;
}

/**
 * Trekk ut metadata fra en IFC-fil.
 * Leser kun header + de første ~5000 linjene for ytelse (metadata er alltid i starten).
 */
export async function trekUtIfcMetadata(filsti: string, filnavn: string): Promise<IfcMetadata> {
  const innhold = await readFile(filsti, "utf-8");

  const metadata: IfcMetadata = {
    prosjektnavn: null,
    prosjektbeskrivelse: null,
    fase: null,
    organisasjon: null,
    forfatter: null,
    programvare: null,
    tidsstempel: null,
    gpsBreddegrad: null,
    gpsLengdegrad: null,
    gpsHøyde: null,
    bygningNavn: null,
    etasjer: [],
    fagdisiplin: gjettDisiplin(filnavn),
    originalFilnavn: filnavn,
  };

  // === FILE_NAME (i HEADER-seksjonen) ===
  // FILE_NAME('path','2024-05-15T12:00:00','author','org','preprocessor','software','');
  const fileNameMatch = innhold.match(
    /FILE_NAME\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*\(([^)]*)\)\s*,\s*\(([^)]*)\)\s*,\s*'([^']*)'\s*,\s*'([^']*)'/
  );
  if (fileNameMatch) {
    metadata.originalFilnavn = rensStreng(fileNameMatch[1] ?? "") ?? filnavn;
    metadata.tidsstempel = rensStreng(fileNameMatch[2] ?? "");
    // Forfatter er en liste — ta første element
    const forfattere = (fileNameMatch[3] ?? "").split(",").map((s) => rensStreng(s)).filter((s): s is string => s !== null);
    if (forfattere.length > 0) metadata.forfatter = forfattere[0] ?? null;
    // Organisasjon
    const orgs = (fileNameMatch[4] ?? "").split(",").map((s) => rensStreng(s)).filter((s): s is string => s !== null);
    if (orgs.length > 0) metadata.organisasjon = orgs[0] ?? null;
    metadata.programvare = rensStreng(fileNameMatch[6] ?? "");
  }

  // === IFCPROJECT ===
  // #123=IFCPROJECT('guid',$,'Prosjektnavn','Beskrivelse',...);
  const prosjektMatch = innhold.match(
    /IFCPROJECT\s*\(\s*'[^']*'\s*,\s*[^,]*,\s*'([^']*)'\s*,\s*'?([^',)]*)'?/
  );
  if (prosjektMatch) {
    metadata.prosjektnavn = rensStreng(prosjektMatch[1]);
    metadata.prosjektbeskrivelse = rensStreng(prosjektMatch[2]);
  }

  // === IFCORGANIZATION ===
  // Overstyr FILE_NAME-organisasjon med IFCORGANIZATION (mer pålitelig)
  const orgMatches = innhold.matchAll(
    /IFCORGANIZATION\s*\(\s*'?([^',)]*)'?\s*,\s*'([^']*)'/g
  );
  for (const m of orgMatches) {
    const orgNavn = rensStreng(m[2]);
    // Filtrer ut generiske software-navn og plassholdere
    if (orgNavn && orgNavn !== "-" && !/^autodesk|graphisoft|bentley|trimble|nemetschek|structural designer$/i.test(orgNavn)) {
      metadata.organisasjon = orgNavn;
      break;
    }
  }

  // === IFCSITE (GPS-koordinater i DMS) ===
  // IFCSITE('guid',#2,'Tomten',$,$,#5687,$,$,.ELEMENT.,(59,55,52,428000),(10,42,27,972000),0.,'',#5726);
  const siteMatch = innhold.match(
    /IFCSITE\s*\([^;]*?\.ELEMENT\.\s*,\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)\s*,\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)\s*,\s*([\d.eE+-]+)/
  );
  if (siteMatch) {
    metadata.gpsBreddegrad = dmsTilDesimal(
      parseInt(siteMatch[1] ?? "0"), parseInt(siteMatch[2] ?? "0"),
      parseInt(siteMatch[3] ?? "0"), parseInt(siteMatch[4] ?? "0")
    );
    metadata.gpsLengdegrad = dmsTilDesimal(
      parseInt(siteMatch[5] ?? "0"), parseInt(siteMatch[6] ?? "0"),
      parseInt(siteMatch[7] ?? "0"), parseInt(siteMatch[8] ?? "0")
    );
    metadata.gpsHøyde = parseFloat(siteMatch[9] ?? "0") || null;
  }

  // === IFCBUILDING ===
  const bygningMatch = innhold.match(
    /IFCBUILDING\s*\(\s*'[^']*'\s*,\s*[^,]*,\s*'([^']*)'/
  );
  if (bygningMatch) {
    metadata.bygningNavn = rensStreng(bygningMatch[1]);
  }

  // === IFCBUILDINGSTOREY (etasjer) ===
  const etasjeMatches = innhold.matchAll(
    /IFCBUILDINGSTOREY\s*\(\s*'[^']*'\s*,\s*[^,]*,\s*'([^']*)'\s*,[^;]*?\.ELEMENT\.\s*,\s*([\d.eE+-]+)/g
  );
  const sett = new Set<string>();
  for (const m of etasjeMatches) {
    const navn = rensStreng(m[1]);
    if (navn && !sett.has(navn)) {
      sett.add(navn);
      const høyde = parseFloat(m[2] ?? "");
      metadata.etasjer.push({ navn, høyde: isNaN(høyde) ? null : høyde });
    }
  }
  // Sorter etasjer etter høyde
  metadata.etasjer.sort((a, b) => (a.høyde ?? -999) - (b.høyde ?? -999));

  // === Fase (fra IFCPROJECT description eller IfcPropertySingleValue) ===
  const faseMatch = innhold.match(
    /IFCPROPERTYSINGLEVALUE\s*\(\s*'(?:Phase|Fase|CurrentPhase)'\s*,[^,]*,\s*IFCLABEL\s*\(\s*'([^']*)'/i
  );
  if (faseMatch) {
    metadata.fase = rensStreng(faseMatch[1]);
  }
  // Fallback: sjekk om prosjektbeskrivelse inneholder fase-info
  if (!metadata.fase && metadata.prosjektbeskrivelse) {
    const faseMønster = /(?:Detaljprosjekt|Forprosjekt|Prosjekteringsunderlag|Anbudsdokument|Arbeidstegning)/i;
    const fm = metadata.prosjektbeskrivelse.match(faseMønster);
    if (fm) metadata.fase = fm[0];
  }

  return metadata;
}
