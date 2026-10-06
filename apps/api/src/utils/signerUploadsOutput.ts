/**
 * Sentral output-signering av `/uploads/`-URL-er (S1 Fase 1b, 2026-09-24).
 *
 * 🔴 DEFAULT-PÅ: en tRPC-middleware kjører dette på ALLE query-svar. Enhver
 * streng som starter med `/uploads/` — uansett feltnavn, på ethvert nivå —
 * signeres ved EMISJON via `signerHvisPrivat`. En ny query-rute som returnerer
 * en rå `/uploads/`-URL får derfor signaturen UTEN at forfatteren la til et kall.
 * Det er hele poenget: opt-in-mønsteret sviktet i august (S1-hullet 2026-08-15,
 * funnet tre dager etter at Fase 1b-sømmen ble lagt), fordi det MÅTTE huskes.
 *
 * 🔴 KUN queries (se `signerOutputHvisQuery`). Mutasjoner signeres IKKE av
 * middleware — de er «den farlige veien» (D1-invarianten): en mutasjon som
 * returnerer en rad klienten skriver tilbake, ville plantet en signert
 * («forgiftet») URL i DB. Opplastings-svaret (`POST /upload`, kilden til lagrede
 * fileUrl-er) er dessuten en Fastify-REST-rute utenfor tRPC og berøres uansett
 * ikke. Mutasjoner som trenger signert visnings-URL beholder eksplisitte kall.
 *
 * 🔴 Type-bevarende: kun rene objekter (`Object.prototype`/null-proto) og arrays
 * kopieres/rekurseres. Date, Prisma.Decimal, Buffer og andre klasse-instanser
 * returneres UENDRET (ved referanse) — ville de gått gjennom `Object.entries`-
 * rekonstruksjon, ble en Date til `{}`. Originalen muteres aldri (dyp kopi kun
 * langs stien som endres).
 *
 * 🔴 Idempotent: `signerHvisPrivat` returnerer alt-signerte URL-er uendret, så et
 * lag som alt signerte eksplisitt (f.eks. `signerVedleggIData`) dobbeltsigneres
 * ikke av middleware.
 */
import { signerHvisPrivat } from "./hmac";

function erRentObjekt(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

function signerNode(node: unknown): unknown {
  if (typeof node === "string") {
    return node.startsWith("/uploads/") ? (signerHvisPrivat(node) ?? node) : node;
  }
  if (Array.isArray(node)) return node.map(signerNode);
  if (erRentObjekt(node)) {
    const kopi: Record<string, unknown> = {};
    for (const [nokkel, verdi] of Object.entries(node)) {
      kopi[nokkel] = signerNode(verdi);
    }
    return kopi;
  }
  return node; // Date/Decimal/Buffer/tall/boolean/null/undefined/klasse-instans — urørt
}

/**
 * Returnér en type-bevarende dyp kopi der hver `/uploads/`-streng er signert.
 * Muterer aldri input.
 */
export function signerUploadsOutput(data: unknown): unknown {
  return signerNode(data);
}

/**
 * Middleware-kjernen: signer output KUN på queries (ikke mutasjoner). Ren funksjon
 * så query-vs-mutasjon-grensen — selve D1-vernet — kan enhets-testes direkte uten
 * DB. Fjernes `type !== "query"`-vakten, signeres mutasjonsoutput og D1-testen blir rød.
 */
export function signerOutputHvisQuery<R extends { ok: boolean }>(
  type: string,
  resultat: R,
): R {
  if (type !== "query" || !resultat.ok) return resultat;
  return { ...resultat, data: signerUploadsOutput((resultat as { data?: unknown }).data) };
}
