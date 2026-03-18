/**
 * Genererer HTML for sjekkliste-PDF.
 * Strukturen speiler web-utskriftssiden (apps/web/src/app/utskrift/sjekkliste/).
 * Brukes med expo-print for å lage PDF som kan deles via e-post.
 */

// ---------------------------------------------------------------------------
//  Typer
// ---------------------------------------------------------------------------

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
}

interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
}

interface FeltVerdi {
  verdi: unknown;
  kommentar: string;
  vedlegg: Array<{ id: string; type: string; url: string; filnavn: string }>;
}

interface SjekklisteForPdf {
  title: string;
  status: string;
  number?: number | null;
  createdAt?: Date | string;
  template: {
    name: string;
    prefix?: string | null;
    objects: RapportObjekt[];
  };
  creator?: { name?: string | null } | null;
  creatorEnterprise?: { name: string } | null;
  responderEnterprise?: { name: string } | null;
  building?: { name: string } | null;
  drawing?: { name: string; drawingNumber?: string | null } | null;
}

interface ProsjektForPdf {
  name: string;
  projectNumber?: string | null;
  externalProjectNumber?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

// ---------------------------------------------------------------------------
//  Konstanter
// ---------------------------------------------------------------------------

const STATUS_TEKST: Record<string, string> = {
  draft: "Utkast",
  submitted: "Innsendt",
  received: "Mottatt",
  in_progress: "Under behandling",
  completed: "Ferdig",
  approved: "Godkjent",
  rejected: "Avvist",
  cancelled: "Avbrutt",
};

const STATUS_FARGE: Record<string, string> = {
  draft: "background:#e5e7eb;color:#374151;",
  submitted: "background:#dbeafe;color:#1e40af;",
  received: "background:#dbeafe;color:#1e40af;",
  in_progress: "background:#fef3c7;color:#92400e;",
  completed: "background:#d1fae5;color:#065f46;",
  approved: "background:#d1fae5;color:#065f46;",
  rejected: "background:#fee2e2;color:#991b1b;",
  cancelled: "background:#f3f4f6;color:#6b7280;",
};

const TRAFIKKLYS: Record<string, { label: string; farge: string }> = {
  green: { label: "Godkjent", farge: "#10b981" },
  yellow: { label: "Anmerkning", farge: "#f59e0b" },
  red: { label: "Avvik", farge: "#ef4444" },
};

// ---------------------------------------------------------------------------
//  Hjelpefunksjoner
// ---------------------------------------------------------------------------

function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normaliserOpsjon(raw: unknown): { value: string; label: string } {
  if (typeof raw === "string") return { value: raw, label: raw };
  if (raw && typeof raw === "object" && "value" in raw) {
    const o = raw as { value: string; label?: string };
    return { value: o.value, label: o.label ?? o.value };
  }
  return { value: String(raw), label: String(raw) };
}

function formaterDato(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
  } catch { return String(v); }
}

function formaterDatoTid(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleString("nb-NO", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(v); }
}

// ---------------------------------------------------------------------------
//  Felt-rendering (én rad i tabellen)
// ---------------------------------------------------------------------------

