import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Ordre 2026-11-14 (6) RETUR 1: maskinlinja «Maskin X t» (`timer.gruppe.maskin`)
// er nøytral i alle tilstander på de fem flatene — ingen rød/grønn og ingen
// varseltekst, heller ikke ved brudd. Sperren mot maskin over arbeid står i
// rad-modalene og røres ikke her. FEILER om rød/grønn farge, en betinget
// className eller «maskinOverstiger» kommer tilbake i blokken rundt linja.

function les(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf-8");
}

const flater: [string, string][] = [
  ["web EcoGruppe (timer/[id]/page.tsx)", "../app/dashbord/timer/[id]/page.tsx"],
  ["web attestering-buckets", "../components/attestering/attestering-buckets.tsx"],
  ["web SeddelKort", "../components/attestering/SeddelKort.tsx"],
  ["web AttesteringDetalj_Edit", "../components/timer/AttesteringDetalj_Edit.tsx"],
  [
    "mobil ProsjektGruppe",
    "../../../mobile/src/components/timer-detalj/ProsjektGruppe.tsx",
  ],
];

/** Blokken fra `sumMaskin > 0 &&` til og med linja med maskin-nøkkelen. */
function maskinBlokk(kilde: string): string {
  const nokkel = kilde.indexOf('t("timer.gruppe.maskin"');
  expect(nokkel).toBeGreaterThan(-1);
  const start = kilde.lastIndexOf("sumMaskin > 0", nokkel);
  expect(start).toBeGreaterThan(-1);
  expect(nokkel - start).toBeLessThan(600);
  const slutt = kilde.indexOf("\n", nokkel);
  return kilde.slice(start, slutt);
}

describe("RETUR 1 — maskinlinja er nøytral på alle fem flater", () => {
  for (const [navn, sti] of flater) {
    it(`${navn}: ingen rød/grønn, ingen betinget farge, ingen varseltekst`, () => {
      const blokk = maskinBlokk(les(sti));
      expect(blokk).not.toMatch(/\b(bg|text|border)-(red|green|emerald|rose)-/);
      expect(blokk).not.toContain("maskinOverstiger");
      expect(blokk).not.toMatch(/maskinOk|overstigerMaskinTak/);
      // Ingen ternær i className — fargen skal ikke avhenge av tilstand.
      expect(blokk).not.toMatch(/className=\{[^}]*\?/);
      // Positiv kontroll: linja bærer den nøytrale grå teksten.
      expect(blokk).toContain("text-gray-700");
    });
  }
});
