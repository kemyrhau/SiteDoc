import { describe, it, expect } from "vitest";
import { nesteListeLogg } from "./listeLogg";

// ORDRE 5 (2026-10-29): spinneren i sjekklistelista etter KD11. Loggen viser når lista henter,
// hvor lenge, og med hvilket utfall — uten persondata.

describe("nesteListeLogg", () => {
  it("start ved overgang til henting, slutt med varighet og antall", () => {
    const a = nesteListeLogg(null, { henter: true, naa: 1000, sted: "sjekklister" });
    expect(a.linje).toBe("[liste] sjekkliste.hentForProsjekt start (sjekklister)");
    const b = nesteListeLogg(a.start, { henter: false, naa: 2350, sted: "sjekklister", antall: 12, feilet: false });
    expect(b.linje).toBe("[liste] sjekkliste.hentForProsjekt slutt 1350 ms, ok, 12 rader (sjekklister)");
    expect(b.start).toBeNull();
  });

  it("ingen linje uten overgang", () => {
    expect(nesteListeLogg(null, { henter: false, naa: 1, sted: "hjem" }).linje).toBeNull();
    expect(nesteListeLogg(5, { henter: true, naa: 9, sted: "hjem" })).toEqual({ start: 5, linje: null });
  });

  it("feil logges som feil", () => {
    expect(nesteListeLogg(0, { henter: false, naa: 40, sted: "innboks", feilet: true }).linje).toBe(
      "[liste] sjekkliste.hentForProsjekt slutt 40 ms, feil (innboks)",
    );
  });
});
