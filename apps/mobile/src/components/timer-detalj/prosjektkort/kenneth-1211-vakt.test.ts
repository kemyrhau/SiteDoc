import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { foreslaOvertidSplitt, type OvertidForslagRad } from "@sitedoc/shared";
import { prosjektVisningsnavn } from "../../../utils/prosjektNavn";

// Kenneths test 2026-11-12 (ORDRE «Timer mobil: fem feil», del 1–4).
// Mobil har ingen renderer — atferden testes i de rene funksjonene, og at
// skjermene faktisk bruker dem vaktes i kilden.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const OVERSIKT = utenKommentarer(les("ProsjektkortDagsoversikt.tsx"));
const KORT = utenKommentarer(les("../../../../app/timer/[id]/kort/[projectId].tsx"));

/** `<TimerRadModal …/>`-elementet i kortvisningen. */
function timerRadModalElement(kilde: string): string {
  const start = kilde.indexOf("<TimerRadModal");
  expect(start).toBeGreaterThan(-1);
  const slutt = kilde.indexOf("</ProsjektkortKontekst.Provider>", start);
  return kilde.slice(start, slutt);
}

describe("del 1 — V21-overtidsforslaget i kortvisningen", () => {
  const LONNSARTER = [
    { id: "timelonn", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 },
    { id: "ot50", overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 2 },
    { id: "ot100", overtidsnivaa: 100, aktiv: true, type: "ordinaer", rekkefolge: 3 },
  ];
  const rad = (
    id: string,
    fraTid: string,
    tilTid: string,
    over: Partial<OvertidForslagRad> = {},
  ): OvertidForslagRad => ({
    id,
    fraTid,
    tilTid,
    pauseMin: 0,
    erReise: false,
    overtidsnivaa: null,
    ...over,
  });

  it("Kenneths dag: 07–15 normal, 15–17 Overtid 50 %, 17–18 normal, norm 7,5 → 17–18 foreslås som Overtid 50 %", () => {
    const forslag = foreslaOvertidSplitt(
      [
        rad("a", "07:00", "15:00", { pauseMin: 30 }),
        rad("b", "15:00", "17:00", { overtidsnivaa: 50 }),
        rad("c", "17:00", "18:00"),
      ],
      7.5,
      LONNSARTER,
      { pauseFra: "11:00" },
    );
    const c = forslag.find((f) => f.radId === "c");
    expect(c).toBeDefined();
    expect(c!.overtidLonnsart.id).toBe("ot50");
    expect(c!.overtidsnivaa).toBe(50);
    // Hele raden ligger etter normen → kun lønnsart byttes.
    expect(c!.normal).toBeNull();
    expect(c!.overtid).toMatchObject({ fraTid: "17:00", tilTid: "18:00", timer: 1 });
    // Raden som alt står på overtid får ikke forslag.
    expect(forslag.find((f) => f.radId === "b")).toBeUndefined();
  });

  it("kortvisningen sender dagsnorm og overtid-delen til rad-modalen (modalen viser ingen linje uten begge)", () => {
    const modal = timerRadModalElement(OVERSIKT);
    expect(modal).toMatch(/dagsnormTimer=\{normTimer\}/);
    expect(modal).toMatch(/onLeggTilOvertidDel=\{/);
    // Overtid-delen lagres som ny rad på samme kort.
    const del = modal.slice(modal.indexOf("onLeggTilOvertidDel="));
    expect(del).toMatch(/leggTilTimerRad\(/);
    expect(del).toMatch(/lagretByggeplassForKort\(timerModal\.kort/);
  });

  it("kortskjermen gir dagsnormen fra svar-cachen, ikke null", () => {
    expect(KORT).not.toMatch(/normTimer=\{null\}/);
    expect(KORT).toMatch(/hentDagsnormLokalt\(sedel\.organizationId, sedel\.dato\)/);
    expect(KORT).toMatch(/normTimer=\{normTimer\}/);
  });
});

describe("del 2 + 3 — prosjektVisningsnavn: kun navnet, aldri nummer eller ID", () => {
  const UKJENT = "Ukjent prosjekt";

  it("returnerer bare navnet selv når prosjektnummeret finnes", () => {
    const p = { id: "e81e1189-aaaa", name: "Bygg 50", projectNumber: "SD-20260101-0042" };
    const navn = prosjektVisningsnavn(p, UKJENT);
    expect(navn).toBe("Bygg 50");
    expect(navn).not.toContain("SD-20260101-0042");
    expect(navn).not.toContain(p.id);
  });

  it("ukjent prosjekt (ikke i cache / tomt navn) → «Ukjent prosjekt», aldri ID", () => {
    expect(prosjektVisningsnavn(null, UKJENT)).toBe(UKJENT);
    expect(prosjektVisningsnavn(undefined, UKJENT)).toBe(UKJENT);
    expect(prosjektVisningsnavn({ name: "  " }, UKJENT)).toBe(UKJENT);
    expect(prosjektVisningsnavn({ name: null }, UKJENT)).toBe(UKJENT);
  });

  // Visningsstedene fra ordren + grep. Nummeret får bare stå i søkefilteret.
  const VISNING = [
    "../../../../app/timer/[id].tsx",
    "../../../../app/timer/[id]/kort/[projectId].tsx",
    "../../../../app/timer/attestering/index.tsx",
    "useProsjektkortSedel.ts",
    "ProsjektkortDagsoversikt.tsx",
    "../ProsjektGruppe.tsx",
    "../TimerSeksjon.tsx",
    "../ProsjektVelger.tsx",
    "../MaskinSeksjon.tsx",
    "../TilleggSeksjon.tsx",
    "../../ProsjektVelger.tsx",
    "../../timer-attestering/AttesteringDetaljMobil.tsx",
  ];

  it.each(VISNING)("%s viser ikke prosjektnummeret (kun søk)", (fil) => {
    const linjer = utenKommentarer(les(fil))
      .split("\n")
      .filter((l) => /projectNumber|prosjektNummer/.test(l));
    for (const l of linjer) {
      // Søk: `(p.projectNumber ?? "").toLowerCase().includes(q)`. Typedeklarasjon
      // (attesteringens server-type) er data, ikke visning.
      expect(l).toMatch(/toLowerCase\(\)\.includes\(q\)|^\s*projectNumber: string;?$/);
    }
  });

  it.each(VISNING)("%s faller aldri tilbake til projectId som navn", (fil) => {
    const kilde = utenKommentarer(les(fil));
    expect(kilde).not.toMatch(/return projectId;/);
    expect(kilde).not.toMatch(/\?\.name \?\? \w+\.projectId/);
  });

  it("søket beholder nummeret i begge prosjektvelgerne", () => {
    expect(utenKommentarer(les("../ProsjektVelger.tsx"))).toMatch(
      /\(p\.projectNumber \?\? ""\)\.toLowerCase\(\)\.includes\(q\)/,
    );
    expect(utenKommentarer(les("../TimerSeksjon.tsx"))).toMatch(
      /\(p\.projectNumber \?\? ""\)\.toLowerCase\(\)\.includes\(q\)/,
    );
  });
});

describe("del 4 — overtidsrader rendres med fra–til som alle andre rader", () => {
  const nb = JSON.parse(les("../../../../../../packages/shared/src/i18n/nb.json")) as Record<string, string>;
  const en = JSON.parse(les("../../../../../../packages/shared/src/i18n/en.json")) as Record<string, string>;

  it("nøkkelen bærer bare nivået — tid og timer kommer fra den felles rad-formen", () => {
    expect(nb["timer.dagsoversikt.overtid"]).toBe("Overtid {{prosent}} %");
    expect(en["timer.dagsoversikt.overtid"]).toBe("Overtime {{prosent}} %");
  });

  // Radform (2026-11-12): overtid er en vanlig rad — samme boks, samme
  // tidsoverskrift og timer; bare lønnsart-teksten bærer nivået.
  it("overtid-raden bruker radens felles tid + t2(rad.timer); nivået i lønnsart-teksten", () => {
    const start = OVERSIKT.indexOf("function radBoks(");
    expect(start).toBeGreaterThan(-1);
    const blokk = OVERSIKT.slice(start, OVERSIKT.indexOf("\n  }\n", start));
    expect(blokk).toContain("{tidTekst(rad)}");
    expect(blokk).toContain("{t2(rad.timer)}");
    expect(blokk).toMatch(/t\("timer\.dagsoversikt\.overtid", \{ prosent: rad\.overtidsnivaa \}\)/);
    expect(blokk).not.toMatch(/fra:/);
    // Ingen egen overtid-gren i visningen.
    expect(OVERSIKT).not.toContain("linjer.overtid.map(");
  });
});
