import { describe, it, expect } from "vitest";
import {
  nesteLedd,
  forrigeBallLedd,
  avledStatus,
  harBallenPosisjon,
  retningsrettigheter,
  finnPosisjon,
  gjenapnePosisjon,
  utledMottakerForPosisjon,
  byggPosisjonsLedd,
  type FlytPosisjonLedd,
  type LeddKlassifisering,
  type FlytBruker,
  type RaFlytMedlem,
} from "./flytPosisjon";
import { beregnHarBallen } from "./flytRolle";

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

/**
 * Q2 divergens-test (fabel-krav): kjør NY posisjon-basert harBallenPosisjon vs GAMMEL
 * recipient-basert beregnHarBallen mot samme fixtures. Distinkt-person-scenariet SKAL
 * divergere — det beviser at posisjon-modellen er riktig og recipient-modellen er buggen.
 * Dokumenterer HVILKE saker som divergerer, så Fase 4-byttet av konsumenter er bevisst.
 */
describe("Q2 divergens: harBallenPosisjon (ny) vs beregnHarBallen (gammel)", () => {
  // Kenneths 31.07-flyt med DISTINKTE personer per ledd (pilot-scenariet).
  const A = "person-A-oppretter";
  const B = "person-B-bestiller";
  const C = "person-C-utforer";
  const D = "person-D-godkjenner";
  const FLYT = [
    ledd(1, "utfor", { brukere: [A] }),
    ledd(2, "kontroll", { brukere: [B] }),
    ledd(3, "utfor", { brukere: [C] }),
    ledd(4, "kontroll", { brukere: [D] }),
  ];

  // Kjør begge modeller for én seer mot én dokumenttilstand.
  function begge(
    dok: { status: string; aktivPosisjon: number | null; recipientUserId?: string | null; bestillerUserId?: string | null },
    seer: string,
  ): { gammel: boolean; ny: boolean } {
    return {
      gammel: beregnHarBallen(
        {
          status: dok.status,
          bestillerUserId: dok.bestillerUserId ?? A,
          recipientUserId: dok.recipientUserId ?? null,
          recipientGroupId: null,
        },
        { userId: seer, gruppeIder: [] },
      ),
      ny: harBallenPosisjon(FLYT, dok.aktivPosisjon, bruker({ userId: seer })),
    };
  }

  it("KONSISTENT data (recipient = personen på aktivPosisjon) → modellene ENIGE", () => {
    // Dok korrekt hos godkjenner (posisjon 4), recipient = D.
    const dok = { status: "received", aktivPosisjon: 4, recipientUserId: D };
    for (const seer of [A, B, C, D]) {
      const { gammel, ny } = begge(dok, seer);
      expect(ny).toBe(gammel); // ingen divergens når dataene stemmer
    }
    expect(begge(dok, D).ny).toBe(true); // godkjenner har ballen (begge)
  });

  it("PILOT-BUG (recipient stale hos bestiller mens posisjon = godkjenner) → DIVERGERER, ny er riktig", () => {
    // Gammel ruting lot recipient bli hos bestiller (B) mens ballen egentlig er hos
    // godkjenner (posisjon 4). Dette er «bestiller sitter med ballen, godkjenner varsles aldri».
    const dok = { status: "responded", aktivPosisjon: 4, recipientUserId: B };

    const bestiller = begge(dok, B);
    // Gammel: bestiller «har ballen» (recipient-match) — BUG. Ny: nei (ikke på posisjon 4).
    expect(bestiller.gammel).toBe(true);
    expect(bestiller.ny).toBe(false);
    expect(bestiller.ny).not.toBe(bestiller.gammel); // DIVERGERER

    const godkjenner = begge(dok, D);
    // Gammel: godkjenner har IKKE ballen (recipient≠D) — BUG. Ny: ja (på posisjon 4) — RIKTIG.
    expect(godkjenner.gammel).toBe(false);
    expect(godkjenner.ny).toBe(true);
    expect(godkjenner.ny).not.toBe(godkjenner.gammel); // DIVERGERER
  });

  it("rapport: samler OG teller divergente (seer)-saker i pilot-buggen", () => {
    const dok = { status: "responded", aktivPosisjon: 4, recipientUserId: B };
    const divergente: { seer: string; gammel: boolean; ny: boolean }[] = [];
    for (const seer of [A, B, C, D]) {
      const { gammel, ny } = begge(dok, seer);
      if (gammel !== ny) divergente.push({ seer, gammel, ny });
    }
    // Nøyaktig 2 seere divergerer: bestiller (gammel true→ny false) + godkjenner (gammel false→ny true).
    expect(divergente).toHaveLength(2);
    expect(divergente.map((d) => d.seer).sort()).toEqual([B, D].sort());
    // Dokumentert bevis: den nye modellen flytter «ballen» fra feil ledd (bestiller) til rett (godkjenner).
  });

  it("SAMME person i alle ledd (Kenneths opprinnelige test) → ingen harBallen-divergens (recipient=person og person er overalt)", () => {
    // Note: for harBallen spesifikt gir samme-person-flyten ingen divergens — begge sier
    // «du har ballen». Divergensen (og buggen) krever DISTINKTE personer (over). Dette
    // dokumenterer HVOR modellene er enige, så Fase 4-byttet er bevisst.
    const P = "samme-person";
    const sammeFlyt = [
      ledd(1, "utfor", { brukere: [P] }),
      ledd(2, "kontroll", { brukere: [P] }),
      ledd(3, "utfor", { brukere: [P] }),
      ledd(4, "kontroll", { brukere: [P] }),
    ];
    for (const pos of [1, 2, 3, 4]) {
      const gammel = beregnHarBallen(
        { status: "received", bestillerUserId: P, recipientUserId: P, recipientGroupId: null },
        { userId: P, gruppeIder: [] },
      );
      const ny = harBallenPosisjon(sammeFlyt, pos, bruker({ userId: P }));
      expect(ny).toBe(gammel); // enige (begge true)
      expect(ny).toBe(true);
    }
  });
});

