import { describe, it, expect } from "vitest";
import {
  dagskortSammenligning,
  overlappSammenligning,
  type TimerRad,
} from "./dagskortSammenligning";
import type { ForsonRad } from "@sitedoc/shared";

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

/* ====================================================================
 *  V19-B (B-3) — overlapp-modus: FORSLAGET (server) mot sedelen, paret
 *  PR. OVERLAPP (ikke eksakt tidsrom).
 * ================================================================== */
const frad = (o: Partial<ForsonRad> & { id: string }): ForsonRad => ({
  projectId: "p1",
  lonnsartId: "l1",
  aktivitetId: "a1",
  timer: 0,
  fraTid: null,
  tilTid: null,
  ...o,
});

describe("overlappSammenligning — pr-overlapp-paring (V19-B B-3)", () => {
  it("offline/laster/utilgjengelig håndteres likt (web-radene finnes ikke lokalt)", () => {
    const base = { webKort: null, forslag: [frad({ id: "f1" })] };
    expect(
      overlappSammenligning({ ...base, nettStatus: "offline", webLaster: false }),
    ).toEqual({ slag: "offline" });
    expect(
      overlappSammenligning({ ...base, nettStatus: "online", webLaster: true }),
    ).toEqual({ slag: "laster" });
    expect(
      overlappSammenligning({ ...base, nettStatus: "online", webLaster: false }),
    ).toEqual({ slag: "utilgjengelig" });
  });

  it("🔴 FASIT: web 07:00–15:00 (7,5 t) vs forslag 07:00–15:30 (8 t) → ÉN valgbar slot, forhåndsvalg «web»", () => {
    const r = overlappSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: {
        status: "draft",
        sedelRader: [frad({ id: "web1", fraTid: "07:00", tilTid: "15:00", timer: 7.5 })],
      },
      forslag: [frad({ id: "mob1", fraTid: "07:00", tilTid: "15:30", timer: 8 })],
    });
    expect(r.slag).toBe("modusB");
    if (r.slag !== "modusB") return;
    expect(r.rader).toHaveLength(1);
    expect(r.rader[0]).toMatchObject({
      nokkel: "mob1", // valg-nøkkel = forslagsradens id
      lokal: { id: "mob1", timer: 8 }, // appen = forslaget
      server: { id: "web1", timer: 7.5 }, // web = sedelen
      valgt: "server", // konservativt: behold PC til brukeren velger
      valgbar: true,
    });
  });

  it("forslag uten motpart → ensidig slot, IKKE valgbar (Q3(b))", () => {
    const r = overlappSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: {
        status: "draft",
        sedelRader: [frad({ id: "web1", fraTid: "07:00", tilTid: "10:00", timer: 3 })],
      },
      forslag: [frad({ id: "mob1", fraTid: "12:00", tilTid: "15:00", timer: 3 })],
    });
    if (r.slag !== "modusB") throw new Error("forventet modusB");
    // Ingen overlapp → to ensidige slots, ingen valgbar.
    expect(r.rader).toHaveLength(2);
    expect(r.rader.every((x) => x.valgbar === false)).toBe(true);
    const f = r.rader.find((x) => x.lokal?.id === "mob1");
    expect(f).toMatchObject({ server: null, valgt: "lokal", valgbar: false });
    const s = r.rader.find((x) => x.server?.id === "web1");
    expect(s).toMatchObject({ lokal: null, valgt: "server", valgbar: false });
  });

  it("låst sedel (sent/accepted) → modusC (lesevisning)", () => {
    const r = overlappSammenligning({
      nettStatus: "online",
      webLaster: false,
      webKort: {
        status: "accepted",
        sedelRader: [frad({ id: "web1", fraTid: "07:00", tilTid: "15:00", timer: 7.5 })],
      },
      forslag: [frad({ id: "mob1", fraTid: "07:00", tilTid: "15:30", timer: 8 })],
    });
    expect(r).toMatchObject({ slag: "modusC", grunn: "accepted" });
  });
});
