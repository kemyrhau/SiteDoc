import { describe, it, expect } from "vitest";
import { maaltAnkomst, type MaaltBesok } from "./maaltArbeidstid";

// Ordre 2026-11-15 (17) punkt 3: målt ankomst fra arbeidsdag_besok_local.
const lokal = (dato: string, tid: string) => new Date(`${dato}T${tid}:00`).toISOString();
const DATO = "2026-11-16";

const besok = (p: Partial<MaaltBesok>): MaaltBesok => ({
  byggeplassId: "bp1",
  ankomstAt: lokal(DATO, "10:40"),
  avreiseAt: null,
  kilde: "gps_forslag",
  ...p,
});

describe("maaltAnkomst", () => {
  it("første byggeplass-besøk etter Start dag er målt ankomst, med kilden", () => {
    const res = maaltAnkomst(
      [
        besok({ byggeplassId: null, ankomstAt: lokal(DATO, "06:30"), kilde: "start_dag" }),
        besok({}),
        besok({ ankomstAt: lokal(DATO, "13:00"), kilde: "manuell" }),
      ],
      DATO,
    );
    expect(res).toEqual({ tid: "10:40", kilde: "gps_forslag" });
  });

  it("Start dag på byggeplassen er ingen ankomst (ingen reise å måle)", () => {
    expect(maaltAnkomst([besok({ kilde: "start_dag" })], DATO)).toBeNull();
  });

  it("utenfor kjent byggeplass og annen dato teller ikke", () => {
    expect(
      maaltAnkomst(
        [besok({ byggeplassId: null }), besok({ ankomstAt: lokal("2026-11-17", "08:00") })],
        DATO,
      ),
    ).toBeNull();
  });
});
