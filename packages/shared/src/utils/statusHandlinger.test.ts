import { describe, it, expect } from "vitest";
import {
  hentRolleFiltrertHandlinger,
  hentStatusHandlinger,
  erTillattForRolle,
  flytRettighetNoekkel,
  type StatusHandling,
  type RettighetsOverrides,
} from "./statusHandlinger";
import { isValidStatusTransition } from "./index";
import type { DokumentflytRolle } from "../types";

/**
 * Regresjonstest for de to rolle-gatene i statusHandlinger — nå på FIKSET oppførsel.
 *
 * Filen begynte som karakteriserings-test av dagens oppførsel (Fase B steg 1 — sikkerhets-
 * nettet før logikken ble rørt). I steg 2 er registrator-radene VENDT: en ren registrator
 * er ikke lenger superbruker. Diffen mot steg 1 viser presist hva som endret seg — kun
 * [REGISTRATOR]-radene; [ADMIN]- og [ROLLE]-radene står uendret.
 *
 * Semantikk som pinnes (post-Fase-B):
 *   - `erAdmin === true`         → full tilgang (alle handlinger / alle overganger)   [ADMIN — står]
 *   - `rolle === "registrator"`  → kun send/slett på EGEN kladd (ROLLE_HANDLINGER.registrator);
 *                                  redigering/lesing ligger i utledDokumentRettighet     [REGISTRATOR — vendt]
 *   - null-rolle                 → ingenting (sjekkes FØR erAdmin)
 *   - øvrige roller              → filtrert per ROLLE_HANDLINGER                        [ROLLE — står]
 *
 * Forventede verdier er hardkodet (ikke utledet fra `hentStatusHandlinger`) slik at
 * testen fanger en utilsiktet endring i universet også.
 */

/* ------------------------------------------------------------------ */
/*  hentRolleFiltrertHandlinger — hvilke handlinger vises i menyen     */
/* ------------------------------------------------------------------ */

interface HandlingRad {
  navn: string;
  status: string;
  rolle: DokumentflytRolle | null;
  erAdmin: boolean;
  /** Forventede nyStatus-verdier i rekkefølge */
  forventet: string[];
}

