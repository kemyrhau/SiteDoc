import { describe, it, expect } from "vitest";
import {
  byggForsonInputFraValg,
  parForslagMotSedel,
  overlappBlokkererAttestering,
  type ForsonRad,
} from "./forsonValg";

/** Kortform for en rad med tid. */
function rad(
  id: string,
  fraTid: string | null,
  tilTid: string | null,
  timer: number,
  over: Partial<ForsonRad> = {},
): ForsonRad {
  return {
    id,
    projectId: "p1",
    lonnsartId: "l1",
    aktivitetId: "a1",
    timer,
    fraTid,
    tilTid,
    ...over,
  };
}

describe("byggForsonInputFraValg", () => {
  it("fasit A: web 07:00–15:00, forslag 07:00–15:30, velg «appen» → erstatt web-raden in-place (8 t, ikke 15,5)", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [rad("mob1", "07:00", "15:30", 8)];
    const res = byggForsonInputFraValg(sedel, forslag, { mob1: "forslag" });
    // Ett oppdatering som treffer web-radens id — ingen ny rad (ellers 15,5 t).
    expect(res.nyeRader).toHaveLength(0);
    expect(res.oppdateringer).toHaveLength(1);
    expect(res.oppdateringer[0]).toMatchObject({
      id: "web1",
      fraTid: "07:00",
      tilTid: "15:30",
      timer: 8,
    });
  });

  it("fasit B: velg «behold PC» (tomt/sedel) → ingen input → kortet uendret (forslag slettes server-side)", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [rad("mob1", "07:00", "15:30", 8)];
    const res = byggForsonInputFraValg(sedel, forslag, { mob1: "sedel" });
    expect(res.oppdateringer).toHaveLength(0);
    expect(res.nyeRader).toHaveLength(0);
  });

  it("manglende valg → konservativt «behold PC» (ingen lønnsdata overskrives)", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [rad("mob1", "07:00", "15:30", 8)];
    const res = byggForsonInputFraValg(sedel, forslag, {});
    expect(res.oppdateringer).toHaveLength(0);
    expect(res.nyeRader).toHaveLength(0);
  });

  it("forslagsrad uten motpart (kun mobil) → beholdes alltid som ny rad", () => {
    const sedel = [rad("web1", "07:00", "11:00", 4)];
    // mobil har en ekstra rad på ettermiddagen som ikke overlapper web-raden
    const forslag = [rad("mob2", "12:00", "16:00", 4)];
    const res = byggForsonInputFraValg(sedel, forslag, {});
    expect(res.oppdateringer).toHaveLength(0);
    expect(res.nyeRader).toHaveLength(1);
    expect(res.nyeRader[0]).toMatchObject({ fraTid: "12:00", tilTid: "16:00", timer: 4 });
  });

  it("serverrad uten motpart (kun PC) → no-op (beholdes)", () => {
    // PC har to rader; mobil overlapper bare den første
    const sedel = [rad("web1", "07:00", "11:00", 4), rad("web2", "12:00", "16:00", 4)];
    const forslag = [rad("mob1", "07:00", "11:30", 4.5)];
    const res = byggForsonInputFraValg(sedel, forslag, { mob1: "forslag" });
    // Kun web1 erstattes; web2 står (ikke referert).
    expect(res.oppdateringer).toHaveLength(1);
    expect(res.oppdateringer[0]!.id).toBe("web1");
    expect(res.nyeRader).toHaveLength(0);
  });

  it("«hele dagen appen»: alle forslagsrader → forslag, 1:1-paring mot sorterte serverrader", () => {
    const sedel = [rad("web1", "07:00", "11:00", 4), rad("web2", "12:00", "16:00", 4)];
    const forslag = [rad("mobA", "07:00", "11:30", 4.5), rad("mobB", "12:00", "16:30", 4.5)];
    const res = byggForsonInputFraValg(sedel, forslag, {
      mobA: "forslag",
      mobB: "forslag",
    });
    expect(res.nyeRader).toHaveLength(0);
    expect(res.oppdateringer).toHaveLength(2);
    const idmap = Object.fromEntries(res.oppdateringer.map((o) => [o.id, o]));
    expect(idmap["web1"]).toMatchObject({ tilTid: "11:30" });
    expect(idmap["web2"]).toMatchObject({ tilTid: "16:30" });
  });

  it("blandet valg pr. tidsrom: ett appen, ett PC", () => {
    const sedel = [rad("web1", "07:00", "11:00", 4), rad("web2", "12:00", "16:00", 4)];
    const forslag = [rad("mobA", "07:00", "11:30", 4.5), rad("mobB", "12:00", "16:30", 4.5)];
    const res = byggForsonInputFraValg(sedel, forslag, {
      mobA: "forslag",
      mobB: "sedel",
    });
    expect(res.oppdateringer).toHaveLength(1);
    expect(res.oppdateringer[0]!.id).toBe("web1");
    expect(res.nyeRader).toHaveLength(0);
  });

  it("bevarer felt (prosjekt/lønnsart/aktivitet/beskrivelse/eco/vehicle) fra forslaget", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [
      rad("mob1", "07:00", "15:30", 8, {
        projectId: "p9",
        lonnsartId: "l9",
        aktivitetId: "a9",
        beskrivelse: "graving",
        externalCostObjectId: "eco9",
        vehicleId: "v9",
      }),
    ];
    const res = byggForsonInputFraValg(sedel, forslag, { mob1: "forslag" });
    expect(res.oppdateringer[0]).toMatchObject({
      id: "web1",
      projectId: "p9",
      lonnsartId: "l9",
      aktivitetId: "a9",
      beskrivelse: "graving",
      externalCostObjectId: "eco9",
      vehicleId: "v9",
    });
  });

  it("tomt forslag → tom input", () => {
    const res = byggForsonInputFraValg([rad("web1", "07:00", "15:00", 7.5)], [], {});
    expect(res.oppdateringer).toHaveLength(0);
    expect(res.nyeRader).toHaveLength(0);
  });
});