/**
 * F3.3 bevis (skjerpet krav): Kenneths 31.07-sekvens med DISTINKTE personer per ledd.
 * Tolkning A (fabel-bindende): send=alltid forover (nesteLedd), besvar=alltid bakover
 * (forrigeBallLedd). Utførerens submit ER en Send → godkjenner. Beviser at pilot-buggen
 * (Send hopper bestiller / Besvar går bakover til vilkårlig avsender) er løst.
 */
describe("F3.3 utledMottakerForPosisjon + 31.07-sekvens (distinkte personer)", () => {
  const A = "reg-A", B = "best-B", C = "utf-C", D = "godk-D";
  const medlem = (
    steg: number,
    klassifisering: LeddKlassifisering,
    o: { brukerId?: string; gruppeId?: string; faggruppeId?: string; erHovedansvarlig?: boolean } = {},
  ): RaFlytMedlem => ({
    steg,
    klassifisering,
    kanTerminereUtenBall: false,
    erHovedansvarlig: o.erHovedansvarlig ?? false,
    brukerId: o.brukerId ?? null,
    gruppeId: o.gruppeId ?? null,
    faggruppeId: o.faggruppeId ?? null,
  });
  // reg(1)→best(2,kontroll)→utf(3)→godk(4,kontroll), hver med én distinkt person.
  const MEDLEMMER = [
    medlem(1, "utfor", { brukerId: A }),
    medlem(2, "kontroll", { brukerId: B }),
    medlem(3, "utfor", { brukerId: C }),
    medlem(4, "kontroll", { brukerId: D }),
  ];
  const LEDD = byggPosisjonsLedd(MEDLEMMER);
  const mottaker = (pos: number) => utledMottakerForPosisjon(MEDLEMMER, pos, A);

  it("utledMottakerForPosisjon → riktig person per posisjon", () => {
    expect(mottaker(1)).toEqual({ recipientUserId: A, recipientGroupId: null });
    expect(mottaker(2)).toEqual({ recipientUserId: B, recipientGroupId: null });
    expect(mottaker(3)).toEqual({ recipientUserId: C, recipientGroupId: null });
    expect(mottaker(4)).toEqual({ recipientUserId: D, recipientGroupId: null });
  });

  it("SEND treffer bestiller (ikke hopp): fra Ledd 1 → 2 = bestiller B", () => {
    const nyPos = nesteLedd(LEDD, 1);
    expect(nyPos).toBe(2);
    expect(mottaker(nyPos!)).toEqual({ recipientUserId: B, recipientGroupId: null });
  });

  it("SEND fra utfører treffer godkjenner (Tolkning A): fra 3 → 4 = godkjenner D", () => {
    const nyPos = nesteLedd(LEDD, 3);
    expect(nyPos).toBe(4);
    expect(mottaker(nyPos!)).toEqual({ recipientUserId: D, recipientGroupId: null });
  });

  it("BESVAR fra godkjenner går tilbake til utfører (retur): fra 4 → 3 = utfører C", () => {
    const nyPos = forrigeBallLedd(LEDD, 4);
    expect(nyPos).toBe(3);
    expect(mottaker(nyPos!)).toEqual({ recipientUserId: C, recipientGroupId: null });
  });

  it("full Send-sekvens 1→2→3→4 gir riktig person-rekke (ingen hopp, ingen bakover-til-avsender)", () => {
    const rekke: string[] = [];
    let pos = 1;
    let neste = nesteLedd(LEDD, pos);
    while (neste !== null) {
      rekke.push(mottaker(neste)!.recipientUserId!);
      pos = neste;
      neste = nesteLedd(LEDD, pos);
    }
    expect(rekke).toEqual([B, C, D]); // bestiller → utfører → godkjenner
  });

  it("E1: null-medlem oppretter-boks (HMS Ledd 1) → bestillerUserId", () => {
    const hms = [medlem(1, "kontroll"), medlem(2, "kontroll", { gruppeId: "g-hms" })];
    expect(utledMottakerForPosisjon(hms, 1, "opp-X")).toEqual({ recipientUserId: "opp-X", recipientGroupId: null });
    expect(utledMottakerForPosisjon(hms, 2, "opp-X")).toEqual({ recipientUserId: null, recipientGroupId: "g-hms" });
  });

  it("E5: faggruppe-ledd uten person/gruppe → null (behold gjeldende)", () => {
    const fg = [medlem(1, "utfor", { faggruppeId: "fg-1" })];
    expect(utledMottakerForPosisjon(fg, 1, "opp-X")).toBeNull();
  });

  it("hovedansvarlig-person vinner ved flertreff på samme steg", () => {
    const flere = [
      medlem(2, "kontroll", { brukerId: "p-vanlig" }),
      medlem(2, "kontroll", { brukerId: "p-hoved", erHovedansvarlig: true }),
    ];
    expect(utledMottakerForPosisjon(flere, 2, null)).toEqual({ recipientUserId: "p-hoved", recipientGroupId: null });
  });
});
