import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zoomSteg, ZOOM_MIN_STEG_M } from "@sitedoc/shared";
import {
  avstandEtterSteg, flyttLangsBlikk, hjulAvstand, orbitPunkt, utliggereBlant, utliggereSomKanVises, utliggerePrModell, panTargetPaaModellDybde, MIN_PAN_DYBDE } from "../tredKamera";

/** W4 — pan-target legges på modellens dybde, ikke 2 enheter foran kamera. */
describe("panTargetPaaModellDybde", () => {
  it("bygning sett på avstand: target havner på senterets dybde langs blikket", () => {
    // Kamera 100 m unna langs -z, ser rett mot origo der modellen står.
    const t = panTargetPaaModellDybde({ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 });
    expect(t).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("senter ved siden av blikklinja: projiseres ned på blikklinja (kameraretning bevares)", () => {
    const t = panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 50, y: 30, z: -20 });
    expect(t).toEqual({ x: 50, y: 0, z: 0 });
  });

  it("dybden gir pan-fart i riktig størrelsesorden (50× mot 2 enheter foran)", () => {
    const kamera = { x: 0, y: 0, z: 100 };
    const t = panTargetPaaModellDybde(kamera, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 })!;
    const avstand = Math.hypot(t.x - kamera.x, t.y - kamera.y, t.z - kamera.z);
    expect(avstand / MIN_PAN_DYBDE).toBe(50);
  });

  it("senter bak kamera: target beholdes (null)", () => {
    expect(panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 10 })).toBeNull();
  });

  it("senter nærmere enn minstedybden: target beholdes (null)", () => {
    expect(panTargetPaaModellDybde({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: MIN_PAN_DYBDE, y: 0, z: 0 })).toBeNull();
  });
});

/** W6 — hjul-zoom følger blikket, også loddrett når kameraet ser skrått ned. */
describe("hjul-zoom langs blikket", () => {
  // Kamera over og ved siden av modellen, ser 45° ned mot origo
  const kamera = { x: 0, y: 10, z: 10 };
  const ned = { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 };

  it("innzoom skrått ovenfra senker kameraet mot det brukeren ser på", () => {
    const ny = flyttLangsBlikk(kamera, ned, hjulAvstand(-100, 14));
    expect(ny.y).toBeLessThan(kamera.y);
    expect(ny.z).toBeLessThan(kamera.z);
    // Flyttet nøyaktig ett steg langs blikket
    const d = Math.hypot(ny.x - kamera.x, ny.y - kamera.y, ny.z - kamera.z);
    expect(d).toBeCloseTo(zoomSteg(14));
  });

  it("forflytningen er parallell med blikket (modellpunktet blir liggende midt i bildet)", () => {
    const ny = flyttLangsBlikk(kamera, ned, 4);
    // Origo ligger fortsatt på blikklinja fra ny posisjon: (origo - ny) × ned = 0
    const v = { x: -ny.x, y: -ny.y, z: -ny.z };
    const kryss = {
      x: v.y * ned.z - v.z * ned.y,
      y: v.z * ned.x - v.x * ned.z,
      z: v.x * ned.y - v.y * ned.x,
    };
    expect(Math.hypot(kryss.x, kryss.y, kryss.z)).toBeCloseTo(0);
  });

  it("hjul ned (positiv deltaY) zoomer ut, hjul opp zoomer inn", () => {
    expect(hjulAvstand(100, 14)).toBeLessThan(0);
    expect(hjulAvstand(-100, 14)).toBeGreaterThan(0);
  });
});

