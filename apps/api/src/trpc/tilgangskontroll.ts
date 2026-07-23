import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { type Permission, PERMISSIONS, utvidTillatelser, utledMinRolle, erTillattForRolle, avgjorDokumentTilgang } from "@sitedoc/shared";
import type { FlytMedlemInfo, AdminNiva } from "@sitedoc/shared";
import { hentFlytRettighetOverrides } from "../services/flytRettighet";

/**
 * Hent brukerens faggruppe-IDer i et prosjekt.
 * Returnerer null for admin (ser alt), string[] for vanlige brukere.
 */
export async function hentBrukerFaggruppeIder(
  userId: string,
  projectId: string,
): Promise<string[] | null> {
  // sitedoc_admin ser alt
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return null;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
    },
  });

  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Prosjektadmin ser alt
  if (medlem.role === "admin") return null;

  return medlem.faggruppeKoblinger.map((e) => e.faggruppeId);
}

/**
 * Bygg Prisma WHERE-filter for faggruppe-basert tilgang.
 * Returnerer null for admin (ingen filtrering nødvendig).
 */
export function byggFaggruppeFilter(faggruppeIder: string[] | null) {
  if (faggruppeIder === null) return null;

  return {
    OR: [
      { bestillerFaggruppeId: { in: faggruppeIder } },
      { utforerFaggruppeId: { in: faggruppeIder } },
    ],
  };
}

/**
 * Verifiser at bruker tilhører den angitte faggruppen.
 */
export async function verifiserFaggruppeTilhorighet(
  userId: string,
  faggruppeId: string,
): Promise<void> {
  // sitedoc_admin har alltid tilgang
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const kobling = await prisma.faggruppeKobling.findFirst({
    where: {
      faggruppeId,
      projectMember: { userId },
    },
  });

  if (!kobling) {
    // Sjekk om bruker er admin (admin kan opprette for alle faggrupper)
    const faggruppe = await prisma.faggruppe.findUnique({
      where: { id: faggruppeId },
      select: { projectId: true },
    });
    if (faggruppe) {
      const medlem = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId: faggruppe.projectId,
          },
        },
      });
      if (medlem?.role === "admin") return;

      // Dokumentflyt-medlemskap som alternativ tilhørighet: er bruker medlem av en
      // flyt der DENNE faggruppen er eier-faggruppe, får de opprette på faggruppens
      // vegne. Gjenbruker hentBrukersFlytMedlemskap (eneste medlemskaps-kilde) og
      // det index-ede `dokumentflyt.faggruppeId` (schema @@index) — ingen faggruppe
      // legges i helperen (R2: index-only bevart).
      const flytIder = await hentBrukersFlytMedlemskap(userId, faggruppe.projectId);
      if (flytIder.length > 0) {
        const treff = await prisma.dokumentflyt.findFirst({
          where: { id: { in: flytIder }, faggruppeId },
          select: { id: true },
        });
        if (treff) return;
      }
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du tilhører ikke denne faggruppen",
    });
  }
}

/**
 * Hent brukerens primær-org-id for tilgangsbeslutninger.
 *
 * Leser kun fra OrganizationMember. Forutsetter dagens 1:1-virkelighet
 * (én bruker = én org). O-4 introduserer eksplisitt primær-flagg når
 * multi-org støttes.
 *
 * @throws BAD_REQUEST hvis bruker har flere OrganizationMember-rader.
 * @returns organizationId, eller null hvis bruker er org-løs (f.eks. sitedoc_admin).
 */
export async function hentBrukersOrg(userId: string): Promise<string | null> {
  const members = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const [first, ...rest] = members;
  if (rest.length > 0) {
    // Multi-org ikke støttet ennå — O-4 vil introdusere primær-org
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Bruker tilhører flere firmaer — kontakt support",
    });
  }
  return first?.organizationId ?? null;
}

/**
 * Som hentBrukersOrg, men kaster FORBIDDEN hvis bruker er org-løs.
 * Brukes på routes som krever firmatilhørighet (alle firma-skopede queries).
 */
export async function krevBrukersOrg(userId: string): Promise<string> {
  const orgId = await hentBrukersOrg(userId);
  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Ingen organisasjon tilknyttet",
    });
  }
  return orgId;
}

/**
 * Løs orgId for en read-only route. Hvis inputOrgId er gitt:
 *   - sitedoc_admin: returner inputOrgId (cross-tenant tilgang)
 *   - andre: returner inputOrgId KUN hvis bruker tilhører den orgen
 * Hvis inputOrgId mangler: returner brukerens egen org (FORBIDDEN hvis org-løs).
 */
export async function resolverOrgFraInput(
  userId: string,
  inputOrgId?: string,
): Promise<string> {
  if (inputOrgId) {
    const bruker = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (bruker?.role === "sitedoc_admin") return inputOrgId;
    const brukersOrg = await hentBrukersOrg(userId);
    if (brukersOrg === inputOrgId) return inputOrgId;
    throw new TRPCError({ code: "FORBIDDEN", message: "Ikke ditt firma" });
  }
  return krevBrukersOrg(userId);
}

/**
 * Intern hjelper for firma-admin-rettighet.
 * Leser fra OrganizationMember.firmaRoller.
 */
