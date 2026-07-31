import { describe, it, expect } from "vitest";
import { avledStatus, type FlytPosisjonLedd } from "@sitedoc/shared";
import { beregnSkyggeFakta, terminalFraStatus } from "./flytFakta";

/**
 * F3.1 bevis-krav (cowork): avledStatus(beregnSkyggeFakta(...)) REPRODUSERER statusen som
 * skrives i dag for alle skrivesteder — eneste dokumenterte unntak: in_progress → received (Q1).
 * Beviser at skygge-fakta er atferds-bevarende før noe leser dem.
 */
const FLYT: FlytPosisjonLedd[] = [
  { posisjon: 1, klassifisering: "utfor", kanTerminereUtenBall: false, brukerIder: new Set(["u-opp"]), gruppeIder: new Set(), faggruppeIder: new Set() },
  { posisjon: 2, klassifisering: "kontroll", kanTerminereUtenBall: false, brukerIder: new Set(["u-mott"]), gruppeIder: new Set(), faggruppeIder: new Set() },
];

// Reproduksjon: fakta beregnet for effektivStatus avleder tilbake til samme status.
function rundtur(effektivStatus: string, nyStatusRaw = effektivStatus): string {
  const fakta = beregnSkyggeFakta({
    effektivStatus,
    nyStatusRaw,
    ledd: FLYT,
    recipientUserId: "u-mott",
    bestillerUserId: "u-opp",
  });
  return avledStatus(fakta).status;
}

describe("F3.1 beregnSkyggeFakta — avledStatus reproduserer status", () => {
  it("draft → draft (ikke sendt)", () => {
    expect(rundtur("draft")).toBe("draft");
  });

  it("received → received (sendt, frem)", () => {
    expect(rundtur("received")).toBe("received");
  });

  it("sent mappes til received av kaller → received", () => {
    // Kaller sender effektivStatus="received" (sent→received-mapping skjer før beregnSkyggeFakta).
    expect(rundtur("received", "sent")).toBe("received");
  });

  it("responded → responded (retning=tilbake)", () => {
    expect(rundtur("responded")).toBe("responded");
  });

  it("terminaler reproduseres via terminal-feltet", () => {
    expect(rundtur("approved")).toBe("approved");
    expect(rundtur("dismissed")).toBe("dismissed");
    expect(rundtur("closed")).toBe("closed");
    expect(rundtur("cancelled")).toBe("cancelled");
  });

  it("DOKUMENTERT UNNTAK: in_progress → received (Q1-kollaps)", () => {
    expect(rundtur("in_progress")).toBe("received");
  });

  it("forwarded holder status (received), retning=paatvers ≠ tilbake", () => {
    const fakta = beregnSkyggeFakta({
      effektivStatus: "received",
      nyStatusRaw: "forwarded",
      ledd: FLYT,
      recipientUserId: "u-mott",
      bestillerUserId: "u-opp",
    });
    expect(fakta.retning).toBe("paatvers");
    expect(avledStatus(fakta).status).toBe("received");
  });
});

describe("F3.1 fakta-verdier", () => {
  it("sendt = false kun for draft", () => {
    expect(beregnSkyggeFakta({ effektivStatus: "draft", nyStatusRaw: "draft", ledd: FLYT }).sendt).toBe(false);
    expect(beregnSkyggeFakta({ effektivStatus: "received", nyStatusRaw: "sent", ledd: FLYT }).sendt).toBe(true);
  });

  it("aktivPosisjon matcher recipient-leddet", () => {
    expect(
      beregnSkyggeFakta({ effektivStatus: "received", nyStatusRaw: "sent", ledd: FLYT, recipientUserId: "u-mott" }).aktivPosisjon,
    ).toBe(2);
  });

  it("terminalFraStatus: rejected+dismissed → avvist (Q3-kollaps)", () => {
    expect(terminalFraStatus("dismissed")).toBe("avvist");
    expect(terminalFraStatus("rejected")).toBe("avvist");
    expect(terminalFraStatus("approved")).toBe("godkjent");
    expect(terminalFraStatus("received")).toBeNull();
  });
});
