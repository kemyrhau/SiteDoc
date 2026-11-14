import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { gpsForslagLinje } from "./gpsForslagLinje";

/** POST (8) TILLEGG punkt 4 — gul GPS-linje under Byggeplass i Bekreft dag. */

const IDAG = "2026-11-14";
const BYGGEPLASSER = [
  { id: "b1", projectId: "p1", navn: "Byggeplass 1" },
  { id: "b2", projectId: "p1", navn: "Byggeplass 2" },
  { id: "b3", projectId: "p2", navn: "Kaia" },
];
const NAVN: Record<string, string> = { p1: "Prosjekt 1", p2: "Prosjekt 2" };
const linje = (over: Partial<Parameters<typeof gpsForslagLinje>[0]> = {}) =>
  gpsForslagLinje({
    gpsByggeplassId: "b2",
    kortDato: IDAG,
    iDag: IDAG,
    prosjektId: "p1",
    byggeplassId: "b1",
    firmaByggeplasser: BYGGEPLASSER,
    prosjektNavn: (id) => NAVN[id] ?? null,
    ...over,
  });

describe("gpsForslagLinje", () => {
  it("annen byggeplass i samme prosjekt → kun byggeplassnavn", () => {
    expect(linje()).toEqual({ byggeplass: "Byggeplass 2", prosjekt: null });
  });

  it("ingen byggeplass valgt på kortet → linja vises", () => {
    expect(linje({ byggeplassId: null })).toEqual({ byggeplass: "Byggeplass 2", prosjekt: null });
  });

  it("annet prosjekt → byggeplass + prosjekt", () => {
    expect(linje({ gpsByggeplassId: "b3" })).toEqual({ byggeplass: "Kaia", prosjekt: "Prosjekt 2" });
  });

  it("samsvar (samme byggeplass og prosjekt) → skjult", () => {
    expect(linje({ byggeplassId: "b2" })).toBeNull();
  });

  it("ikke i dag → skjult", () => {
    expect(linje({ kortDato: "2026-11-13" })).toBeNull();
  });

  it("intet forslag, eller forslaget finnes ikke i firmaets byggeplasser → skjult", () => {
    expect(linje({ gpsByggeplassId: null })).toBeNull();
    expect(linje({ gpsByggeplassId: "ukjent" })).toBeNull();
  });
});

describe("Bekreft dag bruker Hjems GPS-kilde, kun i manuell modus, uten å endre kortet", () => {
  const her = dirname(fileURLToPath(import.meta.url));
  const BEKREFT = readFileSync(join(her, "../../app/timer/bekreft-dag.tsx"), "utf-8").replace(/\s+/g, " ");

  it("samme kilde som Hjem (ByggeplassKontekst.gpsByggeplassId)", () => {
    expect(BEKREFT).toContain("const { valgtBygningId, gpsByggeplassId } = useByggeplass();");
    expect(BEKREFT).not.toContain("Location.getCurrentPositionAsync");
  });

  it("kun manuell modus, dagens dato, gul tekst", () => {
    expect(BEKREFT).toContain("const gpsLinje = manuell ? gpsForslagLinje({");
    expect(BEKREFT).toContain("iDag: lokalIsoDato(new Date())");
    expect(BEKREFT).toContain('className="text-xs text-amber-600"');
  });
});
