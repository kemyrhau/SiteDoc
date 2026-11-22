import { describe, it, expect } from "vitest";
import nb from "../i18n/nb.json";
import en from "../i18n/en.json";
import {
  TIMER_KOL_KEYS,
  TIMER_KOL_I18N,
  TIMER_TABELL_KOL,
  TIMER_TABELL_KOL_KEYS,
  TIMER_TABELL_STANDARD,
  TIMER_TABELL_KOL_BREDDE,
  TIMER_TABELL_TILLAGT,
  erOvertidsnivaa,
  sumOvertidTimer,
  timerTabellVerdi,
  antallUnderlinjer,
  vareOgMengdeTekst,
  type TimerTabellLinje,
} from "./timerDetaljRader";

/**
 * Kolonnelista for attesteringstabellen og rapportens Detaljer (spec prosjektkort-kortid
 * R16/H9/H14, T40/T47, ordre d2b-1 commit 2). Rød før commit 2: eksportene fantes ikke.
 */
const nbT = nb as Record<string, string>;
const enT = en as Record<string, string>;

describe("T40 — samme nøkler og overskrifter som eksporten", () => {
  it("hver eksportnøkkel finnes i tabellens liste, i samme rekkefølge først", () => {
    expect(TIMER_TABELL_KOL_KEYS.slice(0, TIMER_KOL_KEYS.length)).toEqual([...TIMER_KOL_KEYS]);
  });

  it("overskriften er eksportens — unntatt maskinens mengde/enhet til d3", () => {
    for (const k of TIMER_KOL_KEYS) {
      if (k === "mengde" || k === "enhet") continue;
      expect(TIMER_TABELL_KOL[k].i18n, k).toBe(TIMER_KOL_I18N[k]);
    }
    expect(TIMER_TABELL_KOL.mengde.i18n).toBe("kolMaskinmengde");
    expect(TIMER_TABELL_KOL.enhet.i18n).toBe("kolMaskinenhet");
    // Eksporten er urørt til d3 (beslutning 2).
    expect(TIMER_KOL_I18N.mengde).toBe("kolMengde");
    expect(TIMER_KOL_I18N.enhet).toBe("kolEnhet");
  });

  it("hver kolonne har overskrift i nb og en, og standardbredde", () => {
    for (const k of TIMER_TABELL_KOL_KEYS) {
      const nokkel = `timer.eksport.${TIMER_TABELL_KOL[k].i18n}`;
      expect(nbT[nokkel], `nb ${nokkel}`).toBeTruthy();
      expect(enT[nokkel], `en ${nokkel}`).toBeTruthy();
      expect(TIMER_TABELL_KOL_BREDDE[k], `bredde ${k}`).toBeDefined();
    }
  });

  it("T47: på skjerm heter maskinkolonnene «Maskinmengde» og «Maskinenhet»", () => {
    expect(nbT["timer.eksport." + TIMER_TABELL_KOL.mengde.i18n]).toBe("Maskinmengde");
    expect(nbT["timer.eksport." + TIMER_TABELL_KOL.enhet.i18n]).toBe("Maskinenhet");
  });
});

describe("H9 / w5 — standardkolonnene", () => {
  it("w5 + O13: de 13 kjernekolonnene, med Reise og Overtid rett etter Timer", () => {
    expect([...TIMER_TABELL_STANDARD]).toEqual([
      "dato", "ansatt", "prosjektnummer", "underprosjekt", "betegnelse",
      "fraTil", "timer", "reisetimer", "overtid", "maskin", "maskintimer", "vareOgMengde",
      "antall", "belop", "avvik",
    ]);
  });

  it("O13 (R10, vakt): ingen av de 13 kjernekolonnene er tatt ut av standardutvalget", () => {
    for (const k of ["dato", "ansatt", "prosjektnummer", "underprosjekt", "betegnelse", "fraTil", "timer",
      "maskin", "maskintimer", "vareOgMengde", "antall", "belop", "avvik"]) {
      expect(TIMER_TABELL_STANDARD, k).toContain(k);
    }
  });

  it("O13 (R3): Reise og Overtid er tillagte kolonner som settes inn etter Timer", () => {
    expect(TIMER_TABELL_TILLAGT).toEqual({ ider: ["reisetimer", "overtid"], etter: "timer" });
    // Eksportens ja/nei-kolonne «reise» står som før; den nye tallkolonnen har egen nøkkel.
    expect(TIMER_TABELL_KOL_KEYS).toContain("reise");
    expect(TIMER_KOL_KEYS).not.toContain("reisetimer" as never);
    expect(nbT["timer.eksport." + TIMER_TABELL_KOL.reisetimer.i18n]).toBe("Reise");
    expect(nbT["timer.eksport." + TIMER_TABELL_KOL.overtid.i18n]).toBe("Overtid");
  });

  it("w5: fra–til er én kolonne; Fra og Til hver for seg står i «Velg parameter»", () => {
    expect(TIMER_TABELL_STANDARD).not.toContain("fraTid");
    expect(TIMER_TABELL_KOL_KEYS).toContain("fraTid");
    expect(TIMER_TABELL_KOL_KEYS).toContain("tilTid");
  });

  it("maskin og maskintimer side om side", () => {
    const i = (k: string) => TIMER_TABELL_STANDARD.indexOf(k as never);
    expect(i("maskintimer")).toBe(i("maskin") + 1);
  });

  it("alle kolonner som var standard før w5, finnes fortsatt i «Velg parameter»", () => {
    for (const k of ["ansattnr", "prosjekt", "byggeplass", "type", "aktivitet", "pause", "mengde", "enhet",
      "vare", "vareenhet", "varemengde", "beskrivelse", "status"]) {
      expect(TIMER_TABELL_KOL_KEYS, k).toContain(k);
    }
  });

  it("standardlista har bare kjente nøkler, uten duplikater", () => {
    expect(new Set(TIMER_TABELL_STANDARD).size).toBe(TIMER_TABELL_STANDARD.length);
    for (const k of TIMER_TABELL_STANDARD) expect(TIMER_TABELL_KOL_KEYS).toContain(k);
  });
});

