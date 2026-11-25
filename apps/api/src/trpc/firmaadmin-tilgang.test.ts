import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FIRMAADMIN-TILGANG (Kenneth 2026-11-25, «Ja, A–D») — datalaget i tilgangskontroll.ts.
 *
 *   B: `byggTilgangsFilter` (lista) og `verifiserDokumentTilgang` (detaljen) slipper inn en
 *      firmaadmin i prosjektets EIERFIRMA uten medlemsrad, med prosjektadmin-grenen og samme
 *      unntak for private HMS-saker.
 *   A: `hentFirmaAdminOrgIder` — bare aktiv `firma_admin`.
 *   D: `aktivAnsattIEierfirma` — bare aktiv ansatt i eierfirmaet, aldri deltakerfirma.
 *
 * Isolasjon (ordre [3]): firmaadmin i firma X får ikke noe i et prosjekt firma Y eier, heller
 * ikke når X bare er deltakerfirma der. Beslutningsgrenene står i
 * packages/shared/src/utils/tilgangsmatrise.test.ts (rader «B: …»).
 *
 * Testcase fra prod: firma A.Markussen AS, firmaadmin Silje, medlem bare av 998 (ikke 999).
 * Kjør: cd apps/api && npx vitest run src/trpc/firmaadmin-tilgang.test.ts
 */

interface Ansettelse { userId: string; organizationId: string; firmaRoller: string[]; status: string }
interface Prosjekt { id: string; primaryOrganizationId: string | null; deltakere: string[] }
interface Dokument { id: string; bestillerUserId: string | null; recipientUserId: string | null; dokumentflytId: string | null; hmsSynlighet: string | null }

let ansettelser: Ansettelse[] = [];
let prosjekter: Prosjekt[] = [];
let dokumenter: Dokument[] = [];

const finnAnsettelse = (userId: string, organizationId: string) =>
  ansettelser.find((a) => a.userId === userId && a.organizationId === organizationId) ?? null;

vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: () => Promise.resolve({ role: "user" }) },
    project: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const p = prosjekter.find((x) => x.id === where.id);
        return Promise.resolve(p ? { primaryOrganizationId: p.primaryOrganizationId, status: "active", type: "kunde" } : null);
      },
    },
    organizationMember: {
      findUnique: ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) =>
        Promise.resolve(finnAnsettelse(where.userId_organizationId.userId, where.userId_organizationId.organizationId)),
      findMany: ({ where }: { where: { userId?: string; status?: unknown; firmaRoller?: { has: string } } }) =>
        Promise.resolve(
          ansettelser.filter(
            (a) =>
              (where.userId === undefined || a.userId === where.userId) &&
              (where.firmaRoller === undefined || a.firmaRoller.includes(where.firmaRoller.has)) &&
              // `status: { not: "deaktivert" }` eller `status: "deaktivert"`
              (where.status === undefined ||
                (typeof where.status === "string"
                  ? a.status === where.status
                  : a.status !== (where.status as { not: string }).not)),
          ),
        ),
    },
    // Silje har ingen medlemsrad i prosjektene testene bruker.
    projectMember: { findFirst: () => Promise.resolve(null) },
    projectGroupMember: { findFirst: () => Promise.resolve(null) },
    dokumentflytMedlem: { findMany: () => Promise.resolve([]) },
    task: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const d = dokumenter.find((x) => x.id === where.id);
        return Promise.resolve(d ? { ...d, template: { hmsSynlighet: d.hmsSynlighet } } : null);
      },
    },
  },
}));

import {
  byggTilgangsFilter,
  verifiserDokumentTilgang,
  hentFirmaAdminOrgIder,
  aktivAnsattIEierfirma,
  IKKE_PRIVAT_HMS,
} from "./tilgangskontroll";

const SILJE = "u-silje";
const FIRMA_A = "org-a-markussen";
const FIRMA_B = "org-b-annet";
const P998 = "p-998"; // A eier, Silje medlem (ikke brukt her — dekkes av medlemsveien)
const P999 = "p-999"; // A eier, Silje IKKE medlem
const P_B = "p-b"; // B eier
const P_B_DELTAR = "p-b-a-deltar"; // B eier, A er deltakerfirma

