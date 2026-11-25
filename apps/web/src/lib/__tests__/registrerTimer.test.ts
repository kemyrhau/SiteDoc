/**
 * w2 «+ Registrer timer»: ren logikk for knappen og dagssiden.
 */
import { describe, expect, it } from "vitest";
import {
  adresseEtterRegistrering,
  byggeplassForRegistrering,
  loesAapentKort,
  nyKortId,
  registrerLenke,
  registrerTimerSteg,
  gyldigRegistrerDato,
  spennerFlereAar,
  standardAktivitetId,
  standardRegistrerDato,
  visDagDato,
  visTimerTall,
} from "../registrerTimer";

describe("registrerTimerSteg", () => {
  it("ny dag med prosjekt: serveren laget første jobb — ingenting mer å åpne", () => {
    expect(registrerTimerSteg({ eksisterte: false, status: "draft", harAttestertRad: false, projectId: "p1" })).toBe("ferdig");
  });
  it("dagen fantes: neste jobb åpnes i timervinduet", () => {
    expect(registrerTimerSteg({ eksisterte: true, status: "draft", harAttestertRad: false, projectId: "p1" })).toBe("nyJobb");
    expect(registrerTimerSteg({ eksisterte: true, status: "returned", harAttestertRad: false, projectId: "p1" })).toBe("nyJobb");
  });
  it("uten prosjekt fra toppen: velg prosjekt først", () => {
    expect(registrerTimerSteg({ eksisterte: true, status: "draft", harAttestertRad: false, projectId: null })).toBe("velgProsjekt");
  });
  it("sendt dag uten attestert rad: gjenåpne først", () => {
    expect(registrerTimerSteg({ eksisterte: true, status: "sent", harAttestertRad: false, projectId: "p1" })).toBe("gjenaapne");
  });
  it("sendt dag med attestert rad, eller godkjent: låst", () => {
    expect(registrerTimerSteg({ eksisterte: true, status: "sent", harAttestertRad: true, projectId: "p1" })).toBe("laast");
    expect(registrerTimerSteg({ eksisterte: true, status: "accepted", harAttestertRad: false, projectId: "p1" })).toBe("laast");
  });
});

describe("standardAktivitetId", () => {
  it("Anleggsarbeid når aktiv, ellers første aktive, ellers første", () => {
    expect(standardAktivitetId([{ id: "a", navn: "X", aktiv: true }, { id: "b", navn: "Anleggsarbeid", aktiv: true }])).toBe("b");
    expect(standardAktivitetId([{ id: "a", navn: "X", aktiv: false }, { id: "b", navn: "Anleggsarbeid", aktiv: false }, { id: "c", navn: "Y", aktiv: true }])).toBe("c");
    expect(standardAktivitetId([{ id: "a", navn: "X", aktiv: false }])).toBe("a");
    expect(standardAktivitetId([])).toBeNull();
    expect(standardAktivitetId(undefined)).toBeNull();
  });
});

describe("byggeplassForRegistrering", () => {
  const byggeplasser = [{ id: "b1", projectId: "p1" }, { id: "b2", projectId: "p2" }];
  it("byggeplassen fra toppen følger med når den hører til prosjektet", () => {
    expect(byggeplassForRegistrering({ toppbarByggeplassId: "b1", projectId: "p1", byggeplasser })).toBe("b1");
  });
  it("annet prosjekts byggeplass, ukjent byggeplass eller uten prosjekt: null", () => {
    expect(byggeplassForRegistrering({ toppbarByggeplassId: "b2", projectId: "p1", byggeplasser })).toBeNull();
    expect(byggeplassForRegistrering({ toppbarByggeplassId: "bx", projectId: "p1", byggeplasser })).toBeNull();
    expect(byggeplassForRegistrering({ toppbarByggeplassId: "b1", projectId: null, byggeplasser })).toBeNull();
    expect(byggeplassForRegistrering({ toppbarByggeplassId: null, projectId: "p1", byggeplasser })).toBeNull();
  });
});

describe("registrerLenke", () => {
  it("bærer registrer=1, prosjektet og om dagen fantes", () => {
    expect(registrerLenke({ sheetId: "s1", projectId: "p1", eksisterte: true })).toBe(
      "/dashbord/timer/s1?registrer=1&nyttProsjekt=p1&eksisterte=1",
    );
    expect(registrerLenke({ sheetId: "s1", projectId: null, eksisterte: false })).toBe("/dashbord/timer/s1?registrer=1");
  });
});

describe("nyKortId", () => {
  it("gir en ny UUID hver gang", () => {
    const a = nyKortId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(nyKortId()).not.toBe(a);
  });
});