const linje: TimerTabellLinje = {
  id: "t1", type: "timer", dato: "2026-11-16", ansatt: "Kari", ansattnr: "12",
  prosjektnummer: "P-1", prosjekt: "Bygg", avdeling: null, byggeplass: "Tomt", underprosjekt: null,
  kort: null, betegnelse: "Ordinær", aktivitet: null, fraTid: "07:00", tilTid: "15:00",
  timer: 7.5, pauseMin: 30,
  maskiner: [
    { id: "m1", navn: "Gravemaskin", fraTid: "07:00", tilTid: "11:00", timer: 4, mengde: 12, enhet: "m3", utenTimerad: false },
    { id: "m2", navn: "Dumper", fraTid: "11:00", tilTid: "15:00", timer: 4, mengde: null, enhet: null, utenTimerad: false },
  ],
  varer: [{ id: "v1", navn: "Pukk 8-16", enhet: "tonn", mengde: 20 }],
  antall: null, belop: null, lonnsartType: "ordinaer", satsEnhet: null, erReise: false,
  beskrivelse: null, status: "sent", avvik: ["Normtak brutt: Ordinær"],
};

describe("H14 — underlinjer pr. maskin og vare", () => {
  it("antall tekstlinjer = flest av maskiner og varer, minst én", () => {
    expect(antallUnderlinjer(linje)).toBe(2);
    expect(antallUnderlinjer({ maskiner: [], varer: [] })).toBe(1);
  });

  it("maskin- og varekolonnene leser maskin/vare nr. `under`", () => {
    expect(timerTabellVerdi("maskin", linje, 0)).toBe("Gravemaskin");
    expect(timerTabellVerdi("maskin", linje, 1)).toBe("Dumper");
    expect(timerTabellVerdi("mengde", linje, 0)).toBe(12);
    expect(timerTabellVerdi("vare", linje, 0)).toBe("Pukk 8-16");
    expect(timerTabellVerdi("vare", linje, 1)).toBeNull();
  });

  it("w5: «Vare og mengde» i én celle — navn · mengde enhet, komma som desimaltegn", () => {
    expect(timerTabellVerdi("vareOgMengde", linje, 0)).toBe("Pukk 8-16 · 20 tonn");
    expect(timerTabellVerdi("vareOgMengde", linje, 1)).toBeNull();
    expect(vareOgMengdeTekst({ id: "v", navn: "Betong", enhet: "m3", mengde: 4.5 })).toBe("Betong · 4,5 m3");
    expect(vareOgMengdeTekst({ id: "v", navn: "Betong", enhet: "m3", mengde: null })).toBe("Betong");
  });

  it("w5: «Fra–til» i én celle, tom når linja ikke har klokkeslett", () => {
    expect(timerTabellVerdi("fraTil", linje, 0)).toBe("07:00–15:00");
    expect(timerTabellVerdi("fraTil", linje, 1)).toBeNull();
    expect(timerTabellVerdi("fraTil", { ...linje, fraTid: null, tilTid: null }, 0)).toBeNull();
  });

  it("øvrige kolonner har verdi bare på første tekstlinje", () => {
    expect(timerTabellVerdi("ansatt", linje, 0)).toBe("Kari");
    expect(timerTabellVerdi("ansatt", linje, 1)).toBeNull();
    expect(timerTabellVerdi("pause", linje)).toBe(30);
    expect(timerTabellVerdi("avvik", linje)).toBe("Normtak brutt: Ordinær");
  });
});

describe("O13 — overtid summeres fra lønnsartens overtidsnivå", () => {
  it("erOvertidsnivaa: bare 50 og 100 er overtid", () => {
    expect(erOvertidsnivaa(50)).toBe(true);
    expect(erOvertidsnivaa(100)).toBe(true);
    expect(erOvertidsnivaa(null)).toBe(false);
    expect(erOvertidsnivaa(undefined)).toBe(false);
    expect(erOvertidsnivaa(0)).toBe(false);
  });

  it("sumOvertidTimer: summerer timer på rader med overtidsnivå 50/100, 0 uten", () => {
    expect(sumOvertidTimer([
      { timer: 7.5, overtidsnivaa: null },
      { timer: 2, overtidsnivaa: 50 },
      { timer: 1.25, overtidsnivaa: 100 },
      { timer: null, overtidsnivaa: 50 },
    ])).toBe(3.25);
    expect(sumOvertidTimer([{ timer: 8, overtidsnivaa: null }])).toBe(0);
    expect(sumOvertidTimer([])).toBe(0);
  });
});
