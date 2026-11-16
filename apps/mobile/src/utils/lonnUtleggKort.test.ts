import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => null }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "x" }));
vi.mock("../db/database", () => ({ erDatabaseTilgjengelig: () => false, hentDatabase: () => null }));
import { kortMedFlestTimer, kortMedArbeid } from "./beskrivelseKort";
import { kortForLinje, knyttLonnUtleggTilKort } from "./lonnUtleggKort";
import type { Dagsforslag } from "./dagsforslag";
import type { LonnUtlegg } from "./dagsforslagAnvend";

/**
 * T12 (spec tillegg-utlegg-prosjektkort § 5, B6): Bekreft dag gir hver
 * tillegg-/utleggslinje et kort. Standard = kortet med flest arbeidstimer;
 * en linje hvis kort er borte (rammen endret), faller til prosjektets kort.
 */
type R = { projectId: string; byggeplassId: string | null; timer: number; erReise?: boolean };
function forslag(rader: R[], dagByggeplass: string | null = null): Dagsforslag {
  return {
    prosjektId: "p1",
    datoer: [
      {
        dato: "2026-07-01",
        blokkert: false,
        byggeplassId: dagByggeplass,
        rader: rader.map((r) => ({ erReise: false, ...r })),
      },
    ],
  } as unknown as Dagsforslag;
}

describe("T12 — standardkort i Bekreft dag", () => {
  it("🔴 kortet med flest timer, også når prosjektet er det samme", () => {
    const f = forslag([
      { projectId: "p1", byggeplassId: null, timer: 3 },
      { projectId: "p1", byggeplassId: "b2", timer: 4 },
    ]);
    expect(kortMedFlestTimer(f)).toMatchObject({ projectId: "p1", byggeplassId: "b2" });
  });

  it("negativkontroll: timene byttet → det andre kortet", () => {
    const f = forslag([
      { projectId: "p1", byggeplassId: null, timer: 5 },
      { projectId: "p1", byggeplassId: "b2", timer: 4 },
    ]);
    expect(kortMedFlestTimer(f)).toMatchObject({ projectId: "p1", byggeplassId: null });
  });

  it("reise teller ikke; ingen arbeid → null", () => {
    expect(kortMedFlestTimer(forslag([{ projectId: "p1", byggeplassId: null, timer: 2, erReise: true }]))).toBeNull();
  });

  it("arvende rad får dagens byggeplass som kort", () => {
    expect(kortMedFlestTimer(forslag([{ projectId: "p1", byggeplassId: null, timer: 2 }], "b1"))).toMatchObject({
      byggeplassId: "b1",
    });
  });
});

describe("T12 — linja knyttes til et kort som finnes", () => {
  const f = forslag([
    { projectId: "p1", byggeplassId: null, timer: 3 },
    { projectId: "p1", byggeplassId: "b2", timer: 4 },
    { projectId: "p2", byggeplassId: null, timer: 1 },
  ]);
  const kort = kortMedArbeid(f);

  it("eksakt treff beholdes", () => {
    expect(kortForLinje({ projectId: "p1", byggeplassId: null }, kort)).toMatchObject({ projectId: "p1", byggeplassId: null });
    expect(kortForLinje({ projectId: "p1", byggeplassId: "b2" }, kort)).toMatchObject({ byggeplassId: "b2" });
  });

  it("🔴 kortet borte (byggeplass b9) → prosjektets kort med flest timer", () => {
    expect(kortForLinje({ projectId: "p1", byggeplassId: "b9" }, kort, f)).toMatchObject({ projectId: "p1", byggeplassId: "b2" });
  });

  it("gammelt utkast uten felt → prosjektets kort", () => {
    expect(kortForLinje({ projectId: "p2" }, kort, f)).toMatchObject({ projectId: "p2", byggeplassId: null });
  });

  it("prosjekt uten arbeid → null (linja arver sedelen)", () => {
    expect(kortForLinje({ projectId: "p3", byggeplassId: "b2" }, kort, f)).toBeNull();
  });

  it("🔴 knyttLonnUtleggTilKort skriver kortets byggeplass på linja; uten kort blir den null", () => {
    const l: LonnUtlegg = {
      tillegg: [
        { lokalId: "t1", projectId: "p1", tilleggId: "x", antall: 1, kommentar: null, byggeplassId: "b9" },
        { lokalId: "t2", projectId: "p3", tilleggId: "x", antall: 1, kommentar: null, byggeplassId: "b2" },
      ],
      utlegg: [
        {
          id: "u1", projectId: "p1", expenseCategoryId: "k", belop: 1, kommentar: null,
          ordningVedFoering: "utlegg", foertVed: 1, kvittering: null,
        },
      ],
    };
    const ut = knyttLonnUtleggTilKort(l, kort, f);
    expect(ut.tillegg.map((x) => x.byggeplassId)).toEqual(["b2", null]);
    expect(ut.utlegg[0]!.byggeplassId).toBe("b2");
    expect(ut.tillegg[0]!.projectId).toBe("p1");
  });
});
