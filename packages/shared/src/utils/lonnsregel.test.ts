import { describe, it, expect } from "vitest";
import { bruktAvNorm, klassifiserArbeidstid } from "./lonnsregel";

// ORDRE (29) a2, spec `prosjektkort-kortid-spec.md` § 6 L1–L3 + T1 (§ 9):
// normregelen bor i `klassifiserArbeidstid` (`bruktAvNorm`), én kilde for
// GPS-dagen og manuelt kort. Flyttet hit fra mobilens `overtidMotDognet`.

const seg = (normal: number, ot: number) => [
  ...(normal > 0 ? [{ overtidsnivaa: null, timer: normal }] : []),
  ...(ot > 0 ? [{ overtidsnivaa: 50, timer: ot }] : []),
];

describe("a2 L1 — bruktAvNorm: døgnets registrerte arbeid", () => {
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

  it("🔴 fravær teller ikke (B8)", () => {
    expect(
      bruktAvNorm([
        { timer: 3, erReise: false },
        { timer: 4.5, erReise: false, erFravaer: true },
      ]),
    ).toBe(3);
  });

  it("ingen rader → 0", () => {
    expect(bruktAvNorm([])).toBe(0);
  });
});

describe("a2 T1 — klassifiserArbeidstid med bruktAvNorm (L2/L3)", () => {
  it("🔴 brukt 9,5 / norm 7,5 / arbeid 1 → 1 t overtid", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 1, dagsnorm: 7.5, bruktAvNorm: 9.5 })).toEqual(seg(0, 1));
  });

  it("🔴 brukt 6 / arbeid 2,5 → 1,5 normal + 1 overtid", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 2.5, dagsnorm: 7.5, bruktAvNorm: 6 })).toEqual(seg(1.5, 1));
  });

  it("🔴 rest nøyaktig 0 → alt overtid (aldri «0 = ingen norm»)", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 2, dagsnorm: 7.5, bruktAvNorm: 7.5 })).toEqual(seg(0, 2));
  });

  it("norm 0 (ukjent) → alt normaltid uansett brukt", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 9.5 })).toEqual(seg(2, 0));
    expect(klassifiserArbeidstid({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 0 })).toEqual(seg(2, 0));
  });

  it("rest 0 og ukjent norm er ulike grener — samme arbeid, motsatt svar", () => {
    expect(klassifiserArbeidstid({ arbeidstimer: 2, dagsnorm: 7.5, bruktAvNorm: 7.5 })).not.toEqual(
      klassifiserArbeidstid({ arbeidstimer: 2, dagsnorm: 0, bruktAvNorm: 7.5 }),
    );
  });

  it("brukt 0 eller utelatt → som i dag (alle eksisterende kallere)", () => {
    for (const arbeidstimer of [0, 1, 7.5, 9.5]) {
      for (const dagsnorm of [0, 7.5, 8]) {
        const iDag = klassifiserArbeidstid({ arbeidstimer, dagsnorm });
        expect(klassifiserArbeidstid({ arbeidstimer, dagsnorm, bruktAvNorm: 0 })).toEqual(iDag);
        expect(iDag).toEqual(
          dagsnorm > 0
            ? seg(Math.min(arbeidstimer, dagsnorm), Math.max(0, arbeidstimer - dagsnorm))
            : seg(arbeidstimer, 0),
        );
      }
    }
  });
});
