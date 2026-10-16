import { describe, it, expect, vi } from "vitest";
import {
  erKonverteringStrandet,
  erKonverteringPågår,
  erRekonverterbarOriginal,
  lagTegningLivstegn,
  KONVERTERING_STRANDET_MS,
  TEGNING_LIVSTEGN_THROTTLE_MS,
} from "./tegningRekonvertering";

/**
 * RETUR 6 rekonverter (orkestrator 2026-10-16, DB-som-kø + én arbeider i api):
 * `pending` er IKKE lenger en kortvarig mellomtilstand — en alltid-kjørende
 * arbeider (poll hvert 3 s) garanterer at den blir plukket opp uansett alder, så
 * den er ALDRI strandet. Kun `converting` (en rad arbeideren faktisk har tatt)
 * kan være strandet, og kun uten livstegn — speiler reprosessering.ts sitt
 * erStrandet/STRANDET_MS-mønster, men presist på hvilken status som teller.
 */

const NAA = 1_000_000_000_000;

describe("erKonverteringStrandet", () => {
  it("ferskt converting → ikke strandet", () => {
    expect(erKonverteringStrandet("converting", new Date(NAA - 1000), NAA)).toBe(false);
  });

  it("gammelt converting (> grensen) → strandet", () => {
    expect(
      erKonverteringStrandet("converting", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(true);
  });

  it("gammel pending → ALDRI strandet (arbeideren drenerer den uansett alder)", () => {
    expect(
      erKonverteringStrandet("pending", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(false);
  });

  it("nøyaktig på grensen (converting) → strandet (>=)", () => {
    expect(
      erKonverteringStrandet("converting", new Date(NAA - KONVERTERING_STRANDET_MS), NAA),
    ).toBe(true);
  });

  it("done er aldri strandet, uansett alder", () => {
    expect(
      erKonverteringStrandet("done", new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA),
    ).toBe(false);
  });

  it("failed er aldri strandet", () => {
    expect(
      erKonverteringStrandet("failed", new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA),
    ).toBe(false);
  });

  it("null (ikke-DWG/DXF, aldri konvertert) er aldri strandet", () => {
    expect(erKonverteringStrandet(null, new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA)).toBe(
      false,
    );
  });
});

describe("erKonverteringPågår", () => {
  it("fersk pending/converting → pågår", () => {
    expect(erKonverteringPågår("pending", new Date(NAA - 1000), NAA)).toBe(true);
    expect(erKonverteringPågår("converting", new Date(NAA - 1000), NAA)).toBe(true);
  });

  it("gammel pending → FORTSATT pågår (aldri strandet)", () => {
    expect(
      erKonverteringPågår("pending", new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA),
    ).toBe(true);
  });

  it("strandet converting → IKKE pågår (teller som feilet, ikke evig pågår)", () => {
    expect(
      erKonverteringPågår("converting", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(false);
  });

  it("done/failed → ikke pågår", () => {
    expect(erKonverteringPågår("done", new Date(NAA - 1000), NAA)).toBe(false);
    expect(erKonverteringPågår("failed", new Date(NAA - 1000), NAA)).toBe(false);
  });
});

describe("lagTegningLivstegn", () => {
  function fakePrisma() {
    return { $executeRaw: vi.fn().mockResolvedValue(1) };
  }

  it("skriver livstegn ved første kall", async () => {
    const prisma = fakePrisma();
    const livstegn = lagTegningLivstegn(prisma, "t1", () => NAA);
    await livstegn();
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it("throttler — ingen nytt skriv før TEGNING_LIVSTEGN_THROTTLE_MS har gått", async () => {
    const prisma = fakePrisma();
    let t = NAA;
    const livstegn = lagTegningLivstegn(prisma, "t1", () => t);
    await livstegn();
    t += TEGNING_LIVSTEGN_THROTTLE_MS - 1;
    await livstegn();
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it("skriver igjen etter at throttle-vinduet har gått", async () => {
    const prisma = fakePrisma();
    let t = NAA;
    const livstegn = lagTegningLivstegn(prisma, "t1", () => t);
    await livstegn();
    t += TEGNING_LIVSTEGN_THROTTLE_MS;
    await livstegn();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("feil i $executeRaw svelges, ikke kastes", async () => {
    const prisma = { $executeRaw: vi.fn().mockRejectedValue(new Error("db nede")) };
    const livstegn = lagTegningLivstegn(prisma, "t1", () => NAA);
    await expect(livstegn()).resolves.toBeUndefined();
  });
});

describe("erRekonverterbarOriginal", () => {
  it("originalFileUrl som ender på .dwg → rekonverterbar", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.dwg")).toBe(true);
  });

  it("originalFileUrl som ender på .DXF (store bokstaver) → rekonverterbar", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.DXF")).toBe(true);
  });

  it("originalFileUrl som ender på .pdf → IKKE rekonverterbar (annen vei: rekonverterPdf)", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.pdf")).toBe(false);
  });

  it("null (mangler originalfil) → IKKE rekonverterbar", () => {
    expect(erRekonverterbarOriginal(null)).toBe(false);
  });
});
