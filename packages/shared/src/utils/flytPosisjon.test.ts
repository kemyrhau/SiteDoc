import { describe, it, expect } from "vitest";
import {
  nesteLedd,
  forrigeBallLedd,
  avledStatus,
  harBallenPosisjon,
  retningsrettigheter,
  finnPosisjon,
  gjenapnePosisjon,
  type FlytPosisjonLedd,
  type LeddKlassifisering,
  type FlytBruker,
} from "./flytPosisjon";

// Kompakt ledd-bygger for tester. Medlemskap valgfritt.
function ledd(
  posisjon: number,
  klassifisering: LeddKlassifisering,
  opt: {
    kanTerminereUtenBall?: boolean;
    brukere?: string[];
    grupper?: string[];
    faggrupper?: string[];
  } = {},
): FlytPosisjonLedd {
  return {
    posisjon,
    klassifisering,
    kanTerminereUtenBall: opt.kanTerminereUtenBall ?? false,
    brukerIder: new Set(opt.brukere ?? []),
    gruppeIder: new Set(opt.grupper ?? []),
    faggruppeIder: new Set(opt.faggrupper ?? []),
  };
}

const bruker = (o: Partial<FlytBruker> & { userId: string }): FlytBruker => ({
  gruppeIder: [],
  faggruppeIder: [],
  erAdmin: false,
  ...o,
});

// De tre prototype-forhåndsvalgene (Flytmodell Prototype.dc.html) — fasit for oppførsel.
const STANDARD_4 = [
  ledd(1, "utfor"), // registrator/oppretter
  ledd(2, "kontroll"), // bestiller
  ledd(3, "utfor"), // utforer
  ledd(4, "kontroll"), // godkjenner
];
const MED_ORIENTERES = [
  ledd(1, "utfor"),
  ledd(2, "orienteres"), // skal ALDRI holde ballen
  ledd(3, "kontroll"),
  ledd(4, "utfor"),
];
const BESTILLER_SIST = [
  ledd(1, "utfor"), // oppretter
  ledd(2, "utfor"), // utforer
  ledd(3, "kontroll"), // bestiller til slutt
];

describe("nesteLedd (Send →)", () => {
  it("går til neste posisjon fremover", () => {
    expect(nesteLedd(STANDARD_4, 1)).toBe(2);
    expect(nesteLedd(STANDARD_4, 2)).toBe(3);
    expect(nesteLedd(STANDARD_4, 3)).toBe(4);
  });

  it("fra siste ledd finnes ingen neste → null (⇒ Godkjenn og fullfør)", () => {
    expect(nesteLedd(STANDARD_4, 4)).toBeNull();
  });

  it("hopper over Orienteres-ledd", () => {
    // Fra 1: hopp 2 (orienteres) → 3
    expect(nesteLedd(MED_ORIENTERES, 1)).toBe(3);
    // 2 kan aldri holde ballen, men om aktivPosisjon=1 skal 2 aldri velges
    expect(nesteLedd(MED_ORIENTERES, 3)).toBe(4);
    expect(nesteLedd(MED_ORIENTERES, 4)).toBeNull();
  });

  it("«bestiller sist» gir Godkjenn-og-fullfør naturlig (ingen spesialkode)", () => {
    expect(nesteLedd(BESTILLER_SIST, 1)).toBe(2);
    expect(nesteLedd(BESTILLER_SIST, 2)).toBe(3);
    expect(nesteLedd(BESTILLER_SIST, 3)).toBeNull(); // siste = Godkjenn og fullfør
  });

  it("håndterer usortert input", () => {
    const usortert = [ledd(3, "kontroll"), ledd(1, "utfor"), ledd(2, "utfor")];
    expect(nesteLedd(usortert, 1)).toBe(2);
    expect(nesteLedd(usortert, 2)).toBe(3);
  });
});

describe("forrigeBallLedd (Besvar ←)", () => {
  it("går til nærmeste posisjon bakover (kontroll ELLER utfor)", () => {
    expect(forrigeBallLedd(STANDARD_4, 4)).toBe(3); // utfor er gyldig ←-mål
    expect(forrigeBallLedd(STANDARD_4, 3)).toBe(2);
    expect(forrigeBallLedd(STANDARD_4, 2)).toBe(1);
  });

  it("fra første ledd finnes ingen bakover → null", () => {
    expect(forrigeBallLedd(STANDARD_4, 1)).toBeNull();
  });

  it("hopper KUN over Orienteres, ikke utfor", () => {
    // Fra 3: bakover er 2 (orienteres, hopp) → 1 (utfor)
    expect(forrigeBallLedd(MED_ORIENTERES, 3)).toBe(1);
    // Fra 4: bakover er 3 (kontroll) — treffes direkte
    expect(forrigeBallLedd(MED_ORIENTERES, 4)).toBe(3);
  });
});

