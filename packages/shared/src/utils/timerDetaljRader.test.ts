import { describe, it, expect } from "vitest";
import {
  byggDetaljRader,
  kolonnerMedInnhold,
  grupperDetaljRader,
  flatDetaljRader,
  losTimerKolonner,
  ALLE_RADTYPER,
  type DetaljEksportKilde,
} from "./timerDetaljRader";

function kilde(over: Partial<DetaljEksportKilde> = {}): DetaljEksportKilde {
  return {
    timerader: [],
    maskinUtenTimerad: [],
    maskinIkkeEksporterbar: [],
    tillegg: [],
    utlegg: [],
    ...over,
  };
}

const timerad = (o: Partial<DetaljEksportKilde["timerader"][number]> = {}) => ({
  id: "t1",
  dato: "2026-08-10",
  ansatt: "Ola",
  ansattnr: "104",
  prosjekt: "Kai 12",
  lonnsart: "Normaltid",
  aktivitet: "Graving",
  fraTid: "07:00",
  tilTid: "15:00",
  timer: 7.5,
  beskrivelse: "gravde",
  radstatus: "attestert",
  maskiner: [],
  ...o,
});

describe("byggDetaljRader", () => {
  it("bygger én timerad med nøstet maskin under (begge typer valgt)", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [
          timerad({
            maskiner: [
              { id: "m1", navn: "Gravemaskin", timer: 4, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null },
            ],
          }),
        ],
      }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.type)).toEqual(["timer", "maskin"]);
    expect(rader[0]!.timer).toBe(7.5);
    expect(rader[0]!.maskintimer).toBeNull();
    expect(rader[1]!.nivaa).toBe(1);
    expect(rader[1]!.maskinMerke).toBe("noster");
    expect(rader[1]!.maskintimer).toBe(4);
    expect(rader[1]!.timer).toBeNull();
  });

  it("timer avvalgt + maskin valgt: nøstet maskin blir egen normal rad (nivaa 0, merke null)", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [
          timerad({
            maskiner: [
              { id: "m1", navn: "Gravemaskin", timer: 4, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null },
            ],
          }),
        ],
      }),
      ["maskin"],
    );
    expect(rader).toHaveLength(1);
    expect(rader[0]!.type).toBe("maskin");
    expect(rader[0]!.nivaa).toBe(0);
    expect(rader[0]!.maskinMerke).toBeNull();
    // arver identitet fra sin (skjulte) timerad
    expect(rader[0]!.dato).toBe("2026-08-10");
    expect(rader[0]!.ansatt).toBe("Ola");
    expect(rader[0]!.prosjekt).toBe("Kai 12");
  });

  it("radvalg trekker fra: kun tillegg valgt gir kun tillegg-rader", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [timerad()],
        tillegg: [
          { id: "a1", dato: "2026-08-11", ansatt: "Ola", ansattnr: "104", prosjekt: "Kai 12", tillegg: "Diett", antall: 1, kommentar: null, radstatus: "sent" },
        ],
        utlegg: [
          { id: "u1", dato: "2026-08-12", ansatt: "Kari", ansattnr: "117", prosjekt: "Kai 12", kategori: "Parkering", belop: 120, kommentar: null, seddelstatus: "sent" },
        ],
      }),
      ["tillegg"],
    );
    expect(rader.map((r) => r.type)).toEqual(["tillegg"]);
    expect(rader[0]!.antall).toBe(1);
  });

  it("er kronologisk på tvers av typer (dato asc), stabil innen dato", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [timerad({ id: "t2", dato: "2026-08-15" })],
        tillegg: [
          { id: "a1", dato: "2026-08-10", ansatt: "Ola", ansattnr: "104", prosjekt: "Kai 12", tillegg: "Diett", antall: 1, kommentar: null, radstatus: "sent" },
        ],
        utlegg: [
          { id: "u1", dato: "2026-08-12", ansatt: "Kari", ansattnr: "117", prosjekt: "Kai 12", kategori: "Parkering", belop: 120, kommentar: null, seddelstatus: "sent" },
        ],
      }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.dato)).toEqual(["2026-08-10", "2026-08-12", "2026-08-15"]);
    expect(rader.map((r) => r.type)).toEqual(["tillegg", "utlegg", "timer"]);
  });

  it("holder timerad + nøstet maskin samlet selv når en annen type deler dato", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [
          timerad({
            dato: "2026-08-10",
            maskiner: [{ id: "m1", navn: "Gravemaskin", timer: 4, mengde: 100, enhet: "m3", radstatus: "attestert", utleieEnhet: null }],
          }),
        ],
        utlegg: [
          { id: "u1", dato: "2026-08-10", ansatt: "Kari", ansattnr: "117", prosjekt: "Kai 12", kategori: "Parkering", belop: 120, kommentar: null, seddelstatus: "sent" },
        ],
      }),
      ALLE_RADTYPER,
    );
    // timer-blokka (timer + maskin) kommer før utlegg (kildens rekkefølge), og maskin er rett under sin timerad
    expect(rader.map((r) => r.type)).toEqual(["timer", "maskin", "utlegg"]);
  });

  it("løse maskiner vises kun når maskin er valgt, med riktig merke", () => {
    const k = kilde({
      maskinUtenTimerad: [
        { id: "m2", navn: "Hjullaster", timer: 2, mengde: null, enhet: null, radstatus: "sent", utleieEnhet: null, dato: "2026-08-09", ansatt: "Per", ansattnr: "9", prosjekt: "Kai 12" },
      ],
      maskinIkkeEksporterbar: [
        { id: "m3", navn: "Dumper", timer: 3, mengde: null, enhet: null, radstatus: "sent", utleieEnhet: null, dato: "2026-08-09", ansatt: "Per", ansattnr: "9", prosjekt: "Kai 12" },
      ],
    });
    expect(byggDetaljRader(k, ["timer"])).toHaveLength(0);
    const rader = byggDetaljRader(k, ["maskin"]);
    expect(rader.map((r) => r.maskinMerke)).toEqual(["utenTimerad", "ikkeEksporterbar"]);
  });
});

