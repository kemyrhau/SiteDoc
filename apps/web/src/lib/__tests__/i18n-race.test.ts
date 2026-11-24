// @vitest-environment jsdom
/**
 * ORDRE I18N-RACE (2026-11-24): senere språkvalg skal alltid vinne. En treg
 * oppstartslasting (`spraakKlart`) som fullfører etter `byttSpraak` skal ikke overstyre
 * brukerens valg — verken `i18next.language`, `<html lang>` eller det lagrede valget.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type I18nModul = typeof import("../i18n");

const lager = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lager.get(k) ?? null,
  setItem: (k: string, v: string) => { lager.set(k, String(v)); },
  removeItem: (k: string) => { lager.delete(k); },
  clear: () => { lager.clear(); },
});

/** Kontrollert promise: språkfila «henger» til `slipp()` kalles. */
function holdt() {
  let slipp!: () => void;
  let feil!: (e: Error) => void;
  const port = new Promise<void>((res, rej) => { slipp = res; feil = rej; });
  port.catch(() => { /* håndteres av den som venter */ });
  return { port, slipp, feil };
}

const SV = "@sitedoc/shared/src/i18n/sv.json";
const DE = "@sitedoc/shared/src/i18n/de.json";

async function lastModul(lagret: string | null): Promise<I18nModul> {
  vi.resetModules();
  localStorage.clear();
  if (lagret) localStorage.setItem("sitedoc-language", lagret);
  return import("../i18n");
}

/** Hent en ekte språkfil, men vent på porten først. */
function hengendeLaster(sti: string, port: Promise<void>) {
  vi.doMock(sti, async () => {
    await port;
    return vi.importActual(sti);
  });
}

describe("lib/i18n — senere språkvalg vinner", () => {
  beforeEach(() => { document.documentElement.lang = "nb"; });
  afterEach(() => { vi.doUnmock(SV); vi.doUnmock(DE); });

  it("byttSpraak under hengende oppstartslasting: valget står når oppstarten fullfører", async () => {
    const oppstart = holdt();
    hengendeLaster(SV, oppstart.port);
    const m = await lastModul("sv");

    await m.byttSpraak("en");
    expect(m.default.language).toBe("en");

    oppstart.slipp();
    await m.spraakKlart;

    expect(m.default.hasResourceBundle("sv", "translation")).toBe(true); // lastet ferdig
    expect(m.default.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("sitedoc-language")).toBe("en");
  });

  it("byttSpraak til nb under hengende oppstartslasting: nb står", async () => {
    const oppstart = holdt();
    hengendeLaster(SV, oppstart.port);
    const m = await lastModul("sv");

    await m.byttSpraak("nb");
    oppstart.slipp();
    await m.spraakKlart;

    expect(m.default.language).toBe("nb");
    expect(document.documentElement.lang).toBe("nb");
    expect(localStorage.getItem("sitedoc-language")).toBe("nb");
  });

  it("to bytter der det første er tregest: det siste vinner og lagres", async () => {
    const tregt = holdt();
    hengendeLaster(DE, tregt.port);
    const m = await lastModul(null);

    const forste = m.byttSpraak("de");
    await m.byttSpraak("en");
    tregt.slipp();
    await forste;

    expect(m.default.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("sitedoc-language")).toBe("en");
  });

  it("feiler det siste byttet, får hengende oppstartslasting gjelde (som før)", async () => {
    const oppstart = holdt();
    const bytte = holdt();
    hengendeLaster(SV, oppstart.port);
    hengendeLaster(DE, bytte.port);
    const m = await lastModul("sv");

    const b = m.byttSpraak("de");
    bytte.feil(new Error("uten nett"));
    await b;
    oppstart.slipp();
    await m.spraakKlart;

    expect(m.default.language).toBe("sv");
    expect(localStorage.getItem("sitedoc-language")).toBe("sv");
  });
});
