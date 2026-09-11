import { describe, it, expect } from "vitest";
import { velgOfflineListeKilde } from "./offlineListe";

describe("velgOfflineListeKilde", () => {
  it("online + bekreftet svar med rader → server (normalveien, like ferskt som før)", () => {
    expect(
      velgOfflineListeKilde({
        erPaaNettet: true,
        serverBekreftet: true,
        serverAntall: 5,
        lokalAntall: 3,
      }),
    ).toEqual({ kilde: "server", tilstand: "server" });
  });

  it("online + bekreftet tomt svar → server-tom, ALDRI lokal (unngår stale-fella)", () => {
    // Selv om lokal cache har gamle rader, er et bekreftet online-svar autoritativt.
    expect(
      velgOfflineListeKilde({
        erPaaNettet: true,
        serverBekreftet: true,
        serverAntall: 0,
        lokalAntall: 9,
      }),
    ).toEqual({ kilde: "server", tilstand: "server-tom" });
  });

  it("offline med lokal cache → lokal (viser lagrede rader)", () => {
    expect(
      velgOfflineListeKilde({
        erPaaNettet: false,
        serverBekreftet: false,
        serverAntall: 0,
        lokalAntall: 4,
      }),
    ).toEqual({ kilde: "lokal", tilstand: "lokal" });
  });

  it("offline uten lokal cache → lokal-tom (ikke synkronisert ennå)", () => {
    expect(
      velgOfflineListeKilde({
        erPaaNettet: false,
        serverBekreftet: false,
        serverAntall: 0,
        lokalAntall: 0,
      }),
    ).toEqual({ kilde: "lokal", tilstand: "lokal-tom" });
  });

  it("online men server ikke bekreftet ennå (henger/venter) + lokal cache → lokal", () => {
    // Kaldstart med dårlig dekning: isConnected kan si true mens spørringen henger.
    // Vi viser lagrede rader umiddelbart i stedet for evig spinner.
    expect(
      velgOfflineListeKilde({
        erPaaNettet: true,
        serverBekreftet: false,
        serverAntall: 0,
        lokalAntall: 7,
      }),
    ).toEqual({ kilde: "lokal", tilstand: "lokal" });
  });

  it("online men server ikke bekreftet + ingen lokal cache → lokal-tom (skjermen viser spinner)", () => {
    expect(
      velgOfflineListeKilde({
        erPaaNettet: true,
        serverBekreftet: false,
        serverAntall: 0,
        lokalAntall: 0,
      }),
    ).toEqual({ kilde: "lokal", tilstand: "lokal-tom" });
  });

  it("offline men server-svar cachet i minnet fra før (bekreftet) → server-svaret gjelder ikke uten nett", () => {
    // erPaaNettet=false gjør at et gammelt isSuccess ikke lenger er autoritativt.
    expect(
      velgOfflineListeKilde({
        erPaaNettet: false,
        serverBekreftet: true,
        serverAntall: 5,
        lokalAntall: 5,
      }),
    ).toEqual({ kilde: "lokal", tilstand: "lokal" });
  });
});
