import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_LEVETID_MS, LEVETID_NAAR_G_LEVERT_MS } from "./hmac";

/**
 * 🔴 LEVETID ↔ DEL G-KOBLING (E+G, Kenneth-vedtak 2026-09-24).
 *
 * Historikk: i Runde 1 bar dette en SNUBLETRÅD for den MIDLERTIDIGE 24t-levetiden.
 * 24 t var forsvarlig kun så lenge del G (selvfornyelse) IKKE var levert — uten G
 * ville 15 min gitt tomme bilderammer over lunsj. Tråden feilet rødt idet
 * `SignertBilde.tsx` landet, og tvang beslutningen «senk til 15 min».
 *
 * Runde 2 (2026-09-25): del G ER levert og levetiden ER senket. Tråden har gjort
 * jobben; den er nå snudd til en PERMANENT regresjonsvakt om KOBLINGEN:
 *   - G er levert (SignertBilde finnes) ⇒ levetiden MÅ være 15 min.
 * Skulle noen fjerne SignertBilde uten å heve levetiden igjen, eller heve levetiden
 * uten å ta en bevisst beslutning, slår denne ut. Hver assertion i sin egen test,
 * så det er entydig hvilken kobling som brøt.
 *
 * 🔴 KJENT FOR-BRED VAKT (målt 2026-09-25, meldt cowork/design): STANDARD_LEVETID_MS
 * er ÉN global levetid for ALLE `/uploads/`-signaturer. Selvfornyelsen (G) dekker
 * KUN `<img>` (og mobilens `<Image>`) via onError→invalidering. Nedlastingslenker
 * (`<a href download>`), PDF-iframes og `<video>` har INGEN fornyelse — en utløpt
 * signatur der gir 401 ved klikk (målt: gaten svarer 401 uansett konsument). Denne
 * vakten binder altså «img-fornyelse finnes» til «15 min for ALT», men begrunnelsen
 * («utløp er usynlig») holder bare for bilder. Velger design en egen (lengre) levetid
 * for nedlastingslenker, slutter levetiden å være én global konstant, og DENNE
 * assertion-en må bli klasse-bevisst. Til den beslutningen lander speiler vakten
 * korrekt dagens ene-globale tilstand (15 min).
 */

const HER = dirname(fileURLToPath(import.meta.url)); // apps/api/src/utils
const REPO_ROT = resolve(HER, "../../../.."); // → monorepo-rot
const SIGNERT_BILDE = resolve(REPO_ROT, "apps/web/src/components/SignertBilde.tsx");

/**
 * G-DETEKTOR — entydig, filsystem-basert. Del G er «levert» når G1-komponenten
 * finnes. Ordre G1 navngir den EKSAKT: `apps/web/src/components/SignertBilde.tsx`.
 */
export function delGErLevert(): boolean {
  return existsSync(SIGNERT_BILDE);
}

describe("levetid ↔ del G — koblingen er nå permanent låst (G levert)", () => {
  it("G-detektoren er ENTYDIG: true nå (SignertBilde er levert), og existsSync virker mot en ekte sti", () => {
    expect(delGErLevert()).toBe(true); // Runde 2: SignertBilde finnes
    expect(existsSync(resolve(HER, "hmac.ts"))).toBe(true); // existsSync fungerer mot en ekte sti
  });

  it("KOBLING: del G er levert → levetiden MÅ være 15 min", () => {
    if (!delGErLevert()) return; // skulle G fjernes, hviler koblingen (24 t ville vært riktig igjen)
    expect(
      STANDARD_LEVETID_MS,
      "del G (SignertBilde) er levert — STANDARD_LEVETID_MS skal være 15 min (LEVETID_NAAR_G_LEVERT_MS)",
    ).toBe(LEVETID_NAAR_G_LEVERT_MS);
  });

  it("dokumenterer nåtilstanden: STANDARD_LEVETID_MS er 15 min", () => {
    expect(STANDARD_LEVETID_MS).toBe(15 * 60 * 1000);
  });
});
