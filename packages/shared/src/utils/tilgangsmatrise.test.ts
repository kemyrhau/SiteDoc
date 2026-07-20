import { describe, it, expect } from "vitest";

/**
 * Tilgangsmatrise — varig håndhevelse av dokument-tilgangsbeslutningen.
 *
 * Fase A (denne fila, spor 2-ordre 2026-07-20): tabelldrevet matrise mot DAGENS
 * oppførsel i `verifiserDokumentTilgang` (apps/api/src/trpc/tilgangskontroll.ts
 * :480–639). Ingen produksjonskode er endret. Beslutningsgrenene er transkribert
 * linje-for-linje til referansefunksjonen `avgjorDokumentTilgangReferanse` under,
 * med samme rekkefølge og semantikk. Matrisen kjøres mot referansen og er grønn.
 *
 * Dette er sikkerhetsnettet for ekstraksjonen: i Fase B trekkes beslutningen ut
 * som ren funksjon `avgjorDokumentTilgang(fakta)` i produksjonskoden, og SAMME
 * MATRISE (konstanten under) kjøres mot BÅDE referansen og den nye funksjonen.
 * Identisk utfall på hver rad beviser at ekstraksjonen ikke endret oppførsel.
 *
 * Utvidbar: sak 2 (bestiller/mottaker-grener), sak 3 (HMS-synlighet) og sak1b
 * (rollestyring) legger til RADER i MATRISE, ikke nye testfiler.
 *
 * Rekkefølgen på grenene (ufravikelig, jf. ordre § 4):
 *   admin → ikke-medlem → prosjektadmin → firmaansvarlig → bestiller/mottaker →
 *   faggruppe-direkte → gruppe-domain → HMS-åpen → flyt-medlemskap → avvis.
 */

/**
 * `fakta` = de allerede-hentede verdiene som beslutningen tar. I produksjon
 * fylles disse av Prisma-oppslagene i `verifiserDokumentTilgang`; her fylles de
 * direkte per matrise-rad. Modellen er identisk med `avgjorDokumentTilgang`-
 * signaturen som Fase B ekstraherer.
 */
export interface TilgangsFakta {
  /** User.role — "sitedoc_admin" gir full bypass. */
  brukerRolle: string | null;
  /** Finnes en ProjectMember-rad? false → «ikke medlem av prosjektet». */
  erMedlem: boolean;
  /** ProjectMember.role — "admin" = prosjektadmin (ser alt). */
  prosjektmedlemRolle: string | null;
  /** ProjectMember.erFirmaansvarlig. */
  erFirmaansvarlig: boolean;
  /** Innlogget brukers id (for innsender/mottaker-sammenligning). */
  userId: string;

  // Dokument-attributter (dokumentParter + mal-felt)
  /** dokumentId && dokumentType satt → dokumentParter er lastet. */
  harDokument: boolean;
  bestillerUserId: string | null;
  recipientUserId: string | null;
  dokumentflytId: string | null;
  bestillerFaggruppeId: string | null;
  utforerFaggruppeId: string | null;
  templateDomain: string | null;
  templateHmsSynlighet: string | null;

  // Bindinger (allerede-hentet fra medlem)
  /** FaggruppeKobling.faggruppeId[] — direkte faggruppe-tilgang. */
  direkteFaggruppeIder: string[];
  /** Gruppemedlemskap med domener + evt. faggruppe-begrensning. */
  gruppeMedlemskap: Array<{ domener: string[]; faggruppeIder: string[] }>;
  /**
   * Flyt-IDer medlemmet er bundet til via person/faggruppe/gruppe.
   * KUN aktive medlemskap (`periodeSlutt = null`) — periode-filteret bor i
   * `hentFlytIderForMedlem` (blir i Prisma-laget). Utløpt medlemskap er derfor
   * fraværende i denne lista; det er slik periode-vindu-radene modelleres.
   */
  flytIder: string[];

  // Firmaansvarlig-oppslag (Prisma-resultat, forhåndsberegnet av kalleren)
  /** OrganizationMember.userId[] for brukerens firma ([] hvis ingen org). */
  firmaUserIder: string[];
  /** Fant DocumentTransfer med senderId i firmaets brukere? */
  harFirmaTransfer: boolean;
}

export interface TilgangsResultat {
  tillat: boolean;
  grunn: string;
}

/**
 * Referanse: transkripsjon av dagens `verifiserDokumentTilgang`-beslutning
 * (tilgangskontroll.ts:490–638). BARE beslutningsgrenene — Prisma-oppslagene er
 * erstattet av forhåndsberegnede `fakta`. Rekkefølge og semantikk er identisk.
 * `throw FORBIDDEN` → `{ tillat: false }`; `return` → `{ tillat: true }`.
 */
export function avgjorDokumentTilgangReferanse(f: TilgangsFakta): TilgangsResultat {
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

describe("tilgangsmatrise — mot dagens beslutning (Fase A: referanse-transkripsjon)", () => {
  it.each(MATRISE)("$navn", ({ fakta, forventet }) => {
    expect(avgjorDokumentTilgangReferanse(fakta)).toEqual(forventet);
  });
});