async function erFirmaAdmin(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { firmaRoller: true },
  });
  return member?.firmaRoller.includes("firma_admin") ?? false;
}

/**
 * Sjekk om bruker har HMS-tilgang på firma-nivå.
 * Returnerer true for: sitedoc_admin, firma-admin eller hms_ansvarlig på orgId.
 *
 * Brukes for firma-nivå HMS-dashbord: lese på tvers av firma-prosjekter,
 * inkl. private dokumenter, og behandle direkte fra firma-rad.
 *
 * Trinn 1 av firma-HMS-dashboard (2026-05-29).
 */
export async function harFirmaHmsTilgang(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  // sitedoc_admin → ja
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "sitedoc_admin") return true;

  // firma_admin eller hms_ansvarlig på orgId → ja
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { firmaRoller: true },
  });
  if (!member) return false;
  return (
    member.firmaRoller.includes("firma_admin") ||
    member.firmaRoller.includes("hms_ansvarlig")
  );
}

/**
 * Verifiser at bruker er admin i prosjektet.
 * company_admin med riktig org arver admin-rettigheter uten ProjectMember-rad.
 */
export async function verifiserAdmin(
  userId: string,
  projectId: string,
): Promise<void> {
  // sitedoc_admin har alltid tilgang
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem?.role === "admin") return;

  // O-3a: firma-admin-fallback via OrganizationMember.firmaRoller (eller legacy User.role)
  const orgKoblinger = await prisma.projectOrganization.findMany({
    where: { projectId },
    select: { organizationId: true },
  });
  for (const { organizationId } of orgKoblinger) {
    if (await erFirmaAdmin(userId, organizationId)) return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Kun administratorer kan utføre denne handlingen",
  });
}

/**
 * Verifiser at bruker er medlem av prosjektet.
 * company_admin med riktig org arver tilgang uten ProjectMember-rad.
 */
export async function verifiserProsjektmedlem(
  userId: string,
  projectId: string,
): Promise<void> {
  // sitedoc_admin har alltid tilgang
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem) return;

  // O-3a: firma-admin-fallback via OrganizationMember.firmaRoller (eller legacy User.role)
  const orgKoblinger = await prisma.projectOrganization.findMany({
    where: { projectId },
    select: { organizationId: true },
  });
  for (const { organizationId } of orgKoblinger) {
    if (await erFirmaAdmin(userId, organizationId)) return;
  }

  // Fase 2 / T.10: interne prosjekter (type="internt") er firma-eide bærere for
  // ikke-prosjekt-tid. Alle firma-ansatte (OrganizationMember på prosjektets
  // primaryOrganizationId) når dem UTEN ProjectMember-rad. Smalt unntak: gjelder
  // KUN type="internt" + samme org — kunde-prosjekter er uberørt. Interne prosjekter
  // har ingen andre prosjektmoduler (vilkår 3), så praktisk eksponering er timer-flate.
  const prosjekt = await prisma.project.findUnique({
    where: { id: projectId },
    select: { type: true, primaryOrganizationId: true },
  });
  if (prosjekt?.type === "internt" && prosjekt.primaryOrganizationId) {
    const erAnsatt = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: prosjekt.primaryOrganizationId,
        },
      },
      select: { id: true },
    });
    if (erAnsatt) return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Du er ikke medlem av dette prosjektet",
  });
}

/**
 * Verifiser at alle oppgitte prosjekter tilhører firmaet.
 *
 * Firma-grense på rad-nivå for timer-modulen (`SheetTimer.projectId` er svak FK til
 * Project i kjerne-DB). Dette er en FIRMA-grense, ikke prosjekt-medlemskap (jf. G1
 * firma-nivå-tilgang): et firma kan føre timer mot ethvert prosjekt det har en relasjon
 * til. "Tilhører" = unionen av to relasjoner:
 *   - DELTAR: ProjectOrganization-kobling (dekker underentreprenør på annet firmas prosjekt)
 *   - EIER: primaryOrganizationId == orgId (dekker også LEGACY eide prosjekter som mangler
 *     ProjectOrganization-rad — opprettet før auto-koblingen, jf. admin.ts-bugfix; verifisert
 *     på test: "Test redigert mal" hadde timer-rader uten kobling men eide-match).
 *
 * Ren ProjectOrganization-sjekk ville feilaktig avvist skriv mot firmaets egne legacy-
 * prosjekter — derfor unionen. Kaster FORBIDDEN hvis ett eller flere projectId verken er
 * eid av eller koblet til orgId. Tom liste = no-op. To samlede findMany (ikke N oppslag).
 */
