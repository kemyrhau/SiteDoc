import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Negativ kontroll for den delte modul-resolveren (ordre [5]: «gir resolveren
 * aktiv for alt, sjekk at den faktisk leser begge tabeller. En gate som aldri
 * stenger er ikke en gate»).
 *
 * Kjører UTEN DB (prisma mocket). Beviser:
 *   - Firmafamilien leser OrganizationModule (firmatak) OG ProjectModule
 *     (prosjektbryter) — begge må være aktive; enten av → false.
 *   - Prosjektfamilien leser KUN ProjectModule og aldri firmataket (designlås 2/3).
 *   - Standalone: firmamoduler uten firmaId → false; prosjektmoduler upåvirket.
 *
 * Kjør: cd apps/api && npx vitest run src/services/modul/resolver.test.ts
 */

const orgFindUnique = vi.fn();
const projFindFirst = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationModule: { findUnique: (...a: unknown[]) => orgFindUnique(...a) },
    projectModule: { findFirst: (...a: unknown[]) => projFindFirst(...a) },
  },
}));

// Importeres ETTER mock (vi.mock heises, men vær eksplisitt).
import { effektivTilstand, modulFamilie } from "./resolver";

const FIRMA = "org-1";
const PROSJEKT = "prosjekt-1";

beforeEach(() => {
  orgFindUnique.mockReset();
  projFindFirst.mockReset();
});

describe("modulFamilie", () => {
  it("kjenner de tre firmamodulene", () => {
    expect(modulFamilie("timer")).toBe("firma");
    expect(modulFamilie("maskin")).toBe("firma");
    expect(modulFamilie("varelager")).toBe("firma");
  });
  it("kjenner prosjektmodulene", () => {
    expect(modulFamilie("psi")).toBe("prosjekt");
    expect(modulFamilie("kontrollplan")).toBe("prosjekt");
    expect(modulFamilie("hms-avvik")).toBe("prosjekt");
  });
  it("returnerer null for ukjent slug", () => {
    expect(modulFamilie("tull")).toBeNull();
  });
});

describe("effektivTilstand — firmafamilien", () => {
  it("firmatak AV → false, og OrganizationModule ER lest (negativ kontroll)", async () => {
    orgFindUnique.mockResolvedValue({ status: "arkivert" });
    const svar = await effektivTilstand("timer", { firmaId: FIRMA });
    expect(svar).toBe(false);
    expect(orgFindUnique).toHaveBeenCalledTimes(1); // taket ble faktisk slått opp
  });

  it("firmatak manglende rad → false", async () => {
    orgFindUnique.mockResolvedValue(null);
    expect(await effektivTilstand("maskin", { firmaId: FIRMA })).toBe(false);
  });

  it("firmatak PÅ uten prosjekt → true (prosjektbryter ikke slått opp)", async () => {
    orgFindUnique.mockResolvedValue({ status: "aktiv" });
    const svar = await effektivTilstand("timer", { firmaId: FIRMA });
    expect(svar).toBe(true);
    expect(projFindFirst).not.toHaveBeenCalled();
  });

  it("firmatak PÅ, prosjektbryter AV → false, og ProjectModule ER lest (begge tabeller)", async () => {
    orgFindUnique.mockResolvedValue({ status: "aktiv" });
    projFindFirst.mockResolvedValue(null);
    const svar = await effektivTilstand("timer", { firmaId: FIRMA, prosjektId: PROSJEKT });
    expect(svar).toBe(false);
    expect(orgFindUnique).toHaveBeenCalledTimes(1);
    expect(projFindFirst).toHaveBeenCalledTimes(1);
  });

  it("firmatak PÅ og prosjektbryter PÅ → true", async () => {
    orgFindUnique.mockResolvedValue({ status: "aktiv" });
    projFindFirst.mockResolvedValue({ id: "pm-1" });
    expect(
      await effektivTilstand("varelager", { firmaId: FIRMA, prosjektId: PROSJEKT }),
    ).toBe(true);
  });

  it("standalone: firmamodul uten firmaId → false, taket ikke slått opp", async () => {
    const svar = await effektivTilstand("timer", { prosjektId: PROSJEKT });
    expect(svar).toBe(false);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });
});

describe("effektivTilstand — prosjektfamilien", () => {
  it("prosjektbryter PÅ → true, og firmataket slås ALDRI opp (designlås 2/3)", async () => {
    projFindFirst.mockResolvedValue({ id: "pm-1" });
    const svar = await effektivTilstand("psi", { prosjektId: PROSJEKT });
    expect(svar).toBe(true);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it("prosjektbryter AV → false", async () => {
    projFindFirst.mockResolvedValue(null);
    expect(await effektivTilstand("kontrollplan", { prosjektId: PROSJEKT })).toBe(false);
  });

  it("uten prosjektId → false", async () => {
    expect(await effektivTilstand("psi", { firmaId: FIRMA })).toBe(false);
    expect(projFindFirst).not.toHaveBeenCalled();
  });

  it("standalone-prosjekt (firmaId ignoreres for prosjektmoduler) → prosjektbryter avgjør", async () => {
    projFindFirst.mockResolvedValue({ id: "pm-1" });
    const svar = await effektivTilstand("3d-visning", { prosjektId: PROSJEKT });
    expect(svar).toBe(true);
    expect(orgFindUnique).not.toHaveBeenCalled();
  });
});
