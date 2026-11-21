import { describe, expect, it } from "vitest";
import {
  jobbSkjemaLinjer,
  klokkeSteg,
  lesPauseMin,
  lesTimer,
  nyJobbForslag,
  senesteTilTid,
  tilFraTimer,
} from "./jobbSkjema";

// Plan § 8.22 L3a: hvilke jobber skjemaet viser, og forslaget for neste jobb.
const OT = new Set(["ot50"]);
const erOt = (id: string) => OT.has(id);
const rad = (id: string, fraTid: string | null, tilTid: string | null, lonnsartId = "tl", attestertStatus = "pending") => ({
  id, fraTid, tilTid, lonnsartId, pauseMin: 0, attestertStatus,
});

describe("jobbSkjemaLinjer", () => {
  it("én linje, og normal + overtid rett etter, sortert på Fra", () => {
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00")], erOt)?.map((r) => r.id)).toEqual(["a"]);
    const to = jobbSkjemaLinjer([rad("b", "15:00", "15:30", "ot50"), rad("a", "07:00", "15:00")], erOt);
    expect(to?.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("står som i dag (null): 0 eller 3 linjer, hull, uten fra–til, attestert, linje 2 ikke overtid, linje 1 overtid", () => {
    expect(jobbSkjemaLinjer([], erOt)).toBeNull();
    expect(
      jobbSkjemaLinjer([rad("a", "07:00", "10:00"), rad("b", "10:00", "12:00", "ot50"), rad("c", "12:00", "13:00", "ot50")], erOt),
    ).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00"), rad("b", "15:30", "16:00", "ot50")], erOt)).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", null, null)], erOt)).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00", "tl", "attestert")], erOt)).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00", "tl", "erstattet")], erOt)).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00"), rad("b", "15:00", "16:00")], erOt)).toBeNull();
    expect(jobbSkjemaLinjer([rad("a", "07:00", "15:00", "ot50"), rad("b", "15:00", "16:00", "ot50")], erOt)).toBeNull();
  });
});

describe("nyJobbForslag", () => {
  it("ny dag: firmaets tider, merket «firma»", () => {
    expect(nyJobbForslag({ sisteTil: null, firmaStart: "07:00", firmaSlutt: "15:00", firmaPauseMin: 30 })).toEqual({
      fraTid: "07:00", tilTid: "15:00", pauseMin: 30, kilde: "firma",
    });
  });
  it("neste jobb: Fra = forrige slutt; Til = firmaets slutt bare når den er senere", () => {
    expect(nyJobbForslag({ sisteTil: "12:00", firmaStart: "07:00", firmaSlutt: "15:00", firmaPauseMin: 30 })).toEqual({
      fraTid: "12:00", tilTid: "15:00", pauseMin: 0, kilde: "forrige",
    });
    expect(nyJobbForslag({ sisteTil: "15:00", firmaStart: "07:00", firmaSlutt: "15:00", firmaPauseMin: 30 }).tilTid).toBe("");
    expect(nyJobbForslag({ sisteTil: "16:00", firmaStart: "07:00", firmaSlutt: "15:00", firmaPauseMin: 30 }).tilTid).toBe("");
  });
});

describe("senesteTilTid og lesPauseMin", () => {
  it("seneste til over hele dagen, null uten tider", () => {
    expect(senesteTilTid([{ tilTid: "15:00" }, { tilTid: null }, { tilTid: "16:30" }, { tilTid: "09:00" }])).toBe("16:30");
    expect(senesteTilTid([{ tilTid: null }])).toBeNull();
  });
  it("tomt = 0, tall = tall, ellers NaN", () => {
    expect(lesPauseMin(" ")).toBe(0);
    expect(lesPauseMin("30")).toBe(30);
    expect(Number.isNaN(lesPauseMin("3o"))).toBe(true);
  });
});

// Plan § 8.22 O2: timer gir Til.
describe("lesTimer og tilFraTimer", () => {
  it("komma og punktum", () => {
    expect(lesTimer("7,5")).toBe(7.5);
    expect(lesTimer("7.5")).toBe(7.5);
    expect(lesTimer("1")).toBe(1);
    expect(lesTimer("")).toBeNull();
    expect(lesTimer("0")).toBeNull();
    expect(lesTimer("x")).toBeNull();
  });
  it("Til = Fra + timer + pause", () => {
    expect(tilFraTimer("07:00", "8", 0)).toBe("15:00");
    expect(tilFraTimer("07:00", "7,5", 30)).toBe("15:00");
    expect(tilFraTimer("12:00", "1", 0)).toBe("13:00");
  });
  it("tom eller ugyldig Fra → ingenting regnes ut", () => {
    expect(tilFraTimer("", "8", 0)).toBeNull();
    expect(tilFraTimer("7", "8", 0)).toBeNull();
    expect(tilFraTimer("07:00", "", 0)).toBeNull();
  });
});

describe("klokkefeltets steg", () => {
  it("15-minutters steg som timevinduet; firmaets runding, maks 30", () => {
    expect(klokkeSteg(null)).toBe(15);
    expect(klokkeSteg(0)).toBe(15);
    expect(klokkeSteg(5)).toBe(5);
    expect(klokkeSteg(60)).toBe(30);
  });
});
