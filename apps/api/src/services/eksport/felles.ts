/**
 * Delte hjelpere for dataeksport (worker + filsamling).
 */
import { join, resolve, sep } from "path";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

/**
 * URL-sti (`/uploads/...`) → absolutt disk-sti — HERDET mot path traversal.
 *
 * 🔴 `fileUrl` lagres UVALIDERT ved `tegning.opprett`, så en klient kan plante
 * `/uploads/../../../etc/passwd`. Denne funksjonen er den ENE reverseringen alle
 * fil-kallere går gjennom (eksport-arkiv, bilde-render til PDF, zip-nedlasting),
 * så sjekken bor HER: query strippes, prosent-koding dekodes, stien resolves og må
 * ligge innenfor uploads-roten — ellers KASTES det. Da er hver kaller beskyttet
 * uten å måtte huske det. (Kontrollør-RETUR 2026-10-10.)
 */
export function diskSti(urlSti: string): string {
  const utenQuery = urlSti.split("?")[0] ?? urlSti;
  let rel: string;
  try {
    rel = decodeURIComponent(utenQuery.replace(/^\/uploads\//, ""));
  } catch {
    throw new Error(`Ugyldig fil-sti (prosentkoding): ${urlSti}`);
  }
  const rot = resolve(UPLOADS_DIR);
  const full = resolve(rot, rel);
  if (full !== rot && !full.startsWith(rot + sep)) {
    throw new Error(`Fil-sti utenfor uploads-roten avvist: ${urlSti}`);
  }
  return full;
}

/**
 * Sikrer at et visningsnavn bærer filas EKTE endelse, hentet fra `fileUrl` (stien
 * er sannhet — `Drawing.fileType` er bare en etikett). Kategorier som navngir fra
 * et DB-navn (tegning/-original/-revisjon) mangler ellers endelse, og
 * `unikArkivSti` skriver fila uten suffiks → macOS kan ikke åpne den (funn
 * 2026-09-06). Idempotent: no-op hvis navnet alt slutter på samme endelse.
 */
export function medFilendelse(visningsnavn: string, fileUrl: string): string {
  const rensetUrl = (fileUrl.split("?")[0] ?? fileUrl);
  const punkt = rensetUrl.lastIndexOf(".");
  const skrå = rensetUrl.lastIndexOf("/");
  // Gyldig endelse: punktum ETTER siste skråstrek og ikke helt sist i stien.
  if (punkt <= skrå || punkt === rensetUrl.length - 1) return visningsnavn;
  const endelse = rensetUrl.slice(punkt); // f.eks. ".pdf"
  return visningsnavn.toLowerCase().endsWith(endelse.toLowerCase())
    ? visningsnavn
    : `${visningsnavn}${endelse}`;
}
