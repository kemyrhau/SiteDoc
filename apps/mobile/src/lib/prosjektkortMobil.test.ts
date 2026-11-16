import { describe, it, expect } from "vitest";
import {
  beregnKortSummer,
  dagSummer,
  sumIDag,
  utledKortByggeplass,
} from "@sitedoc/shared";
import {
  kortProsjektIder,
  pauseBaererProsjekt,
  sendKnappTekst,
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
  formatKortTall,
  kortModusVisning,
  telteKortVarer,
  arvetByggeplassVisning,
  varerForProsjekt,
} from "./prosjektkortMobil";

const SEDEL = "p-sedel";
const REISE = "lonn-reise";

const timer = [
  { projectId: null, byggeplassId: null, lonnsartId: "normal", timer: 4, pauseMin: 30 },
  { projectId: "p2", byggeplassId: "b2", lonnsartId: "normal", timer: 3 },
  { projectId: "p2", byggeplassId: null, lonnsartId: REISE, timer: 1, erReise: null },
  { projectId: "p2", byggeplassId: "b3", lonnsartId: "normal", timer: 0.5, erReise: true },
];
const maskin = [
  { projectId: "p2", timer: 2 },
  { projectId: null, timer: null },
];

describe("prosjektkortMobil — samme tall som web-samlesiden", () => {
  const kt = tilKortTimerRader(timer, SEDEL, REISE);
  const km = tilKortMaskinRader(maskin, SEDEL);

  it("rad uten projectId havner på sedelens kort", () => {
    expect(kt[0]!.projectId).toBe(SEDEL);
    expect(km[1]!.projectId).toBe(SEDEL);
  });

  it("reise utledes fra erReise, ellers reise-lønnsart", () => {
    expect(kt.map((r) => r.erReise)).toEqual([false, false, true, true]);
  });

  it("kortsummer pr. prosjekt: arbeid/maskin/reise skilt", () => {
    const p2 = beregnKortSummer(
      kt.filter((r) => r.projectId === "p2"),
      km.filter((r) => r.projectId === "p2"),
      [],
    );
    expect(p2).toEqual({ arbeid: 3, maskin: 2, reise: 1.5, varer: null });
  });

  it("sum i dag = arbeid + reise; maskin og reise i bunnlinja", () => {
    expect(sumIDag(kt)).toBe(8.5);
    expect(dagSummer(kt, km)).toEqual({ maskin: 2, reise: 1.5 });
  });

  it("byggeplass pr. kort: rad uten egen arver dagens", () => {
    const p2 = [...kt, ...km].filter((r) => r.projectId === "p2");
    expect(utledKortByggeplass(p2, "b-dag")).toEqual({ type: "flere", antall: 3 });
    const sedel = [...kt, ...km].filter((r) => r.projectId === SEDEL);
    expect(utledKortByggeplass(sedel, "b-dag")).toEqual({ type: "en", id: "b-dag" });
  });

  it("varer: én enhet summeres, Decimal-streng blir tall", () => {
    const v = tilKortVarer([
      { id: "v1", projectId: "p2", antall: "2.5", vare: { id: "x", navn: "Sand", enhet: "m3" } },
      { id: "v2", projectId: "p2", antall: 1, vare: { id: "x", navn: "Sand", enhet: "m3" } },
    ]);
    expect(beregnKortSummer([], [], v).varer).toEqual({ type: "mengde", antall: 3.5, enhet: "m3" });
  });

  it("pausen bæres av første rad med pause", () => {
    expect(pauseBaererProsjekt(kt)).toBe(SEDEL);
    expect(pauseBaererProsjekt(kt.slice(1))).toBeNull();
  });
});

describe("kortProsjektIder — rekkefølge og tomt kort (modell A)", () => {
  it("første forekomst timer → maskin → tillegg → utlegg, så tilføyde", () => {
    expect(
      kortProsjektIder(
        SEDEL,
        [[{ projectId: "p2" }], [{ projectId: "p3" }, { projectId: "p2" }], [], [{ projectId: null }]],
        ["p4", "p3"],
      ),
    ).toEqual(["p2", "p3", SEDEL, "p4"]);
  });

  it("sedelens prosjekt uten rader gir ikke kort", () => {
    expect(kortProsjektIder(SEDEL, [[], [], [], []], [])).toEqual([]);
  });
});

describe("sendKnappTekst", () => {
  it("returnert sedel → «Send på nytt»", () => {
    expect(sendKnappTekst("returned", 7.5)).toEqual({ nokkel: "timer.detalj.sendPaaNytt" });
  });
  it("kladd → «Send dagen (X t)»", () => {
    expect(sendKnappTekst("draft", 7.5)).toEqual({
      nokkel: "timer.prosjektkort.sendDagen",
      timer: 7.5,
    });
  });
  it("kladd med reise → «Send dagen (7,5 t · reise 2 t)»", () => {
    expect(sendKnappTekst("draft", 7.5, 2)).toEqual({
      nokkel: "timer.prosjektkort.sendDagenMedReise",
      timer: 7.5,
      reise: 2,
    });
  });
  it("returnert med reise → fortsatt «Send på nytt»", () => {
    expect(sendKnappTekst("returned", 7.5, 2)).toEqual({ nokkel: "timer.detalj.sendPaaNytt" });
  });
});

