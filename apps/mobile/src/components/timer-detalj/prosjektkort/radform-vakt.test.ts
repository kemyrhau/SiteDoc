import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Radform (godkjent plan «Dagsoversikt i radform», 2026-11-12). Mobil har
// ingen renderer — at skjermen bruker de rene funksjonene vaktes i kilden.

const her = dirname(fileURLToPath(import.meta.url));
const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const OVERSIKT = utenKommentarer(readFileSync(join(her, "ProsjektkortDagsoversikt.tsx"), "utf-8"));

/** Innholdet i `{ … }` som starter ved `start` (klammeparentes-matching). */
function blokk(kilde: string, start: string): string {
  const i = kilde.indexOf(start);
  if (i < 0) return "";
  let dybde = 0;
  for (let j = i + start.length - 1; j < kilde.length; j++) {
    if (kilde[j] === "{") dybde++;
    else if (kilde[j] === "}" && --dybde === 0) return kilde.slice(i, j + 1);
  }
  return "";
}

/** M10: overtid-delen fra V21-forslaget må faktisk lagres som ny rad. */
function overtidDelLagres(kilde: string): boolean {
  const b = blokk(kilde, "onLeggTilOvertidDel={");
  return /\bleggTilTimerRad\(\s*db\(\)/.test(b) && !/\bvoid\s+leggTilTimerRad/.test(b);
}

describe("radform — kildevakter", () => {
  it("M10: onLeggTilOvertidDel kaller leggTilTimerRad, og dagsnormTimer sendes", () => {
    expect(overtidDelLagres(OVERSIKT)).toBe(true);
    expect(OVERSIKT).toContain("dagsnormTimer={normTimer}");
  });

  it("M10 negativkontroll: kallet byttet til void → vakta feiler", () => {
    const mutert = OVERSIKT.replace(
      /(onLeggTilOvertidDel=\{[\s\S]*?)leggTilTimerRad\(/,
      "$1void (",
    );
    expect(mutert).not.toBe(OVERSIKT);
    expect(overtidDelLagres(mutert)).toBe(false);
    expect(overtidDelLagres(OVERSIKT.replace("onLeggTilOvertidDel={", "onX={"))).toBe(false);
  });

  it("radene bygges av raderForDag; ingen gammel prosjekt-oppsummering", () => {
    expect(OVERSIKT).toMatch(/raderForDag\(\{/);
    expect(OVERSIKT).toContain("function radBoks(");
    expect(OVERSIKT).not.toContain("linjer.overtid.map(");
  });

  it("vare-føring fra en rad kobler til raden; kortLaas står", () => {
    expect(OVERSIKT).toContain("sheetTimerId={vareRadId}");
    expect(OVERSIKT).toContain(
      "kortLaas={{ byggeplassId: vareByggeplassForKort(vareKort), ecoId: vareKort.ecoId }}",
    );
  });

  it("Send sperres og peker til raden som mangler beskrivelse", () => {
    expect(OVERSIKT).toMatch(/forsteRadUtenBeskrivelse\(dag\.rader\.map/);
    expect(OVERSIKT).toMatch(/manglerBeskrivelse\s*\?\s*aapneTimer\(kortFor\.timer\.get\(manglerBeskrivelse\.id\)!, manglerBeskrivelse\.id, true\)\s*:\s*onSend\?\.\(\)/);
  });
});
