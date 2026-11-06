import { describe, it, expect } from "vitest";
import { duErHerPosisjon, tegningBunnfelt } from "./tegningDuErHer";

// Tegning der nedre venstre hjørne = (59.0, 10.0) og øvre høyre = (59.1, 10.1)
const geo = {
  point1: { gps: { lat: 59.0, lng: 10.0 }, pixel: { x: 0, y: 100 } },
  point2: { gps: { lat: 59.1, lng: 10.1 }, pixel: { x: 100, y: 0 } },
};

describe("duErHerPosisjon — GPS → blå markør", () => {
  it("innenfor tegningen → markør i tegningsprosent", () => {
    // Midtpunktet mellom referansepunktene (topunkts-transformen er konform, så kun diagonalen er triviell)
    const pos = duErHerPosisjon(geo, { lat: 59.05, lng: 10.05 });
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(50, 0);
    expect(pos!.y).toBeCloseTo(50, 0);
  });

  it("utenfor tegningen → ingen markør (ikke klemt mot kanten)", () => {
    expect(duErHerPosisjon(geo, { lat: 63.4, lng: 10.4 })).toBeNull();
    expect(duErHerPosisjon(geo, { lat: 59.05, lng: 10.2 })).toBeNull();
  });

  it("tegning uten geoReference → ingen markør", () => {
    expect(duErHerPosisjon(null, { lat: 59.05, lng: 10.05 })).toBeNull();
    expect(duErHerPosisjon(undefined, { lat: 59.05, lng: 10.05 })).toBeNull();
  });

  it("uten GPS (avslått/feilet) → ingen markør", () => {
    expect(duErHerPosisjon(geo, null)).toBeNull();
  });

  it("degenerert georeferanse (like punkter) → ingen markør, ingen kast", () => {
    const degenerert = { point1: geo.point1, point2: geo.point1 };
    expect(duErHerPosisjon(degenerert, { lat: 59.05, lng: 10.05 })).toBeNull();
  });
});

describe("tegningBunnfelt — Lagre eller låsetekst", () => {
  it("utkast med redigeringsrett → Lagre, ingen tekst", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: true, offline: false }).visning).toBe("lagre");
  });
  it("sendt (lesemodus) → låsetekst, ikke Lagre", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: false, offline: false }).visning).toBe("laastSendt");
  });
  it("offline → egen offline-tekst", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: false, offline: true }).visning).toBe("laastOffline");
  });
});

describe("tegningBunnfelt — «Bruk min posisjon» (ORDRE 24)", () => {
  const her = { x: 40, y: 60 };
  it("utkast + posisjon innenfor → vises", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: true, offline: false, duErHer: her }).brukMinPosisjon).toBe(true);
  });
  it("sendt → skjult", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: false, offline: false, duErHer: her }).brukMinPosisjon).toBe(false);
  });
  it("offline → skjult", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: false, offline: true, duErHer: her }).brukMinPosisjon).toBe(false);
    expect(tegningBunnfelt({ kanRedigerePunkt: true, offline: true, duErHer: her }).brukMinPosisjon).toBe(false);
  });
  it("posisjon null (ingen GPS/utenfor/uten georeferanse) → skjult", () => {
    expect(tegningBunnfelt({ kanRedigerePunkt: true, offline: false, duErHer: null }).brukMinPosisjon).toBe(false);
  });
});
