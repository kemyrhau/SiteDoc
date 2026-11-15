import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { datoInputVerdi } from "./datoInput";

/** Ordre 2026-11-15 (17) P4: dato-input i skjema viser lokal dato, ikke UTC. */
const forrigeTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Oslo";
});
afterAll(() => {
  process.env.TZ = forrigeTz;
});

describe("datoInputVerdi i Europe/Oslo", () => {
  it("vinter 00:30 lokal → samme dag (gammel kode: gårsdagen)", () => {
    const iso = new Date(2026, 0, 1, 0, 30).toISOString(); // 2025-12-31T23:30Z
    expect(datoInputVerdi(iso)).toBe("2026-01-01");
    expect(iso.split("T")[0]).toBe("2025-12-31"); // negativkontroll
  });

  it("sommer 01:30 lokal → samme dag (gammel kode: gårsdagen)", () => {
    const iso = new Date(2026, 6, 15, 1, 30).toISOString(); // 2026-07-14T23:30Z
    expect(datoInputVerdi(iso)).toBe("2026-07-15");
    expect(iso.split("T")[0]).toBe("2026-07-14");
  });

  it("ren YYYY-MM-DD (mobil-autofyll) brukes uendret", () => {
    expect(datoInputVerdi("2026-11-15")).toBe("2026-11-15");
  });

  it("tom/ugyldig → tom streng", () => {
    expect(datoInputVerdi(null)).toBe("");
    expect(datoInputVerdi("")).toBe("");
    expect(datoInputVerdi("tull")).toBe("");
  });

  it("Dato- og DatoTid-objektet bruker hjelperen, ikke UTC-dato", () => {
    for (const fil of ["DatoObjekt.tsx", "DatoTidObjekt.tsx"]) {
      const kilde = readFileSync(resolve(__dirname, fil), "utf8");
      expect(kilde).toContain("datoInputVerdi(verdi)");
      expect(kilde).not.toContain('toISOString().split("T")[0]');
    }
  });
});
