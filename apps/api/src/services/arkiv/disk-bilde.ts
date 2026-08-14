/**
 * Arkivmal 4c — bilde-bytes fra uploads-disk.
 *
 * `byggSjekklisteArkivHtml` tar en injisert `hentBildeBytes(url)`; her er
 * disk-implementasjonen. api-et eier filene på egen disk — å LESE dem krever
 * ingen signering (207-lærdommen gjelder container-serving utad, ikke lokal
 * fs.readFile). URL-en er `/uploads/privat/<id>.jpg`; compose monterer
 * uploads-volumet inn på `UPLOADS_DIR`. Feil (mangler/tillatelse) → null, som
 * `inlineBilder` allerede oversetter til «manglende vedlegg».
 */
import { readFile } from "fs/promises";
import { diskSti } from "../eksport/felles";

export async function hentBildeBytesFraDisk(url: string): Promise<Buffer | null> {
  if (typeof url !== "string" || url.length === 0) return null;
  // Strip signert query (`?exp=…&sig=…`) før disk-oppslag: noen vedlegg-URL-er
  // ligger lagret SIGNERT i `checklist.data` (målt: 4 av ~25 på prod BEF-001).
  // Uten strip blir filnavnet `<uuid>.jpg?exp=…&sig=…` → ENOENT → «manglende
  // vedlegg», dvs. bildet faller stille ut av arkiv-PDF-en. (Hvorfor signerte
  // URL-er er persistert i data er et eget oppstrøms-spor — måles, fikses ikke her.)
  const utenQuery = url.split("?")[0] ?? url;
  try {
    return await readFile(diskSti(utenQuery));
  } catch {
    return null;
  }
}
