import { describe, it, expect, vi } from "vitest";
import { anvendDwgResultat } from "./tegning";
import { roterProsentMarkor, type DwgKonverteringsResultat } from "../services/dwgKonvertering";

/**
 * FUNKSJONSENDRING (Kenneth 2026-10-10): brukerens rotasjons-overstyring skal FØLGE MED
 * til neste revisjon — ikke nullstilles i `anvendDwgResultat` (tidl. `tegning.ts:242`).
 *
 * `rotasjonOverstyrt` er brukerens ABSOLUTTE valgte visningsrotasjon (bygget står likt i
 * hver revisjon). Enhet/kalibrering er filavhengig og nullstilles fortsatt; orientering er
 * det ikke. Markørene flyttes av `rotDelta` (= ny − gammel autoRotasjon) uavhengig av
 * overstyringen, så de ligger visuelt likt etter revisjonen (regneeksempel i `tegning.ts`).
 *
 * Vi kaller den interne skriveren direkte med en fake-prisma som fletter `update`-data inn
 * i en in-memory rad — da feiler testen umiddelbart hvis noen gjeninnfører nullstillingen.
 */

const TEGNING = { id: "d1", name: "Plan 06", projectId: "p1", byggeplassId: null };

/** DwgMaaling-feltene et resultat må ha (filavhengige — nullstilles ved revisjon). */
const MAALING = {
  mmPrPiksel: 10,
  scale: "1:100",
  scaleKilde: "dwg" as const,
  imageWidth: 2000,
  imageHeight: 1500,
};

function lagResultat(nyAuto: number | null, overstyr: Partial<DwgKonverteringsResultat> = {}): DwgKonverteringsResultat {
  return {
    ...MAALING,
    visningUrl: "/uploads/ny.svg",
    visningFilType: "svg",
    koordinatSystem: null,
    geoReferanse: null,
    feil: null,
    layouts: [],
    autoRotasjon: nyAuto,
    startutsnitt: null,
    rapport: null,
    ...overstyr,
  };
}

/** Fake-prisma: én rad i minnet; `update` fletter data inn. Markør-tabellene er tomme med
 *  mindre `markorer` gir en oppgave-posisjon. */
function lagPrisma(rad: { autoRotasjon: number | null; rotasjonOverstyrt: number | null }, markorer: { x: number; y: number }[] = []) {
  const oppgaveUpdates: { x: number; y: number }[] = [];
  const tx = {
    drawing: { update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(rad, data); }) },
    task: {
      findMany: vi.fn(async () => markorer.map((m, i) => ({ id: `t${i}`, positionX: m.x, positionY: m.y }))),
      update: vi.fn(async ({ data }: { data: { positionX: number; positionY: number } }) => { oppgaveUpdates.push({ x: data.positionX, y: data.positionY }); }),
    },
    checklist: { findMany: vi.fn(async () => []), update: vi.fn() },
    kontrollplanPunkt: { findMany: vi.fn(async () => []), update: vi.fn() },
    omrade: { findMany: vi.fn(async () => []), update: vi.fn() },
  };
  const prisma = {
    drawing: {
      findUnique: vi.fn(async () => ({ autoRotasjon: rad.autoRotasjon })),
      findMany: vi.fn(async () => []), // ingen layout-barn
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { prisma, rad, tx, oppgaveUpdates };
}

describe("DWG-revisjon: rotasjonOverstyrt følger med (test c)", () => {
  it("rotasjonOverstyrt = 90 forblir 90 etter ny revisjon (feiler om den nullstilles)", async () => {
    const { prisma, rad } = lagPrisma({ autoRotasjon: 40, rotasjonOverstyrt: 90 });
    await anvendDwgResultat(prisma, TEGNING, lagResultat(130), "/uploads/orig.dwg");
    expect(rad.rotasjonOverstyrt).toBe(90);
  });

  it("revisjon UTEN overstyring (null) forblir null — følger ny auto", async () => {
    const { prisma, rad } = lagPrisma({ autoRotasjon: 40, rotasjonOverstyrt: null });
    await anvendDwgResultat(prisma, TEGNING, lagResultat(130), "/uploads/orig.dwg");
    expect(rad.rotasjonOverstyrt).toBeNull();
    // auto-rotasjonen OPPDATERES (den er filresultatet), overstyringen ikke.
    expect(rad.autoRotasjon).toBe(130);
  });

  it("update-payloaden setter IKKE rotasjonOverstyrt (orthogonalt felt)", async () => {
    const { prisma, tx } = lagPrisma({ autoRotasjon: 40, rotasjonOverstyrt: 90 });
    await anvendDwgResultat(prisma, TEGNING, lagResultat(130), "/uploads/orig.dwg");
    const data = tx.drawing.update.mock.calls[0]![0].data as Record<string, unknown>;
    expect("rotasjonOverstyrt" in data).toBe(false);
    expect(data.autoRotasjon).toBe(130);
  });

  it("markør flyttes med rotDelta (= ny − gammel auto) selv når overstyringen beholdes", async () => {
    // Markør i et hjørne; auto 40 → 130 gir rotDelta 90°.
    const hjorne = { x: 10, y: 20 };
    const { prisma, rad, oppgaveUpdates } = lagPrisma({ autoRotasjon: 40, rotasjonOverstyrt: 90 }, [hjorne]);
    await anvendDwgResultat(prisma, TEGNING, lagResultat(130), "/uploads/orig.dwg");
    expect(rad.rotasjonOverstyrt).toBe(90); // beholdt
    const forventet = roterProsentMarkor(hjorne, 90); // samme transform koden bruker
    expect(oppgaveUpdates).toHaveLength(1);
    const flyttet = oppgaveUpdates[0]!;
    expect(flyttet.x).toBeCloseTo(forventet.x, 6);
    expect(flyttet.y).toBeCloseTo(forventet.y, 6);
  });

  it("uendret auto (ingen revisjonsrotasjon) → ingen markørflytting, overstyring beholdt", async () => {
    const { prisma, rad, oppgaveUpdates } = lagPrisma({ autoRotasjon: 40, rotasjonOverstyrt: 90 }, [{ x: 10, y: 20 }]);
    await anvendDwgResultat(prisma, TEGNING, lagResultat(40), "/uploads/orig.dwg");
    expect(rad.rotasjonOverstyrt).toBe(90);
    expect(oppgaveUpdates).toHaveLength(0); // rotDelta = 0 → no-op
  });
});
