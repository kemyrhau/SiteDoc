/**
 * Genererer HTML for sjekkliste-PDF.
 * Brukes med expo-print for å lage PDF som kan deles via e-post.
 */

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
  template: {
    name: string;
    prefix?: string | null;
    objects: RapportObjekt[];
  };
  creatorEnterprise?: { name: string } | null;
  responderEnterprise?: { name: string } | null;
  building?: { name: string } | null;
  drawing?: { name: string; drawingNumber?: string | null } | null;
}

interface ProsjektForPdf {
  name: string;
  projectNumber?: string | null;
  address?: string | null;
}

const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

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

function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formaterVerdi(verdi: unknown, type: string, config: Record<string, unknown>): string {
  if (verdi === null || verdi === undefined || verdi === "") return "—";

  switch (type) {
    case "date": {
      if (typeof verdi !== "string") return String(verdi);
      const d = new Date(verdi);
      return d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
    }
    case "date_time": {
      if (typeof verdi !== "string") return String(verdi);
      const d = new Date(verdi);
      return d.toLocaleDateString("nb-NO", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    }
    case "traffic_light": {
      const farger: Record<string, string> = { green: "Grønn", yellow: "Gul", red: "Rød" };
      return farger[verdi as string] ?? String(verdi);
    }
    case "list_multi":
    case "persons":
      return Array.isArray(verdi) ? verdi.join(", ") : String(verdi);
    case "weather": {
      const v = verdi as VaerVerdi;
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      if (v.precipitation && v.precipitation !== "0 mm") deler.push(`Nedbør ${v.precipitation}`);
      return deler.join(", ") || "—";
    }
    case "integer":
    case "decimal": {
      const enhet = config.unit as string | undefined;
      return enhet ? `${verdi} ${enhet}` : String(verdi);
    }
    case "signature":
      return typeof verdi === "string" && verdi.startsWith("data:") ? "[Signatur]" : "—";
    default:
      return typeof verdi === "object" ? JSON.stringify(verdi) : String(verdi);
  }
}

export function byggSjekklisteHtml(
  sjekkliste: SjekklisteForPdf,
  feltVerdier: Record<string, FeltVerdi>,
  prosjekt?: ProsjektForPdf | null,
): string {
  const dato = new Date().toLocaleDateString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const nummer = sjekkliste.number != null && sjekkliste.template.prefix
    ? `${sjekkliste.template.prefix}-${String(sjekkliste.number).padStart(3, "0")}`
    : null;

  // Filtrer toppnivå-objekter (ikke repeater-barn)
  const objekter = sjekkliste.template.objects
    .filter((o) => !o.parentId || sjekkliste.template.objects.find((p) => p.id === o.parentId)?.type === "repeater" ? false : true)
    .filter((o) => !o.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let raderHtml = "";

  for (const objekt of objekter) {
    if (objekt.type === "heading") {
      raderHtml += `<tr class="heading"><td colspan="2">${escapeHtml(objekt.label)}</td></tr>`;
      continue;
    }
    if (objekt.type === "subtitle") {
      raderHtml += `<tr class="subtitle"><td colspan="2">${escapeHtml(objekt.label)}</td></tr>`;
      continue;
    }
    if (objekt.type === "location") continue;
    if (DISPLAY_TYPER.has(objekt.type)) continue;

    const felt = feltVerdier[objekt.id];
    const verdiTekst = felt ? formaterVerdi(felt.verdi, objekt.type, objekt.config) : "—";

    let ekstra = "";
    if (felt?.kommentar) {
      ekstra += `<div class="kommentar">${escapeHtml(felt.kommentar)}</div>`;
    }

    // Trafikklys-farge
    let fargePrikk = "";
    if (objekt.type === "traffic_light" && typeof felt?.verdi === "string") {
      const css: Record<string, string> = { green: "#10b981", yellow: "#f59e0b", red: "#ef4444" };
      const farge = css[felt.verdi] ?? "#ccc";
      fargePrikk = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${farge};margin-right:6px;vertical-align:middle;"></span>`;
    }

    raderHtml += `<tr>
      <td class="label">${escapeHtml(objekt.label)}</td>
      <td class="verdi">${fargePrikk}${escapeHtml(verdiTekst)}${ekstra}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 15mm; }
  .header { border: 1px solid #ccc; margin-bottom: 16px; }
  .header-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #ccc; }
  .header-row:last-child { border-bottom: none; }
  .prosjekt-navn { font-size: 14px; font-weight: bold; }
  .meta { font-size: 10px; color: #555; }
  .tittel { font-size: 12px; font-weight: 600; }
  .nummer { font-size: 11px; font-weight: 500; color: #333; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: #e5e7eb; color: #374151; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  tr { border-bottom: 1px solid #e5e7eb; }
  td { padding: 6px 8px; vertical-align: top; }
  td.label { width: 40%; font-weight: 500; color: #374151; }
  td.verdi { width: 60%; color: #1a1a1a; }
  tr.heading td { background: #f3f4f6; font-size: 13px; font-weight: bold; padding: 8px; }
  tr.subtitle td { font-size: 11px; font-weight: 600; color: #6b7280; padding: 6px 8px; }
  .kommentar { margin-top: 3px; font-size: 10px; font-style: italic; color: #6b7280; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-row">
      <div>
        <div class="prosjekt-navn">${escapeHtml(prosjekt?.name ?? "")}</div>
        ${prosjekt?.projectNumber ? `<div class="meta">Prosjektnr: ${escapeHtml(prosjekt.projectNumber)}</div>` : ""}
        ${prosjekt?.address ? `<div class="meta">Adresse: ${escapeHtml(prosjekt.address)}</div>` : ""}
        ${sjekkliste.building ? `<div class="meta">Lokasjon: ${escapeHtml(sjekkliste.building.name)}${sjekkliste.drawing ? ` · Tegning: ${sjekkliste.drawing.drawingNumber ? sjekkliste.drawing.drawingNumber + " " : ""}${escapeHtml(sjekkliste.drawing.name)}` : ""}</div>` : ""}
      </div>
      <div class="meta">Dato: ${dato}</div>
    </div>
    <div class="header-row">
      <div>
        <div class="tittel">${escapeHtml(sjekkliste.title)}</div>
        <div class="meta">
          ${sjekkliste.creatorEnterprise ? `Oppretter: ${escapeHtml(sjekkliste.creatorEnterprise.name)}` : ""}
          ${sjekkliste.creatorEnterprise && sjekkliste.responderEnterprise ? " · " : ""}
          ${sjekkliste.responderEnterprise ? `Svarer: ${escapeHtml(sjekkliste.responderEnterprise.name)}` : ""}
        </div>
      </div>
      <div style="text-align:right;">
        ${nummer ? `<div class="nummer">Nr: ${escapeHtml(nummer)}</div>` : ""}
        <span class="status">${escapeHtml(STATUS_TEKST[sjekkliste.status] ?? sjekkliste.status)}</span>
      </div>
    </div>
  </div>
  <table>${raderHtml}</table>
</body>
</html>`;
}
