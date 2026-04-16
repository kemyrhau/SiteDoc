import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { type Permission, PERMISSIONS, utvidTillatelser, utledMinRolle, erTillattForRolle } from "@sitedoc/shared";
import type { FlytMedlemInfo } from "@sitedoc/shared";

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
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du tilhører ikke denne faggruppen",
    });
  }
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
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, organizationId: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem?.role === "admin") return;

  // company_admin-fallback: sjekk om prosjektet tilhører brukerens org
  if (bruker?.role === "company_admin" && bruker.organizationId) {
    const orgProsjekt = await prisma.organizationProject.findFirst({
      where: { organizationId: bruker.organizationId, projectId },
    });
    if (orgProsjekt) return;
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
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, organizationId: true } });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem) return;

  // company_admin-fallback: sjekk om prosjektet tilhører brukerens org
  if (bruker?.role === "company_admin" && bruker.organizationId) {
    const orgProsjekt = await prisma.organizationProject.findFirst({
      where: { organizationId: bruker.organizationId, projectId },
    });
    if (orgProsjekt) return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Du er ikke medlem av dette prosjektet",
  });
}

/**
 * Verifiser at bruker tilhører den angitte organisasjonen.
 * Brukes for org-admin-sider (/org/innstillinger).
 * company_admin uten organizationId er en ugyldig tilstand.
 */
export async function verifiserOrganisasjonTilgang(
  userId: string,
  organisationId: string,
): Promise<void> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!bruker?.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bruker tilhører ingen organisasjon",
    });
  }

  if (bruker.organizationId !== organisationId) {
    throw new TRPCError({ code: "FORBIDDEN" });
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
    select: { role: true, organizationId: true },
  });

  if (bruker?.role === "sitedoc_admin") return { erAdmin: true };

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (medlem?.role === "admin") return { erAdmin: true };

  // company_admin med riktig org → admin
  if (bruker?.role === "company_admin" && bruker.organizationId) {
    const orgProsjekt = await prisma.organizationProject.findFirst({
      where: { organizationId: bruker.organizationId, projectId },
    });
    if (orgProsjekt) return { erAdmin: true };
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
): Promise<void> {
  // sitedoc_admin ser alt
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

  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Prosjektadmin ser alt
  if (medlem.role === "admin") return;

  // Firmaansvarlig: ser dokumenter der firmamedlemmer er direkte involvert
  if (medlem.erFirmaansvarlig && dokumentId && dokumentType) {
    const brukerOrg = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (brukerOrg?.organizationId) {
      const firmaUserIder = (await prisma.user.findMany({
        where: { organizationId: brukerOrg.organizationId },
        select: { id: true },
      })).map((u) => u.id);

      // Sjekk bestillerUserId og recipientUserId
      const dokument = dokumentType === "task"
        ? await prisma.task.findUnique({
            where: { id: dokumentId },
            select: { bestillerUserId: true, recipientUserId: true },
          })
        : await prisma.checklist.findUnique({
            where: { id: dokumentId },
            select: { bestillerUserId: true, recipientUserId: true },
          });

      if (dokument) {
        const involverteUserIder = new Set(firmaUserIder);
        if (
          (dokument.bestillerUserId && involverteUserIder.has(dokument.bestillerUserId)) ||
          (dokument.recipientUserId && involverteUserIder.has(dokument.recipientUserId))
        ) {
          return;
        }
      }

      // Sjekk DocumentTransfer.senderId
      const transferMatch = await prisma.documentTransfer.findFirst({
        where: {
          senderId: { in: firmaUserIder },
          ...(dokumentType === "task"
            ? { taskId: dokumentId }
            : { checklistId: dokumentId }),
        },
        select: { id: true },
      });
      if (transferMatch) return;
    }
  }

  // Direkte faggruppe-tilgang
  const direkteFaggruppeIder = medlem.faggruppeKoblinger.map((e) => e.faggruppeId);
  const harDirekteTilgang =
    (bestillerFaggruppeId && direkteFaggruppeIder.includes(bestillerFaggruppeId)) ||
    (utforerFaggruppeId && direkteFaggruppeIder.includes(utforerFaggruppeId));

  if (harDirekteTilgang) return;

  // Fagområde-tilgang via grupper
  if (templateDomain) {
    for (const gm of medlem.groupMemberships) {
      const gruppeDomener = gm.group.domains as string[];
      if (!gruppeDomener.includes(templateDomain)) continue;

      // Tverrgående tilgang: gruppe uten faggrupper
      if (gm.group.groupFaggrupper.length === 0) return;

      // Faggruppe-begrenset: sjekk om dokumentets faggrupper matcher gruppens
      const gruppeFaggruppeIder = gm.group.groupFaggrupper.map((ge) => ge.faggruppeId);
      const matcherFaggruppe =
        (bestillerFaggruppeId && gruppeFaggruppeIder.includes(bestillerFaggruppeId)) ||
        (utforerFaggruppeId && gruppeFaggruppeIder.includes(utforerFaggruppeId));
      if (matcherFaggruppe) return;
    }
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Du har ikke tilgang til dette dokumentet",
  });
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

  const rolle = utledMinRolle(
    {
      userId,
      projectMemberId: medlem.id,
      faggruppeIder: medlem.faggruppeKoblinger.map((e) => e.faggruppeId),
      gruppeIder: medlem.groupMemberships.map((gm) => gm.groupId),
      erAdmin: medlem.role === "admin",
    },
    medlemmerInfo,
    { bestillerFaggruppeId, utforerFaggruppeId },
  );

  if (!erTillattForRolle(rolle, gjeldendStatus, nyStatus)) {
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
    const brukerOrg = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (brukerOrg?.organizationId) {
      const firmaUserIder = (await prisma.user.findMany({
        where: { organizationId: brukerOrg.organizationId },
        select: { id: true },
      })).map((u) => u.id);

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

  if (orBetingelser.length === 0) {
    // Bruker har ingen tilganger — returner et filter som aldri matcher
    return { id: "__ingen_tilgang__" };
  }

  return { OR: orBetingelser };
}

/**
 * Hent brukerens samlede tillatelser fra alle grupper.
 * Admin får alle tillatelser.
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

  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Du er ikke medlem av dette prosjektet",
    });
  }

  // Prosjektadmin har alle tillatelser
  if (medlem.role === "admin") {
    return new Set([...PERMISSIONS] as Permission[]);
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