function renderFelt(
  objekt: RapportObjekt,
  felt: FeltVerdi | undefined,
  apiUrl: string,
): string {
  const { type, label, config } = objekt;
  const verdi = felt?.verdi;
  const tom = verdi === null || verdi === undefined || verdi === "";

  // Overskrift
  if (type === "heading") {
    return `<tr class="heading"><td colspan="2">${esc(label)}</td></tr>`;
  }
  if (type === "subtitle") {
    return `<tr class="subtitle"><td colspan="2">${esc(label)}</td></tr>`;
  }
  // Skjul display-only/spesialtyper
  if (type === "location" || type === "attachments") return "";

  let verdiHtml = "";

  switch (type) {
    case "text_field":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : `<span class="tekst-verdi">${esc(String(verdi))}</span>`;
      break;

    case "list_single": {
      const opsjoner = ((config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgt = typeof verdi === "string" ? opsjoner.find((o) => o.value === verdi)?.label ?? verdi : null;
      verdiHtml = valgt ? esc(valgt) : `<span class="tom">Ikke utfylt</span>`;
      break;
    }
    case "list_multi": {
      const opsjoner = ((config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgte = Array.isArray(verdi)
        ? (verdi as string[]).map((v) => opsjoner.find((o) => o.value === v)?.label ?? v)
        : [];
      verdiHtml = valgte.length > 0 ? esc(valgte.join(", ")) : `<span class="tom">Ikke utfylt</span>`;
      break;
    }
    case "traffic_light": {
      const tl = typeof verdi === "string" ? TRAFIKKLYS[verdi] : null;
      if (tl) {
        verdiHtml = `<span class="trafikklys" style="background:${tl.farge};"></span> ${esc(tl.label)}`;
      } else {
        verdiHtml = `<span class="tom">Ikke utfylt</span>`;
      }
      break;
    }
    case "integer":
    case "decimal":
    case "calculation": {
      const enhet = (config.unit as string) ?? "";
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(`${verdi}${enhet ? ` ${enhet}` : ""}`);
      break;
    }
    case "date":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(formaterDato(verdi));
      break;
    case "date_time":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(formaterDatoTid(verdi));
      break;

    case "person":
    case "company":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(String(verdi));
      break;
    case "persons":
      verdiHtml = Array.isArray(verdi) && verdi.length > 0
        ? esc((verdi as string[]).join(", "))
        : `<span class="tom">Ikke utfylt</span>`;
      break;

    case "weather": {
      const v = (verdi as VaerVerdi) ?? {};
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      if (v.precipitation && v.precipitation !== "0 mm") deler.push(`Nedbør ${v.precipitation}`);
      verdiHtml = deler.length > 0 ? esc(deler.join(", ")) : `<span class="tom">Ingen værdata</span>`;
      break;
    }
    case "signature":
      if (typeof verdi === "string" && verdi.startsWith("data:")) {
        verdiHtml = `<img src="${verdi}" style="max-height:60px;" />`;
      } else {
        verdiHtml = `<span class="tom">Ikke signert</span>`;
      }
      break;

    case "repeater": {
      const rader = Array.isArray(verdi) ? (verdi as Record<string, FeltVerdi>[]) : [];
      if (rader.length === 0) {
        verdiHtml = `<span class="tom">Ingen rader</span>`;
      } else {
        // Barn-objekter av repeateren
        const barn = objekt.config._barnObjekter as RapportObjekt[] | undefined;
        let repeaterHtml = "";
        rader.forEach((rad, idx) => {
          repeaterHtml += `<div class="repeater-rad"><div class="repeater-nr">${idx + 1}. ${esc(label)}</div>`;
          if (barn) {
            for (const b of barn) {
              const bFelt = rad[b.id] as FeltVerdi | undefined;
              repeaterHtml += renderFelt(b, bFelt, apiUrl);
            }
          }
          repeaterHtml += `</div>`;
        });
        return `<tr><td colspan="2" class="repeater-celle">${repeaterHtml}</td></tr>`;
      }
      break;
    }
    case "bim_property":
    case "zone_property":
    case "room_property":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(String(verdi));
      break;

    default:
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(typeof verdi === "object" ? JSON.stringify(verdi) : String(verdi));
  }

  // Kommentar
  let ekstra = "";
  if (felt?.kommentar) {
    ekstra += `<div class="kommentar">${esc(felt.kommentar)}</div>`;
  }
  // Vedlegg-indikatorer
  if (felt?.vedlegg && felt.vedlegg.length > 0) {
    const bildeAntall = felt.vedlegg.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn)).length;
    const filAntall = felt.vedlegg.length - bildeAntall;
    const deler: string[] = [];
    if (bildeAntall > 0) deler.push(`${bildeAntall} bilde${bildeAntall > 1 ? "r" : ""}`);
    if (filAntall > 0) deler.push(`${filAntall} fil${filAntall > 1 ? "er" : ""}`);
    ekstra += `<div class="vedlegg-teller">📎 ${deler.join(", ")}</div>`;
  }

  return `<tr><td class="label">${esc(label)}</td><td class="verdi">${verdiHtml}${ekstra}</td></tr>`;
}

// ---------------------------------------------------------------------------
//  Hovedfunksjon — genererer komplett HTML
// ---------------------------------------------------------------------------

export function byggSjekklisteHtml(
  sjekkliste: SjekklisteForPdf,
  feltVerdier: Record<string, FeltVerdi>,
  prosjekt?: ProsjektForPdf | null,
  apiUrl?: string,
): string {
  const baseUrl = apiUrl ?? "";
  const dato = new Date().toLocaleDateString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  // Sjekkliste-nummer
  const nummer = sjekkliste.number != null && sjekkliste.template.prefix
    ? `${sjekkliste.template.prefix}-${String(sjekkliste.number).padStart(3, "0")}`
    : sjekkliste.number != null
      ? String(sjekkliste.number).padStart(3, "0")
      : null;

  // Opprettet-dato
  const opprettetDato = sjekkliste.createdAt
    ? new Date(sjekkliste.createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  // Vær-tekst fra feltverdier
  const vaerObjekt = sjekkliste.template.objects.find((o) => o.type === "weather");
  let vaerTekst: string | null = null;
  if (vaerObjekt) {
    const v = feltVerdier[vaerObjekt.id]?.verdi as VaerVerdi | null;
    if (v) {
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      if (v.precipitation && v.precipitation !== "0 mm") deler.push(`Nedbør ${v.precipitation}`);
      vaerTekst = deler.length > 0 ? deler.join(", ") : null;
    }
  }

  // Sorter og filtrer toppnivå-objekter
  const toppObjekter = sjekkliste.template.objects
    .filter((o) => !o.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Bygg barn-map for repeatere
  const barnMap = new Map<string, RapportObjekt[]>();
  for (const obj of sjekkliste.template.objects) {
    if (obj.parentId) {
      const liste = barnMap.get(obj.parentId) ?? [];
      liste.push(obj);
      barnMap.set(obj.parentId, liste);
    }
  }

  // Legg barn inn i repeater-config for rendering
  for (const obj of toppObjekter) {
    if (obj.type === "repeater") {
      const barn = barnMap.get(obj.id) ?? [];
      barn.sort((a, b) => a.sortOrder - b.sortOrder);
      obj.config._barnObjekter = barn as unknown as Record<string, unknown>[];
    }
  }

  // Render felter
  let feltHtml = "";
  for (const objekt of toppObjekter) {
    feltHtml += renderFelt(objekt, feltVerdier[objekt.id], baseUrl);
  }

  // Prosjektnumre
  const prosjektNumre: string[] = [];
  if (prosjekt?.projectNumber) prosjektNumre.push(`Prosjektnr: ${esc(prosjekt.projectNumber)}`);
  if (prosjekt?.externalProjectNumber) prosjektNumre.push(`Ekst: ${esc(prosjekt.externalProjectNumber)}`);

  // Entreprise-linje
  const entrepriseDeler: string[] = [];
  if (sjekkliste.creatorEnterprise) {
    let tekst = `Oppretter: ${esc(sjekkliste.creatorEnterprise.name)}`;
    if (sjekkliste.creator?.name) tekst += ` (${esc(sjekkliste.creator.name)})`;
    entrepriseDeler.push(tekst);
  }
  if (sjekkliste.responderEnterprise) {
    entrepriseDeler.push(`Svarer: ${esc(sjekkliste.responderEnterprise.name)}`);
  }

  // Lokasjon
  const lokasjonDeler: string[] = [];
  if (sjekkliste.building) lokasjonDeler.push(`Lokasjon: ${esc(sjekkliste.building.name)}`);
  if (sjekkliste.drawing) {
    const tNr = sjekkliste.drawing.drawingNumber ? `${sjekkliste.drawing.drawingNumber} ` : "";
    lokasjonDeler.push(`Tegning: ${esc(tNr + sjekkliste.drawing.name)}`);
  }

  const statusTekst = STATUS_TEKST[sjekkliste.status] ?? sjekkliste.status;
  const statusFarge = STATUS_FARGE[sjekkliste.status] ?? "background:#e5e7eb;color:#374151;";

  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @page { margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
    line-height: 1.4;
  }

  /* Header-tabell */
  .header { border: 1px solid #d1d5db; border-radius: 4px; margin-bottom: 12px; overflow: hidden; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 12px; border-bottom: 1px solid #d1d5db; }
  .header-row:last-child { border-bottom: none; }
  .prosjekt-navn { font-size: 13px; font-weight: 700; color: #111827; }
  .meta { font-size: 9px; color: #6b7280; margin-top: 1px; }
  .tittel { font-size: 12px; font-weight: 600; color: #111827; }
  .nummer { font-size: 10px; font-weight: 600; color: #374151; }
  .status {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    ${statusFarge}
  }

  /* Felttabell */
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #e5e7eb; }
  td { padding: 5px 8px; vertical-align: top; }
  td.label { width: 38%; font-weight: 500; color: #374151; font-size: 10px; }
  td.verdi { width: 62%; color: #111827; font-size: 10px; }
  tr.heading td {
    background: #f3f4f6;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 8px;
    color: #111827;
    border-bottom: 2px solid #d1d5db;
  }
  tr.subtitle td {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    padding: 5px 8px;
    background: #f9fafb;
  }

  .tom { color: #d1d5db; font-style: italic; }
  .tekst-verdi { white-space: pre-wrap; }
  .kommentar { margin-top: 2px; font-size: 9px; font-style: italic; color: #6b7280; }
  .vedlegg-teller { margin-top: 2px; font-size: 9px; color: #9ca3af; }

  /* Trafikklys */
  .trafikklys {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
  }

  /* Repeater */
  .repeater-celle { padding: 4px 0; }
  .repeater-rad {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 4px;
  }
  .repeater-rad table { margin-top: 2px; }
  .repeater-nr { font-size: 9px; font-weight: 600; color: #9ca3af; margin-bottom: 2px; }

  /* Signatur */
  img { max-width: 100%; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <!-- Rad 1: Prosjekt -->
  <div class="header-row">
    <div>
      <div class="prosjekt-navn">${esc(prosjekt?.name ?? "")}</div>
      ${prosjektNumre.length > 0 ? `<div class="meta">${prosjektNumre.join(" · ")}</div>` : ""}
      ${prosjekt?.address ? `<div class="meta">Adresse: ${esc(prosjekt.address)}</div>` : ""}
      ${lokasjonDeler.length > 0 ? `<div class="meta">${lokasjonDeler.join(" · ")}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div class="meta">Utskrift: ${dato}</div>
      ${opprettetDato ? `<div class="meta">Opprettet: ${opprettetDato}</div>` : ""}
    </div>
  </div>

  <!-- Rad 2: Sjekkliste -->
  <div class="header-row">
    <div>
      <div class="tittel">${esc(sjekkliste.title)}</div>
      ${entrepriseDeler.length > 0 ? `<div class="meta">${entrepriseDeler.join(" · ")}</div>` : ""}
    </div>
    <div style="text-align:right;">
      ${nummer ? `<div class="nummer">${esc(nummer)}</div>` : ""}
      <span class="status">${esc(statusTekst)}</span>
    </div>
  </div>

  <!-- Rad 3: Vær (valgfritt) -->
  ${vaerTekst ? `<div class="header-row"><div class="meta">Vær: ${esc(vaerTekst)}</div></div>` : ""}
</div>

<!-- Felter -->
<table>
${feltHtml}
</table>

</body>
</html>`;
}
