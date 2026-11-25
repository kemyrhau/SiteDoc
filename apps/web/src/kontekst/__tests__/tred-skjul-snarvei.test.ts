import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  lyttEtterSkjulSnarvei,
  erSkrivefelt,
  snarveiGjelderSiden,
} from "../../app/dashbord/[prosjektId]/3d-visning/skjulSnarvei";

/**
 * Ordre 3D-SKJUL-SNARVEI (Kenneth 2026-11-25): hold X og klikk på et objekt = skjul direkte,
 * uten egenskapskort. Scenen krever WebGL og kan ikke kjøres i node; tastetilstanden testes
 * som ren funksjon, og koblingen i handleKlikk låses i kilden. Gesten verifiseres av Kenneth på test.
 */

type Lytter = (e: Event) => void;
function falskVindu() {
  const lyttere = new Map<string, Lytter>();
  return {
    lyttere,
    addEventListener: (type: string, f: Lytter) => void lyttere.set(type, f),
    removeEventListener: (type: string) => void lyttere.delete(type),
    send: (type: string, felt: Record<string, unknown> = {}) => lyttere.get(type)?.(felt as unknown as Event),
  };
}

describe("tastetilstanden for X", () => {
  it("X ned → aktiv, X opp → ikke aktiv", () => {
    const v = falskVindu();
    const s = lyttEtterSkjulSnarvei(v as unknown as Window);
    expect(s.erAktiv()).toBe(false);
    v.send("keydown", { code: "KeyX", key: "x", target: { tagName: "CANVAS" } });
    expect(s.erAktiv()).toBe(true);
    v.send("keyup", { code: "KeyX", key: "x" });
    expect(s.erAktiv()).toBe(false);
  });

  it("X i et input-felt, textarea, select eller contenteditable skjuler ingenting", () => {
    for (const target of [{ tagName: "INPUT" }, { tagName: "textarea" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
      const v = falskVindu();
      const s = lyttEtterSkjulSnarvei(v as unknown as Window);
      v.send("keydown", { code: "KeyX", key: "x", target });
      expect(s.erAktiv(), JSON.stringify(target)).toBe(false);
    }
    expect(erSkrivefelt(null)).toBe(false);
  });

  it("Cmd/Ctrl/Alt+X (klipp ut o.l.) aktiverer ikke snarveien", () => {
    for (const mod of ["metaKey", "ctrlKey", "altKey"]) {
      const v = falskVindu();
      const s = lyttEtterSkjulSnarvei(v as unknown as Window);
      v.send("keydown", { code: "KeyX", key: "x", [mod]: true, target: { tagName: "BODY" } });
      expect(s.erAktiv(), mod).toBe(false);
    }
  });

  it("blur nullstiller, så X ikke henger etter fanebytte", () => {
    const v = falskVindu();
    const s = lyttEtterSkjulSnarvei(v as unknown as Window);
    v.send("keydown", { code: "KeyX", key: "X", target: { tagName: "BODY" } });
    expect(s.erAktiv()).toBe(true);
    v.send("blur");
    expect(s.erAktiv()).toBe(false);
  });

  it("andre taster påvirker ikke tilstanden; stopp fjerner lytterne", () => {
    const v = falskVindu();
    const s = lyttEtterSkjulSnarvei(v as unknown as Window);
    v.send("keydown", { code: "KeyZ", key: "z", target: { tagName: "BODY" } });
    expect(s.erAktiv()).toBe(false);
    s.stopp();
    expect(v.lyttere.size).toBe(0);
  });

  it("gjelder 3d-visning, ikke tegning-3d (ingen liste å vise objektet igjen fra der)", () => {
    expect(snarveiGjelderSiden("/dashbord/p1/3d-visning")).toBe(true);
    expect(snarveiGjelderSiden("/dashbord/p1/tegning-3d")).toBe(false);
    expect(snarveiGjelderSiden(null)).toBe(false);
  });
});

const kilde = readFileSync(resolve(__dirname, "../tred-viewer-kontekst.tsx"), "utf8");

describe("koblingen i handleKlikk", () => {
  const start = kilde.indexOf("async function handleKlikk(event: MouseEvent) {");
  const slutt = kilde.indexOf('rendererDom.addEventListener("click", handleKlikk);');
  const klikk = kilde.slice(start, slutt);

  it("X nede + klikk på objekt kaller skjulObjektOgLeggTil og returnerer før kortet åpnes", () => {
    const gren = klikk.indexOf("if (skjulSnarveiRef.current?.erAktiv()) {");
    const skjul = klikk.indexOf("await skjulObjektRef.current(", gren);
    const retur = klikk.indexOf("return;", skjul);
    const marker = klikk.indexOf("placeMarker(hitResult.point);");
    const kort = klikk.indexOf("onObjektValgtRef.current({ localId");
    expect(start).toBeGreaterThan(-1);
    expect(gren).toBeGreaterThan(-1);
    expect(skjul).toBeGreaterThan(gren);
    expect(retur).toBeGreaterThan(skjul);
    // Grenen ligger før markør og kort: vanlig klikk (uten X) går videre som før
    expect(marker).toBeGreaterThan(retur);
    expect(kort).toBeGreaterThan(retur);
    expect(kilde).toContain("skjulObjektRef.current = skjulObjektOgLeggTil;");
  });

  it("klikk-og-dra skjuler ingenting: dra-sperren kommer før X-grenen", () => {
    const dra = klikk.indexOf("if (Math.sqrt(dx * dx + dy * dy) > 5) return;");
    const gren = klikk.indexOf("if (skjulSnarveiRef.current?.erAktiv()) {");
    expect(dra).toBeGreaterThan(-1);
    expect(gren).toBeGreaterThan(dra);
  });

  it("lytteren lever bare på 3d-visning og fjernes ved avmontering", () => {
    expect(kilde).toContain("if (!snarveiGjelderSiden(pathname)) return;");
    expect(kilde).toContain("const snarvei = lyttEtterSkjulSnarvei(window);");
    expect(kilde).toContain("snarvei.stopp();");
  });
});

describe("hover på øyeknappen og ?-hjelpen forteller om snarveien", () => {
  const popup = readFileSync(resolve(__dirname, "../../app/dashbord/[prosjektId]/3d-visning/komponenter/EgenskapsPopup.tsx"), "utf8");
  const i18nMappe = resolve(__dirname, "../../../../../packages/shared/src/i18n");

  it("øyeknappen har title og aria-label via t(), ikke hardkodet tekst", () => {
    expect(popup).toContain('title={t("3d.skjulObjektHint")}');
    expect(popup).toContain('aria-label={t("3d.skjulObjekt")}');
    expect(popup).not.toContain('title="Skjul objekt"');
  });

  it("«X» står uoversatt i hovertekst og hjelpetekst på alle språk", () => {
    const filer = readdirSync(i18nMappe).filter((f) => f.endsWith(".json"));
    expect(filer.length).toBeGreaterThanOrEqual(15);
    for (const f of filer) {
      const d = JSON.parse(readFileSync(resolve(i18nMappe, f), "utf8")) as Record<string, string>;
      for (const k of ["3d.skjulObjektHint", "3d.hjelp.skjul"]) {
        expect(d[k], `${f} ${k}`).toMatch(/(^|[^\p{L}])X([^\p{L}]|$)/u);
      }
      expect(d["3d.skjulObjekt"], `${f} 3d.skjulObjekt`).toBeTruthy();
    }
  });
});
