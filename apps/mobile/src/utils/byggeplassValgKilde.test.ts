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
    expect(kilde).toMatch(/onVelgByggeplass=\{kanVelgeByggeplassDirekte\(sjekklisteDetalj\?\.drawingId\) \? velgByggeplass : undefined\}/);
    expect(kilde).toMatch(/\.\.\.byggeplassByttInput\(sjekklisteDetalj\?\.lokasjonOmfang, byggeplassId\)/);
  });

  it("oppgave: byggeplass-trykk lagrer med byggeplassByttInput (drawingId null → ønsket vinner)", () => {
    const kilde = les("../../app/oppgave/[id].tsx");
    expect(kilde).toMatch(/onVelgByggeplass=\{kanVelgeByggeplassDirekte\(oppgaveDetalj\?\.drawingId\) \? \(byggeplassId\) =>/);
    expect(kilde).toMatch(/\.\.\.byggeplassByttInput\(oppgaveDetalj\?\.lokasjonOmfang, byggeplassId\)/);
  });
});

/**
 * ORDRE 2026-11-15 (21): byggeplassen følger tegningen. Med tegning skjules byggeplass-radene
 * (byttet skjer ved å velge en tegning fra en annen byggeplass); serveren setter byggeplassen
 * fra tegningen (`velgTaskByggeplass`). Prosjekt-tegning sender `byggeplassId: undefined`.
 */
describe("(21) byggeplass følger tegningen", () => {
  it("sjekkliste: byggeplass-radene gis bare uten tegning", () => {
    const kilde = les("../../app/sjekkliste/[id].tsx");
    expect(kilde).not.toMatch(/onVelgByggeplass=\{velgByggeplass\}/);
    expect(kilde).toMatch(/onVelgByggeplass=\{kanVelgeByggeplassDirekte\(sjekklisteDetalj\?\.drawingId\) \? velgByggeplass : undefined\}/);
  });

  it("sjekkliste: «Byggeplass ikke valgt»-linja får drawingId", () => {
    const kilde = les("../../app/sjekkliste/[id].tsx");
    expect(kilde).toMatch(/kanRedigere: !leseModus, drawingId: sjekklisteDetalj\?\.drawingId \?\? null, \}\) && <ByggeplassIkkeValgtLinje/);
  });

  it("sjekkliste: Lagre sender undefined (ikke null) for prosjekt-tegning", () => {
    const kilde = les("../../app/sjekkliste/[id].tsx");
    expect(kilde).toMatch(/byggeplassId: lokTempTegningId \? \(lokTempBygningId \?\? undefined\) : lokTempBygningId,/);
    expect(kilde).not.toMatch(/byggeplassId: lokTempBygningId, drawingId: lokTempTegningId,/);
  });

  it("oppgave: byggeplass-radene gis bare uten tegning", () => {
    const kilde = les("../../app/oppgave/[id].tsx");
    expect(kilde).not.toMatch(/onVelgByggeplass=\{\(byggeplassId\) =>/);
    expect(kilde).toMatch(/onVelgByggeplass=\{kanVelgeByggeplassDirekte\(oppgaveDetalj\?\.drawingId\) \? \(byggeplassId\) =>[\s\S]*?settVisTegningVelger\(false\); \} : undefined\}/);
  });
});