export async function verifiserProsjekterTilhørerFirma(
  projectIds: string[],
  organizationId: string,
): Promise<void> {
  const unike = Array.from(new Set(projectIds));
  if (unike.length === 0) return;

  const [koblet, eide] = await Promise.all([
    prisma.projectOrganization.findMany({
      where: { projectId: { in: unike }, organizationId },
      select: { projectId: true },
    }),
    prisma.project.findMany({
      where: { id: { in: unike }, primaryOrganizationId: organizationId },
      select: { id: true },
    }),
  ]);
  const gyldigeIder = new Set<string>([
    ...koblet.map((p) => p.projectId),
    ...eide.map((p) => p.id),
  ]);
  const ugyldig = unike.filter((pid) => !gyldigeIder.has(pid));
  if (ugyldig.length > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Prosjekt(er) tilhører ikke firmaet: ${ugyldig.join(", ")}`,
    });
  }
}

/**
 * Verifiser at bruker tilhører den angitte organisasjonen.
 * Brukes for org-admin-sider (/org/innstillinger).
 */
export async function verifiserOrganisasjonTilgang(
  userId: string,
  organisationId: string,
): Promise<void> {
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: organisationId } },
    select: { id: true },
  });
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bruker tilhører ikke denne organisasjonen",
    });
  }
}

/**
 * Autoriser at brukeren kan administrere det angitte firmaet.
 *
 * Tilgangsregler:
 *   - sitedoc_admin     → tilgang til ALLE firmaer (system-rolle)
 *   - firma_admin       → tilgang KUN til eget firma (via OrganizationMember.firmaRoller)
 *   - alle andre roller → FORBIDDEN
 *
 * Brukes på firma-admin-ruter der sitedoc_admin må kunne jobbe i kundens kontekst
 * (Steg 1b — Firma-kontekst Lag 1+2+3 per docs/claude/domene-arbeidsflyt.md).
 *
 * Forskjell fra `verifiserOrganisasjonTilgang`:
 *   - Denne tillater sitedoc_admin uten matchende org
 *   - Denne krever admin-rolle (ikke bare medlemskap)
 */
export async function autoriserAdminForFirma(
  userId: string,
  organizationId: string,
): Promise<void> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!bruker) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ukjent bruker" });
  }

  // sitedoc_admin har alltid tilgang (system-rolle, forblir på User)
  if (bruker.role === "sitedoc_admin") return;

  if (await erFirmaAdmin(userId, organizationId)) return;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Krever firmaadmin-rettighet for det angitte firmaet",
  });
}

/**
 * Krev at en organisasjon er et reelt kunde-firma (erKunde=true).
 * Brukes på operasjoner som kun gir mening for kundefirmaer som faktisk
 * bruker SiteDoc — ikke skall-firma som kun er part i dokumentflyten
 * (f.eks. byggherre, underentreprenør uten SiteDoc-konto).
 */
export async function krevErKundeFirma(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { erKunde: true },
  });
  if (!org) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Firma finnes ikke" });
  }
  if (!org.erKunde) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Operasjonen krever et reelt kunde-firma",
    });
  }
}

/**
 * Verifiser at bruker er admin ELLER firmaansvarlig i prosjektet.
 * Returnerer { erAdmin: true } for admin-brukere, { erAdmin: false } for firmaansvarlige.
 * Kaster FORBIDDEN for vanlige medlemmer.
 */
export async function verifiserAdminEllerFirmaansvarlig(
  userId: string,
  projectId: string,
): Promise<{ erAdmin: boolean }> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (bruker?.role === "sitedoc_admin") return { erAdmin: true };

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem?.role === "admin") return { erAdmin: true };

  // O-3a: firma-admin via OrganizationMember.firmaRoller (eller legacy User.role) → admin
  const orgKoblinger = await prisma.projectOrganization.findMany({
    where: { projectId },
    select: { organizationId: true },
  });
  for (const { organizationId } of orgKoblinger) {
    if (await erFirmaAdmin(userId, organizationId)) return { erAdmin: true };
  }

  if (medlem?.erFirmaansvarlig) return { erAdmin: false };

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Krever administrator- eller firmaansvarlig-rettighet",
  });
}

/**
 * Verifiser at bruker har tilgang til et dokument (sjekkliste/oppgave).
 * Admin ser alt. Vanlige brukere ser kun dokumenter der egen faggruppe er oppretter/svarer,
 * eller via fagområde-tilgang fra brukergrupper.
 */
export async function verifiserDokumentTilgang(
  userId: string,
  projectId: string,
  bestillerFaggruppeId: string | null,
  utforerFaggruppeId: string | null,
  templateDomain?: string | null,
  dokumentId?: string,
  dokumentType?: "task" | "checklist",
  templateHmsSynlighet?: string | null,
): Promise<void> {
  // Datahenting (Prisma) her; beslutningen tas av den rene funksjonen
  // `avgjorDokumentTilgang` (@sitedoc/shared) — samme grener, uendret rekkefølge
  // og semantikk (spor 2-ekstraksjon 2026-07-20). Matrisen i
  // packages/shared/src/utils/tilgangsmatrise.test.ts håndhever oppførselen.
  //
  // sitedoc_admin ser alt — early return bevart så admin ikke utløser medlem-
  // oppslaget (admin har ikke nødvendigvis en ProjectMember-rad).
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: {
        include: {
          group: {
            include: {
              groupFaggrupper: { select: { faggruppeId: true } },
            },
          },
        },
      },
    },
  });

  // Ikke medlem — data-eksistens-guard bevart inline (gater dokumentpart-oppslaget).
  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Prosjektadmin ser alt — early return bevart så prosjektadmin ikke utløser
  // dokumentpart-/firma-/flyt-oppslagene under.
  if (medlem.role === "admin") return;

  // Last dokumentpartene én gang — brukes av firmaansvarlig-, innsender- og
  // flyt-grenen i beslutningsfunksjonen.
  let dokumentParter:
    | { bestillerUserId: string | null; recipientUserId: string | null; dokumentflytId: string | null }
    | null = null;
  if (dokumentId && dokumentType) {
    dokumentParter = dokumentType === "task"
      ? await prisma.task.findUnique({
          where: { id: dokumentId },
          select: { bestillerUserId: true, recipientUserId: true, dokumentflytId: true },
        })
      : await prisma.checklist.findUnique({
          where: { id: dokumentId },
          select: { bestillerUserId: true, recipientUserId: true, dokumentflytId: true },
        });
  }

  const direkteFaggruppeIder = medlem.faggruppeKoblinger.map((e) => e.faggruppeId);

  // Firmaansvarlig-oppslag: firmaets brukere + evt. transfer-avsender-treff.
  // Gate uendret (erFirmaansvarlig && dokument && org). MERK: transfer-spørringen
  // kjøres nå ubetinget innenfor gaten — den gamle kortslutningen (hopp over
  // transfer-oppslag når en firma-part allerede matchet) er droppet, fordi
  // gjeninnføring av den ville krevd å kopiere part-beslutningen inn i data-laget
  // (drift-farlig). Utfallet er identisk (part-treffet vinner uansett i den rene
  // funksjonen); kun én ekstra read i det sjeldne part-treff-tilfellet. FLAGGET.
  let firmaUserIder: string[] = [];
  let harFirmaTransfer = false;
  if (medlem.erFirmaansvarlig && dokumentId && dokumentType) {
    const brukerOrgId = await hentBrukersOrg(userId);
    if (brukerOrgId) {
      firmaUserIder = (await prisma.organizationMember.findMany({
        where: { organizationId: brukerOrgId },
        select: { userId: true },
      })).map((m) => m.userId);

      const transferMatch = await prisma.documentTransfer.findFirst({
        where: {
          senderId: { in: firmaUserIder },
          ...(dokumentType === "task"
            ? { taskId: dokumentId }
            : { checklistId: dokumentId }),
        },
        select: { id: true },
      });
      harFirmaTransfer = Boolean(transferMatch);
    }
  }

  // Flyt-medlemskap: allerede-hentet `medlem` + den delte hentFlytIderForMedlem
  // (eneste medlemskaps-kilde, ingen kopi; N+1-vakt via forhåndshentede id-er).
  // Fetch gates kun på data-eksistens (dokumentflytId) — F1-A-avvisningen (privat
  // HMS) eies av den rene funksjonen, ikke data-laget (drift-sikkert). MERK: én
  // ekstra read i privat-HMS-med-flyt-tilfellet der gammel kode gatet bort
  // oppslaget; utfallet er identisk (F1-A avviser uansett). FLAGGET.
  let flytIder: string[] = [];
  if (dokumentParter?.dokumentflytId) {
    flytIder = await hentFlytIderForMedlem(
      medlem.id,
      direkteFaggruppeIder,
      medlem.groupMemberships.map((gm) => gm.groupId),
    );
  }

  const resultat = avgjorDokumentTilgang({
    brukerRolle: bruker?.role ?? null,
    erMedlem: true,
    prosjektmedlemRolle: medlem.role,
    erFirmaansvarlig: medlem.erFirmaansvarlig,
    userId,
    harDokument: Boolean(dokumentId && dokumentType),
    bestillerUserId: dokumentParter?.bestillerUserId ?? null,
    recipientUserId: dokumentParter?.recipientUserId ?? null,
    dokumentflytId: dokumentParter?.dokumentflytId ?? null,
    bestillerFaggruppeId,
    utforerFaggruppeId,
    templateDomain: templateDomain ?? null,
    templateHmsSynlighet: templateHmsSynlighet ?? null,
    direkteFaggruppeIder,
    gruppeMedlemskap: medlem.groupMemberships.map((gm) => ({
      domener: gm.group.domains as string[],
      faggruppeIder: gm.group.groupFaggrupper.map((ge) => ge.faggruppeId),
    })),
    flytIder,
    firmaUserIder,
    harFirmaTransfer,
  });

  if (!resultat.tillat) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du har ikke tilgang til dette dokumentet",
    });
  }
}

/**
 * Verifiser at bruker har riktig rolle i dokumentflyten for å utføre statusendringen.
 * Dokumenter uten dokumentflytId slipper gjennom (bakoverkompatibilitet).
 * Admin/registrator har alltid lov.
 */
export async function verifiserFlytRolle(
  userId: string,
  projectId: string,
  dokumentflytId: string | null | undefined,
  bestillerFaggruppeId: string | null,
  utforerFaggruppeId: string | null,
  gjeldendStatus: string,
  nyStatus: string,
): Promise<void> {
  // Dokumenter uten dokumentflyt — bakoverkompatibilitet
  if (!dokumentflytId) return;

  // Hent brukerens info
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: { select: { groupId: true } },
    },
  });
  if (!medlem) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem av prosjektet" });
  }

  // Hent flytens medlemmer
  const flytMedlemmer = await prisma.dokumentflytMedlem.findMany({
    where: { dokumentflytId },
    select: { rolle: true, faggruppeId: true, projectMemberId: true, groupId: true },
  });

  const medlemmerInfo: FlytMedlemInfo[] = flytMedlemmer.map((m) => ({
    rolle: m.rolle,
    faggruppeId: m.faggruppeId,
    projectMemberId: m.projectMemberId,
    groupId: m.groupId,
  }));

  // adminNiva (Kloss 2): sitedoc_admin bypasset allerede over (linje 646, full return).
  // Prosjektadmin = "prosjekt" (egen matrise-kolonne, full innenfor statusmaskinen ved tom
  // override, konfigurerbar nedover). Firma-admin er IKKE et flyt-admin-nivå (Kenneth-vedtak
  // 2026-07-23) — og har uansett ingen ProjectMember-rad, så den kaster FORBIDDEN over (linje
  // 655). Ingen firmaRoller-sjekk her: firma-admin får ingen bypass server-side (uendret).
  const adminNiva: AdminNiva = medlem.role === "admin" ? "prosjekt" : null;

  const rolle = utledMinRolle(
    {
      userId,
      projectMemberId: medlem.id,
      faggruppeIder: medlem.faggruppeKoblinger.map((e) => e.faggruppeId),
      gruppeIder: medlem.groupMemberships.map((gm) => gm.groupId),
      erAdmin: adminNiva !== null,
    },
    medlemmerInfo,
    { bestillerFaggruppeId, utforerFaggruppeId },
  );

  // Per-firma rettighets-overstyringer (config-design § 1). Tom tabell → tom map →
  // bit-identisk med default-laget. Firmaet resolves via prosjektets primærorg.
  const prosjekt = await prisma.project.findUnique({
    where: { id: projectId },
    select: { primaryOrganizationId: true },
  });
  const overrides = await hentFlytRettighetOverrides(prosjekt?.primaryOrganizationId);

  if (!erTillattForRolle(rolle, gjeldendStatus, nyStatus, adminNiva, overrides)) {
    const rolleNavn = rolle ?? "ingen";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Du har rollen «${rolleNavn}» i denne dokumentflyten og kan ikke utføre overgangen ${gjeldendStatus} → ${nyStatus}`,
    });
  }
}

