import { describe, it, expect } from "vitest";
import { byggOpprettInput, type OpprettFlyt } from "../opprettFraTegning";

/**
 * «Opprett fra tegning» modell-korreksjon (funn 2026-08-22). To tester, jf. Kenneth:
 * KONTRAKTSTESTEN (HMS → ingen dokumentflytId) er viktigst — den vokter serverens fail-loud-
 * gren (sjekkliste.ts:345) mot at noen senere bygger galt. Funksjonstesten (flere flyter,
 * samme faggruppe → riktig id) fanger at DENNE byggingen er riktig.
 */
describe("byggOpprettInput — dokumentflyt er nøkkelen", () => {
  const flytA: OpprettFlyt = { id: "flyt-A", faggruppeId: "fg-1" };
  const flytB: OpprettFlyt = { id: "flyt-B", faggruppeId: "fg-1" }; // SAMME faggruppe som A

  // 🔴 KONTRAKTSTEST (viktigst)
  it("HMS-mal → INGEN dokumentflytId (server auto-ruter; kontrakt :345)", () => {
    const ut = byggOpprettInput(true, flytA);
    expect(ut.dokumentflytId).toBeUndefined();
    expect(ut.bestillerFaggruppeId).toBeUndefined();
    expect(ut.utforerFaggruppeId).toBeUndefined();
    // også om en flyt tilfeldigvis er valgt: HMS overstyrer og sender ingenting.
    expect(byggOpprettInput(true, null)).toEqual({});
  });

  // FUNKSJONSTEST: flere flyter i samme faggruppe → den VALGTE flytens id sendes
  it("ikke-HMS, flere flyter samme faggruppe → den VALGTE flytens dokumentflytId", () => {
    const utA = byggOpprettInput(false, flytA);
    expect(utA.dokumentflytId).toBe("flyt-A");
    expect(utA.bestillerFaggruppeId).toBe("fg-1");
    expect(utA.utforerFaggruppeId).toBe("fg-1");

    const utB = byggOpprettInput(false, flytB);
    expect(utB.dokumentflytId).toBe("flyt-B"); // IKKE flyt-A — valget avgjør, ikke faggruppen
    expect(utB.bestillerFaggruppeId).toBe("fg-1");
  });

  it("ikke-HMS, flyt uten faggruppe (kryss-faggruppe) → id sendes, faggruppe utelates", () => {
    const ut = byggOpprettInput(false, { id: "flyt-X", faggruppeId: null });
    expect(ut.dokumentflytId).toBe("flyt-X");
    expect(ut.bestillerFaggruppeId).toBeUndefined();
    expect(ut.utforerFaggruppeId).toBeUndefined();
  });

  it("ikke-HMS uten valgt flyt → tomt (UI blokkerer submit; serveren ville avvist)", () => {
    expect(byggOpprettInput(false, null)).toEqual({});
  });
});
