/**
 * Delte hjelpere for dataeksport (worker + filsamling).
 */
import { join } from "path";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

/** URL-sti (`/uploads/...`) → disk-sti. Samme reversering som resten av kodebasen. */
export function diskSti(urlSti: string): string {
  return join(UPLOADS_DIR, urlSti.replace(/^\/uploads\//, ""));
}
