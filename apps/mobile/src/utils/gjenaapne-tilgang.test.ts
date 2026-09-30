import { describe, it, expect } from "vitest";
import { kanGjenaapneDagsseddel } from "./gjenaapne-tilgang";

/**
 * Ordre timersync-conflict-vakt, gate-krav 2 (aktiv utløser) + krav 5 (regresjon).
 *
 * «Gjenåpne» må deaktiveres når `syncStatus === "conflict"` — ellers bumper
 * gjenåpningen server-`updatedAt` og neste pull sletter arbeiderens lokale
 * timerader (han mister timene ved å prøve å redde dem). Men handlingen skal
 * bestå UENDRET på en sedel som ikke er i conflict (krav 5 — vi fjerner en
 * handling i ett tilfelle, ikke i alle).
 */
describe("kanGjenaapneDagsseddel", () => {
  it("🔴 aktiv utløser: BLOKKERT når en sendt sedel står i conflict", () => {
    // Rød først (uten vakten): en conflict-sedel er fortsatt trykkbar → gjenåpne
    // → neste pull sletter de lokale radene.
    expect(kanGjenaapneDagsseddel("sent", "conflict")).toBe(false);
  });

  it("krav 5 (regresjon): gjenåpne virker fortsatt på en sendt, synced sedel", () => {
    expect(kanGjenaapneDagsseddel("sent", "synced")).toBe(true);
  });

  it("krav 5 (regresjon): gjenåpne virker fortsatt på en sendt, pending sedel", () => {
    expect(kanGjenaapneDagsseddel("sent", "pending")).toBe(true);
  });

  it("uendret: ikke tilgjengelig på draft/returned/accepted (knappen er kun på sendt)", () => {
    expect(kanGjenaapneDagsseddel("draft", "synced")).toBe(false);
    expect(kanGjenaapneDagsseddel("returned", "synced")).toBe(false);
    expect(kanGjenaapneDagsseddel("accepted", "synced")).toBe(false);
  });
});
