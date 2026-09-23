import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `prosjekt.settLivssyklus` — avslutt/arkiver-GATEN.
 *
 * 🔴 Kjernen: et prosjekt kan ikke avsluttes/arkiveres fra aktiv uten et dataeksport-arkiv
 * som (1) er ferdig (`status "klar"`), (2) ikke er utløpt (`utloperVed`), og (3) er laget ETTER
 * siste dokumentendring (`fullfortVed` >= nyeste `updatedAt` på Checklist/Task). Etter avslutning
 * er dokumentene utilgjengelige for deltakerne — gaten sikrer at det finnes et ferskt, levende arkiv.
 *
 * «Siste endring» = `updatedAt`, IKKE Activity: målt 2026-09-13 at sjekkliste/oppgave/hms ikke
 * skriver Activity-rader ved utfylling — Activity ville gått grønt på et prosjekt der noen fylte
 * ut femti felter etter eksporten.
 *
 * Negativ kontroll (kjørt manuelt 2026-09-13): fjern hver av de tre betingelsene i
 * `settLivssyklus` én for én → den tilhørende testen under blir RØD. En test som er grønn uten
 * sin betingelse måler ingenting.
 *   - fjern `if (!arkiv)`               → «NEKTER uten arkiv» blir grønn (galt)
 *   - fjern utløps-sjekken              → «NEKTER når arkivet er utløpt» blir grønn (galt)
 *   - fjern ferskhets-sjekken           → «NEKTER når arkivet er eldre enn siste endring» blir grønn (galt)
 */

const eksportFindFirst = vi.fn();
const checklistFindFirst = vi.fn();
const taskFindFirst = vi.fn();
const projectUpdate = vi.fn();
const activityCreate = vi.fn();
const erFirmaAdmin = vi.fn();

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  verifiserAdmin: vi.fn(),
  hentBrukersOrg: vi.fn(),
  hentDeaktiverteOrgIder: vi.fn(),
  erFirmaAdminForProsjekt: (...a: unknown[]) => erFirmaAdmin(...a),
  kanOppretteProsjekt: vi.fn(),
}));
vi.mock("../services/firmamodul", () => ({ hentAktiveFirmamoduler: vi.fn() }));
vi.mock("../services/autoProsjektAdmin", () => ({ autoLeggFirmaAdmins: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerProsjektmedlemskap: vi.fn() }));
vi.mock("../services/prosjektSeed", () => ({ seedStandardProsjektoppsett: vi.fn() }));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { prosjektRouter } from "./prosjekt";

const PROSJEKT = "44444444-4444-4444-4444-444444444444";

// Faste tidspunkter. FULLFORT_* ligger i fortiden; UTLOPER_FREM/BAK regnes relativt til nå
// så utløps-sjekken (`utloperVed <= new Date()`) treffer stabilt uansett når testen kjøres.
const FULLFORT = new Date("2026-02-01T00:00:00Z");
const ENDRING_FOER = new Date("2026-01-01T00:00:00Z"); // eldre enn arkivet → ferskt nok
const ENDRING_ETTER = new Date("2026-03-01T00:00:00Z"); // nyere enn arkivet → for gammelt
const UTLOPER_FREM = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const UTLOPER_BAK = new Date(Date.now() - 3600 * 1000);

type ArkivMock = { fullfortVed?: Date | null; utloperVed?: Date | null } | null;

/**
 * @param rolle           User.role (company_admin = ikke-sitedoc → gaten gjelder).
 * @param prosjektStatus  nåværende status (active → gaten kan slå inn).
 * @param arkiv           nyeste "klar"-arkiv, eller null for «ingen».
 * @param sisteChecklist  nyeste Checklist.updatedAt for prosjektet (null = ingen).
 * @param sisteTask       nyeste Task.updatedAt for prosjektet (null = ingen).
 */
