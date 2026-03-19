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
  updatedAt?: Date | string;
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
  changeLog?: Array<{ createdAt: Date | string; user: { name: string | null } }>;
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

function fullUrl(url: string, apiUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${apiUrl}${url}`;
  return url;
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
    return `<div class="heading">${esc(label)}</div>`;
  }
  if (type === "subtitle") {
    return `<div class="subtitle">${esc(label)}</div>`;
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
        return `<div class="repeater-celle">${repeaterHtml}</div>`;
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

  // Bilder og filer
  const bilder = (felt?.vedlegg ?? []).filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn));
  const filer = (felt?.vedlegg ?? []).filter((v) => !bilder.includes(v));
  const harBilder = bilder.length > 0;

  // Ny layout: label øverst → bilder (2 i bredden, nummerert) → tekst/verdi → kommentar
  let html = `<div class="felt-blokk">`;
  html += `<div class="felt-label">${esc(label)}</div>`;

  // Bilder i 2-kolonners rutenett med nummerering
  if (harBilder) {
    html += `<div class="bilde-rutenett">`;
    bilder.forEach((b, idx) => {
      const src = fullUrl(b.url, apiUrl);
      const nr = idx + 1;
      html += `<div class="bilde-kort">`;
      html += `<img src="${esc(src)}" class="bilde-img" />`;
      html += `<div class="bilde-nr">${nr}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // Verdi/tekst
  if (verdiHtml) {
    html += `<div class="felt-verdi">${verdiHtml}</div>`;
  }

  // Kommentar
  if (felt?.kommentar) {
    html += `<div class="kommentar">${esc(felt.kommentar)}</div>`;
  }

  // Fil-vedlegg
  if (filer.length > 0) {
    html += `<div class="vedlegg-teller">📎 ${filer.length} fil${filer.length > 1 ? "er" : ""}</div>`;
  }

  html += `</div>`;
  return html;
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

  // Opprettet dato+tid
  const opprettetDatoTid = sjekkliste.createdAt
    ? new Date(sjekkliste.createdAt).toLocaleString("nb-NO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  // Endret dato+tid
  const endretDatoTid = sjekkliste.updatedAt
    ? new Date(sjekkliste.updatedAt).toLocaleString("nb-NO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  // Endret av — siste endringslogg-oppføring
  const sisteEndring = sjekkliste.changeLog && sjekkliste.changeLog.length > 0
    ? sjekkliste.changeLog[0]
    : null;
  const endretAv = sisteEndring?.user?.name ?? "";

  // Prosjektnummer
  const prosjektNr = prosjekt?.projectNumber ?? "";

  // Bygning
  const bygningNavn = sjekkliste.building?.name ?? "";

  // Opprettet av
  const opprettetAv = sjekkliste.creator?.name ?? "";

  // Status
  const statusTekst = STATUS_TEKST[sjekkliste.status] ?? sjekkliste.status;
  const statusFarge = STATUS_FARGE[sjekkliste.status] ?? "background:#e5e7eb;color:#374151;";

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

  /* Tittel */
  .doc-tittel {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 10px;
  }

  /* Metadata-rutenett — 4 kolonner */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .meta-celle {
    padding: 5px 8px;
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
  }
  .meta-celle:nth-child(4n) { border-right: none; }
  .meta-celle:nth-last-child(-n+4) { border-bottom: none; }
  .meta-etikett { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; }
  .meta-verdi { font-size: 10px; color: #111827; margin-top: 1px; }
  .status-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    ${statusFarge}
  }

  /* Felt-blokker */
  .felter { }
  .felt-blokk {
    border-bottom: 1px solid #e5e7eb;
    padding: 8px 0;
  }
  .felt-label {
    font-size: 10px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
  }
  .felt-verdi {
    font-size: 10px;
    color: #111827;
    margin-top: 4px;
  }

  .heading {
    background: #f3f4f6;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 8px;
    color: #111827;
    border-bottom: 2px solid #d1d5db;
    margin-top: 6px;
  }
  .subtitle {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    padding: 5px 8px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .tom { color: #d1d5db; font-style: italic; }
  .tekst-verdi { white-space: pre-wrap; }
  .kommentar { margin-top: 4px; font-size: 9px; font-style: italic; color: #6b7280; }
  .vedlegg-teller { margin-top: 4px; font-size: 9px; color: #9ca3af; }

  /* Trafikklys */
  .trafikklys {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
  }

  /* Bilde-rutenett — 2 kolonner med nummerering */
  .bilde-rutenett {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 6px 0;
  }
  .bilde-kort {
    position: relative;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }
  .bilde-img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
    max-height: 200px;
  }
  .bilde-nr {
    position: absolute;
    top: 4px;
    left: 4px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
  }

  /* Repeater */
  .repeater-celle { padding: 4px 0; }
  .repeater-rad {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 4px;
  }
  .repeater-nr { font-size: 9px; font-weight: 600; color: #9ca3af; margin-bottom: 2px; }

  /* Signatur */
  img { max-width: 100%; }
</style>
</head>
<body>

<!-- Tittel med logo -->
<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
  ${prosjekt?.logoUrl ? `<img src="${esc(prosjekt.logoUrl)}" style="max-height:48px;max-width:120px;object-fit:contain;" />` : ""}
  <div class="doc-tittel">${esc(sjekkliste.title)}</div>
</div>

<!-- Metadata-rutenett 4×2 -->
<div class="meta-grid">
  <div class="meta-celle">
    <div class="meta-etikett">Prosjekt</div>
    <div class="meta-verdi">${esc(prosjekt?.name ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Prosjekt nr</div>
    <div class="meta-verdi">${esc(prosjektNr)}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Bygning</div>
    <div class="meta-verdi">${esc(bygningNavn)}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Opprettet av</div>
    <div class="meta-verdi">${esc(opprettetAv)}</div>
  </div>

  <div class="meta-celle">
    <div class="meta-etikett">Opprettet</div>
    <div class="meta-verdi">${esc(opprettetDatoTid)}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Endret av</div>
    <div class="meta-verdi">${esc(endretAv)}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Endret</div>
    <div class="meta-verdi">${esc(endretDatoTid)}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Status</div>
    <div class="meta-verdi"><span class="status-badge">${esc(statusTekst)}</span></div>
  </div>
</div>

<!-- Felter -->
<div class="felter">
${feltHtml}
</div>

</body>
</html>`;
}
