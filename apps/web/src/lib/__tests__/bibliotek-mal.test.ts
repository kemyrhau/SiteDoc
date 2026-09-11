import { describe, it, expect } from "vitest";
import { feltTilObjekt, grupperEtterFase, flyttInnenforFase, type BibliotekFelt } from "../bibliotek-mal";

const F = (label: string, fase: string | null, type = "traffic_light"): BibliotekFelt => ({ label, fase, type });

describe("bibliotek-mal — feltredigeringens rene hjelpere", () => {
  describe("feltTilObjekt", () => {
    it("mapper til MalObjekt med syntetisk id og flat parentId", () => {
      const o = feltTilObjekt({ label: "X", type: "decimal", config: { enhet: "mm" } }, 3);
      expect(o).toMatchObject({ id: "felt-3", type: "decimal", label: "X", parentId: null, config: { enhet: "mm" } });
    });
    it("required og config faller tilbake til trygge defaults", () => {
      const o = feltTilObjekt({ label: "Y", type: "text_field" }, 0);
      expect(o.required).toBe(false);
      expect(o.config).toEqual({});
    });
  });

  describe("grupperEtterFase", () => {
    it("grupperer FØR → UNDER → ETTER → uten fase og utelater tomme faser", () => {
      const felter = [F("a", "ETTER"), F("b", "FØR"), F("c", null), F("d", "FØR")];
      const g = grupperEtterFase(felter);
      expect(g.map((x) => x.fase)).toEqual(["FØR", "ETTER", null]);
      // FØR bevarer array-rekkefølgen (b før d) med sine globale indekser
      expect(g[0].felter.map((f) => f.felt.label)).toEqual(["b", "d"]);
      expect(g[0].felter.map((f) => f.indeks)).toEqual([1, 3]);
    });
  });

  describe("flyttInnenforFase", () => {
    it("bytter to naboer i samme fase", () => {
      const felter = [F("a", "FØR"), F("b", "FØR")];
      const nye = flyttInnenforFase(felter, 0, "ned");
      expect(nye.map((f) => f.label)).toEqual(["b", "a"]);
    });
    it("hopper over felt i annen fase når den finner nabo i egen fase", () => {
      // a(FØR), b(ETTER), c(FØR) — flytt c opp skal bytte med a, ikke b.
      const felter = [F("a", "FØR"), F("b", "ETTER"), F("c", "FØR")];
      const nye = flyttInnenforFase(felter, 2, "opp");
      expect(nye.map((f) => f.label)).toEqual(["c", "b", "a"]);
    });
    it("returnerer samme referanse når feltet alt er ytterst i fasen", () => {
      const felter = [F("a", "FØR"), F("b", "ETTER")];
      expect(flyttInnenforFase(felter, 0, "opp")).toBe(felter);
    });
  });
});
