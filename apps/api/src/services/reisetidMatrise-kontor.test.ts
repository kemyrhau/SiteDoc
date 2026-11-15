import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-15 (13) L2 / (12) TILLEGG: kontor ↔ kontor-avstand for
 * overføringen. Kjører UTEN DB. Låser:
 *   - én rad pr. par i fast rekkefølge (fra < til), cellen [fra → til].
 *   - manuelt par overskrives aldri; flyttet punkt → "manuell_endret".
 *   - kontor-trigger (oppmotestedId) berører kun par med det kontoret.
 *   - OSRM-feil → ingen skriving.
 */

const oppmotestedFindMany = vi.fn();
const avstandFindMany = vi.fn();
const avstandUpsert = vi.fn();
const avstandUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    oppmotested: { findMany: (...a: unknown[]) => oppmotestedFindMany(...a) },
    oppmotestedAvstand: {
      findMany: (...a: unknown[]) => avstandFindMany(...a),
      upsert: (...a: unknown[]) => avstandUpsert(...a),
      updateMany: (...a: unknown[]) => avstandUpdateMany(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const hentKjoretidMatrise = vi.fn();
vi.mock("./rute-service", () => ({
  UOPPNAAELIG: -1,
  hentKjoretidMatrise: (...a: unknown[]) => hentKjoretidMatrise(...a),
}));

import {
  KONTOR_FYLL_PAUSE_MS,
  fyllManglendeKontorAvstander,
  kontorPar,
  recomputeKontorAvstand,
} from "./reisetidMatrise";

const ORG = "org-1";
const KA = { id: "a", lat: 68.4, lng: 17.4 }; // Narvik
const KB = { id: "b", lat: 69.6, lng: 18.9 }; // Tromsø
const KC = { id: "c", lat: 67.3, lng: 14.4 }; // Bodø

type UpsertArg = {
  where: { fraOppmotestedId_tilOppmotestedId: { fraOppmotestedId: string; tilOppmotestedId: string } };
  create: { kjoretidMin: number; avstandM: number | null; kilde: string };
};
const upserts = () => avstandUpsert.mock.calls.map((c) => c[0] as UpsertArg);
const par = () =>
  upserts().map((u) => {
    const w = u.where.fraOppmotestedId_tilOppmotestedId;
    return `${w.fraOppmotestedId}|${w.tilOppmotestedId}`;
  });

beforeEach(() => {
  oppmotestedFindMany.mockReset();
  avstandFindMany.mockReset().mockResolvedValue([]);
  avstandUpsert.mockReset().mockReturnValue(Promise.resolve({}));
  avstandUpdateMany.mockReset().mockResolvedValue({ count: 0 });
  transaction.mockReset().mockResolvedValue([]);
  hentKjoretidMatrise.mockReset();
});

describe("kontorPar", () => {
  it("gir alltid fra < til", () => {
    expect(kontorPar("b", "a")).toEqual({ fra: "a", til: "b" });
    expect(kontorPar("a", "b")).toEqual({ fra: "a", til: "b" });
  });
});

describe("recomputeKontorAvstand", () => {
  it("én rad pr. par (fra < til) med OSRM-cellen", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB, KC]);
    hentKjoretidMatrise.mockResolvedValue({
      durations: [[0, 180, 200], [180, 0, 330], [200, 330, 0]],
      distances: [[0, 250000, 290000], [250000, 0, 540000], [290000, 540000, 0]],
    });
    const res = await recomputeKontorAvstand({ organizationId: ORG });
    expect(par()).toEqual(["a|b", "a|c", "b|c"]);
    expect(upserts()[0]!.create).toMatchObject({ kjoretidMin: 180, avstandM: 250000, kilde: "osrm" });
    expect(res.rader).toBe(3);
  });

  it("manuelt par overskrives ALDRI", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB]);
    avstandFindMany.mockResolvedValue([{ fraOppmotestedId: "a", tilOppmotestedId: "b" }]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[0, 180], [180, 0]], distances: [[0, 1], [1, 0]] });
    await recomputeKontorAvstand({ organizationId: ORG });
    expect(par()).toEqual([]);
    expect(avstandFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG, kilde: { startsWith: "manuell" } }),
      }),
    );
  });

  it("flyttet punkt → manuelle par merkes manuell_endret", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB]);
    avstandFindMany.mockResolvedValue([{ fraOppmotestedId: "a", tilOppmotestedId: "b" }]);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[0, 180], [180, 0]], distances: [[0, 1], [1, 0]] });
    await recomputeKontorAvstand({ organizationId: ORG, oppmotestedId: "a", plasseringEndret: true });
    expect(avstandUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { kilde: "manuell_endret" } }),
    );
  });

  it("kontor-trigger berører kun par med det kontoret", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB, KC]);
    hentKjoretidMatrise.mockResolvedValue({
      durations: [[0, 1, 2], [1, 0, 3], [2, 3, 0]],
      distances: [[0, 1, 2], [1, 0, 3], [2, 3, 0]],
    });
    await recomputeKontorAvstand({ organizationId: ORG, oppmotestedId: "c" });
    expect(par()).toEqual(["a|c", "b|c"]);
  });

  it("OSRM-feil eller færre enn to kontorer → ingen skriving", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB]);
    hentKjoretidMatrise.mockResolvedValue(null);
    expect((await recomputeKontorAvstand({ organizationId: ORG })).rader).toBe(0);
    oppmotestedFindMany.mockResolvedValue([KA]);
    expect((await recomputeKontorAvstand({ organizationId: ORG })).rader).toBe(0);
    expect(avstandUpsert).not.toHaveBeenCalled();
  });
});

