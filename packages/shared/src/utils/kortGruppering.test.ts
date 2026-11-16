import { describe, it, expect } from "vitest";
import { grupperPaaKort, byggKortRader, type KortRadLinje } from "./kortGruppering";

// Kort-id-spec § 12.2 G1–G11, R3, R16. Testene T21, T22, T23, T37 og T52 (§ 12.7).

let teller = 0;
const tid = (min: number) => new Date(Date.UTC(2026, 10, 16, 6, min)).toISOString();

const timer = (over: Record<string, unknown> = {}) => ({
  id: `t${++teller}`,
  sheetId: "s1",
  kortId: "k1" as string | null,
  projectId: "p1" as string | null,
  externalCostObjectId: null as string | null,
  byggeplassId: null as string | null,
  fraTid: null as string | null,
  tilTid: null as string | null,
  timer: 2,
  erReise: false,
  attestertStatus: "pending",
  createdAt: tid(teller),
  ...over,
});
const maskin = (over: Record<string, unknown> = {}) => ({
  id: `m${++teller}`,
  sheetId: "s1",
  kortId: "k1" as string | null,
  projectId: "p1",
  sheetTimerId: null as string | null,
  vehicleId: "v1",
  fraTid: null as string | null,
  tilTid: null as string | null,
  timer: 1,
  mengde: null as number | null,
  enhet: null as string | null,
  utleieEnhet: "time" as string | null,
  createdAt: tid(teller),
  ...over,
});
const vare = (over: Record<string, unknown> = {}) => ({
  id: `v${++teller}`,
  kortId: "k1" as string | null,
  sheetTimerId: null as string | null,
  vareId: "vare1",
  antall: 3,
  createdAt: tid(teller),
  ...over,
});
const tillegg = (over: Record<string, unknown> = {}) => ({
  id: `ti${++teller}`,
  kortId: "k1" as string | null,
  createdAt: tid(teller),
  ...over,
});

const antallRader = (g: ReturnType<typeof grupperPaaKort>) => {
  let n = g.reise.length;
  const tellLinje = (l: (typeof g.utenKort)[number]) => {
    n += 1;
    if (l.type === "timer") n += l.maskiner.length + l.varer.length;
  };
  for (const k of g.kort) k.linjer.forEach(tellLinje);
  g.utenKort.forEach(tellLinje);
  return n;
};

describe("grupperPaaKort", () => {
  it("T21: to kort med samme prosjekt, underprosjekt og byggeplass gir to grupper, linjer sortert på fraTid", () => {
    const a1 = timer({ kortId: "kA", fraTid: "10:00" });
    const a2 = timer({ kortId: "kA", fraTid: "07:00" });
    const a3 = timer({ kortId: "kA", fraTid: null });
    const b1 = timer({ kortId: "kB", fraTid: "06:00" });
    const g = grupperPaaKort({ timer: [a3, a1, b1, a2] });
    expect(g.kort.map((k) => k.kortId)).toEqual(["kB", "kA"]);
    const kA = g.kort[1]!;
    expect(kA.linjer.map((l) => l.rad.id)).toEqual([a2.id, a1.id, a3.id]);
  });

  it("T21: kort uten tid står etter kort med tid; likt → eldste rad, så kortId", () => {
    const x = timer({ kortId: "kX", fraTid: null });
    const y = timer({ kortId: "kY", fraTid: "08:00" });
    const z1 = timer({ kortId: "kZ", fraTid: "08:00", createdAt: tid(-5) });
    const g = grupperPaaKort({ timer: [x, y, z1] });
    expect(g.kort.map((k) => k.kortId)).toEqual(["kZ", "kY", "kX"]);
  });

  it("T22: maskin og vare med kobling står på timeradens linje i ført rekkefølge; ellers egne linjer etter timelinjene", () => {
    const t1 = timer({ kortId: "k1", fraTid: "07:00" });
    const t2 = timer({ kortId: "k2", fraTid: "12:00" });
    const reise = timer({ kortId: null, erReise: true, fraTid: "06:00" });
    const loes = timer({ kortId: null, fraTid: "15:00" });
    const m1 = maskin({ kortId: "k1", sheetTimerId: t1.id, createdAt: tid(50) });
    const m2 = maskin({ kortId: "k1", sheetTimerId: t1.id, createdAt: tid(40) });
    const mAnnet = maskin({ kortId: "k1", sheetTimerId: t2.id, fraTid: "09:00" });
    const mUten = maskin({ kortId: "k1", sheetTimerId: null, fraTid: "08:00" });
    const v1 = vare({ kortId: "k1", sheetTimerId: t1.id });
    const vBorte = vare({ kortId: "k1", sheetTimerId: "finnes-ikke" });
    const vUtenKort = vare({ kortId: null });
    const ti = tillegg({ kortId: "k1" });
    const inn = {
      timer: [t1, t2, reise, loes],
      maskiner: [m1, m2, mAnnet, mUten],
      varer: [v1, vBorte, vUtenKort],
      tillegg: [ti],
    };
    const g = grupperPaaKort(inn);

    const k1 = g.kort.find((k) => k.kortId === "k1")!;
    const forste = k1.linjer[0]!;
    expect(forste.type).toBe("timer");
    if (forste.type !== "timer") throw new Error();
    expect(forste.rad.id).toBe(t1.id);
    expect(forste.maskiner.map((m) => m.id)).toEqual([m2.id, m1.id]);
    expect(forste.varer.map((v) => v.id)).toEqual([v1.id]);
    // Egne linjer etter timelinjene: maskin på egen fra-tid, uten tid sist, så vare, så tillegg.
    expect(k1.linjer.slice(1).map((l) => `${l.type}:${l.rad.id}`)).toEqual([
      `maskin:${mUten.id}`,
      `maskin:${mAnnet.id}`,
      `vare:${vBorte.id}`,
      `tillegg:${ti.id}`,
    ]);
    expect(g.reise.map((r) => r.id)).toEqual([reise.id]);
    expect(g.utenKort.map((l) => l.rad.id).sort()).toEqual([loes.id, vUtenKort.id].sort());
    const inntall = inn.timer.length + inn.maskiner.length + inn.varer.length + inn.tillegg.length;
    expect(antallRader(g)).toBe(inntall);
  });

  it("T23: rader uten underprosjekt fra to prosjekter på samme sedel gir to kort med hvert sitt hode", () => {
    const p1 = timer({ kortId: "kP1", projectId: "p1", fraTid: "07:00" });
    const p2 = timer({ kortId: "kP2", projectId: "p2", fraTid: "12:00" });
    const g = grupperPaaKort({ timer: [p1, p2] });
    expect(g.kort).toHaveLength(2);
    expect(g.kort.map((k) => k.hode?.projectId)).toEqual(["p1", "p2"]);
  });

  it("T52: maskin uten sheetTimerId med kortId er egen linje i kortet sitt, ikke i «Uten kort»", () => {
    const t1 = timer({ kortId: "k1", fraTid: "07:00" });
    const m = maskin({ kortId: "k1", sheetTimerId: null });
    const g = grupperPaaKort({ timer: [t1], maskiner: [m] });
    expect(g.utenKort).toEqual([]);
    expect(g.kort[0]!.linjer.map((l) => l.type)).toEqual(["timer", "maskin"]);
  });
});

