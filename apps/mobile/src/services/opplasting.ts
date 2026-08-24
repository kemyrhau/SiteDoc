import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { sikreEndelse } from "@sitedoc/shared";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

// sikreEndelse/saniter/ENDELSE_FRA_MIME er løftet til @sitedoc/shared (enhetstestet der —
// utledningsgrenen er ikke UI-nåbar fra uploadAsync-stien). Uendret oppførsel.

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

  // `uploadAsync` har INGEN filnavn-opsjon — den utleder multipart-`filename` fra URI-ens
  // basename. For at det tiltenkte navnet (m/ endelse) skal nå serverens extname-gate og
  // returneres som visningsnavn, kopieres fila til en cache-sti navngitt `trygtNavn` og
  // lastes opp derfra. Uten dette ser serveren cache-uri-ens basename (ofte uten endelse for
  // dokumenter) → 400 «Ugyldig filtype: (ingen)».
  //
  // Kopien legges i en UNIK underkatalog (ikke bare et unikt filnavn): basename MÅ forbli
  // `trygtNavn` (det blir multipart-filnavnet), men to samtidige opplastinger med samme
  // filnavn ville ellers pekt på samme sti — og køens direktekall-søsken (FeltDokumentasjon,
  // utenom den sekvensielle køen) kunne slettet den enes kopi mens den andre strømmet fra
  // den. Unik katalog gjør kollisjon umulig ved konstruksjon, ikke ved antakelse om kallmønster.
  const trygtNavn = sikreEndelse(filnavn, mimeType);
  const kopiKatalog = `${FileSystem.cacheDirectory}opplasting-${randomUUID()}/`;
  const opplastingsUri = `${kopiKatalog}${trygtNavn}`;

  console.log("[OPPL] Laster opp:", trygtNavn, "til:", url, "uri:", uri.slice(-50), "token:", token ? "ja" : "nei");

  try {
    await FileSystem.makeDirectoryAsync(kopiKatalog, { intermediates: true });
    await FileSystem.copyAsync({ from: uri, to: opplastingsUri });

    const respons = await FileSystem.uploadAsync(url, opplastingsUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
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
  } finally {
    // Rydd HELE den unike kopikatalogen uansett utfall (idempotent — feiler ikke om den
    // aldri ble laget). Sletter kun denne opplastingens katalog, aldri en annens.
    await FileSystem.deleteAsync(kopiKatalog, { idempotent: true }).catch(() => {});
  }
}