describe("fyllManglendeKontorAvstander — (16) punkt 4", () => {
  const MATRISE3 = {
    durations: [[0, 180, 200], [180, 0, 330], [200, 330, 0]],
    distances: [[0, 250000, 290000], [250000, 0, 540000], [290000, 540000, 0]],
  };

  it("manglende par beregnes; eksisterende (manuell) rad står urørt", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB, KC]);
    // a|b finnes (manuell), a|c og b|c mangler.
    avstandFindMany.mockResolvedValue([{ fraOppmotestedId: "a", tilOppmotestedId: "b" }]);
    hentKjoretidMatrise.mockResolvedValue(MATRISE3);
    const res = await fyllManglendeKontorAvstander("org-fyll-1");
    expect(par()).toEqual(["a|c", "b|c"]);
    expect(res.rader).toBe(2);
    // Hele firmaets rader (alle kilder) teller som «finnes».
    expect(avstandFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-fyll-1" } }),
    );
    expect(avstandUpdateMany).not.toHaveBeenCalled();
  });

  it("ingen par mangler → OSRM kalles ikke, ingen skriving", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB]);
    avstandFindMany.mockResolvedValue([{ fraOppmotestedId: "a", tilOppmotestedId: "b" }]);
    expect((await fyllManglendeKontorAvstander("org-fyll-2")).rader).toBe(0);
    expect(hentKjoretidMatrise).not.toHaveBeenCalled();
    expect(avstandUpsert).not.toHaveBeenCalled();
  });

  it("OSRM-feil → ingen skriving, og nytt forsøk først etter pausen", async () => {
    oppmotestedFindMany.mockResolvedValue([KA, KB]);
    hentKjoretidMatrise.mockResolvedValue(null);
    const t0 = 1_000_000;
    expect((await fyllManglendeKontorAvstander("org-fyll-3", t0)).rader).toBe(0);
    expect(avstandUpsert).not.toHaveBeenCalled();
    expect(hentKjoretidMatrise).toHaveBeenCalledTimes(1);
    await fyllManglendeKontorAvstander("org-fyll-3", t0 + KONTOR_FYLL_PAUSE_MS - 1);
    expect(hentKjoretidMatrise).toHaveBeenCalledTimes(1);
    hentKjoretidMatrise.mockResolvedValue({ durations: [[0, 180], [180, 0]], distances: [[0, 1], [1, 0]] });
    expect((await fyllManglendeKontorAvstander("org-fyll-3", t0 + KONTOR_FYLL_PAUSE_MS)).rader).toBe(1);
  });

  it("DB-feil kastes ikke videre — lesingen skal alltid svare", async () => {
    oppmotestedFindMany.mockRejectedValue(new Error("db nede"));
    const feil = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fyllManglendeKontorAvstander("org-fyll-4")).resolves.toEqual({ rader: 0 });
    feil.mockRestore();
  });

  it("vakt: begge lesestiene fyller før lesing", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const kilde = readFileSync(
      fileURLToPath(new URL("../routes/oppmotested.ts", import.meta.url)),
      "utf8",
    );
    expect(kilde).toContain("await fyllManglendeKontorAvstander(orgId);");
    expect(kilde).toContain("await fyllManglendeKontorAvstander(input.organizationId);");
  });
});
