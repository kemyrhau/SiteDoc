/**
 * w15b: linja «havner i» i reisevinduet regner det serveren gjør i `sikreKortId` etter
 * lagring — den delte `velgReiseKort` for reise, nøkkelen for en rad under terskel.
 * Linja sier det dagens regel gir (til w15c er merget).
 */
import { describe, expect, it } from "vitest";
import { reiseHavnerI, type ReiseHavnerRad } from "./useManuellReiseWeb";

const jobb = (over: Partial<ReiseHavnerRad> = {}): ReiseHavnerRad => ({
  fraTid: "07:00",
  erReise: false,
  kortId: "k1",
  projectId: "p1",
  ecoId: "eco1",
  byggeplassId: "b1",
  opprettet: 1,
  attestertStatus: "pending",
  ...over,
});
const reise = (over: Partial<Parameters<typeof reiseHavnerI>[0]["reise"]> = {}) => ({
  projectId: "p1",
  ecoId: "eco1",
  byggeplassId: "b1",
  retning: "ut" as const,
  fraTid: "06:00",
  erReise: true,
  ...over,
});

describe("reiseHavnerI", () => {
  it("samme sted som jobben → står i jobben", () => {
    expect(reiseHavnerI({ rader: [jobb()], sedelByggeplass: null, reise: reise() })).toEqual({
      type: "jobb",
      kortId: "k1",
      byggeplassId: "b1",
      projectId: "p1",
    });
  });

  it("annet prosjekt uten jobb → eget kort på prosjektet", () => {
    expect(
      reiseHavnerI({ rader: [jobb()], sedelByggeplass: null, reise: reise({ projectId: "p2", byggeplassId: "b2" }) }),
    ).toEqual({ type: "eget", projectId: "p2" });
  });

  it("kontorreise (ingen byggeplass, retning ut) → første jobb på prosjektet (dagens regel)", () => {
    const rader = [jobb(), jobb({ kortId: "k2", fraTid: "12:00", byggeplassId: "b3", opprettet: 2 })];
    expect(
      reiseHavnerI({ rader, sedelByggeplass: null, reise: reise({ byggeplassId: null, fraTid: "15:00" }) }),
    ).toMatchObject({ type: "jobb", kortId: "k1" });
  });

  it("jobbens effektive byggeplass leses med sedelens", () => {
    const r = reiseHavnerI({
      rader: [jobb({ byggeplassId: null })],
      sedelByggeplass: { id: "b1", projectId: "p1" },
      reise: reise(),
    });
    expect(r).toMatchObject({ type: "jobb", byggeplassId: "b1" });
  });

  it("reiserader og erstattede rader er ikke jobber", () => {
    const rader = [jobb({ erReise: true }), jobb({ kortId: "k9", attestertStatus: "erstattet" })];
    expect(reiseHavnerI({ rader, sedelByggeplass: null, reise: reise() })).toEqual({ type: "eget", projectId: "p1" });
  });

  it("under terskel (arbeid): kortet med samme nøkkel, ellers eget kort", () => {
    const arbeid = { erReise: false, retning: null };
    expect(reiseHavnerI({ rader: [jobb()], sedelByggeplass: null, reise: reise(arbeid) })).toMatchObject({
      type: "jobb",
      kortId: "k1",
    });
    expect(
      reiseHavnerI({ rader: [jobb()], sedelByggeplass: null, reise: reise({ ...arbeid, ecoId: null }) }),
    ).toEqual({ type: "eget", projectId: "p1" });
  });
});
