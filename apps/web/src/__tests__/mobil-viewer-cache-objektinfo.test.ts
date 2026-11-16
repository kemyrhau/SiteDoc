/**
 * M5 (1): objektinfo på mobil var tom når modellen ble lastet fra fragment-cachen,
 * fordi råfila (som web-ifc leser egenskaper fra) aldri ble lagt inn på cache-veien.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lagRaadataLager, lesAttributter } from "../app/mobil-viewer/ifcRaadata";

/** Utdrag i formen web-ifc `getItemProperties` returnerer (IfcWall). */
const WEBIFC_VEGG = {
  expressID: 1234,
  type: 3512223829,
  GlobalId: { type: 1, value: "2O2Fr$t4X7Zf8NOew3FLOH" },
  Name: { type: 1, value: "Basic Wall:Yttervegg 300" },
  ObjectType: { type: 1, value: "Basic Wall:Yttervegg 300" },
  Description: { type: 1, value: "" },
  Tag: { type: 1, value: "345678" },
  OwnerHistory: { type: 5, value: 42 },
  PredefinedType: null,
};

describe("mobil-viewer: råfil på cache-veien", () => {
  it("tapp før bakgrunnshentingen er ferdig venter på råfila og gir attributter", async () => {
    const lager = lagRaadataLager();
    const ifc = new Uint8Array([73, 83, 79]);
    let slipp!: (d: Uint8Array) => void;
    void lager.hentIBakgrunn("modell-0", () => new Promise<Uint8Array>((r) => { slipp = r; }));

    const tapp = lager.hent("modell-0");
    slipp(ifc);
    const rå = await tapp;
    expect(rå).toBe(ifc);

    // Når råfila finnes, gir egenskapslesingen ikke-tomme attributter
    const attributter = lesAttributter(rå ? WEBIFC_VEGG : null);
    expect(Object.keys(attributter).length).toBeGreaterThan(0);
    expect(attributter.Name).toBe("Basic Wall:Yttervegg 300");
    expect(attributter).not.toHaveProperty("Description"); // tom streng droppes
    expect(attributter).not.toHaveProperty("PredefinedType"); // null droppes
  });

  it("IFC-veien: råfil satt direkte er tilgjengelig", async () => {
    const lager = lagRaadataLager();
    const ifc = new Uint8Array([1]);
    lager.sett("modell-1", ifc);
    expect(await lager.hent("modell-1")).toBe(ifc);
  });

  it("feilet bakgrunnshenting (offline) gir null, ikke unntak", async () => {
    const lager = lagRaadataLager();
    void lager.hentIBakgrunn("modell-2", () => Promise.reject(new Error("HTTP 503")));
    expect(await lager.hent("modell-2")).toBeNull();
  });

  it("ukjent modell gir null", async () => {
    expect(await lagRaadataLager().hent("finnes-ikke")).toBeNull();
  });
});

describe("mobil-viewer: vakt mot at cache-veien mister råfila igjen", () => {
  const kilde = readFileSync(resolve(__dirname, "../app/mobil-viewer/page.tsx"), "utf-8");

  it("cache-veien starter bakgrunnshenting og skjuler rom/åpninger", () => {
    const cacheBlokk = kilde.slice(kilde.indexOf("if (fraCache) {"));
    expect(cacheBlokk).toContain("raadata.hentIBakgrunn(");
    expect(cacheBlokk).toContain("skjulRomOgÅpninger(");
  });

  it("IFC-veien legger råfila i lageret og skjuler rom/åpninger", () => {
    expect(kilde).toContain("raadata.sett(fragModelId, ifcData)");
    expect(kilde).toContain("await skjulRomOgÅpninger(model, ifcData)");
  });

  it("tapp leser råfila via lageret (venter på bakgrunnshenting)", () => {
    expect(kilde).toContain("await raadata.hent(hitModel.modelId)");
  });

  it("fragment-cachen beholdes (rask andre åpning)", () => {
    expect(kilde).toContain("if (cachedFrag) {");
    expect(kilde).toContain('sendTilApp({ type: "cacheFragment", url, data: b64 })');
  });
});
