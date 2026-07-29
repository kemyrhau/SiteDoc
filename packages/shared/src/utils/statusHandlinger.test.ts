import { describe, it, expect } from "vitest";
import {
  hentRolleFiltrertHandlinger,
  hentStatusHandlinger,
  hentHandlingEierRoller,
  erTillattForRolle,
  flytRettighetNoekkel,
  PROSJEKTADMIN_ROLLE,
  type StatusHandling,
  type RettighetsOverrides,
} from "./statusHandlinger";
import {
  isValidStatusTransition,
  statusKreverBegrunnelse,
  harMinstEttUtfyltFelt,
  erUtfyllbartFelt,
  feltErBesvart,
} from "./index";
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
  { navn: "[ADMIN] registrator+erAdmin, responded → alle (F3: Send tilbake → in_progress; §8A: Send fjernet)", status: "responded", rolle: "registrator", erAdmin: true, forventet: ["approved", "in_progress", "forwarded"] },
  { navn: "[ADMIN] registrator+erAdmin, closed → gjenåpne (F4: universet har Gjenåpne)", status: "closed", rolle: "registrator", erAdmin: true, forventet: ["draft"] },
  { navn: "[ADMIN] erAdmin overstyrer rolle-filter: bestiller+erAdmin, responded → alle (§8A: Send fjernet)", status: "responded", rolle: "bestiller", erAdmin: true, forventet: ["approved", "in_progress", "forwarded"] },

  // — [REGISTRATOR — VENDT] Fase B: registrator sender/sletter EGEN kladd, ellers tom —
  { navn: "[REGISTRATOR] draft → send+slett (oppretter sender/sletter egen kladd)", status: "draft", rolle: "registrator", erAdmin: false, forventet: ["sent", "deleted"] },
  { navn: "[REGISTRATOR] sent → tom (F2: transient, ingen handlinger)", status: "sent", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] received → trekk tilbake (F2: avsender-siden henter til kladd)", status: "received", rolle: "registrator", erAdmin: false, forventet: ["draft"] },
  { navn: "[REGISTRATOR] in_progress → tom (fikset)", status: "in_progress", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] responded → tom (fikset: kan ikke lenger godkjenne)", status: "responded", rolle: "registrator", erAdmin: false, forventet: [] },
  { navn: "[REGISTRATOR] rejected → tom (F3: rejected merget inn i in_progress, universet er tomt)", status: "rejected", rolle: "registrator", erAdmin: false, forventet: [] },
  // H6 (Godkjent = stoppsted): approved→closed fjernet, approved→draft (Gjenåpne) lagt til — Reg eier gjenåpne.
  { navn: "[REGISTRATOR] approved → gjenåpne (H6: Godkjent lukkes aldri, Reg eier gjenåpne)", status: "approved", rolle: "registrator", erAdmin: false, forventet: ["draft"] },
  // F4 (spec § 3–4): Gjenåpne fra alle avsluttede statuser eies av registrator (oppretter).
  { navn: "[REGISTRATOR] cancelled → gjenåpne (F4: Reg eier gjenåpne, legacy)", status: "cancelled", rolle: "registrator", erAdmin: false, forventet: ["draft"] },
  { navn: "[REGISTRATOR] closed → gjenåpne (F4)", status: "closed", rolle: "registrator", erAdmin: false, forventet: ["draft"] },
  { navn: "[REGISTRATOR] dismissed → gjenåpne (F4: åpner F1s terminal-status)", status: "dismissed", rolle: "registrator", erAdmin: false, forventet: ["draft"] },

  // — [ROLLE — står] øvrige roller filtreres per ROLLE_HANDLINGER ————
  { navn: "[ROLLE] bestiller, draft → send+slett", status: "draft", rolle: "bestiller", erAdmin: false, forventet: ["sent", "deleted"] },
  { navn: "[ROLLE] bestiller, sent → tom (F2: transient, trekk tilbake flyttet til received)", status: "sent", rolle: "bestiller", erAdmin: false, forventet: [] },
  // H6 (Godkjent = stoppsted): approved→closed fjernet — bestiller mister Lukk på Godkjent (gjenåpne eies av Reg + P-adm).
  { navn: "[ROLLE] bestiller, approved → tom (H6: Godkjent lukkes aldri, bestiller mister Lukk)", status: "approved", rolle: "bestiller", erAdmin: false, forventet: [] },
  { navn: "[ROLLE] bestiller, cancelled → tom (F4: gjenåpne flyttet til registrator, ikke bestiller)", status: "cancelled", rolle: "bestiller", erAdmin: false, forventet: [] },
  { navn: "[ROLLE] bestiller, received → trekk tilbake (F2: henter sendt hendelse til kladd)", status: "received", rolle: "bestiller", erAdmin: false, forventet: ["draft"] },
  { navn: "[ROLLE] bestiller, rejected → tom (F3: rejected merget inn i in_progress)", status: "rejected", rolle: "bestiller", erAdmin: false, forventet: [] },
  // F3 (matrise § 3): bestiller eier Lukk fra Under arbeid (in_progress→closed).
  { navn: "[ROLLE] bestiller, in_progress → lukk", status: "in_progress", rolle: "bestiller", erAdmin: false, forventet: ["closed"] },
  // F1: utfører eier Avvis (received→dismissed). H3: Videresend (forwarded) fjernet fra utfører-defaults.
  // §8A (2026-07-29): Send (received→sent) fjernet — recipient-løs no-op.
  { navn: "[ROLLE] utforer, received → besvar+avvis (§8A: Send fjernet; H3: ikke videresend)", status: "received", rolle: "utforer", erAdmin: false, forventet: ["responded", "dismissed"] },
  { navn: "[ROLLE] utforer, in_progress → besvar+send på nytt (H3: ikke videresend, ikke lukk)", status: "in_progress", rolle: "utforer", erAdmin: false, forventet: ["responded", "sent"] },
  { navn: "[ROLLE] utforer, rejected → tom (F3: rejected merget inn i in_progress)", status: "rejected", rolle: "utforer", erAdmin: false, forventet: [] },
  { navn: "[ROLLE] utforer, draft → tom", status: "draft", rolle: "utforer", erAdmin: false, forventet: [] },
  // H3: Videresend (forwarded) fjernet fra godkjenner-defaults. §8A: Send (responded→sent) fjernet.
  { navn: "[ROLLE] godkjenner, responded → godkjenn+send tilbake (F3: → in_progress; §8A: Send fjernet; H3: ikke videresend)", status: "responded", rolle: "godkjenner", erAdmin: false, forventet: ["approved", "in_progress"] },
  // F3 (matrise § 3): godkjenner eier Lukk fra Under arbeid (in_progress→closed).
  { navn: "[ROLLE] godkjenner, in_progress → lukk", status: "in_progress", rolle: "godkjenner", erAdmin: false, forventet: ["closed"] },
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
  { navn: "[REGISTRATOR] rejected→sent → false (F3: rejected merget inn i in_progress, ikke lenger venstre ende)", rolle: "registrator", fra: "rejected", til: "sent", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] responded→approved → false (kan ikke godkjenne)", rolle: "registrator", fra: "responded", til: "approved", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] received→responded → false", rolle: "registrator", fra: "received", til: "responded", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] ulovlig draft→closed → false (kun sent/deleted i kladd)", rolle: "registrator", fra: "draft", til: "closed", erAdmin: false, forventet: false },
  { navn: "[REGISTRATOR] closed→draft → true (F4: Gjenåpne eid av oppretteren)", rolle: "registrator", fra: "closed", til: "draft", erAdmin: false, forventet: true },
  { navn: "[REGISTRATOR] dismissed→draft → true (F4: Gjenåpne fra Avvist)", rolle: "registrator", fra: "dismissed", til: "draft", erAdmin: false, forventet: true },

  // — [ROLLE — står] øvrige roller per ROLLE_HANDLINGER ——————————————
  { navn: "[ROLLE] bestiller, draft→sent → true", rolle: "bestiller", fra: "draft", til: "sent", erAdmin: false, forventet: true },
  { navn: "[ROLLE] bestiller, draft→deleted → true", rolle: "bestiller", fra: "draft", til: "deleted", erAdmin: false, forventet: true },
  { navn: "[ROLLE] bestiller, responded→approved → false (ikke eid)", rolle: "bestiller", fra: "responded", til: "approved", erAdmin: false, forventet: false },
  { navn: "[ROLLE] bestiller, closed→draft → false (ingen oppføring)", rolle: "bestiller", fra: "closed", til: "draft", erAdmin: false, forventet: false },
  { navn: "[ROLLE] bestiller, rejected→sent → false (F3: rejected merget inn i in_progress)", rolle: "bestiller", fra: "rejected", til: "sent", erAdmin: false, forventet: false },
  // F3 (matrise § 3): Lukk fra Under arbeid eies av bestiller + godkjenner.
  { navn: "[ROLLE] bestiller, in_progress→closed → true (lukk)", rolle: "bestiller", fra: "in_progress", til: "closed", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, in_progress→closed → true (lukk)", rolle: "godkjenner", fra: "in_progress", til: "closed", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, in_progress→closed → false (ikke eid av utfører)", rolle: "utforer", fra: "in_progress", til: "closed", erAdmin: false, forventet: false },
  { navn: "[ROLLE] utforer, received→responded → true", rolle: "utforer", fra: "received", til: "responded", erAdmin: false, forventet: true },
  // F1: Avvis ruter til dismissed (eid av utfører), IKKE lenger cancelled.
  { navn: "[ROLLE] utforer, received→dismissed → true (avvis nå eid)", rolle: "utforer", fra: "received", til: "dismissed", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, received→cancelled → false (avvis ruter ikke lenger hit)", rolle: "utforer", fra: "received", til: "cancelled", erAdmin: false, forventet: false },
  // F2: Trekk tilbake (received→draft) eies av avsender-siden (registrator + bestiller), ikke utfører.
  { navn: "[F2] registrator, received→draft → true (trekk tilbake til kladd)", rolle: "registrator", fra: "received", til: "draft", erAdmin: false, forventet: true },
  { navn: "[F2] bestiller, received→draft → true (trekk tilbake til kladd)", rolle: "bestiller", fra: "received", til: "draft", erAdmin: false, forventet: true },
  { navn: "[F2] utforer, received→draft → false (ikke avsender-siden)", rolle: "utforer", fra: "received", til: "draft", erAdmin: false, forventet: false },
  { navn: "[ROLLE] utforer, in_progress→sent → true (send på nytt)", rolle: "utforer", fra: "in_progress", til: "sent", erAdmin: false, forventet: true },
  { navn: "[ROLLE] utforer, rejected→in_progress → false (F3: rejected merget, ingen gjenoppta)", rolle: "utforer", fra: "rejected", til: "in_progress", erAdmin: false, forventet: false },
  { navn: "[ROLLE] godkjenner, responded→approved → true", rolle: "godkjenner", fra: "responded", til: "approved", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, responded→in_progress → true (F3: Send tilbake direkte til Under arbeid)", rolle: "godkjenner", fra: "responded", til: "in_progress", erAdmin: false, forventet: true },
  { navn: "[ROLLE] godkjenner, draft→sent → false (ikke eid)", rolle: "godkjenner", fra: "draft", til: "sent", erAdmin: false, forventet: false },
  // §8A (2026-07-29): «Send fram» fjernet fra received/responded/approved (recipient-løs no-op).
  // Overgangen finnes ikke lenger i statusmaskinen → false for ALLE roller, også der utfører/godkjenner
  // «eide» den før. draft→sent + in_progress→sent (Send på nytt) er URØRT (se egne rader).
  { navn: "[§8A] utforer, received→sent → false (Send fram fjernet — var recipient-løs no-op)", rolle: "utforer", fra: "received", til: "sent", erAdmin: false, forventet: false },
  { navn: "[§8A] godkjenner, responded→sent → false (Send fram fjernet)", rolle: "godkjenner", fra: "responded", til: "sent", erAdmin: false, forventet: false },
  { navn: "[§8A] godkjenner, approved→sent → false (Send fram fjernet)", rolle: "godkjenner", fra: "approved", til: "sent", erAdmin: false, forventet: false },
  { navn: "[§8A] bestiller, received→sent → false", rolle: "bestiller", fra: "received", til: "sent", erAdmin: false, forventet: false },
  { navn: "[§8A] bestiller, approved→sent → false", rolle: "bestiller", fra: "approved", til: "sent", erAdmin: false, forventet: false },
];

describe("erTillattForRolle — karakterisering av dagens oppførsel", () => {
  it.each(TILLATT_MATRISE)("$navn", ({ rolle, fra, til, erAdmin, forventet }) => {
    expect(erTillattForRolle(rolle, fra, til, erAdmin)).toBe(forventet);
  });
});

/* ------------------------------------------------------------------ */
/*  isValidStatusTransition — statusmaskinen (linjemodell-vedtak)       */
/* ------------------------------------------------------------------ */

describe("isValidStatusTransition — F3 Merge «Under arbeid» (rejected merget inn i in_progress)", () => {
  it("responded → in_progress er lovlig (Send tilbake DIREKTE til Under arbeid)", () => {
    expect(isValidStatusTransition("responded", "in_progress")).toBe(true);
  });
  it("in_progress → closed er lovlig (Lukk — arver dagens rejected→closed)", () => {
    expect(isValidStatusTransition("in_progress", "closed")).toBe(true);
  });
  it("in_progress → sent er lovlig (Send på nytt, fram igjen etter retting)", () => {
    expect(isValidStatusTransition("in_progress", "sent")).toBe(true);
  });
  it("in_progress → responded er lovlig (Besvar)", () => {
    expect(isValidStatusTransition("in_progress", "responded")).toBe(true);
  });
  it("in_progress → cancelled er ULOVLIG (Avvis fra Under arbeid utgår)", () => {
    expect(isValidStatusTransition("in_progress", "cancelled")).toBe(false);
  });
  it("rejected → * er ulovlig — statusen er borte fra maskinen (merget, rader migreres)", () => {
    expect(isValidStatusTransition("rejected", "sent")).toBe(false);
    expect(isValidStatusTransition("rejected", "in_progress")).toBe(false);
    expect(isValidStatusTransition("rejected", "closed")).toBe(false);
  });
  it("responded → rejected er ULOVLIG (rejected finnes ikke lenger)", () => {
    expect(isValidStatusTransition("responded", "rejected")).toBe(false);
  });
});

describe("isValidStatusTransition — closed → draft (F4: Gjenåpne-handlingen utløser den)", () => {
  it("closed → draft er lovlig i statusmaskinen (Gjenåpne)", () => {
    expect(isValidStatusTransition("closed", "draft")).toBe(true);
  });
  it("closed → sent fortsatt ulovlig (kun draft er åpnet fra closed)", () => {
    expect(isValidStatusTransition("closed", "sent")).toBe(false);
  });
  it("closed-universet: Gjenåpne-handlingen ruter til draft", () => {
    const gjenapne = hentStatusHandlinger("closed").find((h) => h.tekstNoekkel === "statushandling.gjenapne");
    expect(gjenapne?.nyStatus).toBe("draft");
  });
});

/* ------------------------------------------------------------------ */
/*  hentStatusHandlinger — rejected tilbyr «Send på nytt» (sent)        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  F1 — Avvist (dismissed): egen status, påkrevd begrunnelse           */
/* ------------------------------------------------------------------ */

describe("F1 Avvist — statusmaskin + handling + begrunnelse-gate", () => {
  it("received → dismissed er lovlig (Avvis ruter hit, ikke lenger cancelled)", () => {
    expect(isValidStatusTransition("received", "dismissed")).toBe(true);
  });
  it("dismissed → draft er lovlig (F4: Gjenåpne åpner Avvist), men kun draft", () => {
    expect(isValidStatusTransition("dismissed", "draft")).toBe(true);
    expect(isValidStatusTransition("dismissed", "sent")).toBe(false);
  });
  it("received-universet: Avvis-handlingen ruter til dismissed", () => {
    const avvis = hentStatusHandlinger("received").find((h) => h.tekstNoekkel === "handling.avvis");
    expect(avvis?.nyStatus).toBe("dismissed");
  });
  it("statusKreverBegrunnelse: Avvis (dismissed) krever begrunnelse", () => {
    expect(statusKreverBegrunnelse("dismissed")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  P2 — Inndata-validering: kommentar-klasse + tom-besvarelse         */
/* ------------------------------------------------------------------ */

describe("statusKreverBegrunnelse — P2 (Kenneth-vedtak, valg B): kommentar-klassen", () => {
  it("Besvar (responded), Send tilbake (in_progress) og Avvis (dismissed) krever begrunnelse", () => {
    expect(statusKreverBegrunnelse("responded")).toBe(true);
    expect(statusKreverBegrunnelse("in_progress")).toBe(true);
    expect(statusKreverBegrunnelse("dismissed")).toBe(true);
  });
  it("Videresend (forwarded) og Send (sent) er UNNTAK — krever ikke begrunnelse", () => {
    expect(statusKreverBegrunnelse("forwarded")).toBe(false);
    expect(statusKreverBegrunnelse("sent")).toBe(false);
  });
  it("øvrige statuser krever ikke begrunnelse", () => {
    expect(statusKreverBegrunnelse("approved")).toBe(false);
    expect(statusKreverBegrunnelse("closed")).toBe(false);
    expect(statusKreverBegrunnelse("cancelled")).toBe(false);
    expect(statusKreverBegrunnelse("draft")).toBe(false);
  });
});

describe("harMinstEttUtfyltFelt — P2 tom-besvarelse-guard", () => {
  const felt = (id: string, type = "text") => ({ id, type });

  it("blokkerer (false) når malen har svar-felt men ingen er besvart", () => {
    expect(harMinstEttUtfyltFelt([felt("a"), felt("b")], {})).toBe(false);
    expect(harMinstEttUtfyltFelt([felt("a")], { a: { verdi: "", kommentar: "", vedlegg: [] } })).toBe(false);
    expect(harMinstEttUtfyltFelt([felt("a")], null)).toBe(false);
  });

  it("tillater (true) når minst ett felt er besvart — valg B: verdi ELLER kommentar ELLER vedlegg", () => {
    expect(harMinstEttUtfyltFelt([felt("a")], { a: { verdi: "OK" } })).toBe(true);
    expect(harMinstEttUtfyltFelt([felt("a")], { a: { kommentar: "notat" } })).toBe(true);
    expect(harMinstEttUtfyltFelt([felt("a")], { a: { vedlegg: [{ id: "1" }] } })).toBe(true);
  });

  it("tillater (true) når malen ikke har utfyllbare felt (ingenting å fylle)", () => {
    expect(harMinstEttUtfyltFelt([], {})).toBe(true);
    expect(harMinstEttUtfyltFelt([felt("h", "heading"), felt("s", "subtitle")], {})).toBe(true);
    expect(harMinstEttUtfyltFelt([felt("l", "location"), felt("c", "calculation")], {})).toBe(true);
  });

  it("ren-visning/skjulte/auto-felt teller ikke som utfyllbare", () => {
    expect(erUtfyllbartFelt("heading")).toBe(false);
    expect(erUtfyllbartFelt("subtitle")).toBe(false);
    expect(erUtfyllbartFelt("location")).toBe(false);
    expect(erUtfyllbartFelt("drawing_position")).toBe(false);
    expect(erUtfyllbartFelt("calculation")).toBe(false);
    expect(erUtfyllbartFelt("text")).toBe(true);
    expect(erUtfyllbartFelt("checkbox")).toBe(true);
  });

  it("feltErBesvart: tom/manglende felt er ikke besvart", () => {
    expect(feltErBesvart(undefined)).toBe(false);
    expect(feltErBesvart(null)).toBe(false);
    expect(feltErBesvart({ verdi: null, kommentar: "", vedlegg: [] })).toBe(false);
  });
});

describe("F2 Trekk tilbake — received→draft (D-1: sent er dødt, handlingen flyttes)", () => {
  it("received → draft er lovlig (Trekk tilbake henter til redigerbar kladd)", () => {
    expect(isValidStatusTransition("received", "draft")).toBe(true);
  });
  it("sent → cancelled er ULOVLIG (den døde trekk-tilbake-veien utgår)", () => {
    expect(isValidStatusTransition("sent", "cancelled")).toBe(false);
  });
  it("sent → received er fortsatt lovlig (kun auto-overgangen står)", () => {
    expect(isValidStatusTransition("sent", "received")).toBe(true);
  });
  it("received-universet: Trekk tilbake-handlingen ruter til draft", () => {
    const trekk = hentStatusHandlinger("received").find((h) => h.tekstNoekkel === "statushandling.trekkTilbake");
    expect(trekk?.nyStatus).toBe("draft");
  });
  it("sent-universet er tomt (transient status uten handlinger)", () => {
    expect(hentStatusHandlinger("sent")).toEqual([]);
  });
});

describe("§8A — «Send fram» (received/responded/approved → sent) er FJERNET (recipient-løs no-op)", () => {
  it("received → sent er ULOVLIG (Send fram fjernet — var no-op)", () => {
    expect(isValidStatusTransition("received", "sent")).toBe(false);
  });
  it("responded → sent er ULOVLIG (Send fram fjernet)", () => {
    expect(isValidStatusTransition("responded", "sent")).toBe(false);
  });
  it("approved → sent er ULOVLIG (Send fram fjernet)", () => {
    expect(isValidStatusTransition("approved", "sent")).toBe(false);
  });
  it.each(["received", "responded", "approved"])("%s-universet bærer INGEN Send-handling lenger", (status) => {
    const send = hentStatusHandlinger(status).find((h) => h.tekstNoekkel === "handling.send");
    expect(send).toBeUndefined();
  });
  // Negativ kontroll: de legitime Send-veiene er URØRT.
  it("draft → sent er fortsatt lovlig (førstegangs-send med person-velger)", () => {
    expect(isValidStatusTransition("draft", "sent")).toBe(true);
    expect(hentStatusHandlinger("draft").find((h) => h.tekstNoekkel === "handling.send")?.nyStatus).toBe("sent");
  });
  it("in_progress → sent er fortsatt lovlig (Send på nytt etter retting)", () => {
    expect(isValidStatusTransition("in_progress", "sent")).toBe(true);
  });
  it("Videresend (forwarded) er URØRT på received/responded/approved", () => {
    for (const status of ["received", "responded", "approved"]) {
      expect(hentStatusHandlinger(status).some((h) => h.nyStatus === "forwarded")).toBe(true);
    }
  });
});

describe("H3 videresend-rettighet — forwarded er admin-only (fjernet fra flytrolle-defaults)", () => {
  // Del 1: default AV for utfører/godkjenner, PÅ for prosjektadmin (via statusmaskin-snittet).
  it("utfører får IKKE videresend i menyen (received/in_progress)", () => {
    expect(hentRolleFiltrertHandlinger("received", "utforer", null).map((h) => h.nyStatus)).not.toContain("forwarded");
    expect(hentRolleFiltrertHandlinger("in_progress", "utforer", null).map((h) => h.nyStatus)).not.toContain("forwarded");
  });
  it("godkjenner får IKKE videresend i menyen (responded)", () => {
    expect(hentRolleFiltrertHandlinger("responded", "godkjenner", null).map((h) => h.nyStatus)).not.toContain("forwarded");
  });
  it("serveren avviser videresend for utfører/godkjenner (null-nivå)", () => {
    expect(erTillattForRolle("utforer", "received", "forwarded", null)).toBe(false);
    expect(erTillattForRolle("utforer", "in_progress", "forwarded", null)).toBe(false);
    expect(erTillattForRolle("godkjenner", "responded", "forwarded", null)).toBe(false);
  });
  it("prosjektadmin BEHOLDER videresend på de relevante statusene (via snittet, ikke defaults)", () => {
    expect(hentRolleFiltrertHandlinger("received", "utforer", "prosjekt").map((h) => h.nyStatus)).toContain("forwarded");
    expect(hentRolleFiltrertHandlinger("in_progress", "utforer", "prosjekt").map((h) => h.nyStatus)).toContain("forwarded");
    expect(hentRolleFiltrertHandlinger("responded", "godkjenner", "prosjekt").map((h) => h.nyStatus)).toContain("forwarded");
    expect(erTillattForRolle("utforer", "received", "forwarded", "prosjekt")).toBe(true);
    expect(erTillattForRolle("godkjenner", "responded", "forwarded", "prosjekt")).toBe(true);
  });
  it("hentHandlingEierRoller for videresend er tom (eierløs → kun admin)", () => {
    expect(hentHandlingEierRoller("received", "forwarded")).toEqual([]);
    expect(hentHandlingEierRoller("responded", "forwarded")).toEqual([]);
  });
});

describe("hentStatusHandlinger — F3: Under arbeid (in_progress) bærer «Send på nytt»", () => {
  it("rejected-universet er tomt (statusen er merget bort)", () => {
    expect(hentStatusHandlinger("rejected")).toEqual([]);
  });
  it("in_progress-universet inneholder en sent-handling", () => {
    const nyStatuser = hentStatusHandlinger("in_progress").map((h) => h.nyStatus);
    expect(nyStatuser).toContain("sent");
  });
  it("sent-handlingen bruker flytspråk-etiketten «Send på nytt»", () => {
    const sendPaaNytt = hentStatusHandlinger("in_progress").find((h) => h.nyStatus === "sent");
    expect(sendPaaNytt?.tekstNoekkel).toBe("statushandling.sendPaaNytt");
  });
  it("in_progress-universet inneholder Lukk (→closed), ikke Avvis (→cancelled)", () => {
    const nyStatuser = hentStatusHandlinger("in_progress").map((h) => h.nyStatus);
    expect(nyStatuser).toContain("closed");
    expect(nyStatuser).not.toContain("cancelled");
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

/* ------------------------------------------------------------------ */
/*  adminNiva (Kloss 2) — sitedoc / prosjekt / null                    */
/* ------------------------------------------------------------------ */

describe("adminNiva — boolean-shim er bit-identisk (Kloss 1-kompatibilitet)", () => {
  it("true == 'sitedoc' og false == null over hele TILLATT_MATRISE", () => {
    for (const { rolle, fra, til } of TILLATT_MATRISE) {
      if (!rolle) continue;
      expect(erTillattForRolle(rolle, fra, til, true)).toBe(erTillattForRolle(rolle, fra, til, "sitedoc"));
      expect(erTillattForRolle(rolle, fra, til, false)).toBe(erTillattForRolle(rolle, fra, til, null));
    }
  });
  it("hentRolleFiltrertHandlinger: true=='sitedoc', false==null over HANDLING_MATRISE", () => {
    for (const { status, rolle } of HANDLING_MATRISE) {
      const a = hentRolleFiltrertHandlinger(status, rolle, true).map((h) => h.nyStatus);
      const b = hentRolleFiltrertHandlinger(status, rolle, "sitedoc").map((h) => h.nyStatus);
      expect(a).toEqual(b);
      const c = hentRolleFiltrertHandlinger(status, rolle, false).map((h) => h.nyStatus);
      const d = hentRolleFiltrertHandlinger(status, rolle, null).map((h) => h.nyStatus);
      expect(c).toEqual(d);
    }
  });
});

describe("adminNiva='sitedoc' — kode-bypass (full, også ulovlige overganger)", () => {
  it("erTillattForRolle: true for enhver overgang, inkl. ulovlig draft→closed", () => {
    expect(erTillattForRolle("registrator", "draft", "sent", "sitedoc")).toBe(true);
    expect(erTillattForRolle("registrator", "draft", "closed", "sitedoc")).toBe(true);
    expect(erTillattForRolle("godkjenner", "closed", "approved", "sitedoc")).toBe(true);
  });
  it("null-rolle er false selv med sitedoc (rolle sjekkes først — uendret)", () => {
    expect(erTillattForRolle(null, "draft", "sent", "sitedoc")).toBe(false);
  });
  it("hentRolleFiltrertHandlinger: hele universet", () => {
    expect(hentRolleFiltrertHandlinger("draft", "registrator", "sitedoc").map((h) => h.nyStatus)).toEqual(["sent", "deleted"]);
    expect(hentRolleFiltrertHandlinger("responded", "bestiller", "sitedoc").map((h) => h.nyStatus)).toEqual(["approved", "in_progress", "forwarded"]);
  });
});

describe("adminNiva='prosjekt' — full INNENFOR statusmaskinen (tom override)", () => {
  it("lovlig overgang tillates (draft→sent), ulovlig nektes (draft→closed)", () => {
    expect(erTillattForRolle("registrator", "draft", "sent", "prosjekt")).toBe(true);
    expect(isValidStatusTransition("draft", "closed")).toBe(false);
    expect(erTillattForRolle("registrator", "draft", "closed", "prosjekt")).toBe(false);
  });
  it("pseudo-handlinger (deleted/forwarded) bevares — som dagens fulle bypass", () => {
    expect(erTillattForRolle("registrator", "draft", "deleted", "prosjekt")).toBe(true);
    expect(erTillattForRolle("registrator", "received", "forwarded", "prosjekt")).toBe(true);
  });
  it("hentRolleFiltrertHandlinger: hele det statusmaskin-lovlige universet for status", () => {
    // received-universet: responded (lovlig), approved (F6 Godkjenn fra Mottatt, lovlig),
    // draft (F2 trekk tilbake, lovlig), forwarded (pseudo), dismissed (lovlig).
    // §8A: `sent` (Send fram) er stengt i statusmaskinen → prosjektadmin mister den også.
    // Prosjektadmin får hele det statusmaskin-lovlige universet.
    expect(hentRolleFiltrertHandlinger("received", "registrator", "prosjekt").map((h) => h.nyStatus))
      .toEqual(["responded", "approved", "draft", "forwarded", "dismissed"]);
  });
  it("konfigurerbar NEDOVER: negativ prosjektadmin-override slår av en celle", () => {
    const override: RettighetsOverrides = { [flytRettighetNoekkel(PROSJEKTADMIN_ROLLE, "draft", "sent")]: false };
    expect(erTillattForRolle("registrator", "draft", "sent", "prosjekt")).toBe(true);
    expect(erTillattForRolle("registrator", "draft", "sent", "prosjekt", override)).toBe(false);
  });
  it("invariant: positiv prosjektadmin-override på ulovlig overgang snittes bort", () => {
    const override: RettighetsOverrides = { [flytRettighetNoekkel(PROSJEKTADMIN_ROLLE, "draft", "closed")]: true };
    expect(erTillattForRolle("registrator", "draft", "closed", "prosjekt", override)).toBe(false);
  });
});

describe("adminNiva=null (vanlig rolle, inkl. firma-admin) — Kloss 1-sti bevart", () => {
  it("bestiller draft→sent tillatt, responded→approved ikke (bit-identisk med Kloss 1)", () => {
    expect(erTillattForRolle("bestiller", "draft", "sent", null)).toBe(true);
    expect(erTillattForRolle("bestiller", "responded", "approved", null)).toBe(false);
  });
  it("prosjektadmin-override påvirker IKKE null-nivået (kun 'prosjekt'-stien leser den)", () => {
    const override: RettighetsOverrides = { [flytRettighetNoekkel(PROSJEKTADMIN_ROLLE, "draft", "sent")]: false };
    expect(erTillattForRolle("bestiller", "draft", "sent", null, override)).toBe(true);
  });
});
