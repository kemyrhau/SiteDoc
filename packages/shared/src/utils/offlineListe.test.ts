import { describe, it, expect } from "vitest";
import { velgOfflineListeKilde, velgDokumentVisning, velgHjemProsjektVisning } from "./offlineListe";

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

describe("velgDokumentVisning (enkeltdokument-detalj, fase 2)", () => {
  it("🔴 AVVIK Q5: online + venter (fetching) + speil finnes → IKKE offline-modus (spinner)", () => {
    // Rød uten fiksen: tidligere ga «lokal» for alt ikke-bekreftet, også online-venting.
    expect(
      velgDokumentVisning({ erPaaNettet: true, serverBekreftet: false, erFeilet: false, erPauset: false, harSpeil: true }),
    ).toEqual({ offlineModus: false, offlineIkkeLastet: false });
  });

  it("offline + speil → tvungen lesemodus", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: false, serverBekreftet: false, erFeilet: false, erPauset: false, harSpeil: true }),
    ).toEqual({ offlineModus: true, offlineIkkeLastet: false });
  });

  it("offline + ingen speil → «ikke lastet ned» (ikke spinner)", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: false, serverBekreftet: false, erFeilet: false, erPauset: false, harSpeil: false }),
    ).toEqual({ offlineModus: false, offlineIkkeLastet: true });
  });

  it("online + feilet query + speil → offline-modus (feilet teller som frakoblet)", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: true, serverBekreftet: false, erFeilet: true, erPauset: false, harSpeil: true }),
    ).toEqual({ offlineModus: true, offlineIkkeLastet: false });
  });

  it("server bekreftet → aldri offline-modus (online-atferd uendret)", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: true, serverBekreftet: true, erFeilet: false, erPauset: false, harSpeil: true }),
    ).toEqual({ offlineModus: false, offlineIkkeLastet: false });
  });

  // 🔴 FELTFUNN 2026-10-04 (rød uten erPauset-fiksen): offlineFirst gjør én forsøk, PAUSER retry.
  // Query er `paused` (isLoading=true, isError=false), og erPaaNettet henger etter på NetInfo-startverdi
  // true. Før fiksen: frakoblet=false → offlineModus=false → erLaster=true → EVIG SPINNER selv med speil.
  it("paused query + erPaaNettet enda true + speil → offline-modus (lukker NetInfo-racet)", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: true, serverBekreftet: false, erFeilet: false, erPauset: true, harSpeil: true }),
    ).toEqual({ offlineModus: true, offlineIkkeLastet: false });
  });

  it("paused query + erPaaNettet enda true + INGEN speil → «ikke lastet ned» (ikke evig spinner)", () => {
    expect(
      velgDokumentVisning({ erPaaNettet: true, serverBekreftet: false, erFeilet: false, erPauset: true, harSpeil: false }),
    ).toEqual({ offlineModus: false, offlineIkkeLastet: true });
  });
});

describe("velgHjemProsjektVisning (Hjem/prosjektvelger/ny dagsseddel — felles inngang, feltfunn 2026-10-04)", () => {
  const i = (o: Partial<Parameters<typeof velgHjemProsjektVisning>[0]>) =>
    velgHjemProsjektVisning({ erPaaNettet: true, serverBekreftet: false, erFeilet: false, erPauset: false, harLokaleProsjekter: false, ...o });

  it("bekreftet server-svar → server (online-atferd uendret)", () => {
    expect(i({ serverBekreftet: true })).toBe("server");
  });

  it("online + venter (fetching) → spinner (Q5 — online-atferd uendret)", () => {
    expect(i({ erPaaNettet: true })).toBe("spinner");
  });

  // 🔴 RØD UTEN FIKSEN: før falt alt ikke-bekreftet offline/feilet rett til feilsiden,
  // uansett om lokale prosjekter fantes — Hjem stengte veien til de lagrede dokumentene.
  it("uten nett + lokale prosjekter → lokal (INGEN feilside)", () => {
    expect(i({ erPaaNettet: false, harLokaleProsjekter: true })).toBe("lokal");
  });

  it("online + feilet + lokale prosjekter → lokal (feilet teller som frakoblet)", () => {
    expect(i({ erFeilet: true, harLokaleProsjekter: true })).toBe("lokal");
  });

  it("paused + lokale prosjekter → lokal (samme pause-regel som fase 2)", () => {
    expect(i({ erPauset: true, harLokaleProsjekter: true })).toBe("lokal");
  });

  it("uten nett + ingen lokale → feil (feilside/«ingenting lagret»)", () => {
    expect(i({ erPaaNettet: false, harLokaleProsjekter: false })).toBe("feil");
  });

  it("online + feilet + ingen lokale → feil (ekte serverfeil, «prøv igjen»)", () => {
    expect(i({ erFeilet: true, harLokaleProsjekter: false })).toBe("feil");
  });
});
