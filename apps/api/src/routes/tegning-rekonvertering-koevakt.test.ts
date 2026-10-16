import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * RETUR 2 rekonverter (Kontrollør/Kenneth 2026-10-16, test på `7125c773`): «Oppdater alle
 * tegninger» hang på tegning 2 av 9 i 20+ min med TOM logg og ingen kjørende prosess.
 *
 * Feil 1 (denne fila, start-logg): `kjorRekonvertering` logget «ferdig»/«feil», men ALDRI
 * «start» — en jobb som henger FØR sitt eget første [DWG]-loggpunkt (f.eks. fast i en
 * libredwg/ezdxf-child-prosess) var usynlig. Nå logges start uansett utfall.
 *
 * Feil 3 (denne fila, køvakt): `Semafor` (maks 2 samtidig) har INGEN tidsgrense — en jobb
 * som henger uansett årsak holder sin plass FOR ALLTID, og kø 3–9 ville stått bak den til
 * evig tid (DB-sidens `KONVERTERING_STRANDET_MS` gjelder kun status-TOLKNING, ikke selve
 * semafor-plassen). `kjorRekonverteringMedKøvakt` gir opp å VENTE ved samme grense og
 * frigjør plassen — jobben avbrytes ikke, men blokkerer ikke resten av batchen lenger.
 */

const h = vi.hoisted(() => ({ konverterDwg: vi.fn() }));

vi.mock("../services/dwgKonvertering", () => ({
  konverterDwg: (...a: unknown[]) => h.konverterDwg(...a),
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { kjorRekonverteringMedKøvakt } from "./tegning";
import type { DwgKonverteringsResultat } from "../services/dwgKonvertering";

const TEGNING = {
  id: "d1",
  name: "Plan 06 MR fallplan alt 01",
  projectId: "p1",
  byggeplassId: null,
  originalFileUrl: "/uploads/original.dwg",
};

function lagResultat(overstyr: Partial<DwgKonverteringsResultat> = {}): DwgKonverteringsResultat {
  return {
    mmPrPiksel: 10, scale: "1:100", scaleKilde: "dwg", imageWidth: 2000, imageHeight: 1500,
    visningUrl: "/uploads/hoved.svg", mobilVisningUrl: null, visningFilType: "svg",
    koordinatSystem: null, geoReferanse: null, feil: null,
    autoRotasjon: null, startutsnitt: null, rapport: null,
    motor: "egen", fallbackFra: null, fallbackAarsak: null,
    dxfViewerFileUrl: null, registerWorldUrl: null,
    layouts: [],
    ...overstyr,
  };
}

/** Samme minimale transaksjons-shape `anvendDwgResultat` krever (se tegning-rotasjon-folger-revisjon.test.ts). */
function fakePrisma() {
  const tx = {
    drawing: { update: vi.fn().mockResolvedValue({}) },
    task: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    checklist: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    kontrollplanPunkt: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    omrade: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  };
  return {
    drawing: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ autoRotasjon: null }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("kjorRekonverteringMedKøvakt", () => {
  let logg: ReturnType<typeof vi.spyOn>;
  let advarsel: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    h.konverterDwg.mockReset();
    logg = vi.spyOn(console, "log").mockImplementation(() => {});
    advarsel = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    logg.mockRestore();
    advarsel.mockRestore();
  });

  it("logger start uansett, og venter normalt (ingen advarsel) når jobben er ferdig før køgrensen", async () => {
    h.konverterDwg.mockResolvedValue(lagResultat());

    await kjorRekonverteringMedKøvakt(fakePrisma(), TEGNING, 200);

    expect(logg).toHaveBeenCalledWith(expect.stringContaining(`[DWG] start rekonvertering ${TEGNING.id}`));
    expect(advarsel).not.toHaveBeenCalled();
  });

  it("gir opp ved køgrensen og logger advarsel når jobben henger (frigjør semaforplass)", async () => {
    h.konverterDwg.mockReturnValue(new Promise(() => { /* henger for alltid, som root cause-scenarioet */ }));

    await kjorRekonverteringMedKøvakt(fakePrisma(), TEGNING, 20);

    expect(logg).toHaveBeenCalledWith(expect.stringContaining(`[DWG] start rekonvertering ${TEGNING.id}`));
    expect(advarsel).toHaveBeenCalledWith(expect.stringContaining("henger forbi køgrensen"));
  });

  it("løper IKKE videre jobben etter køgrensen — den avbrytes ikke, bare å vente på den stopper", async () => {
    let avsluttet = false;
    h.konverterDwg.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => { avsluttet = true; resolve(lagResultat()); }, 60)),
    );

    await kjorRekonverteringMedKøvakt(fakePrisma(), TEGNING, 10);
    expect(avsluttet).toBe(false); // køvakta ga opp etter 10ms, lenge før jobben (60ms) faktisk er ferdig

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(avsluttet).toBe(true); // men jobben fortsatte i bakgrunnen og fullførte selv
  });
});
