import { describe, it, expect } from "vitest";
import { dagskortSammenligning, type TimerRad } from "./dagskortSammenligning";

const rad = (o: Partial<TimerRad> & { id: string }): TimerRad => ({
  fraTid: null,
  tilTid: null,
  timer: 0,
  ...o,
});

const L1 = rad({ id: "l1", fraTid: "07:00", tilTid: "15:00", timer: 7.5, lonnsartId: "normal" });
const S1 = rad({ id: "s1", fraTid: "07:00", tilTid: "15:00", timer: 8, lonnsartId: "normal" });
const S2 = rad({ id: "s2", fraTid: "15:00", tilTid: "17:00", timer: 2, lonnsartId: "overtid" });

describe("dagskortSammenligning — gate-kriteriene for U-BEKREFT modus B + C", () => {
  it("🔴 gate 4: offline → «offline», ALDRI et tomt web-panel (selv med lokale rader)", () => {
    expect(
      dagskortSammenligning({ nettStatus: "offline", webLaster: false, webKort: null, lokaleTimer: [L1] }),
    ).toEqual({ slag: "offline" });
  });

  it("🔴 offline vinner selv om web-kortet skulle være hentet fra før", () => {
    expect(
      dagskortSammenligning({
        nettStatus: "offline",
        webLaster: false,
        webKort: { status: "draft", timer: [S1] },
        lokaleTimer: [L1],
      }),
    ).toEqual({ slag: "offline" });
  });

  it("🔴 «laster» ≠ «offline» ≠ «tomt» — web-query underveis gir egen tilstand", () => {
    expect(
      dagskortSammenligning({ nettStatus: "online", webLaster: true, webKort: null, lokaleTimer: [L1] }),
    ).toEqual({ slag: "laster" });
  });

  it("online men web-kortet lot seg ikke lese → «utilgjengelig» (ikke tomt kort)", () => {
    expect(
      dagskortSammenligning({ nettStatus: "online", webLaster: false, webKort: null, lokaleTimer: [L1] }),
    ).toEqual({ slag: "utilgjengelig" });
  });

  it("🔴 gate 1: samme klokkeslett flettes til ÉN linje (lokal + server side om side)", () => {
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [S1] },
      lokaleTimer: [L1],
    });
    expect(r.slag).toBe("modusB");
    if (r.slag !== "modusB") return;
    expect(r.rader).toHaveLength(1);
    expect(r.rader[0]).toMatchObject({
      tidsrom: "07:00–15:00",
      lokal: { id: "l1", timer: 7.5 },
      server: { id: "s1", timer: 8 },
      valgt: "server",
    });
  });

  it("🔴 gate 2: modus B ved redigerbart web-kort (draft/returned)", () => {
    for (const status of ["draft", "returned"] as const) {
      expect(
        dagskortSammenligning({
          nettStatus: "online",
          webLaster: false,
          webKort: { status, timer: [S1] },
          lokaleTimer: [L1],
        }).slag,
      ).toBe("modusB");
    }
  });

  it("🔴 gate 3: modus C (lesevisning) ved låst web-kort (sent/accepted), med grunn", () => {
    for (const status of ["sent", "accepted"] as const) {
      const r = dagskortSammenligning({
        nettStatus: "online",
        webLaster: false,
        webKort: { status, timer: [S1] },
        lokaleTimer: [L1],
      });
      expect(r).toMatchObject({ slag: "modusC", grunn: status });
    }
  });

  it("🔴 gate 5: tidsrom kun på web → lokal=null (rendres «ingen registrering», ikke blank)", () => {
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [S1, S2] },
      lokaleTimer: [L1],
    });
    if (r.slag !== "modusB") throw new Error("forventet modusB");
    const kl15 = r.rader.find((x) => x.tidsrom === "15:00–17:00");
    expect(kl15).toMatchObject({ lokal: null, server: { id: "s2" }, valgt: "server" });
  });

  it("🔴 gate 5: tidsrom kun på appen → server=null, valgt='lokal'", () => {
    const Lekstra = rad({ id: "lx", fraTid: "17:00", tilTid: "18:00", timer: 1 });
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [S1] },
      lokaleTimer: [L1, Lekstra],
    });
    if (r.slag !== "modusB") throw new Error("forventet modusB");
    const kl17 = r.rader.find((x) => x.tidsrom === "17:00–18:00");
    expect(kl17).toMatchObject({ lokal: { id: "lx" }, server: null, valgt: "lokal" });
  });

  it("begge sider tomme → ingen rader (skjermen viser «ingen registreringer», ikke krasj)", () => {
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [] },
      lokaleTimer: [],
    });
    expect(r).toEqual({ slag: "modusB", rader: [] });
  });

  it("rader uten klokkeslett merges ALDRI sammen — hver blir sin egen linje (varighet-etikett)", () => {
    const Lu = rad({ id: "lu", fraTid: null, tilTid: null, timer: 8 });
    const Su = rad({ id: "su", fraTid: null, tilTid: null, timer: 6 });
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [Su] },
      lokaleTimer: [Lu],
    });
    if (r.slag !== "modusB") throw new Error("forventet modusB");
    expect(r.rader).toHaveLength(2);
    expect(r.rader.map((x) => x.tidsrom).sort()).toEqual(["6 t", "8 t"]);
    // Ingen linje har BEGGE sider satt (de kunne ikke bevises å være samme tidsrom).
    expect(r.rader.every((x) => !(x.lokal && x.server))).toBe(true);
  });

  it("rader sorteres på starttid; uten-tid sist", () => {
    const r = dagskortSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: { status: "draft", timer: [S2, S1] }, // 15:00 før 07:00 i input
      lokaleTimer: [rad({ id: "lu", timer: 3 })], // uten tid
    });
    if (r.slag !== "modusB") throw new Error("forventet modusB");
    expect(r.rader.map((x) => x.tidsrom)).toEqual(["07:00–15:00", "15:00–17:00", "3 t"]);
  });
});