/**
 * Bygg Prisma WHERE-filter som kombinerer faggruppe-tilgang og fagområde-tilgang.
 * Returnerer null for admin (ingen filtrering nødvendig).
 */
/**
 * Kjerne: flyt-ID-ene et prosjektmedlem er bundet til, via alle tre bindinger
 * (person-direkte / faggruppe / gruppe). Kun aktive medlemskap (`periodeSlutt = null`).
 * Ett rent enkelt-tabell-oppslag på `dokumentflyt_medlemmer` (indeks på alle tre binding-feltene),
 * ingen join — begge konsumenter (filter + tRPC) bruker kun `dokumentflytId`.
 * N+1-vakt: kalleren sender allerede-hentede id-er så `byggTilgangsFilter` ikke dobbelt-henter medlemmet.
 */
async function hentFlytIderForMedlem(
  projectMemberId: string,
  faggruppeIder: string[],
  groupIder: string[],
): Promise<string[]> {
  const orBindinger: Record<string, unknown>[] = [{ projectMemberId }];
  if (faggruppeIder.length > 0) orBindinger.push({ faggruppeId: { in: faggruppeIder } });
  if (groupIder.length > 0) orBindinger.push({ groupId: { in: groupIder } });

  const medlemskap = await prisma.dokumentflytMedlem.findMany({
    where: { periodeSlutt: null, OR: orBindinger },
    select: { dokumentflytId: true },
  });
  return [...new Set(medlemskap.map((m) => m.dokumentflytId))];
}