describe("parForslagMotSedel (delt paring — radio-visning + forsoning) [V19-C-bruk]", () => {
  it("overlappende rader → én paret slot (begge sider, valgbar)", () => {
    const slots = parForslagMotSedel(
      [rad("web1", "07:00", "15:00", 7.5)],
      [rad("mob1", "07:00", "15:30", 8)],
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      nokkel: "mob1",
      sedel: { id: "web1" },
      forslag: { id: "mob1" },
      valgbar: true,
    });
  });

  it("forslag-only og sedel-only → to ensidige slots (ikke valgbare)", () => {
    const slots = parForslagMotSedel(
      [rad("web1", "07:00", "11:00", 4)],
      [rad("mob2", "12:00", "16:00", 4)],
    );
    expect(slots).toHaveLength(2);
    // Forslag-slots først (fra-tid-rekkefølge), deretter sedel-kun.
    expect(slots[0]).toMatchObject({ forslag: { id: "mob2" }, sedel: null, valgbar: false });
    expect(slots[1]).toMatchObject({ sedel: { id: "web1" }, forslag: null, valgbar: false });
  });

  it("to sammenhengende tidsrom → to parede slots, 1:1 på fra-tid", () => {
    const slots = parForslagMotSedel(
      [rad("web1", "07:00", "11:00", 4), rad("web2", "12:00", "16:00", 4)],
      [rad("mobA", "07:00", "11:30", 4.5), rad("mobB", "12:00", "16:30", 4.5)],
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ sedel: { id: "web1" }, forslag: { id: "mobA" }, valgbar: true });
    expect(slots[1]).toMatchObject({ sedel: { id: "web2" }, forslag: { id: "mobB" }, valgbar: true });
  });

  it("tid-løs serverrad kan ikke pares → ensidig sedel-slot", () => {
    const slots = parForslagMotSedel(
      [rad("web1", null, null, 7.5)],
      [rad("mob1", "07:00", "15:00", 7.5)],
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ forslag: { id: "mob1" }, sedel: null, valgbar: false });
    expect(slots[1]).toMatchObject({ nokkel: "sedel:web1", sedel: { id: "web1" }, forslag: null });
  });

  it("paringen er den byggForsonInputFraValg faktisk bruker (valgbare = parede)", () => {
    const sedel = [rad("web1", "07:00", "11:00", 4), rad("web2", "12:00", "16:00", 4)];
    const forslag = [rad("mobA", "07:00", "11:30", 4.5)];
    const slots = parForslagMotSedel(sedel, forslag);
    const parede = slots.filter((s) => s.valgbar && s.forslag && s.sedel);
    // Bygg «velg forslag» for alle parede slots → nøyaktig de oppdateringene.
    const valg = Object.fromEntries(parede.map((s) => [s.forslag!.id, "forslag" as const]));
    const res = byggForsonInputFraValg(sedel, forslag, valg);
    expect(res.oppdateringer.map((o) => o.id)).toEqual(parede.map((s) => s.sedel!.id));
  });
});

describe("overlappBlokkererAttestering (C-2 — attester-knappen død ved uavklart overlapp)", () => {
  it("konfliktVentendeSiden satt → blokkert (uten dette ville attester-knappen stått aktiv)", () => {
    expect(overlappBlokkererAttestering(new Date("2026-10-04T08:00:00Z"))).toBe(true);
    expect(overlappBlokkererAttestering("2026-10-04T08:00:00Z")).toBe(true);
  });

  it("null/undefined → ikke blokkert (normal attestering)", () => {
    expect(overlappBlokkererAttestering(null)).toBe(false);
    expect(overlappBlokkererAttestering(undefined)).toBe(false);
  });
});
