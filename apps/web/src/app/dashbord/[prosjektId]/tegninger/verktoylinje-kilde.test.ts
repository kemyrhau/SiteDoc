import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Kildevakt, ordre VERKTOYLINJE-IKONER (Kenneth 2026-11-25: «Bytt lange tekster med hover i
 * topplinjen. behold rene iconer heller»). Topplinja på tegningssiden lå på én rad uten wrap,
 * og forelderen har overflow-hidden — verktøyene til høyre ble klippet bort på smal skjerm.
 * (a) raden har flex-wrap som sikkerhetsnett; (b) knappene som før hadde tekst rendrer kun
 * ikon (og antall), med navnet i title + aria-label.
 */
const her = dirname(fileURLToPath(import.meta.url));
const kilde = readFileSync(join(her, "page.tsx"), "utf-8");

function verktøylinjeKlasser(): string {
  const m = kilde.match(/data-testid="tegning-verktoylinje"\s+className="([^"]+)"/);
  if (!m?.[1]) throw new Error("Fant ikke topplinja (data-testid=\"tegning-verktoylinje\") i page.tsx");
  return m[1];
}

/** Kildeutsnittet fra topplinja til admin-knappene (rediger/slett) som avslutter raden. */
function verktøylinjeKilde(): string {
  const start = kilde.indexOf('data-testid="tegning-verktoylinje"');
  const slutt = kilde.indexOf("Rediger tegningsdetaljer + slett", start);
  if (start < 0 || slutt < 0) throw new Error("Fant ikke start/slutt på topplinja i page.tsx");
  return kilde.slice(start, slutt);
}

// i18n-nøkler som før var synlig knappetekst, og som nå bare skal stå i title/aria-label.
const TEKSTNØKLER = [
  "handling.lastNed",
  "maaling.malestokk",
  "maaling.verktoyLinjal",
  "maaling.verktoyPolylinje",
  "maaling.verktoyAreal",
  "maaling.referanselinje",
  "maaling.snap",
  "kontrollplan.lagKontrollpunkter",
  "kontrollplan.lagOppgaver",
  "tegninger.rotertAuto",
  "tegninger.rotert",
];
// Hardkodede knappetekster (klikkemodus) og lange statustekster.
const LITERALER = ["Oppgave", "Inspeksjon", "Område", "Klikk i tegningen for å opprette", "Beveg musen over tegningen"];

describe("tegningssidens topplinje", () => {
  it("(a) bryter til flere linjer (flex-wrap) i stedet for å klippe", () => {
    const klasser = verktøylinjeKlasser().split(/\s+/);
    expect(klasser).toContain("flex");
    expect(klasser).toContain("flex-wrap");
    for (const forbudt of ["flex-nowrap", "overflow-hidden", "overflow-x-auto", "overflow-x-scroll", "overflow-auto"]) {
      expect(klasser).not.toContain(forbudt);
    }
  });

  it("(b) knappene rendrer ikke navnet som synlig tekst-node", () => {
    const blokk = verktøylinjeKilde();
    for (const nøkkel of TEKSTNØKLER) {
      // JSX-barn `>…{t("nøkkel")…}` eller `{t("nøkkel")}` alene på linja = synlig tekst.
      const synlig = new RegExp(String.raw`^\s*\{t\("${nøkkel.replace(/\./g, "\\.")}"[^}]*\)\}`, "m");
      expect(blokk, `synlig tekst for ${nøkkel}`).not.toMatch(synlig);
    }
    for (const tekst of LITERALER) {
      const synlig = new RegExp(String.raw`(^|>)\s*${tekst}\s*($|<)`, "m");
      expect(blokk, `synlig tekst «${tekst}»`).not.toMatch(synlig);
    }
    // Ventemarkøren vises som ikon.
    expect(blokk).toMatch(/<KonverteringMarkorLinje[^>]*visning="ikon"/);
  });

  it("navnet står fortsatt i aria-label for hver ikonknapp", () => {
    const blokk = verktøylinjeKilde();
    for (const nøkkel of ["handling.lastNed", "maaling.verktoyLinjal", "maaling.verktoyPolylinje", "maaling.verktoyAreal", "maaling.referanselinje", "maaling.snap", "maaling.malestokk"]) {
      expect(blokk, `aria-label for ${nøkkel}`).toContain(`aria-label={t("${nøkkel}")}`);
    }
    for (const tekst of ["Oppgave", "Inspeksjon", "Område"]) {
      expect(blokk).toContain(`aria-label="${tekst}"`);
    }
    expect(blokk).toContain('aria-label={`${t("kontrollplan.lagKontrollpunkter")}');
    expect(blokk).toContain('aria-label={`${t("kontrollplan.lagOppgaver")}');
  });

  it("avslagsgrunnen for måleverktøyene står fortsatt i title", () => {
    const blokk = verktøylinjeKilde();
    expect(blokk.match(/kanMaleNaa \? t\("maaling\.verktoy\w+"\) : \(maleAvslagGrunn \?\? ""\)/g)?.length).toBe(3);
  });
});
