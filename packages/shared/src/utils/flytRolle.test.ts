import { describe, it, expect } from "vitest";
import {
  utledMinRolle,
  utledDokumentRettighet,
  utledFlytRettighet,
  type FlytBrukerInfo,
  type FlytMedlemInfo,
  type DokumentKontekst,
  type DokumentRettighetInput,
  type DokumentRettighet,
  type FlytMedlemRedigering,
  type FlytRedigeringBruker,
} from "./flytRolle";
import type { DokumentflytRolle } from "../types";

/**
 * Fase B — bevis for registrator-fiksen i flytRolle.
 *
 * To ting bevises:
 *  1. § 5b — utledDokumentRettighet: registrator følger den generelle rettighets-logikken
 *     (Kenneths matrise: oppretter + redigerer egen del). Med ballen → redigerer, uten
 *     ballen → leser, terminal → leser. Aldri null («minst leser»-gulvet er iboende).
 *  2. Flertreff — utledMinRolle: etter at short-circuiten (:92) er fjernet og
 *     ROLLE_PRIORITET flyttet (registrator lavest), vinner riktig rolle ved flertreff,
 *     UAVHENGIG av medlemsrekkefølge. Begge retninger dekkes (fabel-krav):
 *       - registrator + utfører → utfører  (registrator taper for skrive-rolle)
 *       - bestiller + godkjenner → godkjenner (høyeste ansvar vinner, order-uavhengig)
 */

/* ------------------------------------------------------------------ */
/*  § 5b — utledDokumentRettighet: registrators leserett               */
/* ------------------------------------------------------------------ */

const RETT_BASIS: DokumentRettighetInput = {
  erAdmin: false,
  minRolle: null,
  tillatelser: new Set<string>(),
  status: "received",
  dokumentType: "sjekkliste",
  harBallen: false,
};

const rett = (over: Partial<DokumentRettighetInput>): DokumentRettighetInput => ({
  ...RETT_BASIS,
  ...over,
});

interface RettRad {
  navn: string;
  input: DokumentRettighetInput;
  forventet: DokumentRettighet;
}

const RETT_MATRISE: RettRad[] = [
  // — § 5b: registrator → redigerer med ball / leser uten (aldri null) ——
  {
    navn: "§5b registrator MED ball, sjekkliste → redigerer (egen del)",
    input: rett({ minRolle: "registrator", status: "received", harBallen: true }),
    forventet: "redigerer",
  },
  {
    navn: "§5b registrator UTEN ball, sjekkliste → leser",
    input: rett({ minRolle: "registrator", status: "received", harBallen: false }),
    forventet: "leser",
  },
  {
    navn: "§5b registrator, oppgave MED ball → redigerer (append via erFeltLåst)",
    input: rett({ minRolle: "registrator", status: "in_progress", dokumentType: "oppgave", harBallen: true }),
    forventet: "redigerer",
  },
  {
    navn: "§5b registrator, godkjent sjekkliste (approved, terminal) → leser",
    input: rett({ minRolle: "registrator", status: "approved", harBallen: false }),
    forventet: "leser",
  },
  {
    navn: "§5b registrator, egen kladd MED ball → redigerer (løser tidligere flagg)",
    input: rett({ minRolle: "registrator", status: "draft", harBallen: true }),
    forventet: "redigerer",
  },

  // — Kontroller: admin uendret, skrive-rolle beholder redigering ————
  {
    navn: "kontroll: admin → admin (uendret av fiksen)",
    input: rett({ erAdmin: true, minRolle: "registrator", status: "received", harBallen: false }),
    forventet: "admin",
  },
  {
    navn: "kontroll: utfører MED ball, ingen grupper (fallback) → redigerer",
    input: rett({ minRolle: "utforer", status: "in_progress", harBallen: true }),
    forventet: "redigerer",
  },
  {
    navn: "kontroll: utfører UTEN ball → leser",
    input: rett({ minRolle: "utforer", status: "in_progress", harBallen: false }),
    forventet: "leser",
  },
];

