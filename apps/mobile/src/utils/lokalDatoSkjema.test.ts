import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lokalIsoDato } from "./dato";

/**
 * Ordre 2026-11-15 (17) P4: dato-felt autofylles med LOKAL dato, ikke UTC.
 * Europe/Oslo dekker vinter (UTC+1) og sommer (UTC+2) — Node tar TZ-bytte i kjøretid.
 */
const forrigeTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Oslo";
});
afterAll(() => {
  process.env.TZ = forrigeTz;
});

const gammel = (d: Date) => d.toISOString().split("T")[0];

describe("lokalIsoDato i Europe/Oslo", () => {
  it("vinter: 00:30 1. januar er 1. januar (UTC sier 31. desember)", () => {
    const d = new Date(2026, 0, 1, 0, 30);
    expect(lokalIsoDato(d)).toBe("2026-01-01");
    expect(gammel(d)).toBe("2025-12-31"); // negativkontroll: gammel kode gir feil dag
  });

  it("sommer: 01:30 15. juli er 15. juli (UTC sier 14. juli)", () => {
    const d = new Date(2026, 6, 15, 1, 30);
    expect(lokalIsoDato(d)).toBe("2026-07-15");
    expect(gammel(d)).toBe("2026-07-14");
  });

  it("midt på dagen er lik UTC-dato (ingen regresjon)", () => {
    expect(lokalIsoDato(new Date(2026, 10, 15, 12, 0))).toBe("2026-11-15");
  });
});

describe("skjema-hookene autofyller dato lokalt", () => {
  for (const fil of ["../hooks/useOppgaveSkjema.ts", "../hooks/useSjekklisteSkjema.ts"]) {
    it(fil, () => {
      const kilde = readFileSync(resolve(__dirname, fil), "utf8");
      expect(kilde).toContain("autoVerdi = lokalIsoDato(new Date());");
      expect(kilde).not.toContain('toISOString().split("T")[0]');
    });
  }
});
