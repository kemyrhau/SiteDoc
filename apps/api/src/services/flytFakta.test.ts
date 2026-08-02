import { describe, it, expect } from "vitest";
import { avledStatus, type FlytPosisjonLedd, type RaFlytMedlem, type FlytBruker } from "@sitedoc/shared";
import { beregnSkyggeFakta, terminalFraStatus, avledetStatus, beregnRuting } from "./flytFakta";

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

/**
 * § 2.4 (fabel alt. A, 2026-08-01): draft-overgangen (gjenåpne/trekk-tilbake) skal lande på
 * handlerens EGET ledд via `gjenapnePosisjon` — ikke lenger beholde terminal-/gjeldende posisjon.
 * Fikser den systematiske aktivPosisjon-buggen (approved@4 → gjenåpne → utkast beholdt pos 4).
 */
const raMedlem = (steg: number, brukerId: string, klassifisering: string): RaFlytMedlem => ({
  steg,
  klassifisering,
  kanTerminereUtenBall: false,
  erHovedansvarlig: false,
  brukerId,
  gruppeId: null,
  faggruppeId: null,
});
// 4-ledд: registrator(1) → bestiller(2) → utfører(3) → godkjenner(4). Speiler Kenneths live-flyt.
const FLYT4: RaFlytMedlem[] = [
  raMedlem(1, "u1", "utfor"),
  raMedlem(2, "u2", "kontroll"),
  raMedlem(3, "u3", "utfor"),
  raMedlem(4, "u4", "kontroll"),
];
const bruker = (userId: string, erAdmin = false): FlytBruker => ({ userId, gruppeIder: [], faggruppeIder: [], erAdmin });
const draftRuting = (naaPos: number, fraStatus: string, aapner?: FlytBruker | null) =>
  beregnRuting({ nyStatus: "draft", effektivStatus: "draft", medlemmer: FLYT4, naaPos, bestillerUserId: "u1", fraStatus, aapner });

describe("§ 2.4 gjenåpne/trekk-tilbake landing (beregnRuting draft-gren)", () => {
  it("REGRESJON (distinkt-person, §2.4): gjenåpne approved@4 av registrator (ledд 1) → lander på 1, IKKE 4", () => {
    const r = draftRuting(4, "approved", bruker("u1"));
    expect(r.aktivPosisjon).toBe(1); // §2.4 regel 1: åpnerens eget ledд
    expect(r.retning).toBe("frem"); // gjenåpne = ny start
    // Pilot-fiks D + #11 (2026-08-02): et gjenåpnet dok HAR forlatt ledд 1 → sendt=true → «Hos N»,
    // IKKE «Utkast». (Var tidligere sendt=false/draft = buggen KB2-010/bevis-09 rettet.)
    expect(r.sendt).toBe(true);
    expect(r.status).toBe("received");
  });

  it("REGRESJON (bevis-09, Kenneths all-samme-faggruppe): gjenåpne approved@4 av ledд-4-medlem → «Hos 4», ikke «Utkast»", () => {
    const r = draftRuting(4, "approved", bruker("u4"));
    expect(r.aktivPosisjon).toBe(4); // §2.4 regel 1: åpnerens eget (terminal) ledд
    expect(r.sendt).toBe(true);
    expect(r.status).toBe("received"); // «Hos 4» — nesteLedд(4)=null ⇒ klient viser «Godkjenn og fullfør»
  });

  it("REGRESJON (Runde-2 R1): trekk-tilbake received (dok@3) av avsender (ledд 2) → lander på 2, «Hos 2»", () => {
    const r = draftRuting(3, "received", bruker("u2"));
    expect(r.aktivPosisjon).toBe(2); // avsenderleddet
    // R1 (fabel, 2026-08-02): trekk-tilbake gir retning=frem + sendt=true → «Hos N» (received), IKKE
    // «Utkast»/«Besvart». REVERSERER pilot-fiks D-scopingen (som holdt trekk-tilbake på tilbake/false/draft).
    // Bakover-ness er historisk faktum i transferloggen, ikke en cache-distinksjon.
    expect(r.retning).toBe("frem");
    expect(r.sendt).toBe(true);
    expect(r.status).toBe("received");
  });

  it("§ 2.4 regel 3: admin UTENFOR flyten → samme boks (aktivPosisjon uendret), men gjenåpnet ⇒ «Hos N»", () => {
    const r = draftRuting(4, "approved", bruker("admin-x", true));
    expect(r.aktivPosisjon).toBe(4);
    expect(r.sendt).toBe(true); // gjenåpne fra terminal → sendt=true uansett hvem som åpner
  });

  it("bakoverkompat: uten `aapner` (ikke-draft-veier) → posisjon uendret (gammel fall-through)", () => {
    const r = draftRuting(4, "approved", null);
    expect(r.aktivPosisjon).toBe(4);
  });
});