beforeEach(() => {
  ansettelser = [{ userId: SILJE, organizationId: FIRMA_A, firmaRoller: ["firma_admin"], status: "aktiv" }];
  prosjekter = [
    { id: P998, primaryOrganizationId: FIRMA_A, deltakere: [] },
    { id: P999, primaryOrganizationId: FIRMA_A, deltakere: [] },
    { id: P_B, primaryOrganizationId: FIRMA_B, deltakere: [] },
    { id: P_B_DELTAR, primaryOrganizationId: FIRMA_B, deltakere: [FIRMA_A] },
  ];
  dokumenter = [
    { id: "d-bygg", bestillerUserId: "u-annen", recipientUserId: null, dokumentflytId: null, hmsSynlighet: null },
    { id: "d-hms-privat", bestillerUserId: "u-annen", recipientUserId: null, dokumentflytId: null, hmsSynlighet: null },
  ];
});

describe("B: byggTilgangsFilter (lista) — firmaadmin uten medlemsrad", () => {
  it("🔴 Silje (firmaadmin i A) får lista i 999 — alt unntatt private HMS-saker", async () => {
    const filter = await byggTilgangsFilter(SILJE, P999);
    expect(filter).not.toBeNull();
    const or = (filter as { OR: unknown[] }).OR;
    expect(or).toContainEqual(IKKE_PRIVAT_HMS);
  });

  it("🔴 firmaadmin som også er firmaets hms_ansvarlig ser alt (null)", async () => {
    ansettelser[0]!.firmaRoller = ["firma_admin", "hms_ansvarlig"];
    expect(await byggTilgangsFilter(SILJE, P999)).toBeNull();
  });

  it("🔴 isolasjon: prosjekt et annet firma eier → FORBIDDEN", async () => {
    await expect(byggTilgangsFilter(SILJE, P_B)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 isolasjon: prosjekt der A bare er deltakerfirma → FORBIDDEN", async () => {
    await expect(byggTilgangsFilter(SILJE, P_B_DELTAR)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deaktivert firmaadmin får ikke lista", async () => {
    ansettelser[0]!.status = "deaktivert";
    await expect(byggTilgangsFilter(SILJE, P999)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("vanlig ansatt (ikke firmaadmin) uten medlemsrad → FORBIDDEN som før", async () => {
    ansettelser[0]!.firmaRoller = [];
    await expect(byggTilgangsFilter(SILJE, P999)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("B: verifiserDokumentTilgang (detaljen) — samme svar som lista", () => {
  it("🔴 Silje åpner et vanlig dokument i 999", async () => {
    await expect(
      verifiserDokumentTilgang(SILJE, P999, null, null, "bygg", "d-bygg", "task"),
    ).resolves.toBeUndefined();
  });

  it("🔴 privat HMS-sak er skjult for firmaadmin som ikke er behandler eller part", async () => {
    await expect(
      verifiserDokumentTilgang(SILJE, P999, null, null, "hms", "d-hms-privat", "task"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 isolasjon: dokument i prosjekt et annet firma eier → FORBIDDEN", async () => {
    await expect(
      verifiserDokumentTilgang(SILJE, P_B, null, null, "bygg", "d-bygg", "task"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("🔴 isolasjon: dokument der A bare er deltakerfirma → FORBIDDEN", async () => {
    await expect(
      verifiserDokumentTilgang(SILJE, P_B_DELTAR, null, null, "bygg", "d-bygg", "task"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("A: hentFirmaAdminOrgIder", () => {
  it("gir firmaene der brukeren er aktiv firma_admin", async () => {
    ansettelser.push({ userId: SILJE, organizationId: FIRMA_B, firmaRoller: ["hms_ansvarlig"], status: "aktiv" });
    expect(await hentFirmaAdminOrgIder(SILJE)).toEqual([FIRMA_A]);
  });

  it("deaktivert ansettelse gir ingen", async () => {
    ansettelser[0]!.status = "deaktivert";
    expect(await hentFirmaAdminOrgIder(SILJE)).toEqual([]);
  });
});

describe("D: aktivAnsattIEierfirma", () => {
  it("aktiv ansatt i eierfirmaet → eierfirmaet", async () => {
    ansettelser[0]!.firmaRoller = [];
    expect(await aktivAnsattIEierfirma(SILJE, P999)).toBe(FIRMA_A);
  });

  it("🔴 isolasjon: prosjekt et annet firma eier, også når A deltar → null", async () => {
    expect(await aktivAnsattIEierfirma(SILJE, P_B)).toBeNull();
    expect(await aktivAnsattIEierfirma(SILJE, P_B_DELTAR)).toBeNull();
  });

  it("deaktivert ansettelse → null", async () => {
    ansettelser[0]!.status = "deaktivert";
    expect(await aktivAnsattIEierfirma(SILJE, P999)).toBeNull();
  });
});
