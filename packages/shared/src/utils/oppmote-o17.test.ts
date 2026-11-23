/**
 * O17 (vedtak-timer-web.md § Reisevinduet pkt 21–22):
 *  - pkt 21: `kontorReiseRute` kjenner en reise mellom to kontorer på ruten i `reiseRegel.overforing`.
 *  - pkt 22: `planleggAvslutt` — «… fjernes» og kallet regnes fra samme plan (V2: `periodeId`).
 */
import { describe, expect, it } from "vitest";
import { planleggAvslutt, type OverforingPeriode } from "./oppmote";
import { kontorReiseRute } from "./reiseManuell";

const kontor = (id: string) => ({ type: "kontor", oppmotestedId: id });

describe("O17 pkt 21: kontorReiseRute", () => {
  it("kontor ↔ kontor gir begge id-ene", () => {
    expect(kontorReiseRute({ overforing: { fra: kontor("tromso"), til: kontor("narvik"), periodeId: null } })).toEqual({
      fraKontorId: "tromso",
      tilKontorId: "narvik",
    });
  });

  it("kontor → byggeplass (L2) gir null", () => {
    expect(kontorReiseRute({ overforing: { fra: kontor("tromso"), til: { type: "byggeplass", projectId: "p1" } } })).toBeNull();
    expect(kontorReiseRute({ overforing: { fra: { type: "byggeplass", projectId: "p1" }, til: kontor("tromso") } })).toBeNull();
  });

  it("null, streng, manglende eller ugyldig overforing gir null", () => {
    expect(kontorReiseRute(null)).toBeNull();
    expect(kontorReiseRute(undefined)).toBeNull();
    expect(kontorReiseRute("overforing")).toBeNull();
    expect(kontorReiseRute({})).toBeNull();
    expect(kontorReiseRute({ overforing: null })).toBeNull();
    expect(kontorReiseRute({ overforing: { fra: kontor("tromso"), til: { type: "kontor" } } })).toBeNull();
  });
});

describe("O17 pkt 22: planleggAvslutt", () => {
  const p = (id: string, fra: string, til: string | null): OverforingPeriode => ({
    id,
    type: "kontor",
    fast: false,
    oppmotestedId: id === "pA" ? "alta" : "tromso",
    projectId: null,
    fraDato: fra,
    tilDato: til,
    kilde: "overforing",
  });
  const A = p("pA", "2026-11-02", "2026-11-02");
  const B = p("pB", "2026-11-04", null);
  const FAST: OverforingPeriode = { id: "f", type: "kontor", fast: true, oppmotestedId: "narvik", projectId: null, fraDato: "2026-01-01", tilDato: null, kilde: "admin" };
  const perioder = [FAST, A, B];

  it.each(["2026-11-03", "2026-11-02", "2026-11-01"])("Siste dag %s før B starter: B fjernes, kallet gjelder B", (dag) => {
    const r = planleggAvslutt(perioder, dag, "pB");
    expect(r.fjernes?.id).toBe("pB");
    expect(r.kall).toEqual({ handling: "slutt", dato: dag, periodeId: "pB" });
  });

  it("Siste dag 06 (etter start): B lukkes, ingenting fjernes", () => {
    const r = planleggAvslutt(perioder, "2026-11-06", "pB");
    expect(r.fjernes).toBeNull();
    expect(r.kall.periodeId).toBe("pB");
  });

  it("A er aldri med, heller ikke når Siste dag treffer A", () => {
    for (const dag of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-06"]) {
      expect(planleggAvslutt(perioder, dag, "pB").fjernes?.id).not.toBe("pA");
    }
  });
});
