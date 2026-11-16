import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * C4 (Redesign 2026-11-13, plan § 8): ventende auto-lagring i sjekkliste- og
 * oppgaveskjema skrives synkront til SQLite ved unmount og når appen går i
 * bakgrunnen. Kildevakter med negativkontroll pr. regex (V7 sjekkliste, V8 oppgave).
 */

function utenKommentarer(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const her = path.dirname(fileURLToPath(import.meta.url));
const les = (fil: string) => utenKommentarer(readFileSync(path.resolve(her, fil), "utf8"));

function vakter(kilde: string, idn: string) {
  function vakt(re: RegExp, [fra, til]: [string, string]) {
    expect(kilde).toMatch(re);
    expect(kilde.includes(fra)).toBe(true);
    expect(kilde.replace(fra, til)).not.toMatch(re);
  }
  // Flush: nuller ventende timer og skriver den synkrone delen (usynket).
  vakt(
    new RegExp(
      String.raw`const flushVentende = \(\): boolean => \{\s*if \(!lagreTimerRef\.current\) return false;\s*clearTimeout\(lagreTimerRef\.current\);\s*lagreTimerRef\.current = null;[\s\S]{0,80}?skrivTilSQLite\(${idn}, lagreUtvalg\(feltVerdierRef\.current, basisRef\.current\)\.data, false\);`,
    ),
    ["lagreTimerRef.current = null;\n      if (!", "if (!"],
  );
  // Bakgrunn: AppState ≠ active flusher og lar «nett tilbake»-effekten synke.
  vakt(
    /AppState\.addEventListener\("change", \(tilstand\) => \{\s*if \(tilstand !== "active" && flushVentende\(\)\) settSynkStatus\("lokalt_lagret"\);/,
    ['if (tilstand !== "active" && flushVentende())', 'if (tilstand === "aldri" && flushVentende())'],
  );
  // Unmount: lytteren fjernes og ventende endring flushes (uten setState).
  vakt(/return \(\) => \{\s*abonnement\.remove\(\);\s*flushVentende\(\);\s*\};\s*\}, \[/, [
    "abonnement.remove();\n      flushVentende();",
    "abonnement.remove();",
  ]);
}

describe("C4: flush av ventende auto-lagring", () => {
  it("🔴 V7: useSjekklisteSkjema flusher ved unmount og bakgrunn", () => {
    vakter(les("./useSjekklisteSkjema.ts"), "sjekklisteId");
  });
  it("🔴 V8: useOppgaveSkjema flusher ved unmount og bakgrunn", () => {
    vakter(les("./useOppgaveSkjema.ts"), "oppgaveId");
  });
});
