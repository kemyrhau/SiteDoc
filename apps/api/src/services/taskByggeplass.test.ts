import { describe, it, expect } from "vitest";
import { velgTaskByggeplass } from "./taskByggeplass";

const HABU = "11111111-1111-1111-1111-111111111111";
const ANNEN = "22222222-2222-2222-2222-222222222222";

describe("velgTaskByggeplass (ORDRE 28)", () => {
  it("🔴 opprett uten tegning med aktiv byggeplass → byggeplassen settes (BEF-029)", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: HABU })).toBe(HABU);
  });

  it("tegningens byggeplass vinner over klientens valg ved konflikt", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: ANNEN, oensket: HABU })).toBe(ANNEN);
  });

  it("prosjekt-tegning (uten byggeplass) → klientens valg", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: HABU, naavaerende: ANNEN })).toBe(HABU);
  });

  it("eksplisitt null fra klienten = hele prosjektet", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: null, naavaerende: HABU })).toBeNull();
  });

  it("ikke rørt → arv fra sjekkliste, så dagens verdi", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: undefined, arvet: HABU })).toBe(HABU);
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: undefined, naavaerende: ANNEN })).toBe(ANNEN);
    expect(velgTaskByggeplass({ tegningensByggeplassId: null, oensket: undefined })).toBeNull();
  });

  it("tegningsbytte flytter byggeplassen til ny tegnings byggeplass", () => {
    expect(velgTaskByggeplass({ tegningensByggeplassId: ANNEN, oensket: undefined, naavaerende: HABU })).toBe(ANNEN);
  });
});
