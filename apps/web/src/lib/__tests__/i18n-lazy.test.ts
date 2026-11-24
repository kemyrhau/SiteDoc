// @vitest-environment jsdom
/**
 * ORDRE 3D-mobil 6: web laster bare valgt språk. nb ligger statisk; de 14 andre hentes
 * med dynamisk import() — lagret språk ved oppstart, nytt ved bytte.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type I18nModul = typeof import("../i18n");

// Node sin innebygde localStorage skygger for jsdom sin — bruk en enkel minnelagring
const lager = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lager.get(k) ?? null,
  setItem: (k: string, v: string) => { lager.set(k, String(v)); },
  removeItem: (k: string) => { lager.delete(k); },
  clear: () => { lager.clear(); },
});

async function lastModul(lagret: string | null): Promise<I18nModul> {
  vi.resetModules();
  localStorage.clear();
  if (lagret) localStorage.setItem("sitedoc-language", lagret);
  document.body.style.visibility = "";
  return import("../i18n");
}

describe("lib/i18n — dynamisk språklasting", () => {
  beforeEach(() => { document.documentElement.lang = "nb"; });

  it("lagret språk lastes og aktiveres ved oppstart; andre språk lastes ikke", async () => {
    const m = await lastModul("en");
    await m.spraakKlart;
    expect(m.default.language).toBe("en");
    expect(m.default.hasResourceBundle("en", "translation")).toBe(true);
    expect(m.default.hasResourceBundle("sv", "translation")).toBe(false);
    expect(m.default.t("3d.visObjekterLangtUnna")).toBe("Show distant objects");
    expect(document.documentElement.lang).toBe("en");
  });

  it("nb lagret (eller ingenting): ingen dynamisk lasting, nb aktiv", async () => {
    const m = await lastModul(null);
    await m.spraakKlart;
    expect(m.default.language).toBe("nb");
    expect(m.default.hasResourceBundle("en", "translation")).toBe(false);
    expect(m.default.t("3d.visObjekterLangtUnna")).toBe("Vis objekter langt unna");
  });

  it("ugyldig lagret kode gir nb", async () => {
    const m = await lastModul("xx");
    await m.spraakKlart;
    expect(m.hentLagretSpraak()).toBe("nb");
    expect(m.default.language).toBe("nb");
  });

  it("byttSpraak laster, aktiverer og husker valget", async () => {
    const m = await lastModul(null);
    await m.byttSpraak("de");
    expect(m.default.language).toBe("de");
    expect(m.default.hasResourceBundle("de", "translation")).toBe(true);
    expect(localStorage.getItem("sitedoc-language")).toBe("de");
    expect(document.documentElement.lang).toBe("de");
    await m.byttSpraak("nb");
    expect(m.default.language).toBe("nb");
  });

  it("manglende nøkkel faller tilbake til nb", async () => {
    const m = await lastModul("en");
    await m.spraakKlart;
    m.default.addResource("nb", "translation", "test.kunNorsk", "Bare norsk");
    expect(m.default.t("test.kunNorsk")).toBe("Bare norsk");
  });

  it("venteskriptet skjuler siden bare når lagret språk ikke er nb", async () => {
    const m = await lastModul("fr");
    new Function(m.SPRAAK_VENTER_SKRIPT)();
    expect(document.body.style.visibility).toBe("hidden");
    m.visSiden();
    expect(document.body.style.visibility).toBe("");

    localStorage.setItem("sitedoc-language", "nb");
    new Function(m.SPRAAK_VENTER_SKRIPT)();
    expect(document.body.style.visibility).toBe("");

    localStorage.setItem("sitedoc-language", "xx");
    new Function(m.SPRAAK_VENTER_SKRIPT)();
    expect(document.body.style.visibility).toBe("");
    // i18next overlever vi.resetModules: fr-aktiveringen må bli ferdig her, ellers kan den
    // slå inn midt i neste test under last.
    await m.spraakKlart;
  });

  it("alle 15 språk er velgbare (14 lastere + nb statisk)", async () => {
    const m = await lastModul(null);
    const { SPRAAK_KODER } = await import("@sitedoc/shared");
    for (const kode of SPRAAK_KODER) {
      await m.byttSpraak(kode);
      expect(m.default.language).toBe(kode);
      expect(m.default.hasResourceBundle(kode, "translation")).toBe(true);
    }
  });
});

describe("lib/i18n — vakt", () => {
  const kilde = readFileSync(resolve(__dirname, "../i18n.ts"), "utf-8");

  it("ingen statisk import av språkfiler; nb ligger aldri dynamisk", () => {
    expect(kilde).not.toMatch(/^import\s+\w+\s+from\s+["']@sitedoc\/shared\/src\/i18n\/\w+\.json["']/m);
    expect(kilde).not.toContain('import("@sitedoc/shared/src/i18n/nb.json")');
    expect(kilde.match(/import\("@sitedoc\/shared\/src\/i18n\/\w+\.json"\)/g)).toHaveLength(14);
  });

  it("providers rendrer venteskriptet og viser siden når språket er klart", () => {
    const providers = readFileSync(resolve(__dirname, "../../app/providers.tsx"), "utf-8");
    expect(providers).toContain("<script dangerouslySetInnerHTML={{ __html: SPRAAK_VENTER_SKRIPT }} />");
    expect(providers).toContain("void spraakKlart.then(");
    expect(providers).toContain("visSiden");
  });
});