describe("utledDokumentRettighet — § 5b registrator-leserett (Fase B)", () => {
  it.each(RETT_MATRISE)("$navn", ({ input, forventet }) => {
    const resultat = utledDokumentRettighet(input);
    expect(resultat).toBe(forventet);
    // Guard: registrator skal aldri falle ut som null/undefined ("tatt for mye").
    expect(resultat).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Flertreff — utledMinRolle: prioritet vinner, order-uavhengig       */
/* ------------------------------------------------------------------ */

const BRUKER_BASIS: FlytBrukerInfo = {
  userId: "u1",
  projectMemberId: "pm1",
  faggruppeIder: [],
  gruppeIder: [],
  erAdmin: false,
};

const bruker = (over: Partial<FlytBrukerInfo>): FlytBrukerInfo => ({ ...BRUKER_BASIS, ...over });

const medlem = (over: Partial<FlytMedlemInfo>): FlytMedlemInfo => ({
  rolle: "registrator",
  faggruppeId: null,
  projectMemberId: null,
  groupId: null,
  ...over,
});

const INGEN_KONTEKST: DokumentKontekst = { bestillerFaggruppeId: null, utforerFaggruppeId: null };

interface RolleRad {
  navn: string;
  bruker: FlytBrukerInfo;
  medlemmer: FlytMedlemInfo[];
  dokument: DokumentKontekst;
  forventet: DokumentflytRolle | null;
}

const ROLLE_MATRISE: RolleRad[] = [
  // — Ren registrator gjenkjennes (ikke null — beviser prioritet ≥ 1) —
  {
    navn: "ren registrator (person-match) → registrator (ikke null)",
    bruker: bruker({ projectMemberId: "pm1" }),
    medlemmer: [medlem({ rolle: "registrator", projectMemberId: "pm1" })],
    dokument: INGEN_KONTEKST,
    forventet: "registrator",
  },

  // — Flertreff retning 1: registrator + utfører → utfører ————————————
  {
    navn: "flertreff: registrator + utfører → utfører (registrator taper for skrive-rolle)",
    bruker: bruker({ projectMemberId: "pm1", faggruppeIder: ["fg-utf"] }),
    medlemmer: [
      medlem({ rolle: "registrator", projectMemberId: "pm1" }),
      medlem({ rolle: "utforer", faggruppeId: "fg-utf" }),
    ],
    dokument: { bestillerFaggruppeId: null, utforerFaggruppeId: "fg-utf" },
    forventet: "utforer",
  },
  {
    navn: "flertreff: utfører + registrator (omvendt rekkefølge) → utfører (order-uavhengig)",
    bruker: bruker({ projectMemberId: "pm1", faggruppeIder: ["fg-utf"] }),
    medlemmer: [
      medlem({ rolle: "utforer", faggruppeId: "fg-utf" }),
      medlem({ rolle: "registrator", projectMemberId: "pm1" }),
    ],
    dokument: { bestillerFaggruppeId: null, utforerFaggruppeId: "fg-utf" },
    forventet: "utforer",
  },

  // — Flertreff retning 2: bestiller + godkjenner → godkjenner ————————
  //   Beviser at prioritets-flyttingen virker etter at short-circuiten er fjernet:
  //   samme resultat uansett medlemsrekkefølge.
  {
    navn: "flertreff: bestiller + godkjenner → godkjenner (høyeste ansvar vinner)",
    bruker: bruker({ faggruppeIder: ["fg-best"], gruppeIder: ["g-godk"] }),
    medlemmer: [
      medlem({ rolle: "bestiller", faggruppeId: "fg-best" }),
      medlem({ rolle: "godkjenner", groupId: "g-godk" }),
    ],
    dokument: { bestillerFaggruppeId: "fg-best", utforerFaggruppeId: null },
    forventet: "godkjenner",
  },
  {
    navn: "flertreff: godkjenner + bestiller (omvendt rekkefølge) → godkjenner (order-uavhengig)",
    bruker: bruker({ faggruppeIder: ["fg-best"], gruppeIder: ["g-godk"] }),
    medlemmer: [
      medlem({ rolle: "godkjenner", groupId: "g-godk" }),
      medlem({ rolle: "bestiller", faggruppeId: "fg-best" }),
    ],
    dokument: { bestillerFaggruppeId: "fg-best", utforerFaggruppeId: null },
    forventet: "godkjenner",
  },

  // — Admin-mapping beholdt (utledMinRolle:62) ——————————————————————
  {
    navn: "admin → registrator (utledMinRolle:62 uendret; admin-makt via erAdmin-flagget)",
    bruker: bruker({ erAdmin: true }),
    medlemmer: [],
    dokument: INGEN_KONTEKST,
    forventet: "registrator",
  },
];

describe("utledMinRolle — flertreff-prioritet (Fase B, short-circuit fjernet)", () => {
  it.each(ROLLE_MATRISE)("$navn", ({ bruker: b, medlemmer, dokument, forventet }) => {
    expect(utledMinRolle(b, medlemmer, dokument)).toBe(forventet);
  });
});

/**
 * utledFlytRettighet — delt kilde for `DokumentflytMedlem.kanRedigere`-oppslaget
 * (web `useFlytKontekst` + mobil oppgave/sjekkliste). Beviser de tre fiksene mot
 * den gamle to-bindings-løkka:
 *   a) faggruppe-binding låser (manglet helt før → en faggruppe-bundet Leser var ulåst)
 *   b) avsluttet ledd (`periodeSlutt != null`) teller ikke
 *   c) mest-restriktive-vinner ved flertreff, uavhengig av rekkefølge
 */
const rBruker = (o: Partial<FlytRedigeringBruker> = {}): FlytRedigeringBruker => ({
  projectMemberId: "pm-1",
  gruppeIder: ["g-1"],
  faggruppeIder: ["fg-1"],
  ...o,
});
const rMedlem = (o: Partial<FlytMedlemRedigering> = {}): FlytMedlemRedigering => ({
  kanRedigere: true,
  faggruppeId: null,
  projectMemberId: null,
  groupId: null,
  periodeSlutt: null,
  ...o,
});

const REDIGERING_MATRISE: {
  navn: string;
  medlemmer: FlytMedlemRedigering[];
  bruker?: FlytRedigeringBruker;
  forventet: "redigerer" | "leser" | undefined;
}[] = [
  {
    navn: "person-binding, kanRedigere=false → leser",
    medlemmer: [rMedlem({ projectMemberId: "pm-1", kanRedigere: false })],
    forventet: "leser",
  },
  {
    navn: "person-binding, kanRedigere=true → redigerer",
    medlemmer: [rMedlem({ projectMemberId: "pm-1", kanRedigere: true })],
    forventet: "redigerer",
  },
  {
    navn: "gruppe-binding, kanRedigere=false → leser",
    medlemmer: [rMedlem({ groupId: "g-1", kanRedigere: false })],
    forventet: "leser",
  },
  {
    navn: "faggruppe-binding, kanRedigere=false → leser (bug a: manglet helt før)",
    medlemmer: [rMedlem({ faggruppeId: "fg-1", kanRedigere: false })],
    forventet: "leser",
  },
  {
    navn: "faggruppe-binding, kanRedigere=true → redigerer",
    medlemmer: [rMedlem({ faggruppeId: "fg-1", kanRedigere: true })],
    forventet: "redigerer",
  },
  {
    navn: "ingen binding treffer → undefined",
    medlemmer: [rMedlem({ projectMemberId: "pm-annen", kanRedigere: false })],
    forventet: undefined,
  },
  {
    navn: "avsluttet ledd (periodeSlutt satt) teller ikke → undefined (bug b)",
    medlemmer: [rMedlem({ faggruppeId: "fg-1", kanRedigere: false, periodeSlutt: "2026-01-01T00:00:00Z" })],
    forventet: undefined,
  },
  {
    navn: "avsluttet false-ledd ignoreres, aktivt true-ledd vinner → redigerer (bug b)",
    medlemmer: [
      rMedlem({ groupId: "g-1", kanRedigere: false, periodeSlutt: new Date("2026-01-01") }),
      rMedlem({ projectMemberId: "pm-1", kanRedigere: true }),
    ],
    forventet: "redigerer",
  },
  {
    navn: "flertreff: person=true + gruppe=false → leser (bug c, mest restriktiv)",
    medlemmer: [
      rMedlem({ projectMemberId: "pm-1", kanRedigere: true }),
      rMedlem({ groupId: "g-1", kanRedigere: false }),
    ],
    forventet: "leser",
  },
  {
    navn: "flertreff omvendt rekkefølge: gruppe=false først → leser (rekkefølge-uavhengig)",
    medlemmer: [
      rMedlem({ groupId: "g-1", kanRedigere: false }),
      rMedlem({ projectMemberId: "pm-1", kanRedigere: true }),
    ],
    forventet: "leser",
  },
];

describe("utledFlytRettighet — delt kanRedigere-oppslag (tre bindinger + periodeSlutt + presedens)", () => {
  it.each(REDIGERING_MATRISE)("$navn", ({ medlemmer, bruker: b, forventet }) => {
    expect(utledFlytRettighet(medlemmer, b ?? rBruker())).toBe(forventet);
  });
});
