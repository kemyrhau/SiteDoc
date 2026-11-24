/**
 * w15b: linja «havner i» i reisevinduet regner det serveren gjør i `sikreKortId` etter
 * lagring — den delte `velgReiseKort` for reise, nøkkelen for en rad under terskel.
 * w15c: linja følger regelen (byggeplass og underprosjekt er krav).
 * § 8.22: ingen kontorregel; en lagret reise med uendret sted står i kortet sitt.
 */
import { describe, expect, it } from "vitest";
import { utledKortId } from "@sitedoc/shared";
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

  it("§ 8.22 punkt 3: lagret reise med uendret sted blir i kortet sitt, selv om en jobb nå passer bedre", () => {
    // Reisen står i k2 (lagret); k1 er tidligste jobb med samme nøkkel og ville vunnet for en ny reise.
    const rader = [jobb(), jobb({ kortId: "k2", fraTid: "12:00", opprettet: 2 })];
    const lagret = { kortId: "k2", projectId: "p1", byggeplassId: "b1", ecoId: "eco1", erReise: true };
    expect(reiseHavnerI({ rader, sedelByggeplass: null, reise: reise(), lagret })).toMatchObject({
      type: "jobb",
      kortId: "k2",
    });
    expect(reiseHavnerI({ rader, sedelByggeplass: null, reise: reise() })).toMatchObject({ type: "jobb", kortId: "k1" });
  });

  it("§ 8.22 punkt 3: rettet byggeplass på lagret reise → regelen velger kortet på nytt", () => {
    const rader = [jobb(), jobb({ kortId: "k2", fraTid: "12:00", byggeplassId: "b3", opprettet: 2 })];
    const lagret = { kortId: "k1", projectId: "p1", byggeplassId: "b1", ecoId: "eco1", erReise: true };
    expect(
      reiseHavnerI({ rader, sedelByggeplass: null, reise: reise({ byggeplassId: "b3" }), lagret }),
    ).toMatchObject({ type: "jobb", kortId: "k2" });
  });

  it("§ 8.22 punkt 2: reise uten byggeplass har ingen kontorregel — vanlig reise (ingen jobb med samme sted → eget)", () => {
    const rader = [jobb(), jobb({ kortId: "k2", fraTid: "12:00", byggeplassId: "b3", opprettet: 2 })];
    expect(
      reiseHavnerI({ rader, sedelByggeplass: null, reise: reise({ byggeplassId: null, fraTid: "15:00" }) }),
    ).toEqual({ type: "eget", projectId: "p1" });
  });

  it("reise til en byggeplass uten jobb → eget kort (w15c: byggeplassen er et krav)", () => {
    expect(
      reiseHavnerI({ rader: [jobb()], sedelByggeplass: null, reise: reise({ byggeplassId: "b2" }) }),
    ).toEqual({ type: "eget", projectId: "p1" });
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

/**
 * w15f (F55, del H pkt. 26): en dag der et kort bare har maskin eller tillegg. Serveren gir
 * reisen uten jobb `egetReiseKort` (= `utledKortId` av nøkkelen), og under terskel kortet med
 * samme nøkkel blant alle radtypene — linja sier det samme kortet.
 */
describe("reiseHavnerI — kort uten arbeid (w15f, F55)", () => {
  const eier = { userId: "u1", dato: "2026-11-21" };
  const tilleggKort = utledKortId({ ...eier, nokkel: { projectId: "p2", byggeplassId: "b2", ecoId: null } });
  const tillegg = { kortId: tilleggKort, projectId: "p2", byggeplassId: "b2", ecoId: null, opprettet: 5 };

  it("reise til stedet der dagen bare har et tillegg → står i det kortet", () => {
    const r = reiseHavnerI({
      rader: [jobb()],
      andreRader: [tillegg],
      eier,
      sedelByggeplass: null,
      reise: reise({ projectId: "p2", byggeplassId: "b2", ecoId: null }),
    });
    expect(r).toEqual({ type: "kort", kortId: tilleggKort, byggeplassId: "b2", projectId: "p2" });
  });

  it("under terskel på samme sted som et maskinkort → maskinkortet", () => {
    const maskin = { kortId: "km", projectId: "p2", byggeplassId: "b2", ecoId: null, opprettet: 3 };
    const r = reiseHavnerI({
      rader: [jobb()],
      andreRader: [maskin],
      eier,
      sedelByggeplass: null,
      reise: reise({ projectId: "p2", byggeplassId: "b2", ecoId: null, erReise: false, retning: null }),
    });
    expect(r).toMatchObject({ type: "kort", kortId: "km" });
  });

  it("tillegg på et annet sted, eller uten eier (eldre kall) → eget kort som før", () => {
    const annetSted = {
      ...tillegg,
      byggeplassId: "b3",
      kortId: utledKortId({ ...eier, nokkel: { projectId: "p2", byggeplassId: "b3", ecoId: null } }),
    };
    expect(
      reiseHavnerI({
        rader: [jobb()],
        andreRader: [annetSted],
        eier,
        sedelByggeplass: null,
        reise: reise({ projectId: "p2", byggeplassId: "b2", ecoId: null }),
      }),
    ).toEqual({ type: "eget", projectId: "p2" });
    expect(
      reiseHavnerI({
        rader: [jobb()],
        andreRader: [tillegg],
        sedelByggeplass: null,
        reise: reise({ projectId: "p2", byggeplassId: "b2", ecoId: null }),
      }),
    ).toEqual({ type: "eget", projectId: "p2" });
  });

  it("en jobb på stedet går foran kortet uten arbeid", () => {
    const r = reiseHavnerI({
      rader: [jobb({ kortId: "kj", projectId: "p2", byggeplassId: "b2", ecoId: null })],
      andreRader: [tillegg],
      eier,
      sedelByggeplass: null,
      reise: reise({ projectId: "p2", byggeplassId: "b2", ecoId: null }),
    });
    expect(r).toMatchObject({ type: "jobb", kortId: "kj" });
  });
});

// O1 (§ 8.22): to jobber med samme nøkkel; turen under terskel åpnet fra jobb 2.
describe("reiseHavnerI — O1 jobbKortId under terskel", () => {
  const rader = [
    jobb({ kortId: "kA", fraTid: "07:00", opprettet: 1 }),
    jobb({ kortId: "kB", fraTid: "15:00", opprettet: 2 }),
  ];
  const tur = reise({ erReise: false, retning: "retur", fraTid: "16:00" });
  it("åpnet fra jobb 2 → står i jobb 2", () => {
    const h = reiseHavnerI({ rader, sedelByggeplass: null, reise: tur, jobbKortId: "kB" });
    expect(h).toMatchObject({ type: "jobb", kortId: "kB" });
  });
  it("negativkontroll: uten jobbKortId → eldste jobb med nøkkelen (serverens regel 3)", () => {
    const h = reiseHavnerI({ rader, sedelByggeplass: null, reise: tur });
    expect(h).toMatchObject({ type: "jobb", kortId: "kA" });
  });
  it("over terskel (reise) påvirkes ikke av jobbKortId — velgReiseKort som før", () => {
    const h = reiseHavnerI({
      rader,
      sedelByggeplass: null,
      reise: reise({ retning: "ut", fraTid: "06:00" }),
      jobbKortId: "kB",
    });
    expect(h).toMatchObject({ type: "jobb", kortId: "kA" });
  });
});
