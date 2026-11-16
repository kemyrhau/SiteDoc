import { describe, it, expect } from "vitest";
import { klassifiserArbeidstid } from "@sitedoc/shared";
import { bruktAvNorm, klassifiserMotDognet } from "./overtidMotDognet";

// ORDRE 2026-11-16 (27b), spec prosjektkort-kortid-spec.md § 6 L1–L3 (T1 i
// ren form — a2 flytter regelen inn i `klassifiserArbeidstid`).

const seg = (normal: number, ot: number) => [
  ...(normal > 0 ? [{ overtidsnivaa: null, timer: normal }] : []),
  ...(ot > 0 ? [{ overtidsnivaa: 50, timer: ot }] : []),
];

describe("(27b) L1 — bruktAvNorm: døgnets registrerte arbeid", () => {
  it("🔴 alle arbeidsrader teller, også overtid; reise og erstattet teller ikke", () => {
    expect(
      bruktAvNorm([
        { timer: 7.5, erReise: false }, // 07–15 Timelønn
        { timer: 2, erReise: false }, // 15–17 Overtid 50 %
        { timer: 1, erReise: true }, // reise
        { timer: 3, erReise: false, attestertStatus: "erstattet" },
      ]),
    ).toBe(9.5);
  });

  it("ingen rader → 0", () => {
    expect(bruktAvNorm([])).toBe(0);
  });
});

describe("(27b) L2/L3 — klassifiserMotDognet", () => {
  it("🔴 Kenneths dag: brukt 9,5 / norm 7,5 / arbeid 1 → 1 t overtid", () => {
    expect(klassifiserMotDognet({ arbeidstimer: 1, dagsnorm: 7.5, bruktAvNorm: 9.5 })).toEqual(seg(0, 1));
  });

  it("🔴 delvis brukt norm: brukt 6 / arbeid 2,5 → 1,5 normal + 1 overtid", () => {
    expect(klassifiserMotDognet({ arbeidstimer: 2.5, dagsnorm: 7.5, bruktAvNorm: 6 })).toEqual(seg(1.5, 1));
  });

  it("🔴 rest nøyaktig 0 → alt overtid (aldri «0 = ingen norm»)", () => {
    expect(klassifiserMotDognet({ arbeidstimer: 2, dagsnorm: 7.5, bruktAvNorm: 7.5 })).toEqual(seg(0, 2));
  });

  it("🔴 ukjent norm (0) → ingen splitt, alt normaltid, uansett brukt", () => {
    expect(klassifiserMotDognet({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 9.5 })).toEqual(seg(2, 0));
    expect(klassifiserMotDognet({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 0 })).toEqual(seg(2, 0));
  });

  it("rest 0 og ukjent norm er ulike grener — samme arbeid, motsatt svar", () => {
    const rest0 = klassifiserMotDognet({ arbeidstimer: 2, dagsnorm: 7.5, bruktAvNorm: 7.5 });
    const ukjent = klassifiserMotDognet({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 7.5 });
    expect(rest0).not.toEqual(ukjent);
  });

  it("brukt 0 → nøyaktig dagens svar (klassifiserArbeidstid)", () => {
    for (const arbeidstimer of [0, 1, 7.5, 9.5]) {
      for (const dagsnorm of [0, 7.5, 8]) {
        expect(klassifiserMotDognet({ arbeidstimer, dagsnorm, bruktAvNorm: 0 })).toEqual(
          klassifiserArbeidstid({ arbeidstimer, dagsnorm }),
        );
      }
    }
  });

  it("negativkontroll: dagens regel (uten brukt) gir Timelønn for Kenneths 17–18", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 1, dagsnorm: 7.5 })).toEqual(seg(1, 0));
  });
});
