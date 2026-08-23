import * as FileSystem from "expo-file-system/legacy";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

export interface OpplastingsResultat {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Last opp en lokal fil til `/upload` (multipart).
 *
 * Bruker `expo-file-system` sin native `uploadAsync` — IKKE `fetch` + `FormData`.
 * Under New Architecture (RN 0.81) sendte `fetch` med et `{uri}`-fil-objekt en
 * TOM kropp for privat-opplastinger (`?privat=1`), så serveren lagret 0-byte
 * filer (tomme thumbnails + svart annoter). Regresjonen ble synlig da S1 Fase 1b
 * steg 2 flyttet sjekkliste/oppgave-bilder til privat sti; timer-kvitteringer
 * hadde trolig vaert rammet i det stille før det. `uploadAsync` leser fila fra
 * `uri` i native-laget og er upåvirket av fetch/arkitektur.
 */
export async function lastOppFil(
  uri: string,
  filnavn: string,
  mimeType: string,
  // Sensitive filer (timer-kvittering/utlegg) → uploads/privat/, serveres
  // signatur-KUN (S1 Fase 1).
  privat = false,
): Promise<OpplastingsResultat> {
  const token = await hentSessionToken();
  const url = `${AUTH_CONFIG.apiUrl}/upload${privat ? "?privat=1" : ""}`;

  console.log("[OPPL] Laster opp:", filnavn, "til:", url, "uri:", uri.slice(-50), "token:", token ? "ja" : "nei");

  const respons = await FileSystem.uploadAsync(url, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    // Serveren utleder lagret filnavn/endelse fra innhold; `filnavn` bæres som
    // multipart-filnavn så MIME-utledningen og filtype-blokklista fungerer.
    parameters: {},
    mimeType,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  console.log("[OPPL] Respons status:", respons.status);

  if (respons.status < 200 || respons.status >= 300) {
    let feilmelding = "Opplasting feilet";
    try {
      feilmelding = (JSON.parse(respons.body) as { error?: string }).error ?? feilmelding;
    } catch {
      // ikke-JSON kropp
    }
    console.error("[OPPL] Opplasting feilet:", respons.status, respons.body?.slice(0, 200));
    throw new Error(feilmelding);
  }

  const resultat = JSON.parse(respons.body) as OpplastingsResultat;
  console.log("[OPPL] Suksess:", resultat.fileUrl, "size:", resultat.fileSize);
  return resultat;
}