describe("avledStatus (§ 2.3)", () => {
  it("terminal → terminal-etikett + status-map (Q3: avvist→dismissed)", () => {
    expect(avledStatus({ aktivPosisjon: 4, retning: "frem", terminal: "godkjent", sendt: true })).toEqual({
      status: "approved",
      visning: "terminal",
    });
    expect(avledStatus({ aktivPosisjon: 3, retning: "frem", terminal: "avvist", sendt: true })).toEqual({
      status: "dismissed",
      visning: "terminal",
    });
    expect(avledStatus({ aktivPosisjon: 2, retning: "frem", terminal: "lukket", sendt: true })).toEqual({
      status: "closed",
      visning: "terminal",
    });
    expect(avledStatus({ aktivPosisjon: 1, retning: "frem", terminal: "avbrutt", sendt: true })).toEqual({
      status: "cancelled",
      visning: "terminal",
    });
  });

  it("terminal vinner over sendt/retning", () => {
    expect(avledStatus({ aktivPosisjon: 4, retning: "tilbake", terminal: "godkjent", sendt: false }).visning).toBe(
      "terminal",
    );
  });

  it("!sendt → utkast", () => {
    expect(avledStatus({ aktivPosisjon: 1, retning: null, terminal: null, sendt: false })).toEqual({
      status: "draft",
      visning: "utkast",
    });
  });

  it("retning=tilbake → besvart", () => {
    expect(avledStatus({ aktivPosisjon: 1, retning: "tilbake", terminal: null, sendt: true })).toEqual({
      status: "responded",
      visning: "besvart",
    });
  });

  it("ellers → hos (Q1-kollaps: received)", () => {
    expect(avledStatus({ aktivPosisjon: 2, retning: "frem", terminal: null, sendt: true })).toEqual({
      status: "received",
      visning: "hos",
    });
  });
});

describe("harBallenPosisjon (Q2)", () => {
  const flyt = [
    ledd(1, "utfor", { brukere: ["u-opp"] }),
    ledd(2, "kontroll", { grupper: ["g-hms"] }),
  ];

  it("bruker er medlem av leddet på aktivPosisjon", () => {
    expect(harBallenPosisjon(flyt, 1, bruker({ userId: "u-opp" }))).toBe(true);
    expect(harBallenPosisjon(flyt, 2, bruker({ userId: "x", gruppeIder: ["g-hms"] }))).toBe(true);
  });

  it("bruker på FEIL posisjon har ikke ballen", () => {
    expect(harBallenPosisjon(flyt, 2, bruker({ userId: "u-opp" }))).toBe(false);
  });

  it("aktivPosisjon null → aldri ballen", () => {
    expect(harBallenPosisjon(flyt, null, bruker({ userId: "u-opp" }))).toBe(false);
  });
});

describe("retningsrettigheter", () => {
  it("ball-holder kan Send + Besvar", () => {
    const r = retningsrettigheter({ harBallen: true, seerLedd: ledd(2, "kontroll"), kanVideresende: false });
    expect(r.kanSende).toBe(true);
    expect(r.kanBesvare).toBe(true);
  });

  it("uten ballen: verken Send eller Besvar", () => {
    const r = retningsrettigheter({ harBallen: false, seerLedd: ledd(2, "kontroll"), kanVideresende: false });
    expect(r.kanSende).toBe(false);
    expect(r.kanBesvare).toBe(false);
  });

  it("Orienteres har aldri retningshandlinger", () => {
    const r = retningsrettigheter({ harBallen: true, seerLedd: ledd(2, "orienteres"), kanVideresende: false });
    expect(r.kanSende).toBe(false);
    expect(r.kanBesvare).toBe(false);
  });

  it("Videresend ↔ styres av H3-flagget", () => {
    expect(retningsrettigheter({ harBallen: false, seerLedd: null, kanVideresende: true }).kanVideresende).toBe(true);
  });

  it("kanTerminere: ball-holder ELLER kontroll-ledd m/ kanTerminereUtenBall (F3/HMS)", () => {
    // Uten ball, men kanTerminereUtenBall → kan terminere
    expect(
      retningsrettigheter({
        harBallen: false,
        seerLedd: ledd(2, "kontroll", { kanTerminereUtenBall: true }),
        kanVideresende: false,
      }).kanTerminere,
    ).toBe(true);
    // Uten ball og uten flagg → kan ikke
    expect(
      retningsrettigheter({ harBallen: false, seerLedd: ledd(2, "kontroll"), kanVideresende: false }).kanTerminere,
    ).toBe(false);
  });
});

