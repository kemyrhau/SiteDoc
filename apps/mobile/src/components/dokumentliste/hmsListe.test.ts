import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { byggAlternativer, visFilterKolonne, type DokumentRad } from "./dokumentlisteFilter";
import { filterForFane, harPrioritet, tilHmsDokumentRad } from "./hmsListe";

/**
 * Filter-hms (2026-11-03): HMS-lista får filterarket. Låser
 *  - adaptive alternativer per fane (SJA har ingen prioritet),
 *  - at et prioritetsfilter ikke tømmer SJA-fanen stille,
 *  - toleranse mot eldre API: uten de nye feltene skjules filtrene (vis-regelen ≥ 2).
 */

function rad(over: Partial<DokumentRad> & { id: string }): DokumentRad {
  return {
    title: `Dok ${over.id}`,
    status: "sent",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    template: { name: "Avvik", prefix: "AVV" },
    bestillerFaggruppe: { name: "Tømrer" },
    ...over,
  };
}

/** Kolonnene arket viser for en fane, slik FilterOgSorteringSheet avgjør det. */
function synligeKolonner(rader: DokumentRad[], visPrioritet: boolean): string[] {
  const alt = byggAlternativer(rader);
  const kandidater: Array<[string, { value: string; label: string }[]]> = [
    ["emne", alt.emne],
    ["tegning", alt.tegning],
    ["utforerFaggruppe", alt.utforerFaggruppe],
    ...(visPrioritet ? ([["prioritet", alt.prioritet]] as Array<[string, { value: string; label: string }[]]>) : []),
  ];
  return kandidater.filter(([k, a]) => visFilterKolonne(k, a, {})).map(([k]) => k);
}

describe("hmsListe — prioritet per fane", () => {
  it("bare avvik og RUH har prioritet", () => {
    expect(harPrioritet("avvik")).toBe(true);
    expect(harPrioritet("ruh")).toBe(true);
    expect(harPrioritet("sja")).toBe(false);
  });

  it("prioritetsfilteret gjelder ikke i SJA, men står igjen for avvik/RUH", () => {
    const filter = { prioritet: "high", emne: "Fall" };
    expect(filterForFane(filter, "sja")).toEqual({ emne: "Fall" });
    expect(filterForFane(filter, "avvik")).toBe(filter);
    expect(filterForFane(filter, "ruh")).toBe(filter);
    const utenPrio = { emne: "Fall" };
    expect(filterForFane(utenPrio, "sja")).toBe(utenPrio);
  });
});

describe("hmsListe — adaptive alternativer per fane", () => {
  const nyttApi = [
    rad({ id: "1", subject: "Fall", priority: "high", drawing: { name: "Plan 1" }, utforerFaggruppe: { name: "Stillas" } }),
    rad({ id: "2", subject: "Brann", priority: "low", drawing: { name: "Plan 2" }, utforerFaggruppe: { name: "Elektro" } }),
  ];

  it("nytt API: emne, tegning, utførende og prioritet vises i avvik/RUH", () => {
    expect(synligeKolonner(nyttApi, harPrioritet("avvik"))).toEqual(["emne", "tegning", "utforerFaggruppe", "prioritet"]);
  });

  it("SJA: prioritet vises aldri, selv om radene skulle hatt verdier", () => {
    expect(synligeKolonner(nyttApi, harPrioritet("sja"))).not.toContain("prioritet");
    const sja = nyttApi.map((r) => ({ ...r, priority: undefined }));
    expect(byggAlternativer(sja).prioritet).toEqual([]);
  });

  it("🔴 eldre API (feltene mangler) → filtrene skjules stille", () => {
    const gammeltApi = [rad({ id: "1" }), rad({ id: "2", status: "draft" })];
    expect(synligeKolonner(gammeltApi, true)).toEqual([]);
    // Emne har bare «Uten emne» (én verdi), prioritet/tegning/utførende ingen.
    const alt = byggAlternativer(gammeltApi);
    expect(alt.emne).toHaveLength(1);
    expect(alt.prioritet).toEqual([]);
    expect(alt.tegning).toEqual([]);
    expect(alt.utforerFaggruppe).toEqual([]);
  });

  it("et satt filter vises fortsatt selv uten alternativer (kan nullstilles)", () => {
    expect(visFilterKolonne("emne", [], { emne: "Fall" })).toBe(true);
    expect(visFilterKolonne("emne", [], {})).toBe(false);
  });
});

describe("hmsListe — server-rad → DokumentRad", () => {
  it("recipientGroupId utledes fra recipientGroup.id («ballen hos meg» for gruppe)", () => {
    const r = tilHmsDokumentRad({ ...rad({ id: "1" }), recipientGroup: { id: "g1", name: "HMS" } });
    expect(r.recipientGroupId).toBe("g1");
  });

  it("lokal rad uten id og rad med id fra før står urørt", () => {
    const lokal = { ...rad({ id: "1" }), recipientGroup: { name: "HMS" } };
    expect(tilHmsDokumentRad(lokal)).toBe(lokal);
    const medId = { ...rad({ id: "2" }), recipientGroupId: "g9", recipientGroup: { id: "g1", name: "HMS" } };
    expect(tilHmsDokumentRad(medId).recipientGroupId).toBe("g9");
  });
});
