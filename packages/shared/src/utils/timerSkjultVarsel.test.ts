import { describe, it, expect } from "vitest";
import { skalVarsleSkjulteTimer } from "./timerSkjultVarsel";

describe("skalVarsleSkjulteTimer — TILLEGG (14)", () => {
  it("🔴 sitedoc_admin uten ansettelse i valgt firma → varsel", () => {
    expect(skalVarsleSkjulteTimer({ rolle: "sitedoc_admin", erAnsatt: false })).toBe(true);
  });
  it("sitedoc_admin som er ansatt → ingen varsel", () => {
    expect(skalVarsleSkjulteTimer({ rolle: "sitedoc_admin", erAnsatt: true })).toBe(false);
  });
  it("vanlig bruker / company_admin uten ansettelse → ingen varsel", () => {
    expect(skalVarsleSkjulteTimer({ rolle: "user", erAnsatt: false })).toBe(false);
    expect(skalVarsleSkjulteTimer({ rolle: "company_admin", erAnsatt: false })).toBe(false);
  });
  it("ukjent rolle eller ansatt-status → ingen varsel", () => {
    expect(skalVarsleSkjulteTimer({ rolle: undefined, erAnsatt: false })).toBe(false);
    expect(skalVarsleSkjulteTimer({ rolle: "sitedoc_admin", erAnsatt: null })).toBe(false);
  });
});
