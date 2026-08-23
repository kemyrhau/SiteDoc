import { describe, it, expect } from "vitest";
import {
  sedelKreverVurdering,
  sedelHarNormAvvik,
  sedelHarMaskinOver,
  type VurderingsSedel,
} from "./sedel-vurdering";

// Pinner B ∪ C (Kenneth-vedtak 2026-08-23): standard-ekspander i firma-attestering.
// B = ført ≠ dagsnorm · C = tilleggskrav ∨ mertid ∨ maskin-over. IKKE overtidsgrunnlag.avvik.

function sedel(o: Partial<VurderingsSedel> = {}): VurderingsSedel {
  return {
    tilleggHarKrav: false,
    dagsnorm: 8,
    totaltimer: 8,
    pauseMin: 30,
    maskiner: [],
    ...o,
  };
}

describe("sedelKreverVurdering (B ∪ C)", () => {
  it("normal sedel (ført = norm, ingen tillegg/maskin) → false", () => {
    expect(sedelKreverVurdering(sedel())).toBe(false);
  });

  it("B: ført > dagsnorm (9,00t mot 8) → true", () => {
    expect(sedelKreverVurdering(sedel({ totaltimer: 9 }))).toBe(true);
  });

  it("B: ført < dagsnorm (7,50t mot 8) → true", () => {
    expect(sedelKreverVurdering(sedel({ totaltimer: 7.5 }))).toBe(true);
  });

  it("dagsnorm = 0 (ukonfigurert) → ingen norm-avvik (unngår false positive)", () => {
    expect(sedelHarNormAvvik(sedel({ dagsnorm: 0, totaltimer: 9 }))).toBe(false);
    expect(sedelKreverVurdering(sedel({ dagsnorm: 0, totaltimer: 9 }))).toBe(false);
  });

  it("C: tilleggskrav → true selv når ført = norm", () => {
    expect(sedelKreverVurdering(sedel({ tilleggHarKrav: true }))).toBe(true);
  });

  it("C: maskin-over (sum maskin > arbeid + pausebuffer) → true", () => {
    // 8t arbeid + 0,5t pausebuffer = 8,5t tak; 10t maskin bryter.
    const s = sedel({ maskiner: [{ timer: 10 }] });
    expect(sedelHarMaskinOver(s)).toBe(true);
    expect(sedelKreverVurdering(s)).toBe(true);
  });

  it("maskin innenfor buffer → ikke maskin-over", () => {
    expect(sedelHarMaskinOver(sedel({ maskiner: [{ timer: 8.4 }] }))).toBe(false);
  });

  it("string-timer på maskinrad tolkes (tilTall)", () => {
    expect(sedelHarMaskinOver(sedel({ maskiner: [{ timer: "10" }] }))).toBe(true);
  });
});