/**
 * Flyt-ID-ene innlogget bruker er medlem av i et prosjekt (alle tre bindinger).
 * Delt kilde: `byggTilgangsFilter` (synlighet) + tRPC `hentMineFlyter` (klient-opprett).
 */
export async function hentBrukersFlytMedlemskap(
  userId: string,
  projectId: string,
): Promise<string[]> {
  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      id: true,
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: { select: { groupId: true } },
    },
  });
  if (!medlem) return [];
  return hentFlytIderForMedlem(
    medlem.id,
    medlem.faggruppeKoblinger.map((k) => k.faggruppeId),
    medlem.groupMemberships.map((g) => g.groupId),
  );
}

export async function byggTilgangsFilter(
  userId: string,
  projectId: string,
) {
  // sitedoc_admin ser alt
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return null;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: {
        include: {
          group: {
            include: {
              groupFaggrupper: { select: { faggruppeId: true } },
            },
          },
        },
      },
    },
  });

  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Prosjektadmin ser alt
  if (medlem.role === "admin") return null;

  // Samle alle OR-betingelser
  const orBetingelser: Record<string, unknown>[] = [];

  // Firmaansvarlig: ser dokumenter der firmamedlemmer er direkte involvert
  if (medlem.erFirmaansvarlig) {
    const brukerOrgId = await hentBrukersOrg(userId);
    if (brukerOrgId) {
      const firmaUserIder = (await prisma.organizationMember.findMany({
        where: { organizationId: brukerOrgId },
        select: { userId: true },
      })).map((m) => m.userId);

      if (firmaUserIder.length > 0) {
        // Dokumenter opprettet av firmamedlem
        orBetingelser.push({ bestillerUserId: { in: firmaUserIder } });
        // Dokumenter der firmamedlem er mottaker
        orBetingelser.push({ recipientUserId: { in: firmaUserIder } });
        // Dokumenter der firmamedlem har sendt/videresendt
        orBetingelser.push({
          transfers: { some: { senderId: { in: firmaUserIder } } },
        });
      }
    }
  }

  // Innsender/mottaker: brukerens egne dokumenter — speiler bestiller/mottaker-
  // grenen i verifiserDokumentTilgang (avgjorDokumentTilgang, grunn
  // "innsender-mottaker"). Uten denne så oppretteren/mottakeren dokumentet via
  // detalj-URL, men ikke i lista (sak 2, kode-målt 2026-07-19). Ingen
  // rettighetsutvidelse — begge grupper kan allerede åpne dokumentet via detalj-
  // gaten; dette gjør bare lista konsistent. HMS-lista AND-er dessuten
  // byggHmsSynlighetsFilter på toppen (uendret).
  orBetingelser.push({ bestillerUserId: userId });
  orBetingelser.push({ recipientUserId: userId });

  // Direkte faggruppe-tilgang (alle domener)
  const direkteFaggruppeIder = medlem.faggruppeKoblinger.map((e) => e.faggruppeId);
  if (direkteFaggruppeIder.length > 0) {
    orBetingelser.push({ bestillerFaggruppeId: { in: direkteFaggruppeIder } });
    orBetingelser.push({ utforerFaggruppeId: { in: direkteFaggruppeIder } });
  }

  // Fagområde-tilgang via grupper
  for (const gm of medlem.groupMemberships) {
    const gruppeDomener = gm.group.domains as string[];
    if (gruppeDomener.length === 0) continue;

    if (gm.group.groupFaggrupper.length === 0) {
      // Tverrgående tilgang: alle dokumenter med matchende domain
      orBetingelser.push({
        template: { domain: { in: gruppeDomener } },
      });
    } else {
      // Faggruppe-begrenset: kun dokumenter med matchende domain OG faggruppe
      const gruppeFaggruppeIder = gm.group.groupFaggrupper.map((ge) => ge.faggruppeId);
      for (const domain of gruppeDomener) {
        orBetingelser.push({
          AND: [
            { template: { domain } },
            {
              OR: [
                { bestillerFaggruppeId: { in: gruppeFaggruppeIder } },
                { utforerFaggruppeId: { in: gruppeFaggruppeIder } },
              ],
            },
          ],
        });
      }
    }
  }

  // Dokumentflyt-medlemskap: dokumenter i flyter brukeren er medlem av.
  // Fanger person-direkte (project_member_id) binding som faggruppe-/gruppe-veiene over
  // er blinde for. Gjenbruker allerede-hentet `medlem` (ingen ekstra medlems-oppslag).
  const flytIder = await hentFlytIderForMedlem(
    medlem.id,
    direkteFaggruppeIder,
    medlem.groupMemberships.map((gm) => gm.groupId),
  );
  if (flytIder.length > 0) {
    orBetingelser.push({ dokumentflytId: { in: flytIder } });
  }

  if (orBetingelser.length === 0) {
    // UOPPNÅELIG i dag: bestiller/mottaker-grenene over pushes ubetinget, så
    // orBetingelser har alltid ≥ 2 elementer. Beholdt bevisst som forsvar mot en
    // fremtidig refaktor som gjør noen grener betingede — uten den ville et tomt
    // orBetingelser gi `{ OR: [] }`, som i Prisma matcher INGENTING (riktig her,
    // men en subtil semantikk å stole på). Denne sentinellen gjør intensjonen
    // eksplisitt. Bruker har ingen tilganger — filter som aldri matcher.
    return { id: "__ingen_tilgang__" };
  }

  return { OR: orBetingelser };
}

