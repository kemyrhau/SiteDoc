import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit-test for det delte bypass-predikatet `erFirmaAdminForProsjekt`
 * (fabel-presedens 2026-08-15: ett felles bypass-sett for alle porter).
 *
 * Kjører UTEN DB (prisma mocket), i motsetning til *.integration.test.ts. Beviser at
 * ekstraksjonen er atferdsbevarende der typecheck ikke kan: en invertert boolsk ville
 * bestått typecheck men åpnet fem porter samtidig. To assertions:
 *   - firma-admin i en org KOBLET til prosjektet   → true  (bypass slår inn)
 *   - firma-admin kun i en ANNEN org (ikke koblet) → false (gjennomfall, ingen bypass)
 *
 * Kjør: cd apps/api && npx vitest run src/trpc/tilgangskontroll.test.ts
 */

const findMany = vi.fn();
const findUnique = vi.fn();
const userFindUnique = vi.fn();
const memberFindUnique = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    projectOrganization: { findMany: (...a: unknown[]) => findMany(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => findUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    projectMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    // krevAktivAnsettelse (tilgangskontroll.ts, 2026-08-28) kjøres først i
    // verifiserRetningsrett. Standalone (primaryOrganizationId=null) er valgt BEVISST her
    // for å no-op-e gaten og isolere Lukk-guard-/retningsretts-logikken.
    // ⚠️ Ansettelses-gaten selv (deaktivert ansatt → FORBIDDEN) er dermed IKKE dekket av
    // denne fila — den fortjener egne tester (registreringsmodell fase 1, kan FRATA tilgang).
    project: { findUnique: () => Promise.resolve({ primaryOrganizationId: null }) },
  },
}));

// Importeres ETTER mock (vi.mock heises, men vær eksplisitt).
import { erFirmaAdminForProsjekt, verifiserRetningsrett } from "./tilgangskontroll";
import type { RaFlytMedlem } from "@sitedoc/shared";

const USER = "user-1";
const PROJECT = "prosjekt-1";
const KOBLET_ORG = "org-koblet";
const ANNEN_ORG = "org-annen";

describe("erFirmaAdminForProsjekt — delt bypass-predikat", () => {
  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset();
  });

  it("firma-admin i en org KOBLET til prosjektet → true (bypass slår inn)", async () => {
    // Prosjektet er koblet til KOBLET_ORG.
    findMany.mockResolvedValue([{ organizationId: KOBLET_ORG }]);
    // Bruker er firma_admin i den koblede orgen.
    findUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
      Promise.resolve(
        where.userId_organizationId.organizationId === KOBLET_ORG
          ? { firmaRoller: ["firma_admin"] }
          : null,
      ),
    );

    expect(await erFirmaAdminForProsjekt(USER, PROJECT)).toBe(true);
    expect(findMany).toHaveBeenCalledWith({ where: { projectId: PROJECT }, select: { organizationId: true } });
  });

  it("firma-admin kun i en ANNEN org (ikke koblet til prosjektet) → false (gjennomfall)", async () => {
    // Prosjektet er koblet til KOBLET_ORG — der bruker IKKE er firma-admin.
    findMany.mockResolvedValue([{ organizationId: KOBLET_ORG }]);
    // Bruker er firma_admin, men bare i en ANNEN org som prosjektet ikke er koblet til.
    findUnique.mockImplementation(({ where }: { where: { userId_organizationId: { organizationId: string } } }) =>
      Promise.resolve(
        where.userId_organizationId.organizationId === ANNEN_ORG
          ? { firmaRoller: ["firma_admin"] }
          : { firmaRoller: ["hms_ansvarlig"] },
      ),
    );

    expect(await erFirmaAdminForProsjekt(USER, PROJECT)).toBe(false);
  });
});

/**
 * Server-håndhevelse av «Lukk = KUN admin» (Kenneth-vedtak 2026-08-21, kontroll-Claude-fangst):
 * closed ble splittet ut av kanTerminere-grenen i verifiserRetningsrett. Uten denne testen er
 * vernet uverifisert — en ren frontend-grense. Kjører uten DB (prisma mocket).
 *
 * Konstruksjon: ett-ledds flyt der brukeren er hovedansvarlig på steg 2 og HAR ballen
 * (aktivPosisjon = 2) → harBallen = true → kanTerminere = true. En ikke-admin som VILLE fått
 * lukke hvis closed lå i kanTerminere-grenen. Kontroll-paret (approved slipper gjennom) beviser
 * at avvisningen er Lukk-guarden, ikke manglende termineringsrett.
 */
describe("verifiserRetningsrett — Lukk (→closed) håndheves server-side som KUN admin", () => {
  const BALL_USER = "bruker-med-ball";
  const PROSJEKT = "prosjekt-lukk";
  const medlemmer: RaFlytMedlem[] = [
    { steg: 2, klassifisering: null, kanTerminereUtenBall: false, erHovedansvarlig: true, brukerId: BALL_USER, gruppeId: null, faggruppeId: null },
  ];
  const IKKE_ADMIN_MEDLEM = { role: "member", faggruppeKoblinger: [], groupMemberships: [] };

  beforeEach(() => {
    userFindUnique.mockReset();
    memberFindUnique.mockReset();
  });

  it("ikke-admin MED ballen (kanTerminere=true) → FORBIDDEN på closed", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue(IKKE_ADMIN_MEDLEM);
    await expect(
      verifiserRetningsrett(BALL_USER, PROSJEKT, medlemmer, 2, "closed", "approved"),
    ).rejects.toThrow();
  });

  it("KONTROLL: samme ikke-admin slipper gjennom på approved (beviser kanTerminere=true)", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue(IKKE_ADMIN_MEDLEM);
    await expect(
      verifiserRetningsrett(BALL_USER, PROSJEKT, medlemmer, 2, "approved", "responded"),
    ).resolves.toBeUndefined();
  });

  it("prosjektadmin (medlem.role='admin') → closed slipper gjennom (tidlig retur)", async () => {
    userFindUnique.mockResolvedValue({ role: "user" });
    memberFindUnique.mockResolvedValue({ role: "admin", faggruppeKoblinger: [], groupMemberships: [] });
    await expect(
      verifiserRetningsrett(BALL_USER, PROSJEKT, medlemmer, 2, "closed", "approved"),
    ).resolves.toBeUndefined();
  });

  it("sitedoc_admin → closed slipper gjennom (tidlig retur, projectMember hentes ikke)", async () => {
    userFindUnique.mockResolvedValue({ role: "sitedoc_admin" });
    memberFindUnique.mockResolvedValue(null);
    await expect(
      verifiserRetningsrett(BALL_USER, PROSJEKT, medlemmer, 2, "closed", "approved"),
    ).resolves.toBeUndefined();
  });
});
