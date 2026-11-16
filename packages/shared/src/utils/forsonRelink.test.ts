import { describe, it, expect } from "vitest";
import { parForRelink, planleggLinjeRelink, type RelinkLinje } from "./forsonRelink";
import type { ForsonRad } from "./forsonValg";

/**
 * Telefontest B funn 5: linjer (maskin, vare) som hang på forslagsraden følger raden
 * som vant. `sheetTimerId` relinkes alltid; prosjekt, byggeplass og underprosjekt
 * overskrives bare når linjens verdi var lik forslagets (vilkår Kenneth 2026-11-13).
 */

const P1 = "p1";
const P2 = "p2";

function rad(id: string, o: Partial<ForsonRad> = {}): ForsonRad {
  return {
    id,
    projectId: P1,
    byggeplassId: null,
    lonnsartId: "l1",
    aktivitetId: "a1",
    timer: 7.5,
    fraTid: "07:00",
    tilTid: "15:00",
    externalCostObjectId: null,
    ...o,
  };
}

function linje(id: string, sheetTimerId: string | null, o: Partial<RelinkLinje> = {}): RelinkLinje {
  return { id, sheetTimerId, projectId: P1, byggeplassId: null, externalCostObjectId: null, ...o };
}

describe("parForRelink", () => {
  it("gir fra=forslag-id, til=sedel-id for paret overlapp-slot med ulike id-er", () => {
    const par = parForRelink([rad("pc")], [rad("mob", { fraTid: "08:00", tilTid: "14:00" })]);
    expect(par.map((p) => ({ fra: p.fra.id, til: p.tilId }))).toEqual([{ fra: "mob", til: "pc" }]);
  });

  it("negativkontroll: forslag uten motpart og id-parede slots (samme id) gir ingen relink", () => {
    const par = parForRelink(
      [rad("pc", { fraTid: "07:00", tilTid: "09:00" }), rad("felles", { fraTid: "10:00", tilTid: "12:00" })],
      [
        rad("ensom", { fraTid: "16:00", tilTid: "18:00" }),
        rad("felles", { fraTid: "10:00", tilTid: "12:30", grunn: "endret_begge" }),
      ],
    );
    expect(par).toEqual([]);
  });
});

describe("planleggLinjeRelink", () => {
  const forslag = rad("mob", { byggeplassId: "b12" });
  const par = [{ fra: forslag, tilId: "pc" }];

  it("PC-valget: linje som fulgte forslaget får radens sheetTimerId og byggeplass", () => {
    const slutt = [rad("pc", { byggeplassId: null })];
    const plan = planleggLinjeRelink(par, [linje("m1", "mob", { byggeplassId: "b12" })], slutt);
    expect(plan).toEqual([{ id: "m1", fra: "mob", til: "pc", data: { sheetTimerId: "pc", byggeplassId: null } }]);
  });

  it("forslag-valget: raden fikk forslagets verdier → bare sheetTimerId endres", () => {
    const slutt = [rad("pc", { byggeplassId: "b12" })];
    const plan = planleggLinjeRelink(par, [linje("m1", "mob", { byggeplassId: "b12" })], slutt);
    expect(plan).toEqual([{ id: "m1", fra: "mob", til: "pc", data: { sheetTimerId: "pc" } }]);
  });

  it("linje som eksplisitt sto på noe annet enn forslaget beholder sine verdier", () => {
    const slutt = [rad("pc", { projectId: P2, byggeplassId: null, externalCostObjectId: "u1" })];
    const plan = planleggLinjeRelink(
      par,
      [linje("m1", "mob", { byggeplassId: "b99", externalCostObjectId: "u7" })],
      slutt,
    );
    // Prosjekt var lik forslagets (P1) → følger raden (P2); byggeplass/underprosjekt var ikke.
    expect(plan).toEqual([
      { id: "m1", fra: "mob", til: "pc", data: { sheetTimerId: "pc", projectId: P2 } },
    ]);
  });

  it("negativkontroll: linje på en rad som ikke er paret røres ikke", () => {
    const slutt = [rad("pc"), rad("annen")];
    expect(planleggLinjeRelink(par, [linje("m2", "annen"), linje("m3", null)], slutt)).toEqual([]);
  });

  it("raden som vant finnes ikke i sluttsettet → ingen relink (dikter ingen kobling)", () => {
    expect(planleggLinjeRelink(par, [linje("m1", "mob")], [])).toEqual([]);
  });
});