describe("finnPosisjon (delt matcher, Q4)", () => {
  const flyt = [
    ledd(1, "utfor", { brukere: ["u-opp"] }),
    ledd(2, "kontroll", { grupper: ["g-hms"] }),
    ledd(3, "utfor", { brukere: ["u-utf"] }),
  ];

  it("ikke sendt / draft → laveste posisjon (oppretter)", () => {
    expect(finnPosisjon({ ledd: flyt, status: "draft", sendt: false, bestillerUserId: "u-opp" })).toBe(1);
  });

  it("recipientUserId → leddet brukeren er i", () => {
    expect(finnPosisjon({ ledd: flyt, status: "received", sendt: true, recipientUserId: "u-utf" })).toBe(3);
  });

  it("recipientGroupId → leddet gruppen er i", () => {
    expect(finnPosisjon({ ledd: flyt, status: "received", sendt: true, recipientGroupId: "g-hms" })).toBe(2);
  });

  it("fallback til oppretter-ledd", () => {
    expect(finnPosisjon({ ledd: flyt, status: "received", sendt: true, bestillerUserId: "u-opp" })).toBe(1);
  });

  it("ubestembar → null", () => {
    expect(finnPosisjon({ ledd: flyt, status: "received", sendt: true, recipientUserId: "ukjent" })).toBeNull();
  });
});

describe("gjenapnePosisjon (§ 2.4)", () => {
  const flyt = [
    ledd(1, "utfor", { brukere: ["u-opp"] }),
    ledd(2, "orienteres", { brukere: ["u-orient"] }),
    ledd(3, "kontroll", { brukere: ["u-godk"] }),
  ];

  it("regel 1: ballen går til åpnerens eget ledd", () => {
    // Åpner er oppretter (ledd 1). Dok ligger terminalt hos 3. Gjenåpne → 1.
    expect(gjenapnePosisjon({ ledd: flyt, aktivPosisjon: 3, aapner: bruker({ userId: "u-opp" }) })).toBe(1);
  });

  it("regel 2: åpner ikke i dok-leddet → nærmeste eget ball-ledd", () => {
    // Åpner er godkjenner (ledd 3), dok ligger hos 1 → nærmeste eget = 3.
    expect(gjenapnePosisjon({ ledd: flyt, aktivPosisjon: 1, aapner: bruker({ userId: "u-godk" }) })).toBe(3);
  });

  it("regel 2: Orienteres-ledd kan ikke motta ballen", () => {
    // Åpner er kun medlem av orienteres-leddet (2) → ingen gyldig eget ball-ledd → ikke admin → null.
    expect(gjenapnePosisjon({ ledd: flyt, aktivPosisjon: 3, aapner: bruker({ userId: "u-orient" }) })).toBeNull();
  });

  it("regel 3: admin utenfor flyten → samme boks", () => {
    expect(
      gjenapnePosisjon({ ledd: flyt, aktivPosisjon: 3, aapner: bruker({ userId: "admin", erAdmin: true }) }),
    ).toBe(3);
  });
});

describe("prototype-forhåndsvalg — Send-sekvens gir identisk logg", () => {
  // Simulerer «send fremover til fullført» og samler posisjons-loggen.
  function sendSekvens(flyt: FlytPosisjonLedd[]): number[] {
    const logg: number[] = [1];
    let pos = 1;
    let neste = nesteLedd(flyt, pos);
    while (neste !== null) {
      logg.push(neste);
      pos = neste;
      neste = nesteLedd(flyt, pos);
    }
    return logg;
  }

  it("standard 4 ledd → 1,2,3,4", () => {
    expect(sendSekvens(STANDARD_4)).toEqual([1, 2, 3, 4]);
  });

  it("med Orienteres → 1,3,4 (ledd 2 hoppes)", () => {
    expect(sendSekvens(MED_ORIENTERES)).toEqual([1, 3, 4]);
  });

  it("bestiller sist → 1,2,3 (siste = Godkjenn og fullfør)", () => {
    expect(sendSekvens(BESTILLER_SIST)).toEqual([1, 2, 3]);
  });
});
