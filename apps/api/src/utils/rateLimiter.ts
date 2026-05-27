/**
 * Enkel minnebasert rate limiter.
 * Maks antall forespørsler per nøkkel (IP eller userId) per tidsvindu.
 */
import type { FastifyRequest } from "fastify";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Map<string, RateLimitEntry>>();

// Rydd opp utløpte oppføringer hvert 5. minutt
setInterval(() => {
  const now = Date.now();
  for (const [_name, bucket] of buckets) {
    for (const [key, entry] of bucket) {
      if (entry.resetAt <= now) {
        bucket.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

/**
 * Henter ekte klient-IP. Prioriterer Cloudflare's Cf-Connecting-Ip
 * (sendt av cloudflared tunnel, blokkert mot spoofing av Cloudflare),
 * faller tilbake til req.ip (etter trustProxy=true) for direkte trafikk.
 *
 * Bakgrunn: Fastify er bak Cloudflare Tunnel + cloudflared. cloudflared
 * setter ikke X-Forwarded-For med klient-IP, men sender klient-IP i
 * Cf-Connecting-Ip-headeren. Uten denne helperen ser alle requests ut
 * til å komme fra server-IP, og rate-limit per IP er effektivt globalt.
 */
export function hentKlientIp(req: FastifyRequest): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.length > 0) return cf;
  return req.ip ?? "unknown";
}

/**
 * Returnerer { ok, retryAfterSeconds } slik at kallere kan sende
 * Retry-After-info til klient. retryAfterSeconds = 0 når ok=true.
 */
export function sjekkRateLimitDetalj(
  bucketName: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  if (!buckets.has(bucketName)) {
    buckets.set(bucketName, new Map());
  }
  const bucket = buckets.get(bucketName)!;
  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || entry.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count++;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Bakoverkompatibel wrapper rundt sjekkRateLimitDetalj.
 * Beholdt for eksisterende kallsteder som ikke trenger retryAfter.
 */
export function sjekkRateLimit(
  bucketName: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  return sjekkRateLimitDetalj(bucketName, key, maxRequests, windowMs).ok;
}
