import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createTestCaller } from "../test-harness/context";

/**
 * Regresjonsnett for kontrollplan L1 «Start»-veien (skjermbilde-gaten 2026-08-14).
 *
 * Feilklassen: en Zod-validator som MOTSIER skjemaets id-type. `KontrollplanPunkt.id`
 * er `@default(cuid())`, men `sjekkliste.opprett` validerte `kontrollplanPunktId` som
 * `.uuid()`. Da avviste input-laget ETHVERT ekte punkt («Invalid uuid») før resolveren
 * kjørte, og hele «Start»-veien var død — mens diff-review så en riktig-utseende `.uuid()`.
 *
 * Denne testen låser at et CUID godtas på feltet. Den kaller `sjekkliste.opprett` med et
 * CUID `kontrollplanPunktId` og en bevisst ugyldig `templateId`, slik at valideringen
 * stopper på input-laget (ingen DB-treff nødvendig). Kontrakten: valideringsfeilen skal
 * gjelde `templateId` — og IKKE `kontrollplanPunktId`. Gjeninnfører noen `.uuid()` mot
 * cuid-kolonnen, dukker `kontrollplanPunktId` opp i feilen igjen og testen ryker.
 */
describe("sjekkliste.opprett — kontrollplanPunktId godtar cuid (ikke uuid)", () => {
  // Ekte KontrollplanPunkt.id-form (cuid), ikke uuid.
  const PUNKT_CUID = "cmss5wnsm0003p80yyl9w7ocy";

  it("et CUID er ikke et gyldig UUID (dokumenterer regresjonsklassen)", () => {
    // `.uuid()` ville (feilaktig) avvist punkt-IDen; `z.string()` godtar den.
    expect(z.string().uuid().safeParse(PUNKT_CUID).success).toBe(false);
    expect(z.string().safeParse(PUNKT_CUID).success).toBe(true);
  });

  it("input-valideringen avviser ikke et CUID kontrollplanPunktId", async () => {
    const caller = createTestCaller("regresjon-kp-start");
    const feil = await caller.sjekkliste
      .opprett({ templateId: "ikke-en-uuid", kontrollplanPunktId: PUNKT_CUID })
      .then(() => null)
      .catch((e: unknown) => e as Error);

    // Kallet skal feile på input (ugyldig templateId), ikke lykkes.
    expect(feil).toBeTruthy();
    const melding = String(feil?.message);
    // Sanity: valideringen kjørte og fanget den ugyldige templateId-en …
    expect(melding).toContain("templateId");
    // … men kontrollplanPunktId (et CUID) skal IKKE være avvist.
    expect(melding).not.toContain("kontrollplanPunktId");
  });
});
