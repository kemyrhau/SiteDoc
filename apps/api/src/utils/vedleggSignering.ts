/**
 * Signering av bilde-/fil-URL-er ved UTSTEDELSE for sjekkliste-/oppgave-emisjoner
 * (S1 Fase 1b, 2026-08-12).
 *
 * Byggeplass-bilder ligger to steder: `Image.fileUrl` (via `images`-relasjonen)
 * OG duplisert som `vedlegg[].url` dypt inne i `Checklist.data`/`Task.data`-JSON
 * (kan være nestet i repeater-rader + i et `attachments`-felts `verdi`-array).
 * Utskriften leser KUN JSON-kopien. Begge må signeres når de forlater serveren.
 *
 * 🔴 Signering skjer ved EMISJON, aldri ved lagring: `signerVedleggIData` returnerer
 * en DYP KOPI med signerte URL-er — den originale `data`-verdien mutéres aldri.
 * En signert URL (`?exp=&sig=`) som havner i DB er forgiftet permanent (utløp fanget
 * i lagret data) og ville dessuten brutt `bilde.slettMedUrl` sin eksakt-streng-match.
 *
 * Rekursjonen speiler tellings-SQL-ens `$.**.url`: ethvert `url`-strengfelt på et
 * hvilket som helst nivå signeres via `signerHvisPrivat` (som er en no-op for alt
 * utenfor `/uploads/privat/`, så åpne URL-er før migreringen berøres ikke).
 */
import { TRPCError } from "@trpc/server";
import { erForgiftetUploadsUrl } from "@sitedoc/shared";
import { signerHvisPrivat } from "./hmac";

function signerNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(signerNode);
  }
  if (node !== null && typeof node === "object") {
    const kopi: Record<string, unknown> = {};
    for (const [nokkel, verdi] of Object.entries(node as Record<string, unknown>)) {
      kopi[nokkel] =
        nokkel === "url" && typeof verdi === "string"
          ? (signerHvisPrivat(verdi) ?? verdi)
          : signerNode(verdi);
    }
    return kopi;
  }
  return node;
}

/**
 * Returnér en dyp kopi av `Checklist.data`/`Task.data` der hvert `vedlegg[].url`
 * (på ethvert nivå — inkl. repeater-nesting + attachments-felt) er signert.
 * Muterer aldri input. `null`/`undefined`/skalar returneres uendret.
 */
export function signerVedleggIData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  return signerNode(data);
}

/**
 * Signér `fileUrl` på et sett Image-rader (images-relasjonen). Respons-kopi —
 * DB-raden røres ikke, så `slettMedUrl`s eksakt-match mot lagret `fileUrl` består.
 */
export function signerBilder<T extends { fileUrl: string }>(bilder: T[]): T[] {
  return bilder.map((b) => ({ ...b, fileUrl: signerHvisPrivat(b.fileUrl) ?? b.fileUrl }));
}

/** Respons-kopi av én checklist/task-rad med signert `data` (vedlegg-URL-er). */
export function signerDataRad<T extends { data: unknown }>(rad: T): T {
  return { ...rad, data: signerVedleggIData(rad.data) };
}

/** Respons-kopi av flere checklist/task-rader med signert `data`. */
export function signerDataRader<T extends { data: unknown }>(rader: T[]): T[] {
  return rader.map(signerDataRad);
}

/** Finn første forgiftede (`sig=`-bærende) `/uploads/`-URL i et vilkårlig data-tre. */
function finnForgiftetUrl(node: unknown): string | null {
  if (erForgiftetUploadsUrl(node)) return node;
  if (Array.isArray(node)) {
    for (const n of node) {
      const treff = finnForgiftetUrl(n);
      if (treff !== null) return treff;
    }
    return null;
  }
  if (node !== null && typeof node === "object") {
    for (const verdi of Object.values(node as Record<string, unknown>)) {
      const treff = finnForgiftetUrl(verdi);
      if (treff !== null) return treff;
    }
  }
  return null;
}

/**
 * Skrive-vei-vakt (S1, del B): KAST hvis klienten forsøker å lagre en signert
 * («forgiftet») `/uploads/`-URL i `Checklist.data`/`Task.data`. Signaturen har et
 * innebygd utløp — havner den i DB dør den der (rotårsaken denne runden reparerer).
 * Klienten skal ALLTID sende den rå `/uploads/`-stien (mobilens `signerteUrler.ts`
 * holder `feltVerdier` rå med vilje); en signert URL i skrive-input er en bug vi
 * vil ha høyt, ikke stilltiende persistert. Emisjons-signeringen (respons-veien)
 * legger signaturen på ved UTSENDELSE. Rå `/uploads/`-URL-er og eksterne URL-er
 * slipper uendret gjennom.
 */
export function avvisForgiftetVedleggIData(data: unknown): void {
  const forgiftet = finnForgiftetUrl(data);
  if (forgiftet !== null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Kan ikke lagre en signert /uploads/-URL i dokumentdata — send den rå stien " +
        "(uten ?exp=&sig=). Signaturen legges på ved utsendelse.",
    });
  }
}
