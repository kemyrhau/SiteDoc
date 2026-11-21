import { describe, it, expect } from "vitest";
import {
  byggRedigerNyeRader,
  type VentendeMaskin,
  type VentendeTimer,
} from "../RedigerRadModal";

/**
 * F68 (web-timeforing-plan § 4.15 del H punkt 34) — «Lagre endringer» i «Rediger
 * arbeid» skal ikke tømme byggeplassen. Før rettingen sendte vinduet
 * `byggeplassId: null` for hver ventende timerad og maskinrad på sedelen, også
 * radene utenfor jobben. Serveren skriver feltet den får, og kort-id følger
 * nøkkelen (prosjekt, byggeplass, underprosjekt). Serverhalvdelen står i
 * `apps/api/src/routes/rediger-arbeid-byggeplass.integration.test.ts`.
 */
const P1 = "p1";
const E1 = "e1"; // jobben vinduet er åpnet for
const E2 = "e2"; // en annen jobb på samme sedel
const B1 = "b1";
const B2 = "b2";

const timer = (id: string, f: Partial<VentendeTimer>): VentendeTimer => ({
  id,
  projectId: P1,
  externalCostObjectId: E1,
  byggeplassId: B1,
  lonnsartId: "ord",
  aktivitetId: "akt",
  fraTid: "07:00",
  tilTid: "11:00",
  timer: "4",
  ...f,
});
const maskin = (id: string, f: Partial<VentendeMaskin>): VentendeMaskin => ({
  id,
  projectId: P1,
  externalCostObjectId: E1,
  byggeplassId: B1,
  vehicleId: "m1",
  fraTid: null,
  tilTid: null,
  timer: "2",
  mengde: null,
  enhet: null,
  ...f,
});

const pendingTimer = [
  timer("t-jobb", {}),
  timer("t-annen", { externalCostObjectId: E2, byggeplassId: B2, fraTid: "12:00", tilTid: "15:00", timer: "3" }),
];
const pendingMaskin = [maskin("m-jobb", {}), maskin("m-annen", { externalCostObjectId: E2, byggeplassId: B2 })];

describe("F68 — byggRedigerNyeRader sender radens byggeplass uendret", () => {
  it("én rettet time: jobbens rader og radene i den andre jobben beholder byggeplassen", () => {
    const rader = byggRedigerNyeRader({
      projectId: P1,
      ecoId: E1,
      pendingTimer,
      pendingMaskin,
      pendingTillegg: [],
      // Attestanten retter jobbens timerad 07–11 → 07–10.
      editTimer: [
        { key: "t-jobb", originalId: "t-jobb", lonnsartId: "ord", aktivitetId: "akt", fraTid: "07:00", tilTid: "10:00", timer: 3 },
      ],
      editMaskin: [
        { key: "m-jobb", originalId: "m-jobb", vehicleId: "m1", fraTid: null, tilTid: null, timer: 2, mengde: null, enhet: null },
      ],
    });
    const bygg = (rs: ReadonlyArray<{ originalId: string | null; byggeplassId: string | null }>) =>
      Object.fromEntries(rs.map((r) => [r.originalId, r.byggeplassId]));
    expect(bygg(rader.timer)).toEqual({ "t-jobb": B1, "t-annen": B2 });
    expect(bygg(rader.maskin)).toEqual({ "m-jobb": B1, "m-annen": B2 });
    // Det attestanten rettet, går med.
    expect(rader.timer.find((r) => r.originalId === "t-jobb")).toMatchObject({ tilTid: "10:00", timer: 3 });
  });

  it("delt rad (samme originalId) arver originalens byggeplass; rad uten byggeplass sender null", () => {
    const rader = byggRedigerNyeRader({
      projectId: P1,
      ecoId: E1,
      pendingTimer: [timer("t-jobb", {}), timer("t-uten", { externalCostObjectId: E2, byggeplassId: null, fraTid: "12:00", tilTid: "13:00" })],
      pendingMaskin: [],
      pendingTillegg: [],
      editTimer: [
        { key: "a", originalId: "t-jobb", lonnsartId: "ord", aktivitetId: "akt", fraTid: "07:00", tilTid: "09:00", timer: 2 },
        { key: "b", originalId: "t-jobb", lonnsartId: "ord", aktivitetId: "akt", fraTid: "09:00", tilTid: "11:00", timer: 2 },
      ],
      editMaskin: [],
    });
    expect(rader.timer.map((r) => [r.originalId, r.byggeplassId])).toEqual([
      ["t-uten", null],
      ["t-jobb", B1],
      ["t-jobb", B1],
    ]);
  });
});
