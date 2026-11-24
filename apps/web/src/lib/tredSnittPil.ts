/**
 * Snittpilen flyttes dit snittplanet krysser skjermmidten når kameraet har stoppet
 * (`docs/claude/3d-agent-prinsipper.md` § 3d). Brukes av web-viseren og mobil-viewer.
 * Regelen er `snittPilPunkt` i `@sitedoc/shared/tred`.
 */
// Bare typer: viserne laster three dynamisk; en verdi-import her la ~100 kB på First Load
import type * as THREE from "three";
import { snittPilPunkt } from "@sitedoc/shared/tred";

/** Det vi bruker av OBC `SimplePlane` (3.3.3) */
export interface SnittPlan {
  enabled: boolean;
  visible: boolean;
  /** Planet som faktisk klipper (følger håndtaket også etter at pilen er dratt) */
  three: THREE.Plane;
  setFromNormalAndCoplanarPoint(normal: THREE.Vector3, punkt: THREE.Vector3): void;
}

/**
 * Flytter pilen på hvert synlig, aktivt snittplan. Skjulte håndtak (etasjeklippet i web) røres
 * ikke. Gir antall plan som ble flyttet.
 */
export function flyttSnittpilerTilMidten(
  planer: Iterable<SnittPlan>,
  kamera: THREE.Vector3,
  retning: THREE.Vector3,
): number {
  let flyttet = 0;
  for (const plan of planer) {
    if (!plan.enabled || !plan.visible) continue;
    // `plane.origin` følger ikke med når pilen dras — planet som klipper er fasiten
    const normal = plan.three.normal.clone();
    const iPlan = plan.three.coplanarPoint(normal.clone());
    const q = snittPilPunkt(normal, iPlan, kamera, retning);
    if (!q) continue;
    // Egen kopi av normalen: OBC nullstiller sin `normal` til (1,0,0) før den sammenligner
    plan.setFromNormalAndCoplanarPoint(normal, normal.clone().set(q.x, q.y, q.z));
    flyttet++;
  }
  return flyttet;
}
