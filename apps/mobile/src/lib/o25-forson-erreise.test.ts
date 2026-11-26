import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import { byggForsonInputFraValg, type ForsonRad as DeltForsonRad } from "@sitedoc/shared";

// O25 RETUR (Kenneth 2026-11-26): «reise må registreres som reise, uavhengig av hva firmaet
// velger som lønnsart». Mobilens forsoning må bære radens `erReise` til `forsonDagskort`,
// ellers lagrer serveren en beholdt «+ Reise»-rad som arbeid.
//
// Mappingene er modul-lokale i dagskortet (`app/timer/[id].tsx`) og prosjektkortet
// (`useProsjektkortSedel.ts`), to bevisste kopier. Testen henter funksjonene ut av KILDEN,
// transpilerer dem og kjører dem — så begge kopiene måles på atferd, ikke på tekst.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const KILDER = {
  dagskort: les("../../app/timer/[id].tsx"),
  prosjektkort: les("../components/timer-detalj/prosjektkort/useProsjektkortSedel.ts"),
};

/** Klipper ut `function navn(...) {...}` med balanserte klammer og gjør den kjørbar. */
function hentFunksjon(kilde: string, navn: string): (...a: unknown[]) => Record<string, unknown> | null {
  const start = kilde.indexOf(`function ${navn}(`);
  if (start < 0) throw new Error(`fant ikke ${navn}`);
  const kropp = kilde.indexOf("{", kilde.indexOf(")", start));
  let dybde = 0;
  let slutt = kropp;
  for (; slutt < kilde.length; slutt++) {
    if (kilde[slutt] === "{") dybde++;
    else if (kilde[slutt] === "}" && --dybde === 0) break;
  }
  const js = ts.transpileModule(kilde.slice(start, slutt + 1), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(`${js}\nreturn ${navn};`)() as (...a: unknown[]) => Record<string, unknown> | null;
}

const lokalReise = {
  id: "lokal-1",
  projectId: "p1",
  byggeplassId: null,
  lonnsartId: "timelonn",
  aktivitetId: "a1",
  timer: 1,
  fraTid: "06:00",
  tilTid: "07:00",
  beskrivelse: null,
  externalCostObjectId: null,
  erReise: true,
  reiseKilde: "manuell",
};

const forslagReise = {
  id: "forslag-1",
  projectId: "p1",
  byggeplassId: null,
  lonnsartId: "timelonn",
  aktivitetId: "a1",
  timer: "1",
  fraTid: "06:00",
  tilTid: "07:00",
  beskrivelse: null,
  externalCostObjectId: null,
  vehicleId: null,
  grunn: null,
  erReise: true,
};

describe.each(Object.entries(KILDER))("O25 RETUR — forson bærer erReise (%s)", (_navn, kilde) => {
  const lokalRadTilForson = hentFunksjon(kilde, "lokalRadTilForson");
  const raaTilForsonRad = hentFunksjon(kilde, "raaTilForsonRad");

  it("U-BEKREFT: en beholdt lokal «+ Reise»-rad gir erReise: true i forson-kallet", () => {
    expect(lokalRadTilForson(lokalReise)?.erReise).toBe(true);
  });

  it("U-BEKREFT: lokal rad uten flagg men med reisespor er reise; uten spor er arbeid", () => {
    expect(lokalRadTilForson({ ...lokalReise, erReise: null })?.erReise).toBe(true);
    expect(lokalRadTilForson({ ...lokalReise, erReise: null, reiseKilde: null })?.erReise).toBe(false);
    expect(lokalRadTilForson({ ...lokalReise, erReise: false, reiseKilde: null })?.erReise).toBe(false);
  });

  it("overlapp: et forslag med erReise: true gir erReise: true i forson-kallet", () => {
    const forslag = raaTilForsonRad(forslagReise) as unknown as DeltForsonRad;
    const input = byggForsonInputFraValg([], [forslag], { "forslag-1": "forslag" });
    expect(input.nyeRader).toHaveLength(1);
    expect(input.nyeRader[0]!.erReise).toBe(true);
  });

  it("overlapp: et forslag uten flagg sender ikke erReise (serveren beholder/gir false)", () => {
    const forslag = raaTilForsonRad({ ...forslagReise, erReise: undefined }) as unknown as DeltForsonRad;
    expect("erReise" in forslag).toBe(false);
  });
});
