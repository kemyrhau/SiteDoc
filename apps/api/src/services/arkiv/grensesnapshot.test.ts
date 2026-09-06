import { describe, it, expect } from "vitest";
import { injiserGrenseSnapshot } from "./grensesnapshot";
import type { TreObjekt, FeltVerdi } from "@sitedoc/pdf";

const obj = (
  id: string,
  type: string,
  config: Record<string, unknown> = {},
  children: TreObjekt[] = [],
): TreObjekt =>
  ({ id, type, label: id, required: false, config, sortOrder: 0, parentId: null, children }) as TreObjekt;
const fv = (verdi: unknown): FeltVerdi => ({ verdi, kommentar: "", vedlegg: [] });

describe("injiserGrenseSnapshot — kravsnapshot sidestilt med verdi", () => {
  it("rot-felt med grense: {kravTekst, status} injiseres, verdi urørt", () => {
    const felt = obj("h", "decimal", { maks: 10, enhet: "mm", kravType: "hoyst" });
    const data: Record<string, FeltVerdi> = { h: fv(14) };
    injiserGrenseSnapshot([felt], data);
    expect(data.h!.verdi).toBe(14); // verdi aldri rørt
    expect(data.h!.grenseSnapshot).toEqual({
      kravTekst: "≤ 10 mm",
      status: "over",
      avvikTekst: "Avvik: 4 mm over krav",
    });
  });

  it("tomt felt med grense: kravet snapshotes likevel (F7), status null", () => {
    const felt = obj("h", "integer", { maks: 15, enhet: "mm" });
    const data: Record<string, FeltVerdi> = { h: fv(null) };
    injiserGrenseSnapshot([felt], data);
    expect(data.h!.grenseSnapshot).toEqual({ kravTekst: "≤ 15 mm", status: null });
  });

  it("felt uten grense: intet snapshot", () => {
    const felt = obj("t", "integer", { enhet: "stk" });
    const data: Record<string, FeltVerdi> = { t: fv(3) };
    injiserGrenseSnapshot([felt], data);
    expect(data.t!.grenseSnapshot).toBeUndefined();
  });

  it("frosset snapshot (del B) vinner — rekonstruerer ikke over", () => {
    const felt = obj("h", "decimal", { maks: 10, enhet: "mm" });
    const data: Record<string, FeltVerdi> = {
      h: { ...fv(14), grenseSnapshot: { kravTekst: "≤ 99 mm", status: "ok" } },
    };
    injiserGrenseSnapshot([felt], data);
    expect(data.h!.grenseSnapshot).toEqual({ kravTekst: "≤ 99 mm", status: "ok" });
  });

  it("Vei B: styrende felts verdi løser grensen per rad", () => {
    const styrende = obj("u", "list_single", { options: ["pukk", "sprengstein"] });
    const tall = obj("h", "decimal", {
      maks: 10,
      enhet: "mm",
      styrendeFeltId: "u",
      grenseVarianter: [{ valg: "sprengstein", maks: 25 }],
    });
    const data: Record<string, FeltVerdi> = { u: fv("sprengstein"), h: fv(20) };
    injiserGrenseSnapshot([styrende, tall], data);
    // 20 mot variant-maks 25 → innenfor
    expect(data.h!.grenseSnapshot).toEqual({ kravTekst: "≤ 25 mm", status: "ok" });
  });

  it("repeater-rader: snapshot per rad, styrende søsken i samme rad", () => {
    const styrende = obj("u", "list_single", { options: ["pukk", "sprengstein"] });
    const tall = obj("h", "decimal", {
      maks: 10,
      enhet: "mm",
      styrendeFeltId: "u",
      grenseVarianter: [{ valg: "sprengstein", maks: 25 }],
    });
    const rep = obj("rep", "repeater", {}, [styrende, tall]);
    const data: Record<string, FeltVerdi> = {
      rep: fv([
        { _radId: "r1", felter: { u: fv("pukk"), h: fv(14) } }, // 14 > 10 → over
        { _radId: "r2", felter: { u: fv("sprengstein"), h: fv(20) } }, // 20 < 25 → ok
      ]),
    };
    injiserGrenseSnapshot([rep], data);
    const rader = data.rep!.verdi as Array<{ felter: Record<string, FeltVerdi> }>;
    expect(rader[0]!.felter.h!.grenseSnapshot).toEqual({
      kravTekst: "≤ 10 mm",
      status: "over",
      avvikTekst: "Avvik: 4 mm over krav",
    });
    expect(rader[1]!.felter.h!.grenseSnapshot).toEqual({ kravTekst: "≤ 25 mm", status: "ok" });
  });
});