describe("komma og dd.mm.", () => {
  it("timer med komma og to desimaler", () => {
    expect(visTimerTall(7.5)).toBe("7,50");
    expect(visTimerTall(0)).toBe("0,00");
    expect(visTimerTall(12.25)).toBe("12,25");
  });
  it("dato som dd.mm., med år ved behov", () => {
    expect(visDagDato("2026-11-17", false)).toBe("17.11.");
    expect(visDagDato("2026-11-17", true)).toBe("17.11.2026");
    expect(visDagDato("2026-11-17T00:00:00.000Z", false)).toBe("17.11.");
    // Lokal midnatt (ukestart på prosjektets Timer-side) skal ikke bli dagen før.
    expect(visDagDato(new Date(2026, 10, 16), false)).toBe("16.11.");
    expect(visDagDato(new Date(2026, 0, 1), true)).toBe("01.01.2026");
  });
  it("år vises bare når lista spenner over flere år", () => {
    expect(spennerFlereAar(["2026-11-17", "2026-11-18"])).toBe(false);
    expect(spennerFlereAar(["2026-12-31", "2027-01-01"])).toBe(true);
    expect(spennerFlereAar([])).toBe(false);
  });
});

/** w15a (B41 A): kortet som ble laget/valgt er åpent, og adressen ryddes etter flyten. */
describe("loesAapentKort", () => {
  const jobbKort = [{ kortId: "k1", projectId: "p1" }];
  it("prosjekt-id uten eget kort åpner prosjektets eneste jobbkort", () => {
    expect(loesAapentKort({ aapentKort: "p1", kortNokler: ["k1"], jobbKort })).toBe("k1");
  });
  it("to jobber på prosjektet: ingen gjetning", () => {
    const to = [...jobbKort, { kortId: "k2", projectId: "p1" }];
    expect(loesAapentKort({ aapentKort: "p1", kortNokler: ["k1", "k2"], jobbKort: to })).toBe("p1");
  });
  it("kjent nøkkel, null og automatisk står som før", () => {
    expect(loesAapentKort({ aapentKort: "k1", kortNokler: ["k1"], jobbKort })).toBe("k1");
    expect(loesAapentKort({ aapentKort: null, kortNokler: ["k1"], jobbKort })).toBeNull();
    expect(loesAapentKort({ aapentKort: undefined, kortNokler: ["k1"], jobbKort })).toBe("k1");
    expect(loesAapentKort({ aapentKort: undefined, kortNokler: ["k1", "p2"], jobbKort })).toBeNull();
  });
  it("ny kort-id (jobb nr. 2, ikke lagret ennå) står", () => {
    expect(loesAapentKort({ aapentKort: "ny", kortNokler: ["k1"], jobbKort })).toBe("ny");
  });
});

describe("adresseEtterRegistrering", () => {
  it("fjerner registrer, nyttProsjekt og eksisterte; retur står", () => {
    expect(
      adresseEtterRegistrering(
        "/dashbord/timer/s1",
        "registrer=1&nyttProsjekt=p1&eksisterte=1&retur=%2Fdashbord%2Ftimer%2Fmine",
      ),
    ).toBe("/dashbord/timer/s1?retur=%2Fdashbord%2Ftimer%2Fmine");
  });
  it("uten andre parametre: bare stien", () => {
    expect(adresseEtterRegistrering("/dashbord/timer/s1", "registrer=1&nyttProsjekt=p1")).toBe(
      "/dashbord/timer/s1",
    );
  });
});

describe("standardRegistrerDato (REGISTRER-DATO)", () => {
  const naa = new Date(2026, 10, 25, 12); // onsdag 25.11.2026
  it("uten uke eller dato: i dag", () => {
    expect(standardRegistrerDato({ naa })).toBe("2026-11-25");
  });
  it("denne uka: i dag", () => {
    expect(standardRegistrerDato({ naa, ukeStart: new Date(2026, 10, 23) })).toBe("2026-11-25");
  });
  it("tidligere uke: ukas mandag", () => {
    expect(standardRegistrerDato({ naa, ukeStart: new Date(2026, 10, 16) })).toBe("2026-11-16");
  });
  it("fremtidig uke: i dag (ingen dag etter i dag)", () => {
    expect(standardRegistrerDato({ naa, ukeStart: new Date(2026, 10, 30) })).toBe("2026-11-25");
  });
  it("valgt enkeltdato vinner, men ikke etter i dag", () => {
    expect(standardRegistrerDato({ naa, valgtDato: "2026-11-20" })).toBe("2026-11-20");
    expect(standardRegistrerDato({ naa, valgtDato: "2026-12-01" })).toBe("2026-11-25");
  });
});

describe("gyldigRegistrerDato", () => {
  const naa = new Date(2026, 10, 25, 12);
  it("i dag og tidligere er gyldig; i morgen, tomt og ugyldig er ikke", () => {
    expect(gyldigRegistrerDato("2026-11-25", naa)).toBe(true);
    expect(gyldigRegistrerDato("2026-11-24", naa)).toBe(true);
    expect(gyldigRegistrerDato("2026-11-26", naa)).toBe(false);
    expect(gyldigRegistrerDato("", naa)).toBe(false);
    expect(gyldigRegistrerDato("2026-02-30", naa)).toBe(false);
  });
});