const HANDLING_MATRISE: HandlingRad[] = [
  // — null-rolle: ingenting, uavhengig av erAdmin (sjekkes før erAdmin) ——
  { navn: "null-rolle → tom (erAdmin=false)", status: "draft", rolle: null, erAdmin: false, forventet: [] },
  { navn: "null-rolle → tom selv med erAdmin=true (!rolle sjekkes først)", status: "draft", rolle: null, erAdmin: true, forventet: [] },

  // — [ADMIN — står] erAdmin=true gir alle handlinger ————————————————
  { navn: "[ADMIN] registrator+erAdmin, draft → alle", status: "draft", rolle: "registrator", erAdmin: true, forventet: ["sent", "deleted"] },
  { navn: "[ADMIN] registrator+erAdmin, responded → alle", status: "responded", rolle: "registrator", erAdmin: true, forventet: ["approved", "rejected", "forwarded"] },
  { navn: "[ADMIN] registrator+erAdmin, closed → tom (universet er tomt)", status: "closed", rolle: "registrator", erAdmin: true, forventet: [] },
  { navn: "[ADMIN] erAdmin overstyrer rolle-filter: bestiller+erAdmin, responded → alle", status: "responded", rolle: "bestiller", erAdmin: true, forventet: ["approved", "rejected", "forwarded"] },

  // — [REGISTRATOR — VENDT] Fase B: registrator sender/sletter EGEN kladd, ellers tom —
  { navn: "[REGISTRATOR] draft → send+slett (oppretter sender/sletter egen kladd)", status: "draft", rolle: "registrator", erAdmin: false, forventet: ["sent", "deleted"] },
  { navn: "[REGISTRATOR] sent → tom (fikset)", status: "sent", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] received → tom (fikset)", status: "received", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] in_progress → tom (fikset)", status: "in_progress", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] responded → tom (fikset: kan ikke lenger godkjenne)", status: "responded", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] rejected → send på nytt (venstre ende: retter opp returnert)", status: "rejected", rolle: "registrator", erAdmin: false, forventet: ["sent"] },
  { navn: "[REGISTRATOR] approved → tom (fikset)", status: "approved", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] cancelled → tom (fikset)", status: "cancelled", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] closed → tom (uendret)", status: "closed", rolle: "registrator", erAdmin: false, forventet: [] },

  // — [ROLLE — står] øvrige roller filtreres per ROLLE_HANDLINGER ————
  { navn: "[ROLLE] bestiller, draft → send+slett", status: "draft", rolle: "bestiller", erAdmin: false, forventet: ["sent", "deleted"] },
  { navn: "[ROLLE] bestiller, sent → trekk tilbake", status: "sent", rolle: "bestiller", erAdmin: false, forventet: ["cancelled"] },
  { navn: "[ROLLE] bestiller, approved → lukk (ikke videresend)", status: "approved", rolle: "bestiller", erAdmin: false, forventet: ["closed"] },
  { navn: "[ROLLE] bestiller, cancelled → gjenåpne (ikke slett)", status: "cancelled", rolle: "bestiller", erAdmin: false, forventet: ["draft"] },
  { navn: "[ROLLE] bestiller, received → tom (ingen eierskap)", status: "received", rolle: "bestiller", erAdmin: false, forventet: [] },
  { navn: "[ROLLE] bestiller, rejected → send på nytt (venstre ende)", status: "rejected", rolle: "bestiller", erAdmin: false, forventet: ["sent"] },
  { navn: "[ROLLE] utforer, received → besvar+videresend (ikke avvis)", status: "received", rolle: "utforer", erAdmin: false, forventet: ["responded", "forwarded"] },
  { navn: "[ROLLE] utforer, in_progress → besvar+tilbake+videresend", status: "in_progress", rolle: "utforer", erAdmin: false, forventet: ["responded", "sent", "forwarded"] },
  { navn: "[ROLLE] utforer, rejected → gjenoppta+videresend (ikke lukk)", status: "rejected", rolle: "utforer", erAdmin: false, forventet: ["in_progress", "forwarded"] },
  { navn: "[ROLLE] utforer, draft → tom", status: "draft", rolle: "utforer", erAdmin: false, forventet: [] },
  { navn: "[ROLLE] godkjenner, responded → godkjenn+tilbake+videresend", status: "responded", rolle: "godkjenner", erAdmin: false, forventet: ["approved", "rejected", "forwarded"] },
  { navn: "[ROLLE] godkjenner, draft → tom", status: "draft", rolle: "godkjenner", erAdmin: false, forventet: [] },
];

describe("hentRolleFiltrertHandlinger — karakterisering av dagens oppførsel", () => {
  it.each(HANDLING_MATRISE)("$navn", ({ status, rolle, erAdmin, forventet }) => {
    const resultat = hentRolleFiltrertHandlinger(status, rolle, erAdmin);
    expect(resultat.map((h: StatusHandling) => h.nyStatus)).toEqual(forventet);
  });
});

/* ------------------------------------------------------------------ */
/*  erTillattForRolle — serverens rollevalidering (sikkerhetsgaten)    */
/* ------------------------------------------------------------------ */

interface TillattRad {
  navn: string;
  rolle: DokumentflytRolle | null;
  fra: string;
  til: string;
  erAdmin: boolean;
  forventet: boolean;
}

