import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * KARAKTERISERING av `hentEffektivArbeidstid` slik den er FØR L1-B (B6 v3).
 *
 * Orkestrators ufravikelige vilkår (TILLEGG 1/3): serverens nåværende
 * sesong-utledning pinnes grønn FØR normKilde kobles inn, og skal gi SAMME svar
 * etterpå. Testene dekker sommer, vinter, overgang etter periode, delvis
 * overstyring, firma uten kalenderrader og firma uten OrganizationSetting.
 *
 * Prisma mockes; vi styrer `organizationSetting.findUnique` og
 * `arbeidstidsKalender.findFirst` (kalt to ganger: `sommertid_start`, så
 * `sommertid_slutt`). Mocken grener på `where.type`.
 */

const findUnique = vi.fn();
const findFirst = vi.fn();

vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: {
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
    arbeidstidsKalender: {
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
  },
}));

import { hentEffektivArbeidstid } from "./arbeidstid";

const ORG = "11111111-1111-1111-1111-111111111111";
// Fixture-firma fra spec § 3 B6: vinter 07:00–15:00/30 (7,5 t),
// sommer 07:00–15:30/30 (8 t).
const VINTER_SETTING = {
  standardStartTid: "07:00",
  standardSluttTid: "15:00",
  standardPauseMin: 30,
};
const SOMMER_RAD = {
  standardStartTid: "07:00",
  standardSluttTid: "15:30",
  pauseMin: 30,
};

/** Sett opp findFirst til å gi `start`/`slutt` basert på where.type. */
function sommertid(
  start: Record<string, unknown> | null,
  slutt: Record<string, unknown> | null,
) {
  findFirst.mockImplementation(
    (args: { where: { type: string } }) =>
      Promise.resolve(args.where.type === "sommertid_start" ? start : slutt),
  );
}

beforeEach(() => {
  findUnique.mockReset();
  findFirst.mockReset();
});

describe("hentEffektivArbeidstid — karakterisering (før B6 v3)", () => {
  it("vinter: ingen aktiv sommertid → firma-default, 7,5 t", async () => {
    findUnique.mockResolvedValue(VINTER_SETTING);
    sommertid(null, null);
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-01-15T12:00:00Z"));
    expect(r).toEqual({
      startTid: "07:00",
      sluttTid: "15:00",
      pauseMin: 30,
      dagsnorm: 7.5,
    });
  });

  it("sommer: aktiv start ≤ dato OG aktiv slutt ≥ dato → sommertids-tider, 8 t", async () => {
    findUnique.mockResolvedValue(VINTER_SETTING);
    sommertid(SOMMER_RAD, { id: "slutt-1" });
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-07-15T12:00:00Z"));
    expect(r).toEqual({
      startTid: "07:00",
      sluttTid: "15:30",
      pauseMin: 30,
      dagsnorm: 8,
    });
  });

  it("etter sommerperioden: start finnes (≤ dato) men ingen slutt ≥ dato → tilbake til vinter", async () => {
    findUnique.mockResolvedValue(VINTER_SETTING);
    sommertid(SOMMER_RAD, null); // start funnet, slutt null
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-10-15T12:00:00Z"));
    expect(r.dagsnorm).toBe(7.5);
    expect(r.sluttTid).toBe("15:00");
  });

  it("delvis overstyring: kun sluttTid satt i sommertid-raden → resten fra default", async () => {
    findUnique.mockResolvedValue(VINTER_SETTING);
    sommertid(
      { standardStartTid: null, standardSluttTid: "16:00", pauseMin: null },
      { id: "slutt-1" },
    );
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-07-15T12:00:00Z"));
    expect(r).toEqual({
      startTid: "07:00", // fra default (null i raden)
      sluttTid: "16:00", // overstyrt
      pauseMin: 30, // fra default (null i raden)
      dagsnorm: 8.5, // 16:00 − 07:00 − 30 min
    });
  });

  it("firma uten kalenderrader: start-oppslaget gir null → firma-default", async () => {
    findUnique.mockResolvedValue(VINTER_SETTING);
    sommertid(null, null);
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-07-15T12:00:00Z"));
    expect(r.dagsnorm).toBe(7.5);
  });

  it("ingen OrganizationSetting: fallback 07:00–15:00/30, 7,5 t", async () => {
    findUnique.mockResolvedValue(null);
    sommertid(null, null);
    const r = await hentEffektivArbeidstid(ORG, new Date("2026-01-15T12:00:00Z"));
    expect(r).toEqual({
      startTid: "07:00",
      sluttTid: "15:00",
      pauseMin: 30,
      dagsnorm: 7.5,
    });
  });
});
