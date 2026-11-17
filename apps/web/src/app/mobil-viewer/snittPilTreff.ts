import * as THREE from "three";

/**
 * Større treffflate på snittpilen i mobil-vieweren (ORDRE 3D-mobil 10, 2026-11-17).
 *
 * OBC 3.3.3 `SimplePlane` bruker three.js `TransformControls` (0.183) som pil. Pilens
 * usynlige treffvolum (`picker.translate`, navn «Z») er to kjegler med radius 0,2 ytterst
 * som smalner til 0 i midten — rundt pilens rot er det nesten ingenting å treffe med en finger.
 * Her byttes de to kjeglene ut med sylindre med fast radius. Den synlige pilen er uendret,
 * og skaleringen (fast størrelse på skjermen) gjøres fortsatt av TransformControls pr. bilde.
 */

/** Radius på treffsylinderen i gizmo-enheter (kjeglene: 0,2 ytterst, 0 i midten). */
export const PIL_TREFF_RADIUS = 0.25;
/** Lengde pr. side i gizmo-enheter (kjeglene: 0,6). */
export const PIL_TREFF_LENGDE = 0.7;

type MedHjelper = { getHelper(): THREE.Object3D };

/** Treffvolumene for pilen (`picker.translate` → «Z»), eller tom liste om strukturen er ukjent. */
export function pilTreffMesher(kontroller: MedHjelper): THREE.Mesh[] {
  const gizmo = kontroller.getHelper().children[0] as unknown as { picker?: { translate?: THREE.Object3D } } | undefined;
  const gruppe = gizmo?.picker?.translate;
  if (!gruppe) return [];
  return gruppe.children.filter((h): h is THREE.Mesh => h.name === "Z" && (h as THREE.Mesh).isMesh === true);
}

/** Bytter pilens treffkjegler ut med sylindre. Returnerer antall byttet (2 når alt er som ventet). */
export function forstørrPilTreff(kontroller: MedHjelper): number {
  let byttet = 0;
  for (const mesh of pilTreffMesher(kontroller)) {
    if (mesh.userData.sitedocPilTreff) continue;
    mesh.geometry.computeBoundingBox();
    const midt = mesh.geometry.boundingBox?.getCenter(new THREE.Vector3()).z ?? 0;
    const fortegn = midt < 0 ? -1 : 1;
    const geo = new THREE.CylinderGeometry(PIL_TREFF_RADIUS, PIL_TREFF_RADIUS, PIL_TREFF_LENGDE, 8);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, (fortegn * PIL_TREFF_LENGDE) / 2);
    mesh.geometry.dispose();
    mesh.geometry = geo;
    mesh.userData.sitedocPilTreff = true;
    byttet++;
  }
  return byttet;
}
