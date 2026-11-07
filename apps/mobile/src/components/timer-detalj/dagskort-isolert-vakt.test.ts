import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE 34 — dagskortet (`app/timer/[id].tsx`) isoleres fra Bekreft dag
// (Kenneth 2026-11-07). Nye props på delte komponenter har standard = dagens
// atferd, og dagskortet sender dem aldri. Vakten FEILER hvis noen fører
// Bekreft dag-propsene inn i dagskortet eller snur standardverdien.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const DAGSKORT = les("../../../app/timer/[id].tsx");
const MODAL = les("KortVareforbrukModal.tsx");
const MASKIN = les("MaskinSeksjon.tsx");

const BEKREFT_DAG_PROPS = [
  "forblirApen",
  "fortIDag",
  "overtidValg",
  "overtidFra",
  "overtidLonnsartId",
  "stegOvertidFra",
];

describe("ORDRE 34 — dagskortet er isolert fra Bekreft dag", () => {
  it("negativkontroll: dagskort-kilden er lest og er den riktige fila", () => {
    expect(DAGSKORT.length).toBeGreaterThan(1000);
    expect(DAGSKORT).toContain("ProsjektGruppe");
  });

  it.each(BEKREFT_DAG_PROPS)("🔴 dagskortet bruker ikke «%s»", (navn) => {
    expect(DAGSKORT).not.toContain(navn);
  });

  it("🔴 KortVareforbrukModal: standard forblirApen = false (lukker etter lagre som før)", () => {
    expect(MODAL).toMatch(/forblirApen = false/);
    // Ved «nullstill» returneres FØR onLagret — lukking skjer kun uten forblirApen.
    const flat = MODAL.replace(/\s+/g, " ");
    const blokk = /=== "nullstill"\) \{([^}]*)\}/.exec(flat)?.[1];
    expect(blokk).toBeDefined();
    expect(blokk).toContain("return;");
    expect(blokk).not.toContain("onLagret");
    expect(flat.slice(flat.indexOf('=== "nullstill"'))).toContain("onLagret();");
  });

  it("prosjektkortets MaskinSeksjon har fortsatt mengde (pkt 1b alt. 1 — kun fjernet i Bekreft dag)", () => {
    expect(MASKIN).toContain("mengde");
  });
});
