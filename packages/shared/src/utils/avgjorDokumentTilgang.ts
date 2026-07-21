/**
 * Ren beslutning: har en bruker tilgang til et dokument (sjekkliste/oppgave)?
 *
 * Ekstrahert fra `verifiserDokumentTilgang` (apps/api/src/trpc/tilgangskontroll.ts)
 * i spor 2 (2026-07-20). `verifiserDokumentTilgang` beholder ALLE Prisma-oppslag,
 * bygger `TilgangsFakta` og kaller denne funksjonen. Ingen atferdsendring — kun
 * flytting av beslutningsgrenene, i uendret rekkefølge og semantikk.
 *
 * Rekkefølge (ufravikelig — jf. spor2-ordre § 4):
 *   admin → ikke-medlem → prosjektadmin → firmaansvarlig → bestiller/mottaker →
 *   faggruppe-direkte → gruppe-domain → HMS-åpen → flyt-medlemskap → avvis.
 *
 * `packages/shared/src/utils/tilgangsmatrise.test.ts` kjører den delte MATRISE
 * mot BÅDE denne funksjonen og den frosne referanse-transkripsjonen. Divergens =
 * test-feil. Endres en gren her uten at referansen (og dermed dagens oppførsel)
 * endres bevisst, fanges det av matrisen.
 */

/**
 * `fakta` = de allerede-hentede verdiene beslutningen tar. Fylles av Prisma-
 * oppslagene i `verifiserDokumentTilgang`.
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
  /** dokumentId && dokumentType satt → firmaansvarlig-grenen + parts vurderes. */
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
   * Flyt-IDer medlemmet er bundet til (person/faggruppe/gruppe), KUN aktive
   * medlemskap (`periodeSlutt = null`). Periode-filteret bor i
   * `hentFlytIderForMedlem` — utløpt medlemskap er fraværende her.
   */
  flytIder: string[];

  // Firmaansvarlig-oppslag (Prisma-resultat, forhåndsberegnet)
  /** OrganizationMember.userId[] for brukerens firma ([] hvis ingen org). */
  firmaUserIder: string[];
  /** Fant DocumentTransfer med senderId i firmaets brukere? */
  harFirmaTransfer: boolean;
}

export interface TilgangsResultat {
  tillat: boolean;
  /** Grenen som avgjorde — for feilmelding-mapping og test-diagnostikk. */
  grunn: string;
}

/**
 * Avgjør dokumenttilgang fra allerede-hentede fakta. `return`-grenene i
 * `verifiserDokumentTilgang` → `{ tillat: true }`; `throw FORBIDDEN` →
 * `{ tillat: false }`. Kalleren mapper `grunn` tilbake til riktig feilmelding.
 */
export function avgjorDokumentTilgang(f: TilgangsFakta): TilgangsResultat {
  // sitedoc_admin ser alt
  if (f.brukerRolle === "sitedoc_admin") return { tillat: true, grunn: "admin" };

  // Ikke medlem av prosjektet
  if (!f.erMedlem) return { tillat: false, grunn: "ikke-medlem" };

  // Prosjektadmin ser alt
  if (f.prosjektmedlemRolle === "admin") return { tillat: true, grunn: "prosjektadmin" };

  // Dokumentpartene lastes kun når dokumentId && dokumentType finnes. `harParter`
  // speiler originalens `if (dokumentParter)`-guard; i fakta-modellen faller null-
  // parter-tilfellet sammen med `harDokument` (null-feltene bryter part-sjekkene).
  const harParter = f.harDokument;

  // Firmaansvarlig: firmamedlem er bestiller/mottaker, eller transfer-avsender
  if (f.erFirmaansvarlig && f.harDokument) {
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

  // Innsender/mottaker: bruker er bestiller eller direkte mottaker
  if (harParter) {
    if (
      (f.bestillerUserId && f.bestillerUserId === f.userId) ||
      (f.recipientUserId && f.recipientUserId === f.userId)
    ) {
      return { tillat: true, grunn: "innsender-mottaker" };
    }
  }

  // Direkte faggruppe-tilgang (bestiller eller utfører)
  const harDirekteTilgang =
    (f.bestillerFaggruppeId && f.direkteFaggruppeIder.includes(f.bestillerFaggruppeId)) ||
    (f.utforerFaggruppeId && f.direkteFaggruppeIder.includes(f.utforerFaggruppeId));
  if (harDirekteTilgang) return { tillat: true, grunn: "faggruppe-direkte" };

  // Fagområde-tilgang via grupper
  if (f.templateDomain) {
    for (const gm of f.gruppeMedlemskap) {
      if (!gm.domener.includes(f.templateDomain)) continue;
      // Tverrgående: gruppe uten faggrupper ser alle dok med matchende domain
      if (gm.faggruppeIder.length === 0) return { tillat: true, grunn: "gruppe-tverrgaende" };
      // Faggruppe-begrenset
      const matcherFaggruppe =
        (f.bestillerFaggruppeId && gm.faggruppeIder.includes(f.bestillerFaggruppeId)) ||
        (f.utforerFaggruppeId && gm.faggruppeIder.includes(f.utforerFaggruppeId));
      if (matcherFaggruppe) return { tillat: true, grunn: "gruppe-faggruppe" };
    }
  }

  // HMS åpen-synlighet: alle prosjektmedlemmer kan lese
  if (f.templateDomain === "hms" && f.templateHmsSynlighet === "apen") {
    return { tillat: true, grunn: "hms-apen" };
  }

  // Dokumentflyt-medlemskap. F1-A: fyrer IKKE for private HMS-dokumenter.
  if (
    f.dokumentflytId &&
    !(f.templateDomain === "hms" && f.templateHmsSynlighet !== "apen")
  ) {
    if (f.flytIder.includes(f.dokumentflytId)) return { tillat: true, grunn: "flyt-medlemskap" };
  }

  // Ingen tilgang
  return { tillat: false, grunn: "ingen-tilgang" };
}
