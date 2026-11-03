import { describe, it, expect } from "vitest";
import { sokIOppgaver, type OppgaveSokRad } from "./oppgaveSok";

/**
 * Mobilsøk MVP (spec-sok-mobil rev. 2 § 9.1): oppgaver søkes på prefiks+nummer · tittel · beskrivelse · malnavn ·
 * utfører-faggruppe med delt `matchScore` (samme form som sjekklistenes `sokeNorm`). `Task.data` søkes ikke.
 */

function rad(over: Partial<OppgaveSokRad> & { id: string }): OppgaveSokRad {
  return {
    title: "Uten tittel",
    status: "draft",
    number: null,
    description: null,
    template: null,
    utforerFaggruppe: null,
    ...over,
  };
}

const RADER: OppgaveSokRad[] = [
  rad({ id: "a", title: "Tett lekkasje i kjeller", number: 12, template: { name: "Oppgave", prefix: "OPP" } }),
  rad({ id: "b", title: "Montering", description: "Brannmansjett mangler i sjakt 3" }),
  rad({ id: "c", title: "Rydding", template: { name: "Ryddeliste", prefix: "RY" } }),
  rad({ id: "d", title: "Kabelføring", utforerFaggruppe: { name: "Elektro" } }),
];

const ider = (r: OppgaveSokRad[]) => r.map((x) => x.id);

describe("sokIOppgaver", () => {
  it("treffer tittel", () => {
    expect(ider(sokIOppgaver(RADER, "lekkasje"))).toEqual(["a"]);
  });

  it("treffer prefiks+nummer", () => {
    expect(ider(sokIOppgaver(RADER, "OPP12"))).toEqual(["a"]);
  });

  it("treffer beskrivelse", () => {
    expect(ider(sokIOppgaver(RADER, "brannmansjett"))).toEqual(["b"]);
  });

  it("treffer malnavn", () => {
    expect(ider(sokIOppgaver(RADER, "ryddeliste"))).toEqual(["c"]);
  });

  it("treffer utfører-faggruppe", () => {
    expect(ider(sokIOppgaver(RADER, "elektro"))).toEqual(["d"]);
  });

  it("tomt søk eller ingen treff gir tom liste", () => {
    expect(sokIOppgaver(RADER, "  ")).toEqual([]);
    expect(sokIOppgaver(RADER, "finnesikke")).toEqual([]);
  });

  it("lokal rad uten beskrivelse (oppgave_local) søkes på resten", () => {
    const lokal = rad({ id: "e", title: "Sjakt 3", description: null });
    expect(ider(sokIOppgaver([lokal], "sjakt"))).toEqual(["e"]);
  });
});
