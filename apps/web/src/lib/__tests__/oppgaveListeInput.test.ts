import { describe, it, expect } from "vitest";
import { oppgaveListeInput } from "../oppgaveListeInput";

describe("oppgaveListeInput — web-oppgavelisten følger toppbaren (TILLEGG ORDRE 28)", () => {
  it("🔴 sender aktiv byggeplass", () => {
    expect(oppgaveListeInput("p1", { id: "bp1" })).toEqual({ projectId: "p1", byggeplassId: "bp1" });
  });

  it("«Hele prosjektet» (ingen aktiv byggeplass) sender ingen byggeplassId", () => {
    expect(oppgaveListeInput("p1", null)).toEqual({ projectId: "p1" });
    expect("byggeplassId" in oppgaveListeInput("p1", undefined)).toBe(false);
  });
});
