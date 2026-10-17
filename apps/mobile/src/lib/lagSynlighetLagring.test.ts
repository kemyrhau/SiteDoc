import { describe, expect, it, vi, beforeEach } from "vitest";

const butikk = new Map<string, string>();

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => butikk.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => {
    butikk.set(k, v);
  }),
  deleteItemAsync: vi.fn(async (k: string) => {
    butikk.delete(k);
  }),
}));

import { byggSynlighetFraSkjulte, hentSkjulteLag, lagreSkjulteLag, utledSkjulteLag } from "./lagSynlighetLagring";

beforeEach(() => {
  butikk.clear();
});

describe("lagSynlighetLagring", () => {
  it("ingen lagret verdi gir tom liste", async () => {
    expect(await hentSkjulteLag("d1")).toEqual([]);
  });

  it("lagrer og henter skjulte lag pr. tegning", async () => {
    await lagreSkjulteLag("d1", ["A-WALL", "I-FURN"]);
    expect(await hentSkjulteLag("d1")).toEqual(["A-WALL", "I-FURN"]);
  });

  it("ulike tegninger (drawingId) har ulik nøkkel — ingen kryss-lekkasje", async () => {
    await lagreSkjulteLag("d1", ["A-WALL"]);
    await lagreSkjulteLag("d2", ["P-PIPE"]);
    expect(await hentSkjulteLag("d1")).toEqual(["A-WALL"]);
    expect(await hentSkjulteLag("d2")).toEqual(["P-PIPE"]);
  });

  it("lagring av tom liste fjerner nøkkelen (ikke bare en tom verdi)", async () => {
    await lagreSkjulteLag("d1", ["A-WALL"]);
    await lagreSkjulteLag("d1", []);
    expect(await hentSkjulteLag("d1")).toEqual([]);
    expect(butikk.has("sitedoc_tegning_lag_skjult_d1")).toBe(false);
  });

  it("byggSynlighetFraSkjulte/utledSkjulteLag er omvendte av hverandre", () => {
    const skjulte = ["A-WALL", "P-PIPE"];
    const synlighet = byggSynlighetFraSkjulte(skjulte);
    expect(synlighet).toEqual({ "A-WALL": false, "P-PIPE": false });
    expect(utledSkjulteLag(synlighet).sort()).toEqual([...skjulte].sort());
  });

  it("utledSkjulteLag ignorerer nøkler som er explicit true (synlig)", () => {
    expect(utledSkjulteLag({ "A-WALL": false, "S-COLS": true })).toEqual(["A-WALL"]);
  });
});
