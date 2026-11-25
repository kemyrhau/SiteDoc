import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Gate (85) M3 — 3d-visning har ?-hjelp som forklarer mus, snitt og objekter langt unna. */
const side = readFileSync(resolve(__dirname, "../../app/dashbord/[prosjektId]/3d-visning/page.tsx"), "utf8");
const nb = JSON.parse(readFileSync(resolve(__dirname, "../../../../../packages/shared/src/i18n/nb.json"), "utf8")) as Record<string, string>;
const en = JSON.parse(readFileSync(resolve(__dirname, "../../../../../packages/shared/src/i18n/en.json"), "utf8")) as Record<string, string>;

const NOKLER = [
  "3d.hjelp.hvaTittel", "3d.hjelp.hva", "3d.hjelp.musTittel", "3d.hjelp.venstre", "3d.hjelp.hoyre",
  "3d.hjelp.hjul", "3d.hjelp.snittTittel", "3d.hjelp.snitt", "3d.hjelp.langtUnnaTittel", "3d.hjelp.langtUnna",
  "3d.hjelp.skjulTittel", "3d.hjelp.skjul",
];

describe("?-hjelp på 3d-visning", () => {
  it("siden rendrer HjelpKnapp med alle hjelpenøklene", () => {
    expect(side).toContain('import { HjelpFane, HjelpKnapp } from "@/components/hjelp/HjelpModal";');
    expect(side).toContain("<HjelpKnapp>");
    for (const k of NOKLER) expect(side).toContain(`t("${k}")`);
  });

  it("nøklene finnes på nb og en", () => {
    for (const k of NOKLER) {
      expect(nb[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it("forklarer objekter langt unna: langt fra bygget, ofte feil-eksport, skjult som standard, bryterens navn", () => {
    const tekst = nb["3d.hjelp.langtUnna"]!;
    expect(tekst).toContain("langt fra bygget");
    expect(tekst).toContain("skjult som standard");
    expect(tekst).toContain("eksporten fra arkitektens tegning");
    expect(tekst).toContain(`«${nb["3d.visObjekterLangtUnna"]}»`);
  });

  it("forklarer rotasjon og zoom rundt skjermmidten", () => {
    expect(nb["3d.hjelp.venstre"]).toContain("midt på skjermen");
    expect(nb["3d.hjelp.hjul"]).toContain("midten av skjermen");
  });
});