const TILLATT_MATRISE: TillattRad[] = [
  // — null-rolle: aldri (sjekkes før erAdmin) ————————————————————————
  { navn: "null-rolle → false (erAdmin=false)", rolle: null, fra: "draft", til: "sent", erAdmin: false, forventet: false },
  { navn: "null-rolle → false selv med erAdmin=true", rolle: null, fra: "draft", til: "sent", erAdmin: true, forventet: false },

  // — [ADMIN — står] erAdmin=true passerer alt ——————————————————————
  { navn: "[ADMIN] registrator+erAdmin, draft→sent → true", rolle: "registrator", fra: "draft", til: "sent", erAdmin: true, forventet: true },
  { navn: "[ADMIN] registrator+erAdmin, ulovlig draft→closed → true", rolle: "registrator", fra: "draft", til: "closed", erAdmin: true, forventet: true },
  { navn: "[ADMIN] erAdmin overstyrer rolle: bestiller+erAdmin, responded→approved → true", rolle: "bestiller", fra: "responded", til: "approved", erAdmin: true, forventet: true },

  // — [REGISTRATOR — VENDT] Fase B: kun send/slett egen kladd; ingen andre overganger —
  { navn: "[REGISTRATOR] draft→sent → true (sender det hun opprettet)", rolle: "registrator", fra: "draft", til: "sent", erAdmin: false, forventet: true },
  { navn: "[REGISTRATOR] draft→deleted → true (sletter egen kladd)", rolle: "registrator", fra: "draft", til: "deleted", erAdmin: false, forventet: true },
  { navn: "[REGISTRATOR] rejected→sent → true (venstre ende: retter opp returnert, sender mot høyre)", rolle: "registrator", fra: "rejected", til: "sent", erAdmin: false, forventet: true },
  { navn: "[REGISTRATOR] responded→approved → false (kan ikke godkjenne)", rolle: "registrator", fra: "responded", til: "approved", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] received→responded → false", rolle: "registrator", fra: "received", til: "responded", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] ulovlig draft→closed → false (kun sent/deleted i kladd)", rolle: "registrator", fra: "draft", til: "closed", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] terminal closed→draft → false", rolle: "registrator", fra: "closed", til: "draft", erAdmin: false, forventet: false },

  // — [ROLLE — står] øvrige roller per ROLLE_HANDLINGER ——————————————
  { navn: "[ROLLE] bestiller, draft→sent → true", rolle: "bestiller", fra: "draft", til: "sent", erAdmin: false, forventet: true },
  { navn: "[ROLLE] bestiller, draft→deleted → true", rolle: "bestiller", fra: "draft", til: "deleted", erAdmin: false, forventet: true },
  { navn: "[ROLLE] bestiller, responded→approved → false (ikke eid)", rolle: "bestiller", fra: "responded", til: "approved", erAdmin: false, forventet: false },
  { navn: "[ROLLE] bestiller, closed→draft → false (ingen oppføring)", rolle: "bestiller", fra: "closed", til: "draft", erAdmin: false, forventet: false },
  { navn: "[ROLLE] bestiller, rejected→sent → true (venstre ende)", rolle: "bestiller", fra: "rejected", til: "sent", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, rejected→sent → false (ikke venstre ende)", rolle: "utforer", fra: "rejected", til: "sent", erAdmin: false, forventet: false },
  { navn: "[ROLLE] utforer, received→responded → true", rolle: "utforer", fra: "received", til: "responded", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, received→cancelled → false (avvis ikke eid)", rolle: "utforer", fra: "received", til: "cancelled", erAdmin: false, forventet: false },
  { navn: "[ROLLE] utforer, in_progress→sent → true (send tilbake)", rolle: "utforer", fra: "in_progress", til: "sent", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, rejected→in_progress → true (gjenoppta)", rolle: "utforer", fra: "rejected", til: "in_progress", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, responded→approved → true", rolle: "godkjenner", fra: "responded", til: "approved", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, responded→rejected → true", rolle: "godkjenner", fra: "responded", til: "rejected", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, draft→sent → false (ikke eid)", rolle: "godkjenner", fra: "draft", til: "sent", erAdmin: false, forventet: false },
];

describe("erTillattForRolle — karakterisering av dagens oppførsel", () => {
  it.each(TILLATT_MATRISE)("$navn", ({ rolle, fra, til, erAdmin, forventet }) => {
    expect(erTillattForRolle(rolle, fra, til, erAdmin)).toBe(forventet);
  });
});

/* ------------------------------------------------------------------ */
/*  isValidStatusTransition — statusmaskinen (linjemodell-vedtak)       */
/* ------------------------------------------------------------------ */

describe("isValidStatusTransition — rejected → sent (flytmodell-vedtak-2026-07-22)", () => {
  it("rejected → sent er lovlig (returnert dokument sendes mot høyre igjen)", () => {
    expect(isValidStatusTransition("rejected", "sent")).toBe(true);
  });
  it("rejected → in_progress fortsatt lovlig (gjenoppta — uendret)", () => {
    expect(isValidStatusTransition("rejected", "in_progress")).toBe(true);
  });
  it("rejected → closed fortsatt lovlig (uendret)", () => {
    expect(isValidStatusTransition("rejected", "closed")).toBe(true);
  });
  it("rejected → approved ulovlig (kontroll — ingen snarvei til godkjent)", () => {
    expect(isValidStatusTransition("rejected", "approved")).toBe(false);
  });
});

describe("isValidStatusTransition — closed → draft (inert i A, wires i B med Farlig sone)", () => {
  it("closed → draft er lovlig i statusmaskinen (ingen handling utløser den ennå)", () => {
    expect(isValidStatusTransition("closed", "draft")).toBe(true);
  });
  it("closed → sent fortsatt ulovlig (kun draft er åpnet fra closed)", () => {
    expect(isValidStatusTransition("closed", "sent")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  hentStatusHandlinger — rejected tilbyr «Send på nytt» (sent)        */
/* ------------------------------------------------------------------ */

describe("hentStatusHandlinger — rejected → sent («Send på nytt»)", () => {
  it("rejected-universet inneholder en sent-handling", () => {
    const nyStatuser = hentStatusHandlinger("rejected").map((h) => h.nyStatus);
    expect(nyStatuser).toContain("sent");
  });
  it("sent-handlingen bruker flytspråk-etiketten «Send på nytt»", () => {
    const sendPaaNytt = hentStatusHandlinger("rejected").find((h) => h.nyStatus === "sent");
    expect(sendPaaNytt?.tekstNoekkel).toBe("statushandling.sendPaaNytt");
  });
});

/* ------------------------------------------------------------------ */
/*  RettighetsOverrides — config-laget (Kloss 1 plumbing)              */
/* ------------------------------------------------------------------ */

describe("overrides — tom map == uten overrides (bit-identisk-bevis for config-substratet)", () => {
  // Kloss 1-invariant: config-laget skal ikke endre atferd før et firma faktisk
  // registrerer et avvik. Undefined og en tom map må gi nøyaktig default-laget.
  const tom: RettighetsOverrides = {};

  it("erTillattForRolle: tom map lik undefined for hele TILLATT_MATRISE", () => {
    for (const { rolle, fra, til, erAdmin } of TILLATT_MATRISE) {
      const uten = erTillattForRolle(rolle, fra, til, erAdmin);
      const med = erTillattForRolle(rolle, fra, til, erAdmin, tom);
      expect(med).toBe(uten);
    }
  });

  it("hentRolleFiltrertHandlinger: tom map lik undefined for hele HANDLING_MATRISE", () => {
    for (const { status, rolle, erAdmin } of HANDLING_MATRISE) {
      const uten = hentRolleFiltrertHandlinger(status, rolle, erAdmin).map((h) => h.nyStatus);
      const med = hentRolleFiltrertHandlinger(status, rolle, erAdmin, tom).map((h) => h.nyStatus);
      expect(med).toEqual(uten);
    }
  });
});

describe("overrides — invariant: en override kan aldri skape en overgang statusmaskinen ikke har", () => {
  it("positiv override på ulovlig overgang (godkjenner draft→closed) snittes bort", () => {
    // draft→closed finnes ikke i validTransitions — en admin-override kan ikke innføre den.
    expect(isValidStatusTransition("draft", "closed")).toBe(false);
    const override: RettighetsOverrides = {
      [flytRettighetNoekkel("godkjenner", "draft", "closed")]: true,
    };
    expect(erTillattForRolle("godkjenner", "draft", "closed", false, override)).toBe(false);
  });

  it("positiv override på lovlig, ikke-default overgang (godkjenner draft→sent) honoreres", () => {
    // draft→sent ER i validTransitions men ikke i godkjenners default → override slår den på.
    expect(isValidStatusTransition("draft", "sent")).toBe(true);
    const override: RettighetsOverrides = {
      [flytRettighetNoekkel("godkjenner", "draft", "sent")]: true,
    };
    expect(erTillattForRolle("godkjenner", "draft", "sent", false, override)).toBe(true);
  });

  it("negativ override slår av en default-celle (bestiller draft→sent → av)", () => {
    const override: RettighetsOverrides = {
      [flytRettighetNoekkel("bestiller", "draft", "sent")]: false,
    };
    expect(erTillattForRolle("bestiller", "draft", "sent", false)).toBe(true);
    expect(erTillattForRolle("bestiller", "draft", "sent", false, override)).toBe(false);
  });

  it("erAdmin-bypass er upåvirket av overrides (negativ override kan ikke låse ute admin)", () => {
    const override: RettighetsOverrides = {
      [flytRettighetNoekkel("bestiller", "draft", "sent")]: false,
    };
    expect(erTillattForRolle("bestiller", "draft", "sent", true, override)).toBe(true);
  });
});
