import { describe, expect, it } from "vitest";
import { regnJobbTid, validerJobbTid } from "./jobbTid";
import type { OvertidForslagRad } from "./overtidForslag";

// Plan § 8.22 L3a: jobbens Fra–til/pause → lønnslinjer. Skisse A/B/C: norm 7,5 t,
// pause 30 etter 4 t, firmaets arbeidstid 07:00–15:00.
const TIMELONN = { id: "timelonn", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 };
const OT50 = { id: "ot50", overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 2 };
const LONNSARTER = [TIMELONN, OT50];

const grunn = {
  linje1Overtidsnivaa: null,
  andreRader: [] as OvertidForslagRad[],
  norm: 7.5,
  lonnsarter: LONNSARTER,
  pauseEtterTimer: 4,
  fastPauseFra: null,
};

describe("regnJobbTid", () => {
  it("A: 07:00–15:00 / 30 = én linje 7,5 t", () => {
    const r = regnJobbTid({ ...grunn, fraTid: "07:00", tilTid: "15:00", pauseMin: 30 });
    expect(r.ok && r.linjer).toEqual([
      { fraTid: "07:00", tilTid: "15:00", timer: 7.5, pauseMin: 30, overtid: false },
    ]);
  });

  it("B: Til 15:30 gir normal 07:00–15:00 og overtid 15:00–15:30 (0,5 t)", () => {
    const r = regnJobbTid({ ...grunn, fraTid: "07:00", tilTid: "15:30", pauseMin: 30 });
    if (!r.ok) throw new Error("ugyldig");
    expect(r.timer).toBe(8);
    expect(r.overtidLonnsart?.id).toBe("ot50");
    expect(r.linjer).toEqual([
      { fraTid: "07:00", tilTid: "15:00", timer: 7.5, pauseMin: 30, overtid: false },
      { fraTid: "15:00", tilTid: "15:30", timer: 0.5, pauseMin: 0, overtid: true },
    ]);
  });

  it("C: neste jobb etter full norm er hel overtid (én linje)", () => {
    const forrige: OvertidForslagRad = {
      id: "r1", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, erReise: false, overtidsnivaa: null,
    };
    const r = regnJobbTid({ ...grunn, andreRader: [forrige], fraTid: "15:30", tilTid: "17:00", pauseMin: 0 });
    if (!r.ok) throw new Error("ugyldig");
    expect(r.helOvertid).toBe(true);
    expect(r.linjer).toHaveLength(1);
    expect(r.linjer[0]).toMatchObject({ timer: 1.5, overtid: true });
  });

  it("reise på dagen teller ikke mot normen", () => {
    const reise: OvertidForslagRad = {
      id: "re", fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true, overtidsnivaa: null,
    };
    const r = regnJobbTid({ ...grunn, andreRader: [reise], fraTid: "07:00", tilTid: "15:00", pauseMin: 30 });
    expect(r.ok && r.linjer).toHaveLength(1);
  });

  it("valgt overtidsart på linje 1 gir ingen ny overtidslinje", () => {
    const r = regnJobbTid({ ...grunn, linje1Overtidsnivaa: 50, fraTid: "07:00", tilTid: "15:30", pauseMin: 30 });
    expect(r.ok && r.linjer).toHaveLength(1);
  });

  it("uten norm eller overtidsart: én linje", () => {
    const utenNorm = regnJobbTid({ ...grunn, norm: null, fraTid: "07:00", tilTid: "16:00", pauseMin: 30 });
    const utenArt = regnJobbTid({ ...grunn, lonnsarter: [TIMELONN], fraTid: "07:00", tilTid: "16:00", pauseMin: 30 });
    expect(utenNorm.ok && utenNorm.linjer).toHaveLength(1);
    expect(utenArt.ok && utenArt.linjer).toHaveLength(1);
  });
});

describe("validerJobbTid", () => {
  it("godtar gyldig tid og avviser ugyldig", () => {
    expect(validerJobbTid({ fraTid: "07:00", tilTid: "15:00", pauseMin: 30 })).toBeNull();
    expect(validerJobbTid({ fraTid: "07:00", tilTid: "", pauseMin: 0 })).toBe("format");
    expect(validerJobbTid({ fraTid: "7:00", tilTid: "15:00", pauseMin: 0 })).toBe("format");
    expect(validerJobbTid({ fraTid: "15:00", tilTid: "07:00", pauseMin: 0 })).toBe("fraForTil");
    expect(validerJobbTid({ fraTid: "07:00", tilTid: "07:30", pauseMin: 30 })).toBe("pause");
    expect(validerJobbTid({ fraTid: "07:00", tilTid: "08:00", pauseMin: -5 })).toBe("pause");
  });
});
