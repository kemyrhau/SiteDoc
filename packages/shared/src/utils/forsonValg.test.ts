import { describe, it, expect } from "vitest";
import { byggForsonInputFraValg, type ForsonRad } from "./forsonValg";

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
