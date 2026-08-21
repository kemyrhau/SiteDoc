import { describe, it, expect } from "vitest";
import { byggRepeaterTabell } from "./repeater";
import type { TreObjekt } from "../typer";

// MERK: drawing_position-rendering i repeater er FLYTTET til radkort (radkort.test.ts).
// En repeater med drawing_position er per definisjon RIK → radkort, aldri tabell,
// så tabell-cellens drawing_position-gren er fjernet (Kenneth 2026-08-21). Denne
// fila dekker nå kun det helskalare tabell-tilfellet: celle-kommentar (task 3).

// Helskalar repeater (kun text_field) → beholder tabellform (mockup 2b).
const TXT: TreObjekt = {
  id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null,
  children: [{ id: "txt", type: "text_field", label: "Beskrivelse", required: false, config: {}, sortOrder: 0, parentId: "rep", children: [] }],
} as TreObjekt;

describe("byggRepeaterTabell — celle-kommentar (helskalar tabell, task 3)", () => {
  it("celle med kommentar → kommer med (.kommentar), samme form som felt.ts", () => {
    const html = byggRepeaterTabell(
      TXT,
      [{ txt: { verdi: "Vegg", kommentar: "Repeater 1 setter en lokasjon", vedlegg: [] } }],
      TXT.label,
    );
    expect(html).toContain('class="kommentar"');
    expect(html).toContain("Repeater 1 setter en lokasjon");
  });

  it("celle uten kommentar → ingen tom kommentar-node", () => {
    const html = byggRepeaterTabell(
      TXT,
      [{ txt: { verdi: "Vegg", kommentar: "", vedlegg: [] } }],
      TXT.label,
    );
    expect(html).not.toContain('class="kommentar"');
  });

  it("skalar-verdi rendres i cella", () => {
    const html = byggRepeaterTabell(TXT, [{ txt: { verdi: "Vegg tørr", kommentar: "", vedlegg: [] } }], TXT.label);
    expect(html).toContain("Vegg tørr");
  });
});