/** § 3b punkt 2 — zoom-farten følger avstanden til flaten midt på skjermen (kurve felles med mobil). */
describe("zoom-fart etter avstand", () => {
  it("ett hjulhakk = zoomSteg(avstand) fra @sitedoc/shared", () => {
    for (const d of [0.1, 1, 5, 20, 100, 2000]) expect(hjulAvstand(-100, d)).toBeCloseTo(zoomSteg(d));
  });

  it("rask langt unna, sakte nær", () => {
    expect(hjulAvstand(-100, 200)).toBeGreaterThan(hjulAvstand(-100, 20));
    expect(hjulAvstand(-100, 20)).toBeGreaterThan(hjulAvstand(-100, 2));
    // Nær en vegg (1 m) er steget under 1 cm-skala ganger fem — man går ikke gjennom den
    expect(hjulAvstand(-100, 1)).toBeLessThan(0.05);
  });

  it("halvt hakk (styreflate) gir halvt steg", () => {
    expect(hjulAvstand(-50, 20)).toBeCloseTo(zoomSteg(20) / 2);
  });

  it("avstanden trekkes ned med steget til raycasten svarer, aldri under minstesteget", () => {
    expect(avstandEtterSteg(20, 1)).toBe(19);
    expect(avstandEtterSteg(20, -1)).toBe(21);
    expect(avstandEtterSteg(0.01, 1)).toBe(ZOOM_MIN_STEG_M);
  });

  it("innzoom mot en vegg 10 m unna bremser ned nær veggen, og kommer gjennom med minstesteget", () => {
    let avstand = 10;
    let gått = 0;
    const steg: number[] = [];
    for (let i = 0; i < 100; i++) {
      const s = hjulAvstand(-100, avstand);
      steg.push(s);
      gått += s;
      avstand = avstandEtterSteg(avstand, s);
    }
    expect(steg[0]).toBeCloseTo(zoomSteg(10));
    // 100 hakk: nesten fram (målt 8,6 m), ikke forbi
    expect(gått).toBeGreaterThan(8);
    expect(gått).toBeLessThan(10);
    // Steget avtar for hvert hakk og ender ved minstesteget — kontrollert inn mot/gjennom veggen
    for (let i = 1; i < steg.length; i++) expect(steg[i]).toBeLessThanOrEqual(steg[i - 1]!);
    expect(steg[99]).toBeLessThan(steg[0]! / 10);
    expect(steg[99]).toBeGreaterThanOrEqual(ZOOM_MIN_STEG_M);
  });
});

describe("kobling i tred-viewer-kontekst", () => {
  const kilde = readFileSync(resolve(__dirname, "../../kontekst/tred-viewer-kontekst.tsx"), "utf8");

  it("høyre/midtre knapp bruker pan-regelen, venstre roterer rundt skjermmidten", () => {
    expect(kilde).toContain("if (e.button === 0) void settOrbitPunkt();");
    expect(kilde).toContain("else if (e.button === 1 || e.button === 2) settTargetPaaModellDybde();");
    expect(kilde).toContain("panTargetPaaModellDybde(cam.position, blikkretning(), modellSenter)");
  });

  it("W6: camera-controls' hjul-dolly er av, og hjulet flytter target langs blikket", () => {
    expect(kilde).toContain("ctrl.mouseButtons.wheel = 0;");
    expect(kilde).toContain("flyttLangsBlikk(t, retning, steg)");
    expect(kilde).not.toContain("ctrl.forward(");
  });

  it("rotasjon rundt ståsted er erstattet: ingen target 2 enheter foran, ingen controlend-nullstilling", () => {
    expect(kilde).not.toContain("oppdaterTarget");
    expect(kilde).not.toContain('addEventListener("controlend"');
  });

  it("orbit-punktet: først samme avstand som sist, så treffet fra skjermmidten", () => {
    expect(kilde).toContain("orbitPunkt(cam.position, blikkretning(), null, sisteOrbitAvstand)");
    expect(kilde).toContain("orbitPunkt(cam.position, blikkretning(), treff.distanceTo(kameraVedStart), sisteOrbitAvstand)");
    expect(kilde).toContain("sisteOrbitAvstand = o.avstand;");
    // Raycasten går fra midten av lerretet mot synlige modeller
    expect(kilde).toContain("new THREE.Vector2(rect.left + rect.width / 2, rect.top + rect.height / 2)");
    const fn = kilde.slice(kilde.indexOf("finnTreffISkjermmidten = async"), kilde.indexOf("let mouseDownPos"));
    expect(fn).toContain("if (!synligeModeller.has(mid)) continue;");
  });

  it("zoom-fart: hjulsteget regnes fra avstanden til flaten midt på skjermen, som måles på nytt", () => {
    expect(kilde).toContain("const steg = hjulAvstand(e.deltaY, sisteOrbitAvstand);");
    expect(kilde).toContain("sisteOrbitAvstand = avstandEtterSteg(sisteOrbitAvstand, steg);");
    const hjul = kilde.slice(kilde.indexOf('addEventListener("wheel"'), kilde.indexOf("const maalAvstandTilMidten = () =>"));
    expect(hjul).toContain("maalAvstandTilMidten();");
    const maal = kilde.slice(kilde.indexOf("const maalAvstandTilMidten = () =>"));
    expect(maal.slice(0, 600)).toContain("if (treff) sisteOrbitAvstand = treff.distanceTo(cam.position);");
  });

  it("modellsenteret settes fra samlet bbox når modellene er lastet", () => {
    expect(kilde).toContain("modellSenter = center.clone();");
  });
});