describe("byggDetaljRader — maskin foldet inn på timeraden (maskin.md § faktureringsenheten)", () => {
  const timeMaskin = { id: "m1", navn: "Volvo EC220E", timer: 7.5, mengde: 100, enhet: "m3", radstatus: "attestert", utleieEnhet: "time" };
  const doegnMaskin = { id: "m2", navn: "Heatwork", timer: 24, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: "doegn" };
  const ukjentMaskin = { id: "m3", navn: "Aggregat", timer: 8, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null };

  it("utleieEnhet=time → maskintimene foldes inn PÅ timeraden (ingen egen linje)", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [timeMaskin] })] }),
      ALLE_RADTYPER,
    );
    // Kun ÉN rad (timeraden) — maskinen har ingen egen linje.
    expect(rader.map((r) => r.type)).toEqual(["timer"]);
    expect(rader[0]!.timer).toBe(7.5); // operatørens arbeidstimer
    expect(rader[0]!.maskintimer).toBe(7.5); // maskintimene på samme linje
    expect(rader[0]!.mengde).toBe(100); // mengde foldet inn (én maskin)
    expect(rader[0]!.enhet).toBe("m3");
    expect(rader[0]!.maskinnavn).toBe("Volvo EC220E"); // identiteten bevart
  });

  it("NEGATIV KONTROLL: utleieEnhet=doegn → egen nøstet linje, folder IKKE", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [doegnMaskin] })] }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.type)).toEqual(["timer", "maskin"]);
    expect(rader[0]!.maskintimer).toBeNull(); // ikke foldet inn
    expect(rader[0]!.maskinnavn).toBeNull();
    expect(rader[1]!.nivaa).toBe(1);
    expect(rader[1]!.maskinMerke).toBe("noster");
    expect(rader[1]!.maskintimer).toBe(24);
  });

  it("NEGATIV KONTROLL: utleieEnhet=null (ukjent) → ALDRI gjettet, egen nøstet linje", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [ukjentMaskin] })] }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.type)).toEqual(["timer", "maskin"]);
    expect(rader[0]!.maskintimer).toBeNull();
    expect(rader[1]!.nivaa).toBe(1);
  });

  it("blandet: time-maskin foldes, døgn-maskin på egen linje samtidig", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [timeMaskin, doegnMaskin] })] }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.type)).toEqual(["timer", "maskin"]);
    expect(rader[0]!.maskintimer).toBe(7.5); // kun time-maskinen
    expect(rader[0]!.maskinnavn).toBe("Volvo EC220E");
    expect(rader[1]!.betegnelse).toBe("Heatwork"); // døgn-maskinen står alene
  });

  it("flere time-maskiner: maskintimer summeres, mengde blir tom (tvetydig), begge navn med", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [
          timerad({
            maskiner: [
              timeMaskin,
              { id: "m4", navn: "CAT 320", timer: 5, mengde: 50, enhet: "m3", radstatus: "attestert", utleieEnhet: "time" },
            ],
          }),
        ],
      }),
      ALLE_RADTYPER,
    );
    expect(rader.map((r) => r.type)).toEqual(["timer"]);
    expect(rader[0]!.maskintimer).toBe(12.5);
    expect(rader[0]!.mengde).toBeNull(); // to maskiner → tvetydig sum
    expect(rader[0]!.maskinnavn).toBe("Volvo EC220E, CAT 320");
  });

  it("time-maskin, men maskin-radtype avvalgt → ingen maskininfo på timeraden", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [timeMaskin] })] }),
      ["timer"],
    );
    expect(rader.map((r) => r.type)).toEqual(["timer"]);
    expect(rader[0]!.maskintimer).toBeNull();
    expect(rader[0]!.maskinnavn).toBeNull();
  });

  it("timer avvalgt + maskin valgt: time-maskinen blir egen rad (timeraden finnes ikke å folde inn på)", () => {
    const rader = byggDetaljRader(
      kilde({ timerader: [timerad({ maskiner: [timeMaskin] })] }),
      ["maskin"],
    );
    expect(rader).toHaveLength(1);
    expect(rader[0]!.type).toBe("maskin");
    expect(rader[0]!.nivaa).toBe(0);
    expect(rader[0]!.maskintimer).toBe(7.5);
  });
});

