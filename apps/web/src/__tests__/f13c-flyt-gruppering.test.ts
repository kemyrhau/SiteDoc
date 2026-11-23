import { describe, it, expect } from "vitest";
import {
  grupperFlyterPaaFaggruppe,
  finnBerorteFlyter,
} from "../app/dashbord/oppsett/produksjon/_components/flyt-gruppering";

/**
 * F13c (Kenneth 2026-11-23):
 *  - 4A: flyter uten eier-faggruppe vises under «Uten faggruppe» — de ble hoppet over før
 *    (`if (!df.faggruppeId) continue;`), så seedens standardflyter var usynlige (F13b funn A).
 *  - B: slette-modalen viser hvilke flyter og ledd faggruppen står i.
 */

const BYGGHERRE = "fg-byggherre";
const ELEKTRO = "fg-elektro";

const flyter = [
  { id: "f1", name: "Martin rapporterer", faggruppeId: BYGGHERRE, medlemmer: [{ rolle: "bestiller", faggruppe: { id: BYGGHERRE } }] },
  {
    id: "f2",
    name: "HMS-avvik",
    faggruppeId: null,
    medlemmer: [
      { rolle: "bestiller", faggruppe: { id: BYGGHERRE } },
      { rolle: "bestiller", faggruppe: { id: ELEKTRO } },
      { rolle: "utforer", faggruppe: { id: BYGGHERRE } },
    ],
  },
  { id: "f3", name: "Byggherre → Elektro", faggruppeId: null, medlemmer: [{ rolle: "utforer", faggruppe: { id: ELEKTRO } }] },
  {
    id: "f4",
    name: "HMS",
    faggruppeId: null,
    medlemmer: [{ rolle: "bestiller", faggruppe: null }],
    maler: [{ template: { domain: "hms" } }],
  },
];

describe("F13c 4A — «Uten faggruppe»", () => {
  it("🔴 eierløse flyter havner i utenFaggruppe — ingen hoppes over", () => {
    const { perFaggruppe, utenFaggruppe, hmsFlyter } = grupperFlyterPaaFaggruppe(flyter);
    expect(utenFaggruppe.map((f) => f.id)).toEqual(["f2", "f3"]);
    expect(perFaggruppe.get(BYGGHERRE)?.map((f) => f.id)).toEqual(["f1"]);
    const totalt = utenFaggruppe.length + hmsFlyter.length + [...perFaggruppe.values()].reduce((n, l) => n + l.length, 0);
    expect(totalt).toBe(flyter.length);
  });

  it("🔴 F13c-2: HMS-flyten (eierløs, HMS-mal) vises ikke under «Uten faggruppe»", () => {
    const { utenFaggruppe, hmsFlyter } = grupperFlyterPaaFaggruppe(flyter);
    expect(hmsFlyter.map((f) => f.id)).toEqual(["f4"]);
    expect(utenFaggruppe.some((f) => f.id === "f4")).toBe(false);
  });
});

describe("F13c B — berørte flyter i slette-modalen", () => {
  it("🔴 lister eide flyter og ledd med rolle, én rad per flyt", () => {
    const byggherre = finnBerorteFlyter(flyter, BYGGHERRE).map(({ df, roller }) => [df.name, roller]);
    expect(byggherre).toEqual([
      ["Martin rapporterer", ["eier", "bestiller"]],
      ["HMS-avvik", ["bestiller", "utforer"]],
    ]);
    const elektro = finnBerorteFlyter(flyter, ELEKTRO).map(({ df, roller }) => [df.name, roller]);
    expect(elektro).toEqual([
      ["HMS-avvik", ["bestiller"]],
      ["Byggherre → Elektro", ["utforer"]],
    ]);
  });

  it("faggruppe som ikke står i noen flyt gir tom liste", () => {
    expect(finnBerorteFlyter(flyter, "fg-ingen")).toEqual([]);
  });
});
