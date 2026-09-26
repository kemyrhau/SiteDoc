import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_LEVETID_MS, LEVETID_NAAR_G_LEVERT_MS } from "./hmac";

/**
 * 🔴 KLASSE-BEVISST SNUBLETRÅD for 24t-levetiden (E, Kenneth-vedtak 2026-09-24;
 * avvik-retting 2026-09-26).
 *
 * STANDARD_LEVETID_MS er ÉN global levetid for ALLE `/uploads/`-signaturer, satt av
 * den SVAKESTE konsument-klassen. Signereren kan ikke vite om en URL blir et `<img>`
 * eller en nedlasting — samme URL kan bli begge — så per-klasse levetid er umulig.
 * 15 min er forsvarlig FØRST når HVER klasse selvfornyer:
 *   - bilder  selvfornyer: `SignertBilde.tsx` finnes (del G, levert) — onError→re-emisjon.
 *   - lenker  selvfornyer: MARKØR FRA LENKE-RUNDEN — IKKE levert ennå.
 * Til BEGGE finnes hviler tråden på 24 t. Runde 2 senket for tidlig (bare bilder dekket);
 * denne rettingen binder 15-min-kravet til AT ALLE klasser er dekket.
 *
 * To RØDE tester, hver med sin egen grunn (aldri to assertions i én test):
 *   Test 1 — klasse-kobling: fanger «alle klasser selvfornyer, men levetiden står på 24 t».
 *   Test 2 — fristen (GULV): fanger «24 t har stått for lenge», uansett klasser. Gjeninnført
 *            fra Runde 1 (`614a73b9`) — Runde 2 fjernet den da 15 min var nådd; nå tilbake
 *            fordi 24 t er tilbake og skal ikke bli liggende umerket.
 *
 * 🔴 LENKE-MARKØREN (MELD, 2026-09-26): G-detektoren er filsystem-basert med vilje —
 * «ikke et manuelt flagg som kan glemmes» (Runde 1). Lenke-selvfornyelse er ikke
 * designet, så dens artefakt er ikke navngitt. `lenkerSelvfornyer()` speiler
 * G-detektoren mot den NATURLIGE analoge stien `apps/web/src/components/SignertLenke.tsx`.
 * Den er entydig (spesifikk sti) og kan ikke slå ut ved et uhell (kun en ekte
 * SignertLenke-komponent utløser den). Bekreft eller omdøp ved lenke-runden; til den
 * lander er markøren `false` og FRISTEN (Test 2) er forcing-funksjonen.
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
 * LENKE-DETEKTOR — samme filsystem-mønster (MELD: foreslått sti, se filhode).
 * `false` nå (lenke-runden er ikke levert), flipper når en `SignertLenke`-komponent
 * lander. Til da holder fristen (Test 2) 24 t ansvarlig.
 */
export function lenkerSelvfornyer(): boolean {
  return existsSync(SIGNERT_LENKE);
}

describe("levetid-snubletråd — klasse-bevisst: 24 t til ALLE klasser selvfornyer", () => {
  it("detektorene er ENTYDIGE: bilder true (SignertBilde levert), lenker false; existsSync slår ut på en ekte fil", () => {
    expect(delGErLevert()).toBe(true); // SignertBilde finnes
    expect(lenkerSelvfornyer()).toBe(false); // SignertLenke finnes ikke ennå
    expect(existsSync(resolve(HER, "hmac.ts"))).toBe(true); // existsSync fungerer mot en ekte sti (ingen forkledd return)
  });

  it("SNUBLETRÅD 1 (klasse-kobling): BÅDE bilder OG lenker selvfornyer → levetiden MÅ være 15 min", () => {
    if (!(delGErLevert() && lenkerSelvfornyer())) return; // ikke alle klasser dekket → 24 t er riktig, tråden hviler
    expect(
      STANDARD_LEVETID_MS,
      "alle konsument-klasser (bilder + lenker) selvfornyer — sett STANDARD_LEVETID_MS til LEVETID_NAAR_G_LEVERT_MS (15 min)",
    ).toBe(LEVETID_NAAR_G_LEVERT_MS);
  });

  it("SNUBLETRÅD 2 (frist, GULV): 24 t skulle vært midlertidig — ta en bevisst beslutning innen 30.11.2026", () => {
    const frist = Date.parse("2026-11-30T00:00:00Z");
    expect(
      Date.now(),
      "30.11.2026 er passert og levetiden er fortsatt 24 t — lever lenke-selvfornyelse (→15 min) eller flytt fristen BEVISST",
    ).toBeLessThan(frist);
  });

  it("så lenge tråden hviler er STANDARD_LEVETID_MS 24 t (dokumenterer nåtilstanden)", () => {
    expect(STANDARD_LEVETID_MS).toBe(24 * 60 * 60 * 1000);
  });
});