/** § 3b punkt 3 — objekter langt unna: kobling mot andre skjulekilder. */
describe("objekter langt unna (utliggere)", () => {
  const eiere = [
    { modelId: "A", localId: 10 },
    { modelId: "A", localId: 11 },
    { modelId: "B", localId: 20 },
    { modelId: "B", localId: 21 },
  ];

  it("indekser fra finnUtliggere fordeles på modell og localId", () => {
    expect(utliggerePrModell([0, 2, 3], eiere)).toEqual(new Map([["A", [10]], ["B", [20, 21]]]));
    expect(utliggerePrModell([], eiere).size).toBe(0);
  });

  it("bryteren viser ikke utliggere som er skjult av en annen grunn (rom, filter, enkeltobjekt)", () => {
    const utliggere = new Map([["A", [10, 11]], ["B", [20]]]);
    const skjultAvAnnet = new Map([["A", new Set([11])], ["B", new Set([20])]]);
    expect(utliggereSomKanVises(utliggere, skjultAvAnnet)).toEqual(new Map([["A", [10]]]));
  });

  it("uten andre skjulekilder vises alle utliggere", () => {
    const utliggere = new Map([["A", [10, 11]]]);
    expect(utliggereSomKanVises(utliggere, new Map())).toEqual(utliggere);
  });

  it("når et filter fjernes, finnes utliggerne blant objektene som ble vist", () => {
    const utliggere = new Map([["A", [10]], ["B", [20]]]);
    const viste = new Map([["A", [1, 2, 10]], ["C", [10]]]);
    expect(utliggereBlant(utliggere, viste)).toEqual(new Map([["A", [10]]]));
  });
});

describe("utliggere — kobling i tred-viewer-kontekst og 3d-visning", () => {
  const kilde = readFileSync(resolve(__dirname, "../../kontekst/tred-viewer-kontekst.tsx"), "utf8");
  const side = readFileSync(resolve(__dirname, "../../app/dashbord/[prosjektId]/3d-visning/page.tsx"), "utf8");

  it("utliggere finnes med den felles regelen og skjules som standard", () => {
    expect(kilde).toContain("const robust = finnUtliggere(alle);");
    expect(kilde).toContain("let utliggereSynlige = visUtliggereRef.current;");
    expect(kilde).toContain("const [visUtliggere, setVisUtliggere] = useState(false);");
  });

  it("kamera og flyTil bruker boksen uten utliggere", () => {
    expect(kilde).toContain("if (!kameraBoks.isEmpty()) {");
    expect(kilde).toContain("const center = kameraBoks.getCenter(new THREE.Vector3());");
    const flyTil = kilde.slice(kilde.indexOf("flyTil: (x: number"), kilde.indexOf("sisteKlikkPunkt: () =>"));
    expect(flyTil).not.toContain("totalBbox");
  });

  it("bryteren unntar rom/åpninger, filtre og enkeltskjulte objekter", () => {
    const fn = kilde.slice(kilde.indexOf("settUtliggereSynlige: async"), kilde.indexOf("sisteKlikkPunkt: () =>"));
    expect(fn).toContain("for (const [mid, ids] of romIds) leggTil(mid, ids);");
    expect(fn).toContain("for (const o of skjulteObjekter) leggTil(o.modelId, [o.localId]);");
    expect(fn).toContain("for (const f of aktiveFiltre) {");
    expect(fn).toContain("utliggereSomKanVises(utliggerIds, skjultAvAnnet)");
  });

  it("vis-operasjonene skjuler utliggere igjen når bryteren står av", () => {
    for (const navn of ["visObjekt", "visAlleAvKategori", "visAlleAvLag", "visAlleAvSystem"]) {
      const start = kilde.indexOf(`${navn}: async`);
      expect(start).toBeGreaterThan(-1);
      const kropp = kilde.slice(start, kilde.indexOf("\n          },", start));
      expect(kropp).toContain("await skjulUtliggereIgjen(");
    }
  });

  it("3d-visning viser bryteren bare når det finnes utliggere, med antall", () => {
    expect(side).toContain("{antallUtliggere > 0 && (");
    expect(side).toContain('{t("3d.visObjekterLangtUnna")} ({antallUtliggere})');
    expect(side).toContain("void settVisUtliggere(e.target.checked);");
  });
});
