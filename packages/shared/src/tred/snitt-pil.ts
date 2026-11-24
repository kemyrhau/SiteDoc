/**
 * Snittpilen følger skjermmidten (3D, web + mobil-viewer).
 *
 * Vedtak Kenneth 2026-11-17 (`docs/claude/3d-agent-prinsipper.md` § 3d). Pilen (håndtaket på
 * snittplanet) står i punktet brukeren dobbeltklikket. Zoomer eller panorerer man inn i et rom,
 * havner den utenfor bildet. Når kameraet har stoppet, flyttes den i samme plan dit planet
 * krysser skjermmidten. Snittet er det samme: samme normal, nytt punkt i samme plan.
 *
 * Regel:
 * - strålen fra kameraet gjennom skjermmidten krysser planet foran kameraet → krysningspunktet;
 * - strålen står parallelt med planet, eller krysser bak kameraet → kameraets nærmeste punkt
 *   på planet (fotpunktet).
 */
import type { Punkt3 } from "./utliggere";

/** Under denne verdien av |normal · retning| regnes strålen som parallell med planet. */
export const SNITT_PIL_PARALLELL = 1e-6;

function prikk(a: Punkt3, b: Punkt3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function enhet(v: Punkt3): Punkt3 | null {
  const l = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(l) || l === 0) return null;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * Nytt punkt for snittpilen, i samme plan som `punktIPlan` med normal `normal`.
 * `null` når normalen eller et punkt er ugyldig — pilen blir da stående.
 */
export function snittPilPunkt(
  normal: Punkt3,
  punktIPlan: Punkt3,
  kamera: Punkt3,
  retning: Punkt3,
): Punkt3 | null {
  const n = enhet(normal);
  if (!n) return null;
  if (![punktIPlan, kamera].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) {
    return null;
  }
  // Fortegnet avstand fra kameraet til planet langs normalen
  const tilPlan = prikk(n, { x: punktIPlan.x - kamera.x, y: punktIPlan.y - kamera.y, z: punktIPlan.z - kamera.z });
  const r = enhet(retning);
  if (r) {
    const nr = prikk(n, r);
    if (Math.abs(nr) >= SNITT_PIL_PARALLELL) {
      const t = tilPlan / nr;
      if (t > 0) return { x: kamera.x + r.x * t, y: kamera.y + r.y * t, z: kamera.z + r.z * t };
    }
  }
  // Parallell, bak kameraet eller ingen retning: fotpunktet
  return { x: kamera.x + n.x * tilPlan, y: kamera.y + n.y * tilPlan, z: kamera.z + n.z * tilPlan };
}
