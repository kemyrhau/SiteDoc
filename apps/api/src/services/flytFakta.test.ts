import { describe, it, expect } from "vitest";
import { avledStatus, type FlytPosisjonLedd } from "@sitedoc/shared";
import { beregnSkyggeFakta, terminalFraStatus, avledetStatus } from "./flytFakta";

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

describe("F3.2 avledetStatus (avledStatus = eneste status-skriver)", () => {
  it("opprett standard (!sendt) → draft", () => {
    expect(avledetStatus({ retning: null, terminal: null, sendt: false })).toBe("draft");
  });

  it("opprett HMS (sendt, ingen terminal) → received (transient «sent» kollapser)", () => {
    // F3.2 bevisst endring #2: HMS-opprett skrev «sent» før; nå «Hos 2» = received.
    expect(avledetStatus({ retning: null, terminal: null, sendt: true })).toBe("received");
  });

  it("HMS-besvar/gjenåpne (retning=tilbake) → responded", () => {
    expect(avledetStatus({ retning: "tilbake", terminal: null, sendt: true })).toBe("responded");
  });

  it("HMS-lukk (terminal=lukket) → closed", () => {
    expect(avledetStatus({ retning: "frem", terminal: "lukket", sendt: true })).toBe("closed");
  });

  it("firma-terminaler avledes fra terminal-feltet", () => {
    expect(avledetStatus({ retning: "frem", terminal: "godkjent", sendt: true })).toBe("approved");
    expect(avledetStatus({ retning: "frem", terminal: "avvist", sendt: true })).toBe("dismissed");
  });

  it("BEVISST ENDRING #1: firma in_progress-input (terminal=null, sendt) → received (Q1)", () => {
    expect(avledetStatus({ retning: "frem", terminal: null, sendt: true })).toBe("received");
  });
});