describe("byggKortRader", () => {
  const timerLinjer = (rader: KortRadLinje[]) => rader.filter((r) => r.type === "timer");

  it("T37: timerad med én koblet døgn-maskin og én koblet vare gir én linje", () => {
    const t1 = timer({ fraTid: "07:00", timer: 7.5 });
    const m = maskin({ sheetTimerId: t1.id, utleieEnhet: "doegn", mengde: 12, enhet: "m3", timer: 1 });
    const v = vare({ sheetTimerId: t1.id, antall: 4 });
    const rader = byggKortRader({ timer: [t1], maskiner: [m], varer: [v] });
    expect(rader).toHaveLength(1);
    expect(rader[0]!.maskiner).toHaveLength(1);
    expect(rader[0]!.varer).toHaveLength(1);
    expect(rader[0]!.maskiner[0]).toMatchObject({ mengde: 12, enhet: "m3", timer: 1 });
  });

  it("T37: timerad med to maskiner og tre varer gir én linje med to og tre i ført rekkefølge", () => {
    const t1 = timer({ fraTid: "07:00", timer: 8 });
    const m1 = maskin({ sheetTimerId: t1.id, createdAt: tid(90), timer: 2 });
    const m2 = maskin({ sheetTimerId: t1.id, createdAt: tid(80), timer: 3 });
    const v1 = vare({ sheetTimerId: t1.id, createdAt: tid(70) });
    const v2 = vare({ sheetTimerId: t1.id, createdAt: tid(60) });
    const v3 = vare({ sheetTimerId: t1.id, createdAt: tid(95) });
    const mUten = maskin({ sheetTimerId: null, fraTid: "13:00", tilTid: "14:00", timer: 1 });
    const rader = byggKortRader({ timer: [t1], maskiner: [m1, m2, mUten], varer: [v1, v2, v3] });
    expect(rader).toHaveLength(2);
    expect(rader[0]!.maskiner.map((m) => m.id)).toEqual([m2.id, m1.id]);
    expect(rader[0]!.varer.map((v) => v.id)).toEqual([v2.id, v1.id, v3.id]);
    // Maskin uten kobling: egen linje med egen fra–til.
    expect(rader[1]).toMatchObject({ type: "maskin", fraTid: "13:00", tilTid: "14:00", timer: null });
    // Summene er lik kildens.
    const sumTimer = timerLinjer(rader).reduce((a, r) => a + (r.timer ?? 0), 0);
    const sumMaskin = rader.flatMap((r) => r.maskiner).reduce((a, m) => a + m.timer, 0);
    expect(sumTimer).toBe(8);
    expect(sumMaskin).toBe(6);
  });

  it("T52: merket «uten timerad» bare på maskin som krever timerad og mangler gyldig kobling", () => {
    const t1 = timer({ fraTid: "07:00" });
    const reise = timer({ kortId: "k1", erReise: true, fraTid: "06:00" });
    const mTime = maskin({ sheetTimerId: null, utleieEnhet: "time" });
    const mUkjent = maskin({ sheetTimerId: null, utleieEnhet: null });
    const mDoegn = maskin({ sheetTimerId: null, utleieEnhet: "doegn" });
    const mPaaReise = maskin({ sheetTimerId: reise.id, utleieEnhet: "time" });
    const mOk = maskin({ sheetTimerId: t1.id, utleieEnhet: "time" });
    const rader = byggKortRader({ timer: [t1, reise], maskiner: [mTime, mUkjent, mDoegn, mPaaReise, mOk] });
    const merket = rader.flatMap((r) => r.maskiner).filter((m) => m.utenTimerad).map((m) => m.id);
    expect(merket.sort()).toEqual([mTime.id, mUkjent.id, mPaaReise.id].sort());
  });

  it("reise og «Uten kort» kommer med, antall inn = antall ut", () => {
    const t1 = timer({ fraTid: "07:00" });
    const reise = timer({ kortId: null, erReise: true, fraTid: "06:00" });
    const loes = timer({ kortId: null });
    const rader = byggKortRader({ timer: [t1, reise, loes] });
    expect(rader.map((r) => r.blokk)).toEqual(["kort", "reise", "utenKort"]);
  });
});
