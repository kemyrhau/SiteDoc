import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE 2026-11-15 (20) punkt 1: opprettelse av sjekkliste/oppgave (sjekklister-, oppgaver- og
 * HMS-siden) sender `opprettByggeplass`/`opprettTegning` (lagret valg, ellers ingen) — ikke
 * `aktivByggeplass`/`standardTegning`, som kan være A1-forvalget (c) «første».
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8");

const SIDER = {
  sjekklister: "[prosjektId]/sjekklister/page.tsx",
  oppgaver: "[prosjektId]/oppgaver/page.tsx",
  hms: "[prosjektId]/hms/page.tsx",
};

describe("web-opprettelse bruker byggeplass uten gjett", () => {
  for (const [navn, sti] of Object.entries(SIDER)) {
    it(`${navn}: opprett-kallene sender opprettByggeplass + opprettTegning`, () => {
      const kilde = les(sti);
      expect(kilde).toContain("byggeplassId: opprettByggeplass?.id,");
      expect(kilde).toContain("drawingId: opprettTegning?.id,");
      // Negativkontroll: visningsverdiene sendes ikke lenger ved opprettelse.
      expect(kilde).not.toContain("byggeplassId: aktivByggeplass?.id,");
      expect(kilde).not.toContain("drawingId: standardTegning?.id,");
    });
  }
});
