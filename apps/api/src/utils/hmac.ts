import { createHmac, timingSafeEqual } from "crypto";

/**
 * HMAC-signerte fil-URL-er (S1 autorisert filserving, Fase 1).
 *
 * Sensitive filer serveres fra `/uploads/privat/*` og er signatur-KUN (ingen
 * sesjons-fallback). API signerer stien ved emisjon (etter authz i tRPC-laget)
 * og legger `?exp=&sig=` på. `/uploads/privat/*`-hooken i server.ts verifiserer
 * signaturen uten ny DB-authz.
 *
 * Signaturen dekker path-delen + utløps-tidspunkt (millis). Query-strengen med
 * signaturen selv er ikke en del av signert innhold — kun `path\nexp`.
 *
 * Prefiks-signering (for Potree-tiles i Fase 2) bygges på samme util senere via
 * en `prefiks`-variant; Fase 1 signerer eksakt path.
 */

// Kortlevd standard-levetid for fil-URL-er (nok til en visningsøkt; kort nok til
// at en lekket URL dør raskt). Logo/langlevde varianter kommer i Fase 1b.
const STANDARD_LEVETID_MS = 5 * 60 * 1000;

// Dev-fallback så lokal utvikling/test uten satt secret ikke bryter. I produksjon
// KREVES FIL_SIGNING_SECRET (kastes ved bruk) — flagget som deploy-forutsetning.
const DEV_FALLBACK_SECRET =
  "dev-usikret-fil-signering-sett-FIL_SIGNING_SECRET-i-prod";

function hentSecret(): string {
  const secret = process.env.FIL_SIGNING_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FIL_SIGNING_SECRET mangler — kreves i produksjon for signert filserving",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function beregnSignatur(path: string, exp: number): string {
  return createHmac("sha256", hentSecret())
    .update(`${path}\n${exp}`)
    .digest("base64url");
}

/**
 * Signer en `/uploads/...`-sti → returnerer stien med `?exp=&sig=` påhengt.
 * Eventuell eksisterende query strippes før signering (idempotent ved re-signering).
 */
export function signerFilSti(sti: string, levetidMs = STANDARD_LEVETID_MS): string {
  const path = sti.split("?")[0] ?? sti;
  const exp = Date.now() + levetidMs;
  const sig = beregnSignatur(path, exp);
  return `${path}?exp=${exp}&sig=${sig}`;
}

const PRIVAT_PREFIKS = "/uploads/privat/";

/**
 * Signer en fil-URL KUN hvis den peker inn i /uploads/privat/ (sensitiv,
 * signatur-KUN serving). Andre URL-er (non-privat, tomme, allerede signerte med
 * eget query, eksterne) returneres uendret. Målrettet signering ved emisjon —
 * kalles i de prosedyrene som faktisk returnerer privat-URL-er, i stedet for en
 * middleware som muterer alle svar (S1 Fase 1, forbedring etter Blokk 17).
 */
export function signerHvisPrivat(url: string | null | undefined): string | null | undefined {
  if (typeof url !== "string" || !url.startsWith(PRIVAT_PREFIKS)) return url;
  return signerFilSti(url);
}

/**
 * Verifiser signatur for en gitt path + exp + sig (fra query-parametere).
 * Returnerer false ved manglende/ugyldig/utløpt signatur. Konstant-tids-
 * sammenligning mot timing-angrep.
 */
export function verifiserFilSignatur(
  path: string,
  exp: string | undefined | null,
  sig: string | undefined | null,
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;

  const forventet = beregnSignatur(path, expNum);
  const a = Buffer.from(forventet);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