/**
 * Hent brukerens samlede tillatelser fra alle grupper.
 * Admin får alle tillatelser.
 * firma_admin på en koblet ProjectOrganization arver fulle tillatelser uavhengig av
 * om ProjectMember-rad finnes eller ikke (speiler verifiserAdmin-mønsteret).
 */
export async function hentBrukerTillatelser(
  userId: string,
  projectId: string,
): Promise<Set<Permission>> {
  // sitedoc_admin har alle tillatelser
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") {
    return new Set([...PERMISSIONS] as Permission[]);
  }

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      groupMemberships: {
        include: {
          group: { select: { permissions: true } },
        },
      },
    },
  });

  // Prosjektadmin har alle tillatelser
  if (medlem?.role === "admin") {
    return new Set([...PERMISSIONS] as Permission[]);
  }

  // Firma-admin-fallback: speiler verifiserAdmin (linje 226-232).
  // firma_admin på en koblet ProjectOrganization arver fulle prosjekt-tillatelser,
  // også når bruker er ProjectMember med role="member".
  const orgKoblinger = await prisma.projectOrganization.findMany({
    where: { projectId },
    select: { organizationId: true },
  });
  for (const { organizationId } of orgKoblinger) {
    if (await erFirmaAdmin(userId, organizationId)) {
      return new Set([...PERMISSIONS] as Permission[]);
    }
  }

  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Samle alle tillatelser fra grupper og utvid gamle til nye
  const raTillatelser: string[] = [];
  for (const gm of medlem.groupMemberships) {
    const perms = gm.group.permissions as string[];
    raTillatelser.push(...perms);
  }

  return utvidTillatelser(raTillatelser);
}

