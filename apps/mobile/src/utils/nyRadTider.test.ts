import { describe, it, expect } from "vitest";
import { nyRadTider } from "./nyRadTider";

// ORDRE 36c del B — reise fra dag-seksjonen får ingen foreslått sluttid.
const effektiv = { startTid: "07:00", sluttTid: "15:00" };

describe("nyRadTider", () => {
  it("ny arbeidsrad uten rader: firmaets start og slutt (som før)", () => {
    expect(nyRadTider({ reise: false, tilTider: [], effektiv })).toEqual({ fra: "07:00", til: "15:00" });
  });

  it("ny arbeidsrad: fra = seneste tilTid uansett rekkefølge (som før)", () => {
    expect(nyRadTider({ reise: false, tilTider: ["11:00", null, "09:30"], effektiv })).toEqual({
      fra: "11:00",
      til: "15:00",
    });
  });

  it("🔴 reise: fra som før, til = null (ingen firmaslutt)", () => {
    expect(nyRadTider({ reise: true, tilTider: [], effektiv })).toEqual({ fra: "07:00", til: null });
    expect(nyRadTider({ reise: true, tilTider: ["15:00"], effektiv })).toEqual({ fra: "15:00", til: null });
  });

  it("negativkontroll: samme input uten reise gir sluttid — flagget er det som skiller", () => {
    const a = nyRadTider({ reise: true, tilTider: ["12:00"], effektiv });
    const b = nyRadTider({ reise: false, tilTider: ["12:00"], effektiv });
    expect(a.fra).toBe(b.fra);
    expect(a.til).toBeNull();
    expect(b.til).toBe("15:00");
  });
});
