import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { løsReiseKort, type OppmoteResultat, type ReiseKortInput } from "@sitedoc/shared";
import {
  erUtenOppmote,
  manuellReiseInput,
  reiseKortKanLagre,
  reiseKortRad,
  reiseKortSluttForStart,
  TOMT_MANUELL_VALG,
  type ReiseKortManuellValg,
} from "./reiseKortManuell";

/**
 * O22 (vedtak-timer-web.md § Reisevinduet pkt 28, Kenneth 2026-11-25): mobilens reise-kort uten
 * oppmøtested. Kortet kaller `løsReiseKort` slik `useManuellReise` gjør (uten web-flaggene) og
 * gir raden til `onLagre`, som skriver den lokalt (`leggTilTimerRad(db(), …)`). Ingen nettkall.
 */

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const IKKE_VALGT: OppmoteResultat = { kilde: "ikkeValgt" };
const FAST: OppmoteResultat = { kilde: "fast", oppmotestedId: "o1" };

const MIN_REGEL = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
} as const;
const KM_REGEL = { ...MIN_REGEL, reiseTerskelEnhet: "km", reiseTerskelM: 30000 } as const;

/** Som mobilens `useManuellReise`: ingen `tillatUtenKjoretid`, ingen `tillatDeling`. */
function mobilKort(oppmote: OppmoteResultat, valg: ReiseKortManuellValg = TOMT_MANUELL_VALG, over: Partial<ReiseKortInput> = {}) {
  return løsReiseKort({
    retning: "tur",
    oppmote,
    dagStart: "07:00",
    dagSlutt: "15:00",
    byggeplassId: "b1",
    kjoretidFor: (o, b) => (o === "o1" && b === "b1" ? 45 : null),
    avstandFor: (o, b) => (o === "o1" && b === "b1" ? 40000 : null),
    regel: { ...MIN_REGEL },
    grensepunkter: [],
    resolverLonnsartId: "lr",
    standardLonnsartId: "l1",
    ...manuellReiseInput(oppmote, valg),
    ...over,
  });
}

const kan = (r: ReturnType<typeof mobilKort>) => reiseKortKanLagre({ resultat: r, kontorKonflikt: false, aktivitetId: "a1" });

