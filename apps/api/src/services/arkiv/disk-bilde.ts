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
  try {
    return await readFile(diskSti(url));
  } catch {
    return null;
  }
}
