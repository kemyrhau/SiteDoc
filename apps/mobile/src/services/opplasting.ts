import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

export interface OpplastingsResultat {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/** MIME → filendelse, for filnavn som mangler suffiks (dokument fra Filer, cache-uri). */
const ENDELSE_FRA_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/heif": ".heic",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

/** Fjern sti-separatorer/kontrolltegn så navnet trygt kan brukes som cache-filnavn. */
function saniter(navn: string): string {
  // eslint-disable-next-line no-control-regex
  return navn.replace(/[/\\\x00-\x1f]/g, "_").trim() || "fil";
}

/**
 * Garanter at multipart-filnavnet har en endelse serveren godtar. `uploadAsync` utleder
 * multipart-`filename` fra URI-ens basename (ingen filnavn-opsjon), og `upload.ts:121`
 * avviser tomt suffiks med 400 FØR magic-bytes får korrigert noe. Dokumenter fra Filer har
 * ofte ingen endelse i cache-stien → uten dette byttes 0-byte-bugen mot 400. Har navnet
 * allerede en endelse, beholdes den (serverens magic-sniff retter evt. bilde-uenighet).
 */
function sikreEndelse(filnavn: string, mimeType: string): string {
  const rent = saniter(filnavn);
  // Ekte endelse = punktum + 1–6 tegn med MINST én bokstav. Et rent numerisk suffiks
  // («Faktura 2026.08» → «.08») er et dato-/versjonsfragment, ikke en endelse → da vinner
  // MIME. (Kjent restgrense: et alfabetisk men ikke-reelt suffiks som «.v2» leses fortsatt
  // som endelse — sjeldnere, og krever en kjent-endelse-liste å skille rent.)
  const m = rent.match(/\.([a-z0-9]{1,6})$/i);
  if (m && m[1] && /[a-z]/i.test(m[1])) return rent;
  return rent + (ENDELSE_FRA_MIME[mimeType.toLowerCase()] ?? "");
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
