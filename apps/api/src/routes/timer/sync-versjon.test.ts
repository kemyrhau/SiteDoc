import { describe, it, expect } from "vitest";
import {
  klassifiserSyncRader,
  type ServerRad,
  type PayloadRad,
} from "./sync-versjon";

const V1 = "2026-10-05T08:00:00.000Z"; // versjonen telefonen hentet
const V2 = "2026-10-05T09:30:00.000Z"; // nyere versjon (PC skrev etterpå)

function srv(over: Partial<ServerRad> = {}): ServerRad {
  return {
    id: "r1",
    updatedAt: V1,
    projectId: "p1",
    lonnsartId: "l1",
    aktivitetId: "a1",
    timer: 8,
    fraTid: "07:00",
    tilTid: "15:00",
    beskrivelse: null,
    pauseMin: 0,
    ...over,
  };
}

function pl(over: Partial<PayloadRad> = {}): PayloadRad {
  return {
    id: "r1",
    serverVersjon: V1,
    endretLokalt: false,
    projectId: "p1",
    lonnsartId: "l1",
    aktivitetId: "a1",
    timer: 8,
    fraTid: "07:00",
    tilTid: "15:00",
    beskrivelse: null,
    pauseMin: 0,
    ...over,
  };
}

describe("klassifiserSyncRader — rader (R1–R12)", () => {
  it("R1 uendret begge → skriv", () => {
    const r = klassifiserSyncRader([srv()], [pl()], []);
    expect(r.skriv).toEqual(["r1"]);
    expect(r.hoppOver).toEqual([]);
    expect(r.avvik).toEqual([]);
  });

  it("R2 endret telefon, uendret PC (versjon lik, endretLokalt) → skriv", () => {
    const r = klassifiserSyncRader(
      [srv()],
      [pl({ endretLokalt: true, tilTid: "15:30", timer: 8.5 })],
      [],
    );
    expect(r.skriv).toEqual(["r1"]);
  });

  it("R3 uendret telefon, endret PC (versjon ulik, endretLokalt=false, innhold ulikt) → hopp over", () => {
    const r = klassifiserSyncRader(
      [srv({ updatedAt: V2, tilTid: "15:30" })], // PC endret til 15:30
      [pl({ serverVersjon: V1, endretLokalt: false, tilTid: "15:00" })],
      [],
    );
    expect(r.hoppOver).toEqual(["r1"]);
    expect(r.skriv).toEqual([]);
    expect(r.avvik).toEqual([]);
  });

  it("R4 endret begge (versjon ulik, endretLokalt=true, innhold ulikt) → avvik endret_begge (payload)", () => {
    const r = klassifiserSyncRader(
      [srv({ updatedAt: V2, tilTid: "15:30" })],
      [pl({ serverVersjon: V1, endretLokalt: true, tilTid: "15:15" })],
      [],
    );
    expect(r.avvik).toEqual([{ id: "r1", grunn: "endret_begge", kilde: "payload" }]);
    expect(r.skriv).toEqual([]);
    expect(r.hoppOver).toEqual([]);
  });

  it("R5 begge endret til det samme (versjon ulik, innhold likt) → hopp over", () => {
    const r = klassifiserSyncRader(
      [srv({ updatedAt: V2, tilTid: "15:30" })],
      [pl({ serverVersjon: V1, endretLokalt: true, tilTid: "15:30" })],
      [],
    );
    expect(r.hoppOver).toEqual(["r1"]);
    expect(r.avvik).toEqual([]);
  });

  it("R6 ny rad på telefon (ingen serverrad, versjon null) → opprett (skriv)", () => {
    const r = klassifiserSyncRader([], [pl({ id: "ny", serverVersjon: null })], []);
    expect(r.skriv).toEqual(["ny"]);
  });

  it("R7 slettet PC, endret telefon (ingen serverrad, versjon satt, endretLokalt) → avvik slettet_pc", () => {
    const r = klassifiserSyncRader(
      [],
      [pl({ serverVersjon: V1, endretLokalt: true })],
      [],
    );
    expect(r.avvik).toEqual([{ id: "r1", grunn: "slettet_pc", kilde: "payload" }]);
    expect(r.skriv).toEqual([]);
  });

  it("R8 slettet PC, uendret telefon (ingen serverrad, versjon satt, endretLokalt=false) → hopp over", () => {
    const r = klassifiserSyncRader(
      [],
      [pl({ serverVersjon: V1, endretLokalt: false })],
      [],
    );
    expect(r.hoppOver).toEqual(["r1"]);
    expect(r.avvik).toEqual([]);
  });

  it("R9 eldre app (versjon mangler), serverrad finnes, innhold likt → skriv (idempotent)", () => {
    const r = klassifiserSyncRader(
      [srv()],
      [pl({ serverVersjon: undefined, endretLokalt: undefined })],
      [],
    );
    expect(r.skriv).toEqual(["r1"]);
  });

  it("R10 eldre app (versjon null), serverrad finnes, innhold ulikt → avvik endret_begge (trygg retning)", () => {
    const r = klassifiserSyncRader(
      [srv({ tilTid: "15:00" })],
      [pl({ serverVersjon: null, endretLokalt: undefined, tilTid: "15:30" })],
      [],
    );
    expect(r.avvik).toEqual([{ id: "r1", grunn: "endret_begge", kilde: "payload" }]);
  });

  it("R11 eldre app, serverrad mangler → opprett", () => {
    const r = klassifiserSyncRader([], [pl({ id: "x", serverVersjon: null, endretLokalt: undefined })], []);
    expect(r.skriv).toEqual(["x"]);
  });

  it("fail-safe (fabel-vilkår b): versjon SATT uten endretLokalt → forslag, ikke stille hopp over", () => {
    // R4-retning: serverrad finnes, versjon ulik, innhold ulikt, endretLokalt mangler.
    // `!== false` → avvik (trygg retning), ikke hopp over (som `=== true` ville gitt).
    const r4 = klassifiserSyncRader(
      [srv({ updatedAt: V2, tilTid: "15:30" })],
      [pl({ serverVersjon: V1, endretLokalt: undefined, tilTid: "15:00" })],
      [],
    );
    expect(r4.avvik).toEqual([{ id: "r1", grunn: "endret_begge", kilde: "payload" }]);
    expect(r4.hoppOver).toEqual([]);
    // R7-retning: serverraden mangler, versjon satt, endretLokalt mangler → slettet_pc.
    const r7 = klassifiserSyncRader([], [pl({ serverVersjon: V1, endretLokalt: undefined })], []);
    expect(r7.avvik).toEqual([{ id: "r1", grunn: "slettet_pc", kilde: "payload" }]);
    expect(r7.hoppOver).toEqual([]);
  });
});