describe("formatKortTall — som web (1–2 desimaler, komma)", () => {
  it("formaterer", () => {
    expect([5, 7.5, 2.25, 1 / 3, 0].map(formatKortTall)).toEqual(["5,0", "7,5", "2,25", "0,33", "0,0"]);
  });
});

describe("kortModusVisning — prosjektlås og arv-tekst", () => {
  it("kortmodus låser prosjektet og kaller arv-kilden «dagen»", () => {
    expect(kortModusVisning(true)).toEqual({
      prosjektLaast: true,
      arvesFra: "timer.byggeplass.arvesFraDagen",
      fra: "timer.byggeplass.fraDagen",
    });
  });

  it("dagskort er uendret: ikke låst, «dagskortet»", () => {
    expect(kortModusVisning(false)).toEqual({
      prosjektLaast: false,
      arvesFra: "timer.byggeplass.arvesFraDagskort",
      fra: "timer.byggeplass.fraDagskort",
    });
  });
});

describe("telteKortVarer (16d)", () => {
  const vare = { navn: "Sement", enhet: "sekk" };
  const varer = [
    { id: "a", projectId: "p1", antall: 2, vare, syncStatus: "synced" as const },
    { id: "b", projectId: "p1", antall: 5, vare, syncStatus: "avvist" as const },
    { id: "c", projectId: "p1", antall: 1, vare, syncStatus: "pending" as const },
    { id: "d", projectId: "p2", antall: 9, vare },
    { id: "e", projectId: "p1", antall: 3, vare },
  ];

  it("avviste lokale linjer telles ikke i Varer-summen", () => {
    const telte = telteKortVarer(varer, "p1");
    expect(telte.map((v) => v.id)).toEqual(["a", "c", "e"]);
    expect(beregnKortSummer([], [], telte).varer).toEqual({ type: "mengde", antall: 6, enhet: "sekk" });
  });

  it("server-linjer uten syncStatus telles, andre prosjekter ikke", () => {
    expect(telteKortVarer(varer, "p2").map((v) => v.id)).toEqual(["d"]);
  });
});

describe("arvetByggeplassVisning — rad-dialogen viser dagskortets faktiske byggeplass", () => {
  const blokkA = { navn: "Blokk A", projectId: "p1" };

  it("sedelens byggeplass vises med navn + «fra dagskortet» / «fra dagen»", () => {
    expect(arvetByggeplassVisning(blokkA, "p1", false)).toEqual({
      navn: "Blokk A",
      nokkel: "timer.byggeplass.fraDagskort",
    });
    expect(arvetByggeplassVisning(blokkA, "p1", true)).toEqual({
      navn: "Blokk A",
      nokkel: "timer.byggeplass.fraDagen",
    });
  });

  it("ingen byggeplass på sedelen → «Ingen byggeplass»", () => {
    expect(arvetByggeplassVisning(null, "p1", false)).toEqual({
      navn: null,
      nokkel: "timer.byggeplass.ingenValgt",
    });
    expect(arvetByggeplassVisning(null, "p1", true).nokkel).toBe("timer.byggeplass.ingenValgt");
  });

  it("sedelens byggeplass på annet prosjekt arves ikke (samme regel som radlista)", () => {
    expect(arvetByggeplassVisning(blokkA, "p2", false)).toEqual({
      navn: null,
      nokkel: "timer.byggeplass.ingenValgt",
    });
  });
});

describe("varerForProsjekt — dagskortets lesevisning (K20)", () => {
  const server = [
    { id: "s1", projectId: "p1", antall: 2, vare: { navn: "Pukk", enhet: "tonn" } },
    { id: "s2", projectId: "p2", antall: 1, vare: { navn: "Sand", enhet: "m3" } },
  ];
  it("🔴 kun prosjektets linjer, synket lokal linje telles én gang", () => {
    const lokale = [
      { id: "s1", projectId: "p1", antall: 2, vare: { navn: "Pukk", enhet: "tonn" } },
      { id: "l1", projectId: "p1", antall: 4, vare: { navn: "Grus", enhet: "tonn" } },
      { id: "l2", projectId: "p2", antall: 3, vare: { navn: "Grus", enhet: "tonn" } },
    ];
    expect(varerForProsjekt(server, lokale, "p1").map((v) => v.id)).toEqual(["s1", "l1"]);
    expect(varerForProsjekt(server, lokale, "p3")).toEqual([]);
  });
});