describe("kolonnerMedInnhold", () => {
  it("kun timer-rader → belop/antall/mengde/enhet tomme", () => {
    const rader = byggDetaljRader(kilde({ timerader: [timerad({ maskiner: [] })] }), ["timer"]);
    const kol = kolonnerMedInnhold(rader);
    expect(kol.timer).toBe(true);
    expect(kol.aktivitet).toBe(true);
    expect(kol.beskrivelse).toBe(true);
    expect(kol.belop).toBe(false);
    expect(kol.antall).toBe(false);
    expect(kol.maskintimer).toBe(false);
    expect(kol.mengde).toBe(false);
    expect(kol.enhet).toBe(false);
    expect(kol.fraTid).toBe(true);
    expect(kol.tilTid).toBe(true);
  });

  it("klokkeslett lander på timer-raden, er null på tillegg/utlegg/maskin", () => {
    const rader = byggDetaljRader(
      kilde({
        timerader: [
          timerad({
            maskiner: [
              { id: "m1", navn: "Gravemaskin", timer: 4, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null },
            ],
          }),
        ],
        tillegg: [
          { id: "a1", dato: "2026-08-10", ansatt: "Ola", ansattnr: "104", prosjekt: "Kai 12", tillegg: "Diett", antall: 1, kommentar: null, radstatus: "sent" },
        ],
      }),
      ["timer", "maskin", "tillegg"],
    );
    const timerRad = rader.find((r) => r.type === "timer");
    expect(timerRad?.fraTid).toBe("07:00");
    expect(timerRad?.tilTid).toBe("15:00");
    // maskin nøstet under timeraden bærer ikke klokkeslett (det er arbeidsradens)
    expect(rader.find((r) => r.type === "maskin")?.fraTid).toBeNull();
    expect(rader.find((r) => r.type === "tillegg")?.tilTid).toBeNull();
  });
});