describe("klassifiserSyncRader — slettinger (S1–S4)", () => {
  it("S1 slettet telefon, uendret PC (versjon lik) → slett", () => {
    const r = klassifiserSyncRader([srv()], [], [{ id: "r1", serverVersjon: V1 }]);
    expect(r.slett).toEqual(["r1"]);
    expect(r.avvik).toEqual([]);
  });

  it("S2' slettet telefon, endret PC (versjon ulik) → avvik slettet_telefon (server-kopi)", () => {
    const r = klassifiserSyncRader(
      [srv({ updatedAt: V2 })],
      [],
      [{ id: "r1", serverVersjon: V1 }],
    );
    expect(r.avvik).toEqual([{ id: "r1", grunn: "slettet_telefon", kilde: "server" }]);
    expect(r.slett).toEqual([]);
  });

  it("S3 slettet begge (ingen serverrad) → no-op", () => {
    const r = klassifiserSyncRader([], [], [{ id: "r1", serverVersjon: V1 }]);
    expect(r.slett).toEqual([]);
    expect(r.avvik).toEqual([]);
  });

  it("S4 eldre app (ingen versjon), serverrad finnes → avvik slettet_telefon (trygg retning)", () => {
    const r = klassifiserSyncRader([srv()], [], [{ id: "r1", serverVersjon: null }]);
    expect(r.avvik).toEqual([{ id: "r1", grunn: "slettet_telefon", kilde: "server" }]);
  });
});

describe("klassifiserSyncRader — presisjon (§ 9.6 test 9)", () => {
  it("updatedAt-ISO sendt tilbake uendret → lik versjon (skriv), en update → ulik", () => {
    const presis = "2026-10-05T08:00:00.123Z"; // ms-presisjon
    const skriv = klassifiserSyncRader([srv({ updatedAt: presis })], [pl({ serverVersjon: presis })], []);
    expect(skriv.skriv).toEqual(["r1"]);
    // PC gjorde en update (ny updatedAt) → telefonens gamle versjon er ulik.
    const ulik = klassifiserSyncRader(
      [srv({ updatedAt: "2026-10-05T08:00:00.124Z", tilTid: "15:30" })],
      [pl({ serverVersjon: presis, endretLokalt: false, tilTid: "15:00" })],
      [],
    );
    expect(ulik.hoppOver).toEqual(["r1"]);
  });

  it("Date-objekt som server-updatedAt sammenlignes korrekt mot ISO-streng", () => {
    const d = new Date("2026-10-05T08:00:00.000Z");
    const r = klassifiserSyncRader([srv({ updatedAt: d })], [pl({ serverVersjon: V1 })], []);
    expect(r.skriv).toEqual(["r1"]);
  });
});
