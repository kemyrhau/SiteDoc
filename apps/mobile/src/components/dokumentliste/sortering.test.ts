import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import {
  filtrerOgSorter,
  MAKS_SORTERNIVAAER,
  sammenlignRader,
  tilgjengeligeSorteringer,
  trykkSorteringsbrikke,
  type DokumentRad,
  type Sortering,
} from "./dokumentlisteFilter";
import { brikkeA11y, brikkeEtikett, sorteringOppsummering } from "./sorteringEtikett";

/**
 * Flernivå-sortering (2026-11-04): komparator med opptil 3 nivåer + fast hale
 * (nummer ↑, id), brikke-syklusen legg til → snu → fjern, adaptive brikker og etiketter.
 */

const DAG = 86_400_000;
const iDag = Date.now();
const iso = (dagerSiden: number) => new Date(iDag - dagerSiden * DAG).toISOString();

function rad(over: Partial<DokumentRad> & { id: string }): DokumentRad {
  return {
    title: `Dok ${over.id}`,
    status: "sent",
    number: null,
    createdAt: iso(1),
    updatedAt: iso(1),
    subject: null,
    dueDate: null,
    ...over,
  };
}

const ider = (r: DokumentRad[]) => r.map((x) => x.id);
const sorter = (rader: DokumentRad[], s: Sortering) => ider(filtrerOgSorter(rader, {}, "", s));

describe("sammenlignRader", () => {
  it("tom sortering = opprettet, nyeste først", () => {
    const rader = [rad({ id: "gammel", createdAt: iso(9) }), rad({ id: "ny", createdAt: iso(1) })];
    expect(sorter(rader, [])).toEqual(["ny", "gammel"]);
  });

  it("første nivå avgjør; likhet faller gjennom til neste nivå med egen retning", () => {
    const rader = [
      rad({ id: "a", subject: "Bad", number: 1 }),
      rad({ id: "b", subject: "Bad", number: 3 }),
      rad({ id: "c", subject: "Ark", number: 2 }),
    ];
    const s: Sortering = [
      { nokkel: "emne", retning: "stigende" },
      { nokkel: "nummer", retning: "synkende" },
    ];
    expect(sorter(rader, s)).toEqual(["c", "b", "a"]);
  });

  it("tre nivåer", () => {
    const rader = [
      rad({ id: "a", subject: "X", title: "B", number: 1 }),
      rad({ id: "b", subject: "X", title: "A", number: 2 }),
      rad({ id: "c", subject: "X", title: "A", number: 1 }),
    ];
    const s: Sortering = [
      { nokkel: "emne", retning: "stigende" },
      { nokkel: "navn", retning: "stigende" },
      { nokkel: "nummer", retning: "synkende" },
    ];
    expect(sorter(rader, s)).toEqual(["b", "c", "a"]);
  });

  it("likt på alle nivåer: fast hale nummer ↑, deretter id", () => {
    const rader = [
      rad({ id: "z", subject: "X", number: 2 }),
      rad({ id: "y", subject: "X", number: 1 }),
      rad({ id: "b", subject: "X", number: 1 }),
    ];
    expect(sorter(rader, [{ nokkel: "emne", retning: "stigende" }])).toEqual(["b", "y", "z"]);
  });

  it("stabil: samme resultat uansett inn-rekkefølge", () => {
    const rader = [
      rad({ id: "a", subject: "X", number: 1 }),
      rad({ id: "b", subject: "X", number: 1 }),
      rad({ id: "c", subject: "Y", number: 1 }),
    ];
    const s: Sortering = [{ nokkel: "emne", retning: "synkende" }];
    expect(sorter(rader, s)).toEqual(sorter([...rader].reverse(), s));
    expect(sorter(rader, s)).toEqual(["c", "a", "b"]);
  });

  it("tomme verdier sist i begge retninger", () => {
    const rader = [
      rad({ id: "uten", dueDate: null }),
      rad({ id: "tidlig", dueDate: iso(-1) }),
      rad({ id: "sen", dueDate: iso(-5) }),
    ];
    expect(sorter(rader, [{ nokkel: "frist", retning: "stigende" }])).toEqual(["tidlig", "sen", "uten"]);
    expect(sorter(rader, [{ nokkel: "frist", retning: "synkende" }])).toEqual(["sen", "tidlig", "uten"]);
  });

  it("returnerer 0 bare for samme rad", () => {
    const a = rad({ id: "a" });
    expect(sammenlignRader(a, a, [])).toBe(0);
    expect(sammenlignRader(a, rad({ id: "b" }), [])).not.toBe(0);
  });

  it("søk overstyrer sorteringen med relevans", () => {
    const rader = [
      rad({ id: "svak", title: "Annet", subject: "rekkverk", number: 1 }),
      rad({ id: "sterk", title: "Rekkverk", number: 2 }),
    ];
    const s: Sortering = [{ nokkel: "nummer", retning: "stigende" }];
    const medSok = ider(filtrerOgSorter(rader, {}, "rekkverk", s));
    const utenSort = ider(filtrerOgSorter(rader, {}, "rekkverk", []));
    expect(medSok).toEqual(utenSort);
  });
});