describe("grupperDetaljRader (fase 4)", () => {
  // Radsett med to ansatte på to prosjekter, tvers-flettet, + en nøstet maskin.
  const rader = byggDetaljRader(
    kilde({
      timerader: [
        timerad({ id: "t1", dato: "2026-08-10", ansatt: "Ola", prosjekt: "Kai 12", timer: 7.5,
          maskiner: [{ id: "m1", navn: "Gravemaskin", timer: 4, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null }] }),
        timerad({ id: "t2", dato: "2026-08-11", ansatt: "Kari", prosjekt: "Bru 3", timer: 8 }),
        timerad({ id: "t3", dato: "2026-08-12", ansatt: "Ola", prosjekt: "Bru 3", timer: 5 }),
      ],
    }),
    ALLE_RADTYPER,
  );

  it("gruppering «ingen» → én gruppe uten overskrift, rekkefølge uendret", () => {
    const g = grupperDetaljRader(rader, "ingen");
    expect(g).toHaveLength(1);
    expect(g[0]!.overskrift).toBeNull();
    expect(g[0]!.rader).toBe(rader);
    // Subtotal = sum over alle timer-rader (maskin bidrar ikke til timer).
    expect(g[0]!.subtotal.timer).toBe(20.5);
    expect(g[0]!.subtotal.maskintimer).toBe(4);
  });

  it("gruppering «ansatt» → bøtter sortert på navn, nøstet maskin følger sin timerad", () => {
    const g = grupperDetaljRader(rader, "ansatt");
    expect(g.map((x) => x.overskrift)).toEqual(["Kari", "Ola"]);
    const ola = g.find((x) => x.overskrift === "Ola")!;
    // Ola: timerad+maskin (10.) og timerad (12.) → 3 rader, maskin rett etter sin timerad.
    expect(ola.rader.map((r) => r.type)).toEqual(["timer", "maskin", "timer"]);
    expect(ola.subtotal.timer).toBe(12.5);
    expect(ola.subtotal.maskintimer).toBe(4);
    expect(g.find((x) => x.overskrift === "Kari")!.subtotal.timer).toBe(8);
  });

  it("gruppering «prosjekt» → bøtter på prosjekt; subtotal.antall/belop null når fraværende", () => {
    const g = grupperDetaljRader(rader, "prosjekt");
    expect(g.map((x) => x.overskrift)).toEqual(["Bru 3", "Kai 12"]);
    const bru = g.find((x) => x.overskrift === "Bru 3")!;
    expect(bru.subtotal.timer).toBe(13); // Kari 8 + Ola 5
    expect(bru.subtotal.antall).toBeNull(); // ingen tillegg
    expect(bru.subtotal.belop).toBeNull(); // ingen utlegg
  });

  it("grand total = sum av gruppe-subtotaler (ingen dobbelttelling)", () => {
    const g = grupperDetaljRader(rader, "prosjekt");
    const grand = g.reduce((s, x) => s + (x.subtotal.timer ?? 0), 0);
    expect(grand).toBe(20.5);
  });
});