/**
 * Verifiser at bruker har en spesifikk tillatelse.
 */
export async function verifiserTillatelse(
  userId: string,
  projectId: string,
  permission: Permission,
): Promise<void> {
  const tillatelser = await hentBrukerTillatelser(userId, projectId);

  if (!tillatelser.has(permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Du mangler tillatelsen "${permission}" for å utføre denne handlingen`,
    });
  }
}

/**
 * Sjekker om bruker har en granulær firma-rolle (per A.25).
 *
 * Brukes for HMS-ansvarlig, og lignende firma-roller som gjelder på tvers av
 * prosjekter innenfor brukerens organisasjon. Per A.27 gir "hms_ansvarlig"
 * automatisk lese-tilgang til HMS-rapporter i firmaets prosjekter.
 *
 * Tildeles av firma-admin via organisasjon.tildelOrgRolle / fjernOrgRolle.
 */
export async function harOrgRolle(userId: string, role: string): Promise<boolean> {
  const member = await prisma.organizationMember.findFirst({
    where: { userId, firmaRoller: { has: role } },
    select: { id: true },
  });
  return member !== null;
}

/**
 * Verifiser at en bruker har skrive-tilgang til en annen brukers
 * AnsattKompetanse-rad (Fase 0.5 § 2 + A.28).
 *
 * Policy konfigureres per firma via OrganizationSetting.kompetanseRegistreringTilgang:
 * - "firma_admin" (default) — kun firma-admin kan skrive
 * - "bruker_egen" — bruker kan skrive egne, firma-admin alle
 * - "alle" — alle ansatte kan skrive for hverandre
 *
 * Bypass: sitedoc_admin og company_admin har alltid tilgang innen sin egen org
 * (Alternativ A — admin respekterer ikke policy, kun ikke-admin gjør det).
 *
 * Kaster TRPCError ved manglende tilgang.
 */
export async function verifiserKompetanseSkriveTilgang(
  ctxUserId: string,
  malUserId: string,
): Promise<void> {
  const ctxBruker = await prisma.user.findUniqueOrThrow({
    where: { id: ctxUserId },
    select: { role: true },
  });

  // Steg 1: SiteDoc-admin kortslutning (cross-tenant superuser)
  if (ctxBruker.role === "sitedoc_admin") return;

  // Steg 2: Verifiser at målbruker finnes
  const malBrukerEksisterer = await prisma.user.findUnique({
    where: { id: malUserId },
    select: { id: true },
  });
  if (!malBrukerEksisterer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Mål-bruker finnes ikke",
    });
  }

  // Steg 3: Cross-org blokkering — begge må tilhøre samme firma
  const ctxOrgId = await hentBrukersOrg(ctxUserId);
  if (!ctxOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Krever firma-tilknytning",
    });
  }
  const malOrgId = await hentBrukersOrg(malUserId);
  if (malOrgId !== ctxOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mål-bruker tilhører annet firma",
    });
  }

  // Steg 4: Firma-admin kortslutning (etter cross-org sjekk)
  if (await erFirmaAdmin(ctxUserId, ctxOrgId)) return;

  // Steg 5: Hent firma-policy (default firma_admin hvis setting mangler)
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId: ctxOrgId },
    select: { kompetanseRegistreringTilgang: true },
  });
  const policy = setting?.kompetanseRegistreringTilgang ?? "firma_admin";

  // Steg 6: Apply policy
  if (policy === "firma_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Kun firma-admin kan registrere kompetanse i dette firmaet",
    });
  }
  if (policy === "bruker_egen" && malUserId !== ctxUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du kan kun registrere egne kompetanser",
    });
  }
  // policy === "alle" → tillat (samme firma allerede verifisert)
}

/**
 * Verifiser at bruker har skrive-tilgang til ansvarlig-felt på Equipment
 * (både primær `Equipment.ansvarligUserId` og tilleggsansvarlige i
 * `EquipmentAnsvarlig`-tabellen). Per A.6 hybrid-modell.
 *
 * Tilgangsregler:
 *  - sitedoc_admin: alltid (cross-org)
 *  - firma_admin: i samme firma som equipment
 *  - nåværende primær (Equipment.ansvarligUserId === ctxUserId): i samme firma
 *  - andre: kun lese-tilgang (kaster FORBIDDEN her)
 *
 * Importerer prismaMaskin lokalt for å unngå sirkulær avhengighet i tRPC-laget.
 */
export async function verifiserMaskinAnsvarligSkriveTilgang(
  ctxUserId: string,
  equipmentId: string,
): Promise<void> {
  const { prismaMaskin } = await import("@sitedoc/db-maskin");

  const equipment = await prismaMaskin.equipment.findUnique({
    where: { id: equipmentId },
    select: { organizationId: true, ansvarligUserId: true },
  });
  if (!equipment) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Maskin ikke funnet" });
  }

  const ctxBruker = await prisma.user.findUnique({
    where: { id: ctxUserId },
    select: { role: true },
  });
  if (!ctxBruker) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Steg 1: sitedoc_admin (cross-org)
  if (ctxBruker.role === "sitedoc_admin") return;

  // Steg 2: cross-org-blokkering (alle ikke-superadmin må være i samme firma)
  const ctxOrgId = await hentBrukersOrg(ctxUserId);
  if (ctxOrgId !== equipment.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Maskin tilhører annet firma",
    });
  }

  // Steg 3: firma-admin i samme firma
  if (await erFirmaAdmin(ctxUserId, equipment.organizationId)) return;

  // Steg 4: primær-ansvarlig i samme firma
  if (equipment.ansvarligUserId === ctxUserId) return;

  // Steg 5: andre brukere har kun lese-tilgang
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Kun firma-admin eller hovedansvarlig kan endre ansvarlige",
  });
}

// ---------------------------------------------------------------------------
// Dokumentflyt-tilgang — flyt-bytte + brukers boks i flyt
// Brukes av oppgave.hentTilgjengeligeFlyter, sjekkliste.hentTilgjengeligeFlyter,
// og av begge endreStatus Lag 1-blokker (kryssfaggruppe/flyt-bytte).
// ---------------------------------------------------------------------------

export interface BrukersBoks {
  steg: number;
  rolle: string;
  kilde: "projectMember" | "group" | "faggruppe";
}

/**
 * Finn brukerens posisjon (steg + rolle) i en gitt dokumentflyt.
 * Spesifisitets-hierarki: projectMember > group > faggruppe.
 * Returnerer null hvis brukeren ikke er medlem av flyten.
 */
export function finnBrukersBoks(
  flyt: {
    medlemmer: Array<{
      steg: number;
      rolle: string;
      projectMemberId: string | null;
      groupId: string | null;
      faggruppeId: string | null;
    }>;
  },
  bruker: {
    projectMemberId: string;
    faggruppeIder: Set<string>;
    gruppeIder: Set<string>;
  },
): BrukersBoks | null {
  for (const m of flyt.medlemmer) {
    if (m.projectMemberId === bruker.projectMemberId) {
      return { steg: m.steg, rolle: m.rolle, kilde: "projectMember" };
    }
  }
  for (const m of flyt.medlemmer) {
    if (m.groupId && bruker.gruppeIder.has(m.groupId)) {
      return { steg: m.steg, rolle: m.rolle, kilde: "group" };
    }
  }
  for (const m of flyt.medlemmer) {
    if (m.faggruppeId && bruker.faggruppeIder.has(m.faggruppeId)) {
      return { steg: m.steg, rolle: m.rolle, kilde: "faggruppe" };
    }
  }
  return null;
}

export interface BrukerProsjektTilgang {
  erSitedocAdmin: boolean;
  erProsjektAdmin: boolean;
  erRegistrator: boolean;
  projectMemberId: string;
  faggruppeIder: Set<string>;
  gruppeIder: Set<string>;
}

/**
 * Aggregert tilgangs-info for én bruker i ett prosjekt. Henter user.role,
 * ProjectMember + relasjoner, og permissions i ett kall. Kaster FORBIDDEN
 * hvis brukeren ikke er medlem av prosjektet.
 */
export async function hentBrukerProsjektTilgang(
  userId: string,
  projectId: string,
): Promise<BrukerProsjektTilgang> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: { select: { groupId: true } },
    },
  });
  if (!medlem) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem av prosjektet" });
  }
  const tillatelser = await hentBrukerTillatelser(userId, projectId);
  return {
    erSitedocAdmin: bruker?.role === "sitedoc_admin",
    erProsjektAdmin: medlem.role === "admin",
    erRegistrator: tillatelser.has("create_checklists") || tillatelser.has("create_tasks"),
    projectMemberId: medlem.id,
    faggruppeIder: new Set(medlem.faggruppeKoblinger.map((k) => k.faggruppeId)),
    gruppeIder: new Set(medlem.groupMemberships.map((g) => g.groupId)),
  };
}

/**
 * Avgjør om brukeren kan bytte oppgave/sjekkliste til en annen dokumentflyt.
 * Fire veier til ja:
 *   1. Sitedoc-admin
 *   2. Prosjektadmin (ProjectMember.role === "admin")
 *   3. Registrator (create_checklists eller create_tasks)
 *   4. Har ballen + cross-flyt-medlem (er recipient eller medlem av
 *      recipientGroup, og er medlem av minst én annen flyt på samme
 *      dokumenttype). BACKLOG: flyt-bytte lander på brukerens egen boks
 *      i ny flyt, så cross-flyt-medlemskap er en forutsetning.
 */
export function kanByttFlyt(
  tilgang: BrukerProsjektTilgang,
  dokumentRecipient: {
    recipientUserId: string | null;
    recipientGroupId: string | null;
  },
  brukerHarAndreFlyter: boolean,
  userId: string,
): boolean {
  if (tilgang.erSitedocAdmin) return true;
  if (tilgang.erProsjektAdmin) return true;
  if (tilgang.erRegistrator) return true;
  const harBallen =
    dokumentRecipient.recipientUserId === userId ||
    (dokumentRecipient.recipientGroupId !== null &&
      tilgang.gruppeIder.has(dokumentRecipient.recipientGroupId));
  return harBallen && brukerHarAndreFlyter;
}
