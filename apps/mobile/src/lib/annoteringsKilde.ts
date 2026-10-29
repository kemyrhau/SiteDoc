// Kilden til bildet som åpnes i annoteringen (RETUR svart gjenåpning, Kenneth 2026-10-28).
//
// Rotårsak (målt i koden): etter opplasting sletter køen lokalfila og skriver den RÅ server-URL-en
// (`resultat.fileUrl`, usignert) i vedlegget (`OpplastingsKoProvider`). `/uploads/` er signatur-KUN
// (`apps/api/src/server.ts`, Fase 1b) → en naken nedlasting gir 401. `BildeAnnotering` lastet ned
// uten å se på status, base64-kodet feilsvaret `{"error":…}` og sendte det som `data:image/jpeg` →
// Fabric fikk aldri et bilde → helt svart lerret uten feilmelding.
//
// Her avgjøres kilden ÉN gang, og en ugyldig kilde blir en navngitt feil — aldri et «bilde» som ikke
// er et bilde. Ren funksjon med injiserte filoperasjoner, så den er testbar uten native moduler.
import { erUtloptSignatur } from "@sitedoc/shared";

export type AnnoteringsKilde =
  | { type: "lokal"; sti: string }
  | { type: "server"; url: string }
  /** Rå eller utløpt-signert `/uploads/`-URL: må fornyes (refetch) før den kan lastes. */
  | { type: "trengerSignatur" };

export function erLokalSti(uri: string): boolean {
  return uri.startsWith("file://") || uri.startsWith("/var/") || uri.startsWith("/private/");
}

/** Hvilken kilde er `uri`? `apiUrl` gjør en server-relativ sti absolutt. */
export function velgAnnoteringsKilde(uri: string, apiUrl: string, naa: number = Date.now()): AnnoteringsKilde {
  if (erLokalSti(uri)) return { type: "lokal", sti: uri };
  // erUtloptSignatur er sann for RÅ /uploads/ og utløpt-signert (samme delte regel som visningen).
  if (erUtloptSignatur(uri, naa)) return { type: "trengerSignatur" };
  return { type: "server", url: uri.startsWith("/") ? `${apiUrl}${uri}` : uri };
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Dekod de første byte-ene av en base64-streng (nok til magiske byte; ingen avhengighet til atob/Buffer). */
export function forsteByte(base64: string, antall = 12): number[] {
  const ut: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const tegn of base64) {
    const v = B64.indexOf(tegn);
    if (v < 0) break;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      ut.push((buffer >> bits) & 0xff);
      if (ut.length >= antall) break;
    }
  }
  return ut;
}

/**
 * MIME-typen til base64-innholdet ut fra magiske byte (JPEG/PNG/GIF/WebP/HEIC), eller null når det
 * ikke er et bilde — f.eks. et 401-svar `{"error":…}` som ble lagret som «bildet».
 */
export function bildeMimeFraBase64(base64: string): string | null {
  const b = forsteByte(base64);
  const asc = (fra: number, til: number) => String.fromCharCode(...b.slice(fra, til));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && asc(1, 4) === "PNG") return "image/png";
  if (asc(0, 3) === "GIF") return "image/gif";
  if (asc(0, 4) === "RIFF" && asc(8, 12) === "WEBP") return "image/webp";
  if (asc(4, 8) === "ftyp") return "image/heic";
  return null;
}

export type AnnoteringsbildeResultat =
  | { ok: true; dataUrl: string }
  | { ok: false; grunn: "trengerSignatur" | "lokalMangler" | "nedlastingFeilet" | "ikkeBilde"; status?: number };

export interface AnnoteringsbildeDeps {
  apiUrl: string;
  cacheDir: string;
  finnes: (sti: string) => Promise<boolean>;
  lastNed: (url: string, tilSti: string) => Promise<{ status: number }>;
  lesBase64: (sti: string) => Promise<string>;
  naa?: number;
}

export async function lastAnnoteringsbilde(uri: string, deps: AnnoteringsbildeDeps): Promise<AnnoteringsbildeResultat> {
  const kilde = velgAnnoteringsKilde(uri, deps.apiUrl, deps.naa);
  if (kilde.type === "trengerSignatur") return { ok: false, grunn: "trengerSignatur" };
  let sti: string;
  if (kilde.type === "lokal") {
    if (!(await deps.finnes(kilde.sti))) return { ok: false, grunn: "lokalMangler" };
    sti = kilde.sti;
  } else {
    sti = `${deps.cacheDir}annoterings_kilde_${Date.now()}.jpg`;
    const { status } = await deps.lastNed(kilde.url, sti);
    if (status < 200 || status >= 300) return { ok: false, grunn: "nedlastingFeilet", status };
  }
  const base64 = await deps.lesBase64(sti);
  const mime = bildeMimeFraBase64(base64);
  if (!mime) return { ok: false, grunn: "ikkeBilde" };
  return { ok: true, dataUrl: `data:${mime};base64,${base64}` };
}