describe("flatDetaljRader (virtualiserings-flate)", () => {
  const rader = byggDetaljRader(
    kilde({
      timerader: [
        timerad({ id: "t1", dato: "2026-08-10", ansatt: "Ola", prosjekt: "Kai 12", timer: 7.5,
          maskiner: [{ id: "m1", navn: "Gravemaskin", timer: 4, mengde: null, enhet: null, radstatus: "attestert", utleieEnhet: null }] }),
        timerad({ id: "t2", dato: "2026-08-11", ansatt: "Kari", prosjekt: "Bru 3", timer: 8 }),
        timerad({ id: "t3", dato: "2026-08-12", ansatt: "Ola", prosjekt: "Bru 3", timer: 5 }),
      ],
    }),
    ALLE_RADTYPER,
  );

  it("«ingen» → kun rad-er + én avsluttende grandtotal (verken header eller subtotal)", () => {
    const flate = flatDetaljRader(grupperDetaljRader(rader, "ingen"));
    expect(flate.filter((r) => r.kind === "header")).toHaveLength(0);
    expect(flate.filter((r) => r.kind === "subtotal")).toHaveLength(0);
    const grand = flate.filter((r) => r.kind === "grandtotal");
    expect(grand).toHaveLength(1);
    expect(flate.at(-1)!.kind).toBe("grandtotal");
    // 4 rader (t1 + nøstet maskin + t2 + t3) + grandtotal.
    expect(flate).toHaveLength(5);
    if (grand[0]!.kind === "grandtotal") expect(grand[0]!.subtotal.timer).toBe(20.5);
  });

  it("«ansatt» → header + rader + subtotal pr. gruppe, så én grandtotal til slutt", () => {
    const flate = flatDetaljRader(grupperDetaljRader(rader, "ansatt"));
    // 2 headere (Kari, Ola), 2 subtotaler, 1 grandtotal, 4 rader = 9.
    expect(flate.filter((r) => r.kind === "header").map((r) => r.kind === "header" && r.overskrift))
      .toEqual(["Kari", "Ola"]);
    expect(flate.filter((r) => r.kind === "subtotal")).toHaveLength(2);
    expect(flate.filter((r) => r.kind === "grandtotal")).toHaveLength(1);
    expect(flate.at(-1)!.kind).toBe("grandtotal");
    // Rekkefølge innen Ola-gruppen: header → timer → maskin → timer → subtotal.
    const olaHeader = flate.findIndex((r) => r.kind === "header" && r.overskrift === "Ola");
    expect(flate[olaHeader + 1]!.kind).toBe("rad");
    expect(flate[olaHeader + 4]!.kind).toBe("subtotal");
  });

  it("tomt radsett → kun grandtotal med null-summer", () => {
    const flate = flatDetaljRader(grupperDetaljRader([], "ingen"));
    expect(flate).toHaveLength(1);
    expect(flate[0]!.kind).toBe("grandtotal");
    if (flate[0]!.kind === "grandtotal") expect(flate[0]!.subtotal.timer).toBeNull();
  });
});

describe("losTimerKolonner (flateparitet — ÉN sannhet for skjerm/PDF/Excel)", () => {
  const rader = byggDetaljRader(kilde({ timerader: [timerad()] }), ALLE_RADTYPER);

  it("config satt → ordrett brukervalg i valgt rekkefølge (ingen drop-tom)", () => {
    // «mengde» har ingen data på en ren timerad, men er eksplisitt valgt → skal STÅ (B1).
    expect(losTimerKolonner(rader, "intern", ["prosjekt", "dato", "timer", "mengde"])).toEqual([
      "prosjekt",
      "dato",
      "timer",
      "mengde",
    ]);
  });

  it("ekstern VINNER over kolonnevalget: ansattnr/status filtreres bort strukturelt", () => {
    const valgt = ["dato", "ansattnr", "ansatt", "status", "timer"];
    expect(losTimerKolonner(rader, "ekstern", valgt)).toEqual(["dato", "ansatt", "timer"]);
    // Intern beholder dem (samme brukervalg).
    expect(losTimerKolonner(rader, "intern", valgt)).toEqual(valgt);
  });

  it("ukjente nøkler i config filtreres bort (relikvi fra annen form)", () => {
    expect(losTimerKolonner(rader, "intern", ["dato", "finnesikke", "timer"])).toEqual([
      "dato",
      "timer",
    ]);
  });

  it("tom/utelatt config → dynamisk standardsett (intern: med ansattnr + status)", () => {
    const koler = losTimerKolonner(rader, "intern", []);
    expect(koler.slice(0, 6)).toEqual([
      "dato",
      "ansatt",
      "ansattnr",
      "prosjekt",
      "type",
      "betegnelse",
    ]);
    expect(koler).toContain("status");
    // Tomme kolonner (ingen maskin/tillegg/utlegg-data) droppes i dynamisk modus.
    expect(koler).not.toContain("maskintimer");
    expect(koler).not.toContain("belop");
  });

  it("tom config + ekstern → ansattnr/status utelatt fra standardsettet", () => {
    const koler = losTimerKolonner(rader, "ekstern", []);
    expect(koler).not.toContain("ansattnr");
    expect(koler).not.toContain("status");
    expect(koler).toContain("ansatt");
  });
});
