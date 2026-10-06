import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_LEVETID_MS, LEVETID_NAAR_G_LEVERT_MS } from "./hmac";

/**
 * 🔴 KLASSE-BEVISST SNUBLETRÅD → PERMANENT REGRESJONSVAKT (E, Kenneth-vedtak 2026-09-24;
 * avvik-retting 2026-09-26; lenke-runden 2026-09-27).
 *
 * STANDARD_LEVETID_MS er ÉN global levetid for ALLE `/uploads/`-signaturer, satt av den
 * SVAKESTE konsument-klassen. Signereren kan ikke vite om en URL blir et `<img>` eller en
 * nedlasting — samme URL kan bli begge — så per-klasse levetid er umulig. 15 min er forsvarlig
 * FØRST når HVER klasse selvfornyer:
 *   - bilder  selvfornyer: `SignertBilde.tsx` finnes (del G) — onError → re-emisjon.
 *   - lenker  selvfornyer: `SignertLenke.tsx` finnes (lenke-runden) — sjekk før navigering.
 * Begge finnes nå → 15 min er nådd. Tråden er snudd til en PERMANENT vakt om KOBLINGEN:
 * fjernes en klasses selvfornyelse (komponenten slettes) uten å heve levetiden igjen, eller
 * heves levetiden umerket mens begge klasser er dekket, slår den ut. Hver assertion i sin egen
 * test, så det er entydig hvilken kobling som brøt.
 *
 * Historikk: Runde 1 bar tråden for den midlertidige 24 t (+ en frist 30.11.2026 som gulv).
 * Runde 2 senket for tidlig (bare bilder dekket). Avvik-rettingen (26.09) satte 24 t tilbake og
 * gjeninnførte fristen. Lenke-runden (27.09) lukket lenke-klassen → 15 min, og fristen er igjen
 * fjernet (målet er nådd; en dato-vakt som fyrer uten sak er selv en regresjon).
 */

const HER = dirname(fileURLToPath(import.meta.url)); // apps/api/src/utils
const REPO_ROT = resolve(HER, "../../../.."); // → monorepo-rot
const SIGNERT_BILDE = resolve(REPO_ROT, "apps/web/src/components/SignertBilde.tsx");
const SIGNERT_LENKE = resolve(REPO_ROT, "apps/web/src/components/SignertLenke.tsx");

/**
 * BILDE-DETEKTOR — entydig, filsystem-basert. Bilder selvfornyer når G1-komponenten
 * finnes. Ordre G1 navngir den EKSAKT: `apps/web/src/components/SignertBilde.tsx`.
 */
export function delGErLevert(): boolean {
  return existsSync(SIGNERT_BILDE);
}

/**
 * LENKE-DETEKTOR — samme filsystem-mønster («ikke et manuelt flagg som kan glemmes»).
 * Lenke-klassen selvfornyer når `apps/web/src/components/SignertLenke.tsx` finnes
 * (kontrakt bundet i BACKLOG + [web.md]). Levert i lenke-runden → true.
 */
export function lenkerSelvfornyer(): boolean {
  return existsSync(SIGNERT_LENKE);
}

describe("levetid-snubletråd — permanent vakt: 15 min krever at ALLE klasser selvfornyer", () => {
  it("detektorene er ENTYDIGE: begge klasser true (SignertBilde + SignertLenke levert); existsSync slår ut på en ekte fil", () => {
    expect(delGErLevert()).toBe(true); // SignertBilde finnes
    expect(lenkerSelvfornyer()).toBe(true); // SignertLenke finnes (lenke-runden)
    expect(existsSync(resolve(HER, "hmac.ts"))).toBe(true); // existsSync fungerer mot en ekte sti (ingen forkledd return)
  });

  it("KLASSE-KOBLING: BÅDE bilder OG lenker selvfornyer → levetiden MÅ være 15 min", () => {
    if (!(delGErLevert() && lenkerSelvfornyer())) return; // en klasse mistet dekning → 24 t ville vært riktig igjen
    expect(
      STANDARD_LEVETID_MS,
      "alle konsument-klasser (bilder + lenker) selvfornyer — STANDARD_LEVETID_MS skal være 15 min (LEVETID_NAAR_G_LEVERT_MS)",
    ).toBe(LEVETID_NAAR_G_LEVERT_MS);
  });

  it("dokumenterer nåtilstanden: STANDARD_LEVETID_MS er 15 min", () => {
    expect(STANDARD_LEVETID_MS).toBe(15 * 60 * 1000);
  });
});