describe("trykkSorteringsbrikke", () => {
  it("legger til med startretning", () => {
    expect(trykkSorteringsbrikke([], "frist")).toEqual([{ nokkel: "frist", retning: "stigende" }]);
    expect(trykkSorteringsbrikke([], "endret")).toEqual([{ nokkel: "endret", retning: "synkende" }]);
  });

  it("andre trykk snur, tredje fjerner", () => {
    const en = trykkSorteringsbrikke([], "frist");
    const to = trykkSorteringsbrikke(en, "frist");
    expect(to).toEqual([{ nokkel: "frist", retning: "synkende" }]);
    expect(trykkSorteringsbrikke(to, "frist")).toEqual([]);
  });

  it("fjerning flytter nivåene under opp", () => {
    let s: Sortering = [];
    for (const k of ["frist", "nummer", "navn"] as const) s = trykkSorteringsbrikke(s, k);
    s = trykkSorteringsbrikke(trykkSorteringsbrikke(s, "frist"), "frist");
    expect(s.map((n) => n.nokkel)).toEqual(["nummer", "navn"]);
  });

  it("maks 3: fjerde brikke endrer ingenting", () => {
    let s: Sortering = [];
    for (const k of ["frist", "nummer", "navn"] as const) s = trykkSorteringsbrikke(s, k);
    expect(s).toHaveLength(MAKS_SORTERNIVAAER);
    expect(trykkSorteringsbrikke(s, "emne")).toBe(s);
  });
});

describe("tilgjengeligeSorteringer", () => {
  it("opprettet, endret og navn alltid; frist/nummer/emne bare med data", () => {
    expect(tilgjengeligeSorteringer([rad({ id: "a" })], [])).toEqual(["opprettet", "endret", "navn"]);
    const rader = [rad({ id: "a", dueDate: iso(-1) }), rad({ id: "b", number: 4, subject: "Bad" })];
    expect(tilgjengeligeSorteringer(rader, [])).toEqual(["opprettet", "endret", "frist", "nummer", "emne", "navn"]);
  });

  it("tomt emne teller ikke som data", () => {
    expect(tilgjengeligeSorteringer([rad({ id: "a", subject: "  " })], [])).not.toContain("emne");
  });

  it("valgt nøkkel vises alltid, også uten data", () => {
    const s: Sortering = [{ nokkel: "frist", retning: "stigende" }];
    expect(tilgjengeligeSorteringer([rad({ id: "a" })], s)).toContain("frist");
  });
});

describe("etiketter", () => {
  const ord: Record<string, string> = {
    "dokumentsok.sorteringOpprettet": "Opprettet",
    "dokumentsok.sorteringFrist": "Frist",
    "dokumentsok.sorteringNummer": "Nummer",
    "dokumentsok.sorteringStigende": "stigende",
    "dokumentsok.sorteringSynkende": "synkende",
    "dokumentsok.sorteringDeretter": ", deretter ",
    "dokumentsok.sorteringNivaa": "{{nivaa}} · {{navn}} {{pil}}",
    "dokumentsok.sorteringNivaaA11y": "{{navn}}, nivå {{nivaa}}, {{retning}}",
  };
  const t = ((k: string, v?: Record<string, unknown>) =>
    (ord[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(v?.[n] ?? ""))) as unknown as TFunction;
  const s: Sortering = [
    { nokkel: "frist", retning: "stigende" },
    { nokkel: "nummer", retning: "synkende" },
  ];

  it("brikke: nivå og pil når valgt, bare navn ellers", () => {
    expect(brikkeEtikett(s, "frist", t)).toBe("1 · Frist ↑");
    expect(brikkeEtikett(s, "nummer", t)).toBe("2 · Nummer ↓");
    expect(brikkeEtikett(s, "opprettet", t)).toBe("Opprettet");
  });

  it("skjermleser sier nivå og retning i ord", () => {
    expect(brikkeA11y(s, "nummer", t)).toBe("Nummer, nivå 2, synkende");
  });

  it("oppsummering over lista", () => {
    expect(sorteringOppsummering(s, t)).toBe("Frist ↑, deretter Nummer ↓");
    expect(sorteringOppsummering([], t)).toBe("");
  });
});
