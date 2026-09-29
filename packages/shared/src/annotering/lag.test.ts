import { describe, it, expect } from "vitest";
import {
  reskalerLagObjekt,
  FABRIC_VERSJON,
  skalertStrek,
  skalertFont,
  skalertKontrast,
  annoteringSkala,
  formKontrastStil,
  tekstKontrastStil,
  ANNOTERING_STREK_FARGE,
  ANNOTERING_KONTRAST_FARGE,
} from "./lag";

describe("reskalerLagObjekt — koordinat-normalisering på tvers av skjermstørrelser", () => {
  it("ratio 1 (samme canvas) lar objektet stå urørt", () => {
    const obj = { type: "circle", left: 40, top: 20, scaleX: 1.5, scaleY: 1.5, stroke: "#ef4444" };
    expect(reskalerLagObjekt(obj, 1)).toEqual(obj);
  });

  it("ratio 2 (web→dobbelt så stor canvas) dobler posisjon OG skala", () => {
    const ut = reskalerLagObjekt({ left: 40, top: 20, scaleX: 1.5, scaleY: 2 }, 2);
    expect(ut.left).toBe(80);
    expect(ut.top).toBe(40);
    expect(ut.scaleX).toBe(3);
    expect(ut.scaleY).toBe(4);
  });

  it("ratio 0.5 (web→mobil, mindre canvas) halverer", () => {
    const ut = reskalerLagObjekt({ left: 100, top: 60, scaleX: 2, scaleY: 2 }, 0.5);
    expect(ut).toMatchObject({ left: 50, top: 30, scaleX: 1, scaleY: 1 });
  });

  it("manglende scaleX/scaleY behandles som 1 (Fabric-default), ikke 0", () => {
    const ut = reskalerLagObjekt({ left: 10, top: 10 }, 3);
    expect(ut.scaleX).toBe(3);
    expect(ut.scaleY).toBe(3);
  });

  it("manglende left/top behandles som 0", () => {
    const ut = reskalerLagObjekt({ scaleX: 1, scaleY: 1 }, 4);
    expect(ut.left).toBe(0);
    expect(ut.top).toBe(0);
  });

  it("bevarer øvrige egenskaper (type, stroke, path) uendret", () => {
    const obj = { type: "path", path: [["M", 0, 0]], stroke: "#ef4444", left: 5, top: 5, scaleX: 1, scaleY: 1 };
    const ut = reskalerLagObjekt(obj, 2);
    expect(ut.type).toBe("path");
    expect(ut.stroke).toBe("#ef4444");
    expect(ut.path).toEqual([["M", 0, 0]]);
  });

  it("FABRIC_VERSJON matcher CDN-en HTML-en laster (én kilde)", () => {
    expect(FABRIC_VERSJON).toBe("5.3.1");
  });
});

// Effektiv visuell strek/font = grunnverdi × objektets scale (slik Fabric rendrer:
// strokeWidth og fontSize skaleres med scaleX/scaleY). reskalerLagObjekt rører derfor
// IKKE strokeWidth/fontSize — den skalerer scale, og størrelsen følger med. Ville vi
// også skalert strokeWidth her, ble streken dobbelt-skalert.
const MOBIL = 390;
const WEB = 1163;

describe("strek/font/kontrast skalerer med canvas-bredden (FUNN 1/3)", () => {
  // KRAV c.1 — assertert mot TO ulike canvas-bredder, ikke én.
  it("strek er større på web-canvas enn på mobil-canvas, i samme forhold som bredden", () => {
    const mobil = skalertStrek(MOBIL);
    const web = skalertStrek(WEB);
    expect(mobil).toBe(3); // referanse-kalibrering bevart
    expect(web).toBeGreaterThan(mobil);
    expect(web / mobil).toBeCloseTo(WEB / MOBIL, 10);
  });

  it("font skalerer likt: 14px på mobil-referanse, proporsjonalt større på web", () => {
    expect(skalertFont(MOBIL)).toBe(14);
    expect(skalertFont(WEB) / skalertFont(MOBIL)).toBeCloseTo(WEB / MOBIL, 10);
  });

  it("kontrastkant skalerer også — 2px på mobil er usynlig på 1163px-canvas", () => {
    expect(skalertKontrast(MOBIL)).toBe(2);
    expect(skalertKontrast(WEB)).toBeGreaterThan(skalertKontrast(MOBIL));
    expect(skalertKontrast(WEB) / skalertKontrast(MOBIL)).toBeCloseTo(WEB / MOBIL, 10);
  });

  it("ugyldig/null canvas-bredde faller tilbake til skala 1 (ingen deling på 0)", () => {
    expect(annoteringSkala(0)).toBe(1);
    expect(annoteringSkala(-5)).toBe(1);
    expect(skalertStrek(0)).toBe(3);
  });
});

