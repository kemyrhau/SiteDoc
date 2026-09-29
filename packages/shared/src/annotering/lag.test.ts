import { describe, it, expect } from "vitest";
import {
  reskalerLagObjekt,
  FABRIC_CDN_STI,
  skalertStrek,
  skalertFont,
  skalertKontrast,
  skalertTekstKant,
  annoteringSkala,
  formKontrastStil,
  formLagBeskrivelse,
  tekstKontrastStil,
  skalertPilhode,
  pilLinjeSlutt,
  ANNOTERING_PILHODE_FAKTOR,
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

  it("FABRIC_CDN_STI er pinnet til CDN-stien HTML-en laster (én kilde for stien)", () => {
    expect(FABRIC_CDN_STI).toBe("5.3.1");
  });
});

// Effektiv visuell strek/font = grunnverdi × objektets scale (slik Fabric rendrer:
// strokeWidth og fontSize skaleres med scaleX/scaleY). reskalerLagObjekt rører derfor
// IKKE strokeWidth/fontSize — den skalerer scale, og størrelsen følger med. Ville vi
// også skalert strokeWidth her, ble streken dobbelt-skalert.
const MOBIL = 390;
const WEB = 1163;

describe("strek/font/kontrast skalerer SUB-LINEÆRT med canvas-bredden (FUNN 2 — for tykt)", () => {
  const SQRT = Math.sqrt(WEB / MOBIL); // sub-lineær faktor, ~1.727

  // KRAV c.1 — assertert mot TO ulike canvas-bredder, ikke én.
  it("strek vokser med canvas, men saktere enn lineært (kvadratrot)", () => {
    const mobil = skalertStrek(MOBIL);
    const web = skalertStrek(WEB);
    expect(mobil).toBe(3); // referanse-kalibrering bevart
    expect(web).toBeGreaterThan(mobil);
    // Sub-lineær: forholdet er KVADRATROTEN av bredde-forholdet, ikke bredde-forholdet.
    expect(web / mobil).toBeCloseTo(SQRT, 10);
    expect(web / mobil).toBeLessThan(WEB / MOBIL); // strengt saktere enn lineær
    expect(web).toBeCloseTo(5.18, 1); // ~5,2px på 1163px (lineær ga ~9px)
  });

  it("font skalerer sub-lineært: 14px på mobil, ~24px på web (ikke ~42px)", () => {
    expect(skalertFont(MOBIL)).toBe(14);
    expect(skalertFont(WEB) / skalertFont(MOBIL)).toBeCloseTo(SQRT, 10);
    expect(skalertFont(WEB)).toBeCloseTo(24.2, 1);
  });

  it("kontrastkant er en ANDEL av streken (0,3 per side), ikke et fast tillegg", () => {
    // 0,9px på mobil (3×0,3), ~1,55px på web (5,18×0,3) — tynn, følger streken.
    expect(skalertKontrast(MOBIL)).toBeCloseTo(0.9, 5);
    expect(skalertKontrast(WEB)).toBeCloseTo(1.55, 1);
    expect(skalertKontrast(WEB) / skalertStrek(WEB)).toBeCloseTo(0.3, 5);
  });

  it("tekst-outline er en andel av fonten (0,1)", () => {
    expect(skalertTekstKant(MOBIL)).toBeCloseTo(1.4, 5);
    expect(skalertTekstKant(WEB) / skalertFont(WEB)).toBeCloseTo(0.1, 5);
  });

  it("ugyldig/null canvas-bredde faller tilbake til skala 1 (ingen deling på 0)", () => {
    expect(annoteringSkala(0)).toBe(1);
    expect(annoteringSkala(-5)).toBe(1);
    expect(skalertStrek(0)).toBe(3);
  });
});

