import { describe, it, expect } from "vitest";
import { tilOppgaveVisning } from "./oppgaveVisning";

/**
 * Ordre 2026-11-03 (5): emnet ble lagret (`oppgave.oppdater`), men oppgaveskjermen viste alltid
 * «Legg til emne» fordi `useOppgaveSkjema` ikke tok `subject` med i returobjektet.
 *
 * Rød før fiksen: `subject` mangler i det mappede objektet.
 */

const SERVERSVAR = {
  id: "oppg-1",
  title: "Fuge i bad",
  status: "sent",
  priority: "medium",
  description: null,
  number: 26,
  subject: "3. etasje",
  data: { felt: 1 },
  template: { id: "mal-1", name: "BEF", prefix: "BEF", objects: [], showSubject: true, subjects: ["3. etasje"] },
  bestillerFaggruppe: { id: "fg-1", name: "Tømrer" },
  utforerFaggruppe: null,
  drawing: null,
  checklist: null,
};

describe("tilOppgaveVisning", () => {
  it("🔴 tar med emnet (subject)", () => {
    expect(tilOppgaveVisning(SERVERSVAR).subject).toBe("3. etasje");
  });

  it("🔴 emne som er null forblir null (ikke udefinert)", () => {
    expect(tilOppgaveVisning({ ...SERVERSVAR, subject: null })).toHaveProperty("subject", null);
  });

  it("offline-speilet (JSON-rundtur av hele svaret) gir samme emne", () => {
    const speil = JSON.parse(JSON.stringify(SERVERSVAR)) as typeof SERVERSVAR;
    expect(tilOppgaveVisning(speil).subject).toBe("3. etasje");
  });

  it("negativkontroll: øvrige felt består, malen med showSubject/subjects følger hel", () => {
    const v = tilOppgaveVisning(SERVERSVAR);
    expect(v).toMatchObject({ id: "oppg-1", title: "Fuge i bad", number: 26, status: "sent" });
    expect(v.template).toEqual(SERVERSVAR.template);
    expect(v).not.toHaveProperty("data");
  });
});
