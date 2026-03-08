/**
 * Enkel minnebasert rate limiter.
 * Maks antall forespørsler per IP per tidsvindu.
 */
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

export function sjekkRateLimit(
  bucketName: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  if (!buckets.has(bucketName)) {
    buckets.set(bucketName, new Map());
  }
  const bucket = buckets.get(bucketName)!;
  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || entry.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
