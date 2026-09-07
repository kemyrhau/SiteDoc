/**
 * Delte hjelpere for dataeksport (worker + filsamling).
 */
import { join } from "path";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

/** URL-sti (`/uploads/...`) → disk-sti. Samme reversering som resten av kodebasen. */
export function diskSti(urlSti: string): string {
  return join(UPLOADS_DIR, urlSti.replace(/^\/uploads\//, ""));
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
