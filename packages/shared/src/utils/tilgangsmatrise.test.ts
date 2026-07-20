import { describe, it, expect } from "vitest";
import {
  avgjorDokumentTilgang,
  type TilgangsFakta,
  type TilgangsResultat,
} from "./avgjorDokumentTilgang";

/**
 * Tilgangsmatrise — varig håndhevelse av dokument-tilgangsbeslutningen.
 *
 * Fase A (spor 2-ordre 2026-07-20): tabelldrevet matrise mot DAGENS oppførsel i
 * `verifiserDokumentTilgang` (apps/api/src/trpc/tilgangskontroll.ts:490–638).
 * Beslutningsgrenene ble transkribert linje-for-linje til den frosne referansen
 * `avgjorDokumentTilgangReferanse` under, med samme rekkefølge og semantikk.
 *
 * Fase B: beslutningen er ekstrahert som ren funksjon `avgjorDokumentTilgang` i
 * produksjonskoden (packages/shared/src/utils/avgjorDokumentTilgang.ts).
 * `verifiserDokumentTilgang` beholder alle Prisma-oppslag og kaller den.
 *
 * SAMME MATRISE (konstanten under) kjøres mot BEGGE sider — den frosne referansen
 * OG den ekstraherte produksjonsfunksjonen. Identisk utfall på hver rad = beviset
 * på at ekstraksjonen ikke endret oppførsel. Divergens mellom referansen (dagens
 * oppførsel) og produksjonsfunksjonen ved en senere endring = test-feil.
 *
 * Utvidbar: sak 2 (bestiller/mottaker-grener), sak 3 (HMS-synlighet) og sak1b
 * (rollestyring) legger til RADER i MATRISE, ikke nye testfiler.
 *
 * Rekkefølgen på grenene (ufravikelig, jf. ordre § 4):
 *   admin → ikke-medlem → prosjektadmin → firmaansvarlig → bestiller/mottaker →
 *   faggruppe-direkte → gruppe-domain → HMS-åpen → flyt-medlemskap → avvis.
 */

/**
 * FROSSET referanse: transkripsjon av dagens `verifiserDokumentTilgang`-beslutning
 * (tilgangskontroll.ts:490–638), gjort i Fase A og cowork-godkjent gren for gren.
 * Endres ALDRI ved refaktor — den er «dagens oppførsel» som produksjonsfunksjonen
 * måles mot. `throw FORBIDDEN` → `{ tillat: false }`; `return` → `{ tillat: true }`.
 */
function avgjorDokumentTilgangReferanse(f: TilgangsFakta): TilgangsResultat {
  // :492 — sitedoc_admin ser alt
  if (f.brukerRolle === "sitedoc_admin") return { tillat: true, grunn: "admin" };

  // :510 — ikke medlem av prosjektet
  if (!f.erMedlem) return { tillat: false, grunn: "ikke-medlem" };

  // :518 — prosjektadmin ser alt
  if (f.prosjektmedlemRolle === "admin") return { tillat: true, grunn: "prosjektadmin" };

  // :521–534 — dokumentParter lastes kun når dokumentId && dokumentType finnes
  const harParter = f.harDokument;

  // :537–568 — firmaansvarlig: firmamedlem er bestiller/mottaker, eller transfer-avsender
  if (f.erFirmaansvarlig && f.harDokument) {
    // :539 brukerOrgId? Uten org er firmaUserIder=[] og harFirmaTransfer=false.
    if (harParter) {
      const involverte = new Set(f.firmaUserIder);
      if (
        (f.bestillerUserId && involverte.has(f.bestillerUserId)) ||
        (f.recipientUserId && involverte.has(f.recipientUserId))
      ) {
        return { tillat: true, grunn: "firmaansvarlig-part" };
      }
    }
    if (f.harFirmaTransfer) return { tillat: true, grunn: "firmaansvarlig-transfer" };
  }

  // :573–580 — innsender/mottaker: bruker er bestiller eller direkte mottaker
  if (harParter) {
    if (
      (f.bestillerUserId && f.bestillerUserId === f.userId) ||
      (f.recipientUserId && f.recipientUserId === f.userId)
    ) {
      return { tillat: true, grunn: "innsender-mottaker" };
    }
  }

  // :583–588 — direkte faggruppe-tilgang (bestiller eller utfører)
  const harDirekteTilgang =
    (f.bestillerFaggruppeId && f.direkteFaggruppeIder.includes(f.bestillerFaggruppeId)) ||
    (f.utforerFaggruppeId && f.direkteFaggruppeIder.includes(f.utforerFaggruppeId));
  if (harDirekteTilgang) return { tillat: true, grunn: "faggruppe-direkte" };

  // :591–606 — fagområde-tilgang via grupper
  if (f.templateDomain) {
    for (const gm of f.gruppeMedlemskap) {
      if (!gm.domener.includes(f.templateDomain)) continue;
      // :597 tverrgående: gruppe uten faggrupper ser alle dok med matchende domain
      if (gm.faggruppeIder.length === 0) return { tillat: true, grunn: "gruppe-tverrgaende" };
      // :600–604 faggruppe-begrenset
      const matcherFaggruppe =
        (f.bestillerFaggruppeId && gm.faggruppeIder.includes(f.bestillerFaggruppeId)) ||
        (f.utforerFaggruppeId && gm.faggruppeIder.includes(f.utforerFaggruppeId));
      if (matcherFaggruppe) return { tillat: true, grunn: "gruppe-faggruppe" };
    }
  }

  // :612 — HMS åpen-synlighet: alle prosjektmedlemmer kan lese
  if (f.templateDomain === "hms" && f.templateHmsSynlighet === "apen") {
    return { tillat: true, grunn: "hms-apen" };
  }

  // :623–633 — dokumentflyt-medlemskap. F1-A: fyrer IKKE for private HMS-dok.
  if (
    f.dokumentflytId &&
    !(f.templateDomain === "hms" && f.templateHmsSynlighet !== "apen")
  ) {
    if (f.flytIder.includes(f.dokumentflytId)) return { tillat: true, grunn: "flyt-medlemskap" };
  }

  // :635 — ingen tilgang
  return { tillat: false, grunn: "ingen-tilgang" };
}