describe("O22 — mobil reise-kort uten oppmøtested (offline, manuell modus)", () => {
  it("ikke valgt: ingen sperre, tidsfeltene (Slutt = jobbstart), Lagre grå til Start er skrevet", () => {
    const r = mobilKort(IKKE_VALGT);
    expect(r.sperre).toBeNull();
    expect(erUtenOppmote(r)).toBe(true);
    expect(r).toMatchObject({ fraTid: null, tilTid: "07:00" });
    expect(kan(r)).toBe(false);
  });

  it("skrevet Start → Lagre virker, raden som skrives lokalt har tid, art og spor uten oppmøtested", () => {
    const r = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "06:00" });
    expect(kan(r)).toBe(true);
    const rad = reiseKortRad({ resultat: r, kontorKonflikt: false, aktivitetId: "a1" });
    expect(rad).toMatchObject({ lonnsartId: "lr", timer: 1, fraTid: "06:00", tilTid: "07:00" });
    expect(rad!.reiseSpor).toMatchObject({
      erReise: true,
      reiseKilde: "manuell",
      reiseOppmotestedId: null,
      reiseAvstandM: null,
      reiseKjoretidMin: null,
      reiseRetning: "ut",
    });
  });

  it("Retur: Start = arbeidsslutt, arbeideren skriver Slutt", () => {
    const r = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, sluttTid: "16:00" }, { retning: "retur" });
    expect(r).toMatchObject({ fraTid: "15:00", tilTid: "16:00", timer: 1, sperre: null });
    expect(kan(r)).toBe(true);
  });

  it("minuttgrense måles på skrevet tid: 20 min < 30 → arbeidstid på standardart (som manuell modus)", () => {
    const r = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "06:40" });
    expect(r.klassifisering).toMatchObject({ erReise: false, lonnsartId: "l1" });
    expect(kan(r)).toBe(true);
  });

  it("km-firma: uten avhuking firmaets under-type; avhuket → reisetid", () => {
    const uten = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "06:00" }, { regel: { ...KM_REGEL } });
    expect(uten.klassifisering?.erReise).toBe(false);
    const avhuket = mobilKort(IKKE_VALGT, { startTid: "06:00", sluttTid: null, kategoriValg: "reisetid" }, { regel: { ...KM_REGEL } });
    expect(avhuket.klassifisering).toMatchObject({ erReise: true, lonnsartId: "lr" });
  });

  it("Slutt før Start: Lagre sperret med egen forklaring", () => {
    const r = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "08:00" });
    expect(reiseKortSluttForStart(r)).toBe(true);
    expect(kan(r)).toBe(false);
    expect(reiseKortRad({ resultat: r, kontorKonflikt: false, aktivitetId: "a1" })).toBeNull();
  });

  it("andre sperrer står: manglerRegel, manglende aktivitet", () => {
    const r = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "06:00" }, { regel: null });
    expect(r.sperre).toBe("manglerRegel");
    const ok = mobilKort(IKKE_VALGT, { ...TOMT_MANUELL_VALG, startTid: "06:00" });
    expect(reiseKortKanLagre({ resultat: ok, kontorKonflikt: false, aktivitetId: null })).toBe(false);
  });

  it("regresjon: med valgt oppmøtested er reisen uendret, og arbeiderens tider blandes ikke inn", () => {
    expect(manuellReiseInput(FAST, { startTid: "05:00", sluttTid: "05:10", kategoriValg: "reisetid" })).toEqual({});
    const r = mobilKort(FAST, { startTid: "05:00", sluttTid: "05:10", kategoriValg: "reisetid" });
    expect(r).toMatchObject({ fraTid: "06:15", tilTid: "07:00", kjoretidMin: 45, sperre: null });
    expect(erUtenOppmote(r)).toBe(false);
  });

  it("regresjon: mangler kjøretid med valgt sted sperrer fortsatt på mobil (manglerKjoretid)", () => {
    expect(mobilKort(FAST, TOMT_MANUELL_VALG, { byggeplassId: "b2" }).sperre).toBe("manglerKjoretid");
  });
});

describe("O22 — kortet og hooken (kildevakt)", () => {
  const KORT = les("ReiseKort.tsx");
  const HOOK = les("useManuellReise.ts");
  const HJELP = les("reiseKortManuell.ts");

  it("den gamle sperren og «koble til nett» er borte", () => {
    expect(KORT).not.toContain("oppmoteIkkeValgt:");
    expect(KORT).not.toContain("sperre.oppmoteIkkeValgt");
  });

  it("manuell modus viser tidsfeltene, Fra-teksten og den blå teksten", () => {
    const flat = KORT.replace(/\s+/g, " ");
    expect(flat).toContain("{utenOppmote && ( <View className=\"gap-3\">");
    expect(KORT).toContain("<FraTilTidFelt");
    expect(KORT).toContain('t("timer.reiseKort.utenOppmote")');
    expect(KORT).toContain('t("timer.reiseKort.oppmoteIkkeValgt")');
    expect(KORT).toContain("bg-blue-50");
  });

  it("hooken gir arbeiderens tider til løsReiseKort; ingen nettkall i kort, hook eller hjelper", () => {
    expect(HOOK).toContain("...manuellReiseInput(oppmote, manuellValg)");
    for (const kilde of [KORT, HOOK, HJELP]) {
      expect(kilde).not.toMatch(/\btrpc\b|fetch\(/);
    }
  });

  it("raden går til onLagre, og DagSeksjon skriver den lokalt", () => {
    expect(KORT).toContain("const rad = reiseKortRad(");
    const DAG = les("prosjektkort/DagSeksjon.tsx").replace(/\s+/g, " ");
    expect(DAG).toMatch(/onLagre=\{\(l\) => \{ leggTilTimerRad\( db\(\),/);
  });
});