describe("hvit og rød form er KONSENTRISKE uansett strekbredde (FUNN 2, KRAV c.2)", () => {
  it("begge lag deler nøyaktig senterkoordinater — ikke bare begge finnes", () => {
    const { hvit, rod } = formLagBeskrivelse(WEB, 500, 320);
    // Senteret er identisk (poenget: forskjøvet før, da de sto etter hjørnet).
    expect(hvit.left).toBe(rod.left);
    expect(hvit.top).toBe(rod.top);
    expect(hvit.left).toBe(500);
    expect(hvit.top).toBe(320);
    // …og posisjonert etter senter, som gjør dem konsentriske uavhengig av strek.
    expect(hvit.originX).toBe("center");
    expect(hvit.originY).toBe("center");
    expect(rod.originX).toBe("center");
    expect(rod.originY).toBe("center");
  });

  it("senteret er likt SELV om strekbreddene er ulike (regresjonsvakt mot hjørne-forskyvning)", () => {
    const { hvit, rod } = formLagBeskrivelse(WEB, 100, 100);
    expect(hvit.strokeWidth).toBeGreaterThan(rod.strokeWidth); // ulik strek
    expect(hvit.left).toBe(rod.left); // men samme senter
    expect(hvit.top).toBe(rod.top);
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
    expect(mobil.hvitKant).toBeCloseTo(1.4, 5); // 14 × 0,1
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

describe("pilhode: forholdet hode:strek er konstant (KRAV c1 — det som feilet nominelt)", () => {
  it("hode:strek er PILHODE_FAKTOR:1 (5:1) på mobil-canvas", () => {
    expect(skalertPilhode(MOBIL) / skalertStrek(MOBIL)).toBeCloseTo(ANNOTERING_PILHODE_FAKTOR, 10);
  });

  it("SAMME forhold på en mye bredere canvas — ingen drift mellom to bredder", () => {
    const mobilForhold = skalertPilhode(MOBIL) / skalertStrek(MOBIL);
    const webForhold = skalertPilhode(WEB) / skalertStrek(WEB);
    expect(webForhold).toBeCloseTo(mobilForhold, 10);
    // absolutte verdier vokser med canvas, men i takt: 390px → 3/15, 1163px → større, samme 5:1
    expect(skalertPilhode(WEB)).toBeGreaterThan(skalertPilhode(MOBIL));
  });
});

describe("pilLinjeSlutt: linja stopper FØR hodets senter (KRAV c2 + c3)", () => {
  const fra = { x: 0, y: 0 };

  it("KRAV c2 — endepunktet er trukket tilbake fra spissen, ikke i den", () => {
    const til = { x: 100, y: 0 };
    const pilhode = 20;
    const slutt = pilLinjeSlutt(fra, til, pilhode);
    // trukket tilbake med halve hodelengden langs vinkelen (100 - 10 = 90)
    expect(slutt.x).toBeCloseTo(90, 10);
    expect(slutt.y).toBeCloseTo(0, 10);
    // og strengt FØR spissen (ikke i senteret der hodet ligger)
    expect(slutt.x).toBeLessThan(til.x);
  });

  it("KRAV c2 — virker på skrå (tilbaketrekk følger pil-vinkelen)", () => {
    const til = { x: 30, y: 40 }; // lengde 50
    const slutt = pilLinjeSlutt(fra, til, 20); // tilbake 10 langs (0.6, 0.8)
    expect(slutt.x).toBeCloseTo(30 - 0.6 * 10, 10);
    expect(slutt.y).toBeCloseTo(40 - 0.8 * 10, 10);
  });

  it("KRAV c3 — kort pil klemmes til lengde 0 (ikke negativ), hodet tegnes fortsatt", () => {
    const til = { x: 6, y: 0 }; // lengde 6 < pilhode/2 = 10
    const slutt = pilLinjeSlutt(fra, til, 20);
    // tilbaketrekk klemt til pilens lengde → endepunkt = start, aldri forbi (ingen negativ x)
    expect(slutt.x).toBeCloseTo(fra.x, 10);
    expect(slutt.y).toBeCloseTo(fra.y, 10);
    expect(slutt.x).toBeGreaterThanOrEqual(0);
  });

  it("KRAV c3 — degenerert pil (fra === til) gir ingen NaN, faller tilbake til spissen", () => {
    const slutt = pilLinjeSlutt(fra, { x: 0, y: 0 }, 20);
    expect(Number.isNaN(slutt.x)).toBe(false);
    expect(Number.isNaN(slutt.y)).toBe(false);
    expect(slutt).toEqual({ x: 0, y: 0 });
  });
});