/** Nøytral basis: vanlig prosjektmedlem, intet dokument, ingen bindinger → avvis. */
const BASIS: TilgangsFakta = {
  brukerRolle: "user",
  erMedlem: true,
  prosjektmedlemRolle: "member",
  erFirmaansvarlig: false,
  userId: "u-selv",
  harDokument: false,
  bestillerUserId: null,
  recipientUserId: null,
  dokumentflytId: null,
  bestillerFaggruppeId: null,
  utforerFaggruppeId: null,
  templateDomain: null,
  templateHmsSynlighet: null,
  direkteFaggruppeIder: [],
  gruppeMedlemskap: [],
  flytIder: [],
  firmaUserIder: [],
  harFirmaTransfer: false,
};

const fakta = (over: Partial<TilgangsFakta>): TilgangsFakta => ({ ...BASIS, ...over });

interface MatriseRad {
  navn: string;
  fakta: TilgangsFakta;
  forventet: TilgangsResultat;
}

/**
 * MATRISE — én rad per beslutnings-sti. Delt konstant: Fase B kjører SAMME
 * array mot den ekstraherte produksjonsfunksjonen.
 */
export const MATRISE: MatriseRad[] = [
  // — Rolle-bypass ——————————————————————————————————————————————
  {
    navn: "sitedoc_admin ser alt (selv uten binding/dokument)",
    fakta: fakta({ brukerRolle: "sitedoc_admin", erMedlem: false }),
    forventet: { tillat: true, grunn: "admin" },
  },
  {
    navn: "ikke medlem av prosjektet → avvis",
    fakta: fakta({ erMedlem: false }),
    forventet: { tillat: false, grunn: "ikke-medlem" },
  },
  {
    navn: "prosjektadmin ser alt",
    fakta: fakta({ prosjektmedlemRolle: "admin" }),
    forventet: { tillat: true, grunn: "prosjektadmin" },
  },

  // — Firmaansvarlig ————————————————————————————————————————————
  {
    navn: "firmaansvarlig: bestiller er firmamedlem → tillat",
    fakta: fakta({
      erFirmaansvarlig: true,
      harDokument: true,
      bestillerUserId: "u-kollega",
      firmaUserIder: ["u-kollega"],
    }),
    forventet: { tillat: true, grunn: "firmaansvarlig-part" },
  },
  {
    navn: "firmaansvarlig: mottaker er firmamedlem → tillat",
    fakta: fakta({
      erFirmaansvarlig: true,
      harDokument: true,
      recipientUserId: "u-kollega",
      firmaUserIder: ["u-annen", "u-kollega"],
    }),
    forventet: { tillat: true, grunn: "firmaansvarlig-part" },
  },
  {
    navn: "firmaansvarlig: transfer-avsender i firma → tillat",
    fakta: fakta({
      erFirmaansvarlig: true,
      harDokument: true,
      firmaUserIder: ["u-kollega"],
      harFirmaTransfer: true,
    }),
    forventet: { tillat: true, grunn: "firmaansvarlig-transfer" },
  },
  {
    navn: "firmaansvarlig uten treff (ingen part/transfer i firma) → faller videre til avvis",
    fakta: fakta({
      erFirmaansvarlig: true,
      harDokument: true,
      bestillerUserId: "u-fremmed",
      firmaUserIder: ["u-kollega"],
    }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },
  {
    navn: "firmaansvarlig uten dokument → gren hoppes over",
    fakta: fakta({ erFirmaansvarlig: true, harDokument: false, firmaUserIder: ["u-selv"] }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Innsender / mottaker ——————————————————————————————————————
  {
    navn: "innsender: bruker er bestiller → tillat",
    fakta: fakta({ harDokument: true, bestillerUserId: "u-selv" }),
    forventet: { tillat: true, grunn: "innsender-mottaker" },
  },
  {
    navn: "mottaker: bruker er direkte mottaker → tillat",
    fakta: fakta({ harDokument: true, recipientUserId: "u-selv" }),
    forventet: { tillat: true, grunn: "innsender-mottaker" },
  },
  {
    navn: "bestiller/mottaker er andre → ikke truffet",
    fakta: fakta({ harDokument: true, bestillerUserId: "u-annen", recipientUserId: "u-tredje" }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Sak 2: liste↔detalj-paritet (bestiller/mottaker) ——————————————
  // VIKTIG OM DEKNING: disse radene tester `avgjorDokumentTilgang` — DETALJ-gaten.
  // Sak-2-FIKSEN ligger i `byggTilgangsFilter` (liste-filteret), som IKKE testes
  // her og fortsatt mangler testdekning. Radene beviser altså BARE den delte
  // beslutningen (bestiller/mottaker → tillat) som liste-filteret nå er ment å
  // speile — de er ikke bevis på at liste-filteret faktisk gjør det. Ytterkanten
  // (at byggTilgangsFilter bygger riktig OR) dekkes av cowork-review + browser-DoD.
  //
  // Radene pinner beslutningen: oppretter/mottaker UTEN egen faggruppe-binding ser
  // sitt eget selv når dokumentet bærer en fremmed faggruppe (person-basert gren,
  // uavhengig av faggruppe) — nettopp brukergruppen sak 2 rammet.
  {
    navn: "sak 2: oppretter uten faggruppe, usendt dok (dokumentflytId=null) med fremmed faggruppe → tillat via bestiller",
    fakta: fakta({
      harDokument: true,
      bestillerUserId: "u-selv",
      dokumentflytId: null,
      bestillerFaggruppeId: "fg-fremmed",
      direkteFaggruppeIder: [],
    }),
    forventet: { tillat: true, grunn: "innsender-mottaker" },
  },
  {
    navn: "sak 2: personlig mottaker uten faggruppe, dok med fremmed faggruppe → tillat via mottaker",
    fakta: fakta({
      harDokument: true,
      recipientUserId: "u-selv",
      bestillerFaggruppeId: "fg-fremmed",
      direkteFaggruppeIder: [],
    }),
    forventet: { tillat: true, grunn: "innsender-mottaker" },
  },
  {
    navn: "sak 2 negativ kontroll: verken bestiller/mottaker/faggruppe/flyt (dok m/ fremmed faggruppe + flyt) → avvis",
    fakta: fakta({
      harDokument: true,
      bestillerUserId: "u-annen",
      recipientUserId: "u-tredje",
      bestillerFaggruppeId: "fg-fremmed",
      direkteFaggruppeIder: [],
      dokumentflytId: "flyt-fremmed",
      flytIder: [],
    }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Direkte faggruppe ——————————————————————————————————————————
  {
    navn: "direkte faggruppe: bestiller-faggruppe matcher → tillat",
    fakta: fakta({ bestillerFaggruppeId: "fg-1", direkteFaggruppeIder: ["fg-1"] }),
    forventet: { tillat: true, grunn: "faggruppe-direkte" },
  },
  {
    navn: "direkte faggruppe: utfører-faggruppe matcher → tillat",
    fakta: fakta({ utforerFaggruppeId: "fg-2", direkteFaggruppeIder: ["fg-9", "fg-2"] }),
    forventet: { tillat: true, grunn: "faggruppe-direkte" },
  },
  {
    navn: "direkte faggruppe: ingen match → faller videre",
    fakta: fakta({ bestillerFaggruppeId: "fg-1", direkteFaggruppeIder: ["fg-3"] }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Gruppe-domain —————————————————————————————————————————————
  {
    navn: "gruppe tverrgående (domain-match, ingen faggrupper) → tillat",
    fakta: fakta({
      templateDomain: "kvalitet",
      gruppeMedlemskap: [{ domener: ["kvalitet"], faggruppeIder: [] }],
    }),
    forventet: { tillat: true, grunn: "gruppe-tverrgaende" },
  },
  {
    navn: "gruppe faggruppe-begrenset: domain + faggruppe matcher → tillat",
    fakta: fakta({
      templateDomain: "kvalitet",
      bestillerFaggruppeId: "fg-5",
      gruppeMedlemskap: [{ domener: ["kvalitet"], faggruppeIder: ["fg-5"] }],
    }),
    forventet: { tillat: true, grunn: "gruppe-faggruppe" },
  },
  {
    navn: "gruppe faggruppe-begrenset: domain matcher men faggruppe ikke → avvis",
    fakta: fakta({
      templateDomain: "kvalitet",
      bestillerFaggruppeId: "fg-5",
      gruppeMedlemskap: [{ domener: ["kvalitet"], faggruppeIder: ["fg-6"] }],
    }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },
  {
    navn: "gruppe: domain matcher ikke → gren hoppes over",
    fakta: fakta({
      templateDomain: "kvalitet",
      gruppeMedlemskap: [{ domener: ["hms"], faggruppeIder: [] }],
    }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — HMS åpen synlighet ————————————————————————————————————————
  {
    navn: "HMS åpen: alle prosjektmedlemmer leser → tillat",
    fakta: fakta({ templateDomain: "hms", templateHmsSynlighet: "apen" }),
    forventet: { tillat: true, grunn: "hms-apen" },
  },
  {
    navn: "åpen-synlighet men domain ikke hms → ikke truffet",
    fakta: fakta({ templateDomain: "kvalitet", templateHmsSynlighet: "apen" }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Flyt-medlemskap + periode-vindu (obligatorisk) ————————————
  {
    navn: "flyt-medlemskap: aktiv periode (flytId i flytIder) → tillat",
    fakta: fakta({ harDokument: true, dokumentflytId: "flyt-1", flytIder: ["flyt-1"] }),
    forventet: { tillat: true, grunn: "flyt-medlemskap" },
  },
  {
    navn: "PERIODE-VINDU: utløpt medlemskap (periodeSlutt satt → filtrert bort av hentFlytIderForMedlem, flytId fraværende) → avvis",
    fakta: fakta({ harDokument: true, dokumentflytId: "flyt-1", flytIder: [] }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },
  {
    navn: "flyt-medlemskap: dokument uten flyt-id → gren hoppes over",
    fakta: fakta({ harDokument: true, dokumentflytId: null, flytIder: ["flyt-1"] }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — F1-A: privat HMS blokkert tross gyldig flyt-medlemskap (obligatorisk) —
  {
    navn: "F1-A: privat HMS (domain=hms, synlighet≠apen) + gyldig flyt-medlemskap → AVVIS",
    fakta: fakta({
      harDokument: true,
      templateDomain: "hms",
      templateHmsSynlighet: "skjult",
      dokumentflytId: "flyt-1",
      flytIder: ["flyt-1"],
    }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },
  {
    navn: "F1-A kontroll: HMS åpen + flyt-medlemskap → tillat via hms-apen (før flyt-grenen)",
    fakta: fakta({
      harDokument: true,
      templateDomain: "hms",
      templateHmsSynlighet: "apen",
      dokumentflytId: "flyt-1",
      flytIder: ["flyt-1"],
    }),
    forventet: { tillat: true, grunn: "hms-apen" },
  },
  {
    navn: "privat HMS uten annen tilgang → avvis",
    fakta: fakta({ templateDomain: "hms", templateHmsSynlighet: "skjult" }),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },

  // — Baseline ——————————————————————————————————————————————————
  {
    navn: "vanlig medlem uten binding/dokument → avvis",
    fakta: fakta({}),
    forventet: { tillat: false, grunn: "ingen-tilgang" },
  },
];

describe("tilgangsmatrise — frossen referanse (dagens oppførsel)", () => {
  it.each(MATRISE)("$navn", ({ fakta, forventet }) => {
    expect(avgjorDokumentTilgangReferanse(fakta)).toEqual(forventet);
  });
});

describe("tilgangsmatrise — ekstrahert produksjonsfunksjon (avgjorDokumentTilgang)", () => {
  it.each(MATRISE)("$navn", ({ fakta, forventet }) => {
    expect(avgjorDokumentTilgang(fakta)).toEqual(forventet);
  });
});

describe("tilgangsmatrise — begge sider identiske på hver rad", () => {
  it.each(MATRISE)("$navn", ({ fakta }) => {
    expect(avgjorDokumentTilgang(fakta)).toEqual(avgjorDokumentTilgangReferanse(fakta));
  });
});