function lagCaller(opts: {
  rolle?: string;
  prosjektStatus?: string;
  arkiv?: ArkivMock;
  sisteChecklist?: Date | null;
  sisteTask?: Date | null;
}) {
  const {
    rolle = "company_admin",
    prosjektStatus = "active",
    arkiv = null,
    sisteChecklist = null,
    sisteTask = null,
  } = opts;
  erFirmaAdmin.mockResolvedValue(true);
  eksportFindFirst.mockResolvedValue(arkiv);
  checklistFindFirst.mockResolvedValue(sisteChecklist ? { updatedAt: sisteChecklist } : null);
  taskFindFirst.mockResolvedValue(sisteTask ? { updatedAt: sisteTask } : null);
  projectUpdate.mockResolvedValue({ id: PROSJEKT, status: "completed" });
  activityCreate.mockResolvedValue({});
  const ctx = {
    userId: "user-1",
    ipAddress: null,
    userAgent: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: rolle, name: "Test" }) },
      project: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: prosjektStatus,
          name: "Prosjekt",
          primaryOrganizationId: "org-1",
        }),
        update: (...a: unknown[]) => projectUpdate(...a),
      },
      eksportJobb: { findFirst: (...a: unknown[]) => eksportFindFirst(...a) },
      checklist: { findFirst: (...a: unknown[]) => checklistFindFirst(...a) },
      task: { findFirst: (...a: unknown[]) => taskFindFirst(...a) },
      activity: { create: (...a: unknown[]) => activityCreate(...a) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return prosjektRouter.createCaller(ctx);
}

// Et ferskt, gyldig arkiv (ferdig + i fremtiden ikke utløpt + laget etter siste endring).
const FERSKT_ARKIV: ArkivMock = { fullfortVed: FULLFORT, utloperVed: UTLOPER_FREM };

describe("prosjekt.settLivssyklus — avslutt-gate", () => {
  beforeEach(() => {
    eksportFindFirst.mockReset();
    checklistFindFirst.mockReset();
    taskFindFirst.mockReset();
    projectUpdate.mockReset();
    activityCreate.mockReset();
    erFirmaAdmin.mockReset();
  });

  // --- Betingelse 1: arkivet finnes og er ferdig -----------------------------
  it("NEKTER avslutt (completed) fra aktiv uten ferdig eksport-arkiv", async () => {
    const caller = lagCaller({ arkiv: null });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "completed" })).rejects.toThrow(
      /arkivMangler/,
    );
    // Gaten stopper FØR skriving — prosjektet endres ikke.
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("NEKTER arkiver (archived) fra aktiv uten ferdig eksport-arkiv", async () => {
    const caller = lagCaller({ arkiv: null });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "archived" })).rejects.toThrow(
      /arkivMangler/,
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  // --- Betingelse 3: arkivet er laget etter siste endring --------------------
  it("TILLATER avslutt: ferskt arkiv, ingen endring siden (endring FØR arkivet)", async () => {
    const caller = lagCaller({ arkiv: FERSKT_ARKIV, sisteChecklist: ENDRING_FOER });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  it("TILLATER avslutt når prosjektet ikke har dokumenter (ingenting å bli foreldet mot)", async () => {
    const caller = lagCaller({ arkiv: FERSKT_ARKIV });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  it("NEKTER avslutt når arkivet er eldre enn siste endring (checklist endret etter)", async () => {
    const caller = lagCaller({ arkiv: FERSKT_ARKIV, sisteChecklist: ENDRING_ETTER });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "completed" })).rejects.toThrow(
      /arkivForGammelt/,
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("NEKTER avslutt når en OPPGAVE er endret etter arkivet (Task inngår i siste endring)", async () => {
    const caller = lagCaller({ arkiv: FERSKT_ARKIV, sisteTask: ENDRING_ETTER });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "completed" })).rejects.toThrow(
      /arkivForGammelt/,
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  // --- Betingelse 2: arkivet er ikke utløpt ----------------------------------
  it("NEKTER avslutt når arkivet er utløpt", async () => {
    const caller = lagCaller({
      arkiv: { fullfortVed: FULLFORT, utloperVed: UTLOPER_BAK },
      sisteChecklist: ENDRING_FOER,
    });
    await expect(caller.settLivssyklus({ id: PROSJEKT, status: "completed" })).rejects.toThrow(
      /arkivUtlopt/,
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("TILLATER avslutt når utloperVed = null (utløper aldri)", async () => {
    const caller = lagCaller({
      arkiv: { fullfortVed: FULLFORT, utloperVed: null },
      sisteChecklist: ENDRING_FOER,
    });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  // --- Nødutgang og ikke-gatede overganger -----------------------------------
  it("sitedoc-admin er nødutgang: avslutter uten arkiv", async () => {
    const caller = lagCaller({ rolle: "sitedoc_admin", arkiv: null });
    await caller.settLivssyklus({ id: PROSJEKT, status: "completed" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });

  it("gjenåpning (active) er ikke gatet — tillates uten arkiv", async () => {
    const caller = lagCaller({ arkiv: null, prosjektStatus: "completed" });
    await caller.settLivssyklus({ id: PROSJEKT, status: "active" });
    expect(projectUpdate).toHaveBeenCalledOnce();
  });
});
