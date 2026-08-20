import { describe, it, expect } from "vitest";
import { finnSedlerÅSlette, type LokalSedelUtsnitt, type Slettevindu } from "./timerSyncSletting";

const vindu: Slettevindu = { fraDato: "2026-06-01", tilDato: null };

function sedel(
  id: string,
  dato: string,
  syncStatus: string = "synced",
): LokalSedelUtsnitt {
  return { id, dato, syncStatus };
}

describe("finnSedlerÅSlette", () => {
  it("sletter en synced lokal sedel innenfor vinduet som mangler i server-settet", () => {
    const lokale = [sedel("a", "2026-07-01")];
    const levende = new Set<string>(); // serveren har den ikke lenger
    expect(finnSedlerÅSlette(lokale, levende, vindu)).toEqual(["a"]);
  });

  it("beholder en sedel som fortsatt finnes på server (via id)", () => {
    const lokale = [sedel("a", "2026-07-01")];
    expect(finnSedlerÅSlette(lokale, new Set(["a"]), vindu)).toEqual([]);
  });

  it("beholder en sedel som matcher server via clientUuid (lokal id != server-id)", () => {
    // Lokal id er clientUuid-invarianten; server-settet inneholder både id og clientUuid.
    const lokale = [sedel("client-uuid-1", "2026-07-01")];
    const levende = new Set(["server-id-1", "client-uuid-1"]);
    expect(finnSedlerÅSlette(lokale, levende, vindu)).toEqual([]);
  });

  // ---- VAKT 1: kun innenfor intervallet serveren uttalte seg om ----

  it("VAKT 1: rører ALDRI en sedel FØR fraDato, selv om den mangler i settet", () => {
    const lokale = [sedel("gammel", "2026-05-31")]; // dagen før fraDato
    expect(finnSedlerÅSlette(lokale, new Set(), vindu)).toEqual([]);
  });

  it("VAKT 1: fraDato er inklusiv (sedel PÅ fraDato som mangler slettes)", () => {
    const lokale = [sedel("grense", "2026-06-01")];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu)).toEqual(["grense"]);
  });

  it("VAKT 1: rører ALDRI en sedel ETTER tilDato når vinduet er lukket", () => {
    const lukketVindu: Slettevindu = { fraDato: "2026-06-01", tilDato: "2026-06-30" };
    const lokale = [
      sedel("innenfor", "2026-06-15"),
      sedel("etter", "2026-07-01"), // utenfor øvre grense
    ];
    // Kun "innenfor" slettes; "etter" er utenfor serverens uttalelse.
    expect(finnSedlerÅSlette(lokale, new Set(), lukketVindu)).toEqual(["innenfor"]);
  });

  // ---- VAKT 2: aldri upushet lokalt arbeid ----

  it("VAKT 2: rører ALDRI en pending sedel, selv om id-en mangler i settet", () => {
    const lokale = [sedel("kladd", "2026-07-01", "pending")];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu)).toEqual([]);
  });

  it("VAKT 2: rører ALDRI en avvist sedel, selv om id-en mangler i settet", () => {
    const lokale = [sedel("avvist", "2026-07-01", "avvist")];
    expect(finnSedlerÅSlette(lokale, new Set(), vindu)).toEqual([]);
  });

  // ---- begge vaktene sammen + blandet sett ----

  it("blandet sett: sletter kun synced-innenfor-manglende, beholder resten", () => {
    const lokale = [
      sedel("slett-meg", "2026-07-01", "synced"), // → slettes
      sedel("pending", "2026-07-02", "pending"), // vakt 2
      sedel("finnes", "2026-07-03", "synced"), // finnes på server
      sedel("for-gammel", "2026-05-01", "synced"), // vakt 1
      sedel("conflict", "2026-07-04", "conflict"), // ikke pending/avvist → slettes
    ];
    const levende = new Set(["finnes"]);
    expect(finnSedlerÅSlette(lokale, levende, vindu).sort()).toEqual(
      ["conflict", "slett-meg"].sort(),
    );
  });
});
