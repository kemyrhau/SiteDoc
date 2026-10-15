import { describe, it, expect } from "vitest";
import {
  skjermTilVerden,
  verdenTilSkjerm,
  type DxfKameraParametre,
} from "./kamera-projeksjon";

// Kamera som i DxfViewerTegning.tsx etter FitView: symmetrisk boks, senter i
// verdenskoordinater (1000, 2000), canvas 800×600 (CSS-px).
const BASIS: DxfKameraParametre = {
  left: -400,
  right: 400,
  top: 300,
  bottom: -300,
  zoom: 1,
  senterX: 1000,
  senterY: 2000,
  rotasjonGrader: 0,
  canvasBredde: 800,
  canvasHoyde: 600,
};

describe("verdenTilSkjerm / skjermTilVerden — uten rotasjon", () => {
  it("kamerasenteret projiseres til canvasets midtpunkt", () => {
    const skjerm = verdenTilSkjerm({ verdenX: 1000, verdenY: 2000 }, BASIS);
    expect(skjerm.skjermX).toBeCloseTo(400, 9);
    expect(skjerm.skjermY).toBeCloseTo(300, 9);
  });

  it("verdens-Y OPP svarer til skjerm-Y OPP (mindre skjermY)", () => {
    const over = verdenTilSkjerm({ verdenX: 1000, verdenY: 2100 }, BASIS);
    const under = verdenTilSkjerm({ verdenX: 1000, verdenY: 1900 }, BASIS);
    expect(over.skjermY).toBeLessThan(300);
    expect(under.skjermY).toBeGreaterThan(300);
  });

  it("venstre kant av kamerarammen (left=−400) er skjermX=0", () => {
    const skjerm = verdenTilSkjerm({ verdenX: 1000 - 400, verdenY: 2000 }, BASIS);
    expect(skjerm.skjermX).toBeCloseTo(0, 9);
  });

  it("zoom skalerer synlig område: dobbel zoom halverer skjermforflytning for samme verdensavstand", () => {
    const punkt = { verdenX: 1100, verdenY: 2000 };
    const s1 = verdenTilSkjerm(punkt, BASIS);
    const s2 = verdenTilSkjerm(punkt, { ...BASIS, zoom: 2 });
    const dx1 = s1.skjermX - 400;
    const dx2 = s2.skjermX - 400;
    expect(dx2).toBeCloseTo(dx1 * 2, 9);
  });

  it("rundtur skjerm→verden→skjerm er identisk (flyttallstoleranse)", () => {
    const start: { skjermX: number; skjermY: number } = { skjermX: 123.4, skjermY: 567.8 };
    const verden = skjermTilVerden(start, BASIS);
    const tilbake = verdenTilSkjerm(verden, BASIS);
    expect(tilbake.skjermX).toBeCloseTo(start.skjermX, 9);
    expect(tilbake.skjermY).toBeCloseTo(start.skjermY, 9);
  });

  it("rundtur verden→skjerm→verden er identisk", () => {
    const start = { verdenX: 942.3, verdenY: 2088.1 };
    const skjerm = verdenTilSkjerm(start, BASIS);
    const tilbake = skjermTilVerden(skjerm, BASIS);
    expect(tilbake.verdenX).toBeCloseTo(start.verdenX, 9);
    expect(tilbake.verdenY).toBeCloseTo(start.verdenY, 9);
  });
});

describe("verdenTilSkjerm / skjermTilVerden — med rotasjonGrader (VEDTAK B, visningsrotasjon)", () => {
  // Utledning (se filheader): med `camera.up.set(sinθ, cosθ, 0)` og three.js sin
  // `lookAt`, blir kamera-lokal X-akse (cosθ,−sinθ) og Y-akse (sinθ,cosθ) i
  // verdensrom. Ved θ=90° peker kamerarommets lokale X-akse mot verdens −Y (sør),
  // og Y-aksen (skjerm-"opp") mot verdens +X (øst). Et punkt rett NORD for
  // senteret (Δy>0, Δx=0) skal derfor lande på kamerarommets −X-side, altså
  // VENSTRE halvdel av skjermen — og et punkt rett ØST (Δx>0) skal lande OVER
  // midtlinjen (mindre skjermY).
  it("90°: et punkt rett NORD for senteret flyttes til venstre halvdel av skjermen", () => {
    const k: DxfKameraParametre = { ...BASIS, rotasjonGrader: 90 };
    const skjerm = verdenTilSkjerm({ verdenX: 1000, verdenY: 2100 }, k);
    expect(skjerm.skjermX).toBeLessThan(400);
    expect(skjerm.skjermY).toBeCloseTo(300, 6);
  });

  it("90°: et punkt rett ØST for senteret flyttes OVER midtlinjen (mot toppen)", () => {
    const k: DxfKameraParametre = { ...BASIS, rotasjonGrader: 90 };
    const skjerm = verdenTilSkjerm({ verdenX: 1100, verdenY: 2000 }, k);
    expect(skjerm.skjermY).toBeLessThan(300);
    expect(skjerm.skjermX).toBeCloseTo(400, 6);
  });

  it("360° er identisk med 0°", () => {
    const punkt = { verdenX: 1123, verdenY: 1876 };
    const a = verdenTilSkjerm(punkt, { ...BASIS, rotasjonGrader: 0 });
    const b = verdenTilSkjerm(punkt, { ...BASIS, rotasjonGrader: 360 });
    expect(b.skjermX).toBeCloseTo(a.skjermX, 9);
    expect(b.skjermY).toBeCloseTo(a.skjermY, 9);
  });

  it("kamerasenteret projiseres til midtpunktet uansett rotasjon", () => {
    for (const rotasjonGrader of [0, 37, 90, 180, 271]) {
      const skjerm = verdenTilSkjerm({ verdenX: 1000, verdenY: 2000 }, { ...BASIS, rotasjonGrader });
      expect(skjerm.skjermX).toBeCloseTo(400, 9);
      expect(skjerm.skjermY).toBeCloseTo(300, 9);
    }
  });

  it("rundtur skjerm→verden→skjerm holder for en vilkårlig rotasjon", () => {
    const k: DxfKameraParametre = { ...BASIS, rotasjonGrader: 37 };
    const start = { skjermX: 611, skjermY: 42 };
    const verden = skjermTilVerden(start, k);
    const tilbake = verdenTilSkjerm(verden, k);
    expect(tilbake.skjermX).toBeCloseTo(start.skjermX, 9);
    expect(tilbake.skjermY).toBeCloseTo(start.skjermY, 9);
  });
});

describe("verdenTilSkjerm — ikke-kvadratisk kameraboks (ulik bredde/høyde)", () => {
  it("asymmetrisk left/right/top/bottom gir riktig midtpunkt og skala pr. akse", () => {
    const k: DxfKameraParametre = {
      ...BASIS,
      left: -100,
      right: 300, // midX = 100, halvW = 200
      top: 50,
      bottom: -150, // midY = -50, halvH = 100
      senterX: 0,
      senterY: 0,
      canvasBredde: 400,
      canvasHoyde: 200,
    };
    // Kamerarom-punkt = (midX, midY) = (100, -50) skal lande midt på skjermen.
    const midt = verdenTilSkjerm({ verdenX: 100, verdenY: -50 }, k);
    expect(midt.skjermX).toBeCloseTo(200, 9);
    expect(midt.skjermY).toBeCloseTo(100, 9);
  });
});
