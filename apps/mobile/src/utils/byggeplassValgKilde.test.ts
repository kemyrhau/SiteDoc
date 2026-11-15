import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE 2026-11-15 (20b) punkt 3: «Velg» og lokasjonsvalget i sjekkliste og oppgave viser
 * byggeplassene øverst. Ett trykk setter byggeplass (tegning frivillig); ingen rad for
 * «Hele prosjektet» — det er kun et visningsfilter. Regelen for bytte (`byggeplassByttInput`)
 * er testet i web `dokument-lokasjon.test.ts` (samme funksjon fra @sitedoc/shared).
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8").replace(/\s+/g, " ");

describe("(20b) byggeplassvalg øverst i lokasjonslista", () => {
  const liste = les("../components/LokasjonSeksjon.tsx");
  const blokk = liste.slice(liste.indexOf("export function TegningVelgerListe"));

  it("byggeplass-radene rendres før tegningsgruppene", () => {
    const byggeplass = blokk.indexOf("bygninger.map((b) => ( <Pressable");
    const tegninger = blokk.indexOf("grupper.map((g)");
    expect(byggeplass).toBeGreaterThan(-1);
    expect(byggeplass).toBeLessThan(tegninger);
    expect(blokk).toMatch(/onPress=\{\(\) => onVelgByggeplass\?\.\(b\.id\)\}/);
  });

  it("negativkontroll: ingen «Hele prosjektet»-rad i lista", () => {
    expect(blokk).not.toMatch(/heleProsjektet|HELE_PROSJEKTET|__hele_prosjektet__/);
  });

  it("sjekkliste: «Velg» åpner lista, og byggeplass-trykk lagrer med byggeplassByttInput", () => {
    const kilde = les("../../app/sjekkliste/[id].tsx");
    expect(kilde).toMatch(/<ByggeplassIkkeValgtLinje onVelg=\{aapneByggeplassValg\} \/>/);
    expect(kilde).toMatch(/onVelgByggeplass=\{velgByggeplass\}/);
    expect(kilde).toMatch(/\.\.\.byggeplassByttInput\(sjekklisteDetalj\?\.lokasjonOmfang, byggeplassId\)/);
  });

  it("oppgave: byggeplass-trykk lagrer med byggeplassByttInput (drawingId null → ønsket vinner)", () => {
    const kilde = les("../../app/oppgave/[id].tsx");
    expect(kilde).toMatch(/onVelgByggeplass=\{\(byggeplassId\) =>/);
    expect(kilde).toMatch(/\.\.\.byggeplassByttInput\(oppgaveDetalj\?\.lokasjonOmfang, byggeplassId\)/);
  });
});
