import { describe, it, expect } from "vitest";
import { carveArbeidstider, type CarveSegment } from "./carveArbeidstid";
import {
  finnTidsromKonflikt,
  finnOverlappendeTidsrom,
  tilErEtterFra,
  type Tidsrom,
} from "./tidsromValidering";
import { effektiveTimerFraSpenn, pauseVinduFra } from "./pauseBeregning";

/** Pausevindu 4 t inn i skiftet (firma-default) fra en gitt start. */
const pause4 = (start: string) => pauseVinduFra(start, 4.0);

describe("carveArbeidstider", () => {
  it("carver normaltid + OT sekvensielt fra reelt start (reise=0, pause krysses)", () => {
    // 07:00 start, 30 min pause 11:00–11:30, 7.5 t normaltid + 2.0 t OT.
    const v = carveArbeidstider({
      startTid: "07:00",
      reisetidTimer: 0,
      pauseFra: pause4("07:00"), // 11:00
      pauseMin: 30,
      segmenter: [
        { overtidsnivaa: null, timer: 7.5 },
        { overtidsnivaa: 50, timer: 2.0 },
      ],
    });
    expect(v).toHaveLength(2);
    expect(v[0]!.fraTid).toBe("07:00");
    // Normaltid 7.5 t krysser lunsj (11:00) → 07:00 + 7.5 t + 30 min = 15:00.
    expect(v[0]!.tilTid).toBe("15:00");
    // OT starter der normaltid slutter, ingen (ny) pause → 15:00 + 2 t = 17:00.
    expect(v[1]!.fraTid).toBe("15:00");
    expect(v[1]!.tilTid).toBe("17:00");
  });

  it("reise>0 forskyver arbeids-start (reise føres på egen rad uten tid)", () => {
    const v = carveArbeidstider({
      startTid: "07:00",
      reisetidTimer: 1, // arbeid starter 08:00
      pauseFra: pause4("07:00"),
      pauseMin: 30,
      segmenter: [{ overtidsnivaa: null, timer: 6.5 }],
    });
    expect(v[0]!.fraTid).toBe("08:00");
    // 08:00 + 6.5 t, krysser 11:00-pause → +30 min = 15:00.
    expect(v[0]!.tilTid).toBe("15:00");
  });

  it("hopper over 0-segmenter", () => {
    const v = carveArbeidstider({
      startTid: "07:00",
      reisetidTimer: 0,
      pauseFra: pause4("07:00"),
      pauseMin: 30,
      segmenter: [
        { overtidsnivaa: null, timer: 0 },
        { overtidsnivaa: 50, timer: 3 },
      ],
    });
    expect(v).toHaveLength(1);
    expect(v[0]!.overtidsnivaa).toBe(50);
  });

  it("hvert vindu har effektive timer == segmentets timer (pause trukket ut)", () => {
    const v = carveArbeidstider({
      startTid: "06:30",
      reisetidTimer: 0.5,
      pauseFra: pause4("06:30"),
      pauseMin: 30,
      segmenter: [
        { overtidsnivaa: null, timer: 7.5 },
        { overtidsnivaa: 50, timer: 1.5 },
      ],
    });
    for (const vindu of v) {
      const eff = effektiveTimerFraSpenn(
        vindu.fraTid,
        vindu.tilTid,
        pause4("06:30"),
        30,
      );
      expect(eff).toBeCloseTo(vindu.timer, 2);
    }
  });

  // Fabel krav 2: bevis sekvensielle, ikke-overlappende vinduer på tvers av
  // kanttilfeller. Overlapp-sjekken (finnTidsromKonflikt) må returnere null.
  it("produserer ALDRI overlappende vinduer (property mot finnTidsromKonflikt)", () => {
    const scenarier: Array<{
      startTid: string;
      reisetidTimer: number;
      pauseMin: number;
      segmenter: CarveSegment[];
    }> = [
      // basis
      { startTid: "07:00", reisetidTimer: 0, pauseMin: 30, segmenter: [{ overtidsnivaa: null, timer: 7.5 }, { overtidsnivaa: 50, timer: 2 }] },
      // reise-forskyvning
      { startTid: "07:00", reisetidTimer: 1.5, pauseMin: 30, segmenter: [{ overtidsnivaa: null, timer: 6 }, { overtidsnivaa: 50, timer: 1 }] },
      // pause spiser (nesten) hele et lite vindu (0.25 t arbeid som krysser lunsj)
      { startTid: "10:45", reisetidTimer: 0, pauseMin: 30, segmenter: [{ overtidsnivaa: null, timer: 0.25 }, { overtidsnivaa: 50, timer: 3 }] },
      // tre segmenter
      { startTid: "06:00", reisetidTimer: 0, pauseMin: 45, segmenter: [{ overtidsnivaa: null, timer: 7.5 }, { overtidsnivaa: 50, timer: 2.5 }, { overtidsnivaa: 100, timer: 2 }] },
      // sen start mot midnatt (kappet-dag) — clamping skal ikke gi overlapp
      { startTid: "21:00", reisetidTimer: 0, pauseMin: 0, segmenter: [{ overtidsnivaa: null, timer: 2 }, { overtidsnivaa: 50, timer: 0.5 }] },
      // pause = 0 (ingen pause konfigurert)
      { startTid: "08:00", reisetidTimer: 0, pauseMin: 0, segmenter: [{ overtidsnivaa: null, timer: 7.5 }, { overtidsnivaa: 50, timer: 2 }] },
    ];

    for (const s of scenarier) {
      const v = carveArbeidstider({
        startTid: s.startTid,
        reisetidTimer: s.reisetidTimer,
        pauseFra: pause4(s.startTid),
        pauseMin: s.pauseMin,
        segmenter: s.segmenter,
      });
      const tidsrom: Tidsrom[] = v.map((x) => ({
        fraTid: x.fraTid,
        tilTid: x.tilTid,
      }));
      // Ingen overlapp OG hver til > fra.
      expect(finnTidsromKonflikt(tidsrom)).toBeNull();
      for (const t of tidsrom) {
        expect(tilErEtterFra(t.fraTid, t.tilTid)).toBe(true);
      }
      // Sekvensiell: hvert vindus fra == forrige vindus til (endepunkt-berøring).
      for (let i = 1; i < v.length; i++) {
        expect(v[i]!.fraTid).toBe(v[i - 1]!.tilTid);
      }
    }
  });

  // Fabel krav 3: reise-unntaket (null-tider) skal ALDRI gi falsk overlapp mot
  // de carvede arbeids-radene i redigeringsflaten — finnOverlappendeTidsrom
  // hopper over rader uten begge tider.
  it("tid-løs reise-rad gir ingen falsk overlapp mot carvede rader", () => {
    const v = carveArbeidstider({
      startTid: "07:00",
      reisetidTimer: 1,
      pauseFra: pause4("07:00"),
      pauseMin: 30,
      segmenter: [{ overtidsnivaa: null, timer: 6.5 }],
    });
    const reiseRad: Tidsrom = { fraTid: null, tilTid: null };
    const alle: Tidsrom[] = [reiseRad, ...v];
    // Ingen av de carvede vinduene "overlapper" reise-raden.
    for (const vindu of v) {
      expect(
        finnOverlappendeTidsrom(vindu.fraTid, vindu.tilTid, [reiseRad]),
      ).toBeNull();
    }
    // Og hele settet er konfliktfritt (reise hoppes over).
    expect(finnTidsromKonflikt(alle)).toBeNull();
  });
});