describe("visuelt strek/bilde-forhold er likt på tvers av skjermer (FUNN, KRAV c.2)", () => {
  // Effektiv visuell strek = strokeWidth × scaleX. Andelen av canvas (≈ bildet, som
  // fyller canvas) skal være invariant når laget flyttes mellom skjermstørrelser.
  const effektivStrek = (o: Record<string, unknown>) =>
    (o.strokeWidth as number) * (o.scaleX as number);

  it("et lag tegnet på liten canvas og åpnet på stor har samme strek/bilde-andel", () => {
    // Tegnet på mobil: proporsjonal strek, scale 1.
    const tegnet = { strokeWidth: skalertStrek(MOBIL), scaleX: 1, scaleY: 1, left: 10, top: 10 };
    const andelMobil = effektivStrek(tegnet) / MOBIL;

    // Åpnet på web: reskalering ganger scale med bredde-forholdet.
    const paaWeb = reskalerLagObjekt(tegnet, WEB / MOBIL);
    const andelWeb = effektivStrek(paaWeb) / WEB;

    expect(andelWeb).toBeCloseTo(andelMobil, 10);
  });

  it("motsatt vei (web→mobil) gir også samme andel", () => {
    const tegnet = { strokeWidth: skalertStrek(WEB), scaleX: 1, scaleY: 1 };
    const andelWeb = effektivStrek(tegnet) / WEB;
    const paaMobil = reskalerLagObjekt(tegnet, MOBIL / WEB);
    const andelMobil = effektivStrek(paaMobil) / MOBIL;
    expect(andelMobil).toBeCloseTo(andelWeb, 10);
  });
});

describe("alle formtyper får hvit kontrastkant, ikke bare tekst (FUNN 4, KRAV c.3)", () => {
  it("form-halo (pil/sirkel/firkant): hvit strek er bredere enn rød på begge bredder", () => {
    for (const bredde of [MOBIL, WEB]) {
      const { rodStrek, hvitStrek } = formKontrastStil(bredde);
      // Hvit halo stikker en kontrastkant ut på HVER side → strengt bredere enn rød.
      expect(hvitStrek).toBeGreaterThan(rodStrek);
      expect(hvitStrek - rodStrek).toBeCloseTo(2 * skalertKontrast(bredde), 10);
    }
  });

  it("form-halo skalerer med canvas (usynlig kant på stor canvas unngås)", () => {
    expect(formKontrastStil(WEB).hvitStrek).toBeGreaterThan(formKontrastStil(MOBIL).hvitStrek);
    expect(formKontrastStil(WEB).rodStrek).toBeGreaterThan(formKontrastStil(MOBIL).rodStrek);
  });

  it("tekst: hvit outline males FØRST (paintFirst stroke), font+kant skalerer", () => {
    const mobil = tekstKontrastStil(MOBIL);
    const web = tekstKontrastStil(WEB);
    expect(mobil.paintFirst).toBe("stroke");
    expect(mobil.fontSize).toBe(14);
    expect(mobil.hvitKant).toBe(2);
    expect(web.fontSize).toBeGreaterThan(mobil.fontSize);
    expect(web.hvitKant).toBeGreaterThan(mobil.hvitKant);
  });

  it("rød merkefarge og hvit kontrastfarge er de forventede (én kilde med HTML)", () => {
    expect(ANNOTERING_STREK_FARGE).toBe("#ef4444");
    expect(ANNOTERING_KONTRAST_FARGE).toBe("#ffffff");
  });
});

describe("ingen drift når laget lastes på samme bredde det ble laget på (KRAV c.4)", () => {
  it("ratio 1 lar strek OG scale stå urørt (ikke dobbelt-skalering)", () => {
    const tegnet = { strokeWidth: skalertStrek(WEB), scaleX: 1, scaleY: 1, left: 50, top: 40 };
    const lastet = reskalerLagObjekt(tegnet, 1);
    expect(lastet.strokeWidth).toBe(tegnet.strokeWidth);
    expect(lastet.scaleX).toBe(1);
    expect(lastet.scaleY).toBe(1);
    expect(lastet).toEqual(tegnet);
  });

  it("fram-og-tilbake (liten→stor→liten) lander på utgangspunktet — ingen drift", () => {
    const tegnet = { strokeWidth: skalertStrek(MOBIL), scaleX: 1, scaleY: 1, left: 12, top: 8 };
    const fram = reskalerLagObjekt(tegnet, WEB / MOBIL);
    const tilbake = reskalerLagObjekt(fram, MOBIL / WEB);
    expect((tilbake.scaleX as number)).toBeCloseTo(1, 10);
    expect((tilbake.left as number)).toBeCloseTo(12, 10);
    expect(tilbake.strokeWidth).toBe(tegnet.strokeWidth);
  });
});
