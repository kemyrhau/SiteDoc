import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  arbeidOgReise,
  klassifiserManuellReise,
  sendDagenTekst,
  tilManuellReiseSpor,
} from "@sitedoc/shared";
import {
  beregnDagsforslag,
  leggTilManuellReise,
  type BeregnDagsforslagInput,
  type DagsforslagDag,
  type DagsforslagManuellReise,
} from "./dagsforslag";

/**
 * POST 2026-11-14 (8) punkt 1 — «+ Reise» i Nytt prosjektkort (Bekreft dag i
 * manuell modus). Reisen arbeideren fører ligger i rettingen (utkastet) og
 * legges i forslaget som erReise-rad med samme spor som det lagrede kortet
 * (`settInnTimerRad`: reiseKilde "manuell", tidKilde "manuell"). Arbeidsradene
 * røres ikke, og «Send dagen» viser reisen separat.
 */

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const L_NORMAL = "L-normal";
const L_REISE = "L-reise";
const DATO = "2026-07-01";

/** Manuell modus: ingen GPS, ingen reise-oppslag (som `forberedManuellDag`). */
function manuellInput(over: Partial<BeregnDagsforslagInput> = {}): BeregnDagsforslagInput {
  return {
    dag: { startAt: `${DATO}T07:00:00`, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: `${DATO}T15:30:00`,
    endLat: null,
    endLng: null,
    kontekstByggeplassId: null,
    aktivtProsjektId: "p1",
    destinasjonProsjektId: null,
    sisteSegmentKilde: "bruker",
    prosjekter: [{ id: "p1", lat: 59.9, lng: 10.7 }],
    aktiviteter: [{ id: "a1", navn: "Anleggsarbeid" }],
    alleLonnsarter: [
      { id: L_NORMAL, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 },
      { id: L_REISE, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 },
    ],
    standardLonnsartId: L_NORMAL,
    regel: {
      reiseTerskelEnhet: "minutter",
      reiseTerskelMin: 30,
      reiseTerskelM: null,
      reiseUnderTerskelType: "arbeidstid",
      reiseOverTerskelType: "reisetid",
      tidsrundingMinutter: null,
      standardPauseEtterTimer: 4.0,
    },
    reiseOppslag: null,
    effektivPerDato: { [DATO]: { startTid: "07:00", sluttTid: "15:30", pauseMin: 30, dagsnorm: 8 } },
    eksisterendeSedelPerDato: {},
    ...over,
  };
}

const REISE: DagsforslagManuellReise = {
  projectId: "p1",
  byggeplassId: null,
  lonnsartId: L_REISE,
  aktivitetId: "a1",
  timer: 1.5,
  fraTid: "15:30",
  tilTid: "17:00",
};

describe("POST (8) punkt 1 — manuell reise i Bekreft dag", () => {
  it("rettingens reise blir erReise-rad med samme spor som det lagrede kortet", () => {
    const f = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [REISE] } });
    const reise = f.datoer[0]!.rader.filter((r) => r.erReise);
    expect(reise).toEqual([
      {
        projectId: "p1",
        lonnsartId: L_REISE,
        aktivitetId: "a1",
        timer: 1.5,
        fraTid: "15:30",
        tilTid: "17:00",
        pauseMin: 0,
        erReise: true,
        reiseRetning: null,
        reiseOppmotestedId: null,
        byggeplassId: null,
        reiseKjoretidMin: null,
        reiseAvstandM: null,
        reiseKilde: "manuell",
        reiseRegel: null,
        tidKilde: "manuell",
      },
    ]);
  });

  it("arbeidsradene er uendret av reisen (pause, tider, lønnsart)", () => {
    const uten = beregnDagsforslag(manuellInput());
    const med = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [REISE] } });
    expect(med.datoer[0]!.rader.filter((r) => !r.erReise)).toEqual(uten.datoer[0]!.rader);
    expect(uten.datoer[0]!.rader.some((r) => r.erReise)).toBe(false);
  });

  it("«Send dagen» viser reisen separat for de lagrede radene", () => {
    const f = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [REISE] } });
    const { arbeid, reise } = arbeidOgReise(f.datoer[0]!.rader);
    expect(reise).toBe(1.5);
    expect(sendDagenTekst("draft", arbeid, reise)).toEqual({
      nokkel: "timer.prosjektkort.sendDagenMedReise",
      timer: arbeid,
      reise: 1.5,
    });
  });

  it("legges på første åpne dato; alle blokkert → ingen rad", () => {
    const dag = (dato: string, blokkert: boolean) =>
      ({ dato, blokkert, rader: [] }) as unknown as DagsforslagDag;
    const ut = leggTilManuellReise([dag("d1", true), dag("d2", false)], [REISE]);
    expect(ut.map((d) => d.rader.length)).toEqual([0, 1]);
    const blokkert = leggTilManuellReise([dag("d1", true)], [REISE]);
    expect(blokkert[0]!.rader).toEqual([]);
    expect(leggTilManuellReise([dag("d1", false)], undefined)[0]!.rader).toEqual([]);
  });
});

describe("POST (8) punkt 1 — samme knapp og skjuleregel som det lagrede kortet", () => {
  const BEKREFT = les("../../app/timer/bekreft-dag.tsx").replace(/\s+/g, " ");
  const DAGSEKSJON = les("../components/timer-detalj/prosjektkort/DagSeksjon.tsx").replace(/\s+/g, " ");

  it.each([
    ["resolveren", "hentReiseKnappLokalt("],
    ["valgt/automatisk viser knappen", 'status === "valgt" || reiseKnapp?.status === "automatisk"'],
    ["låst reise-lønnsart", "reise={{ lonnsartId: reiseKnappLonnsartId, laast: true }}"],
    ["admin-hint ved skjult knapp", "timer.prosjektkort.reiseSkjultFlere"],
    ["hint-lenka", "/dashbord/firma/innstillinger#reise-regelsett"],
    ["knappen vises kun med lønnsart", "reiseKnappLonnsartId != null ?"],
  ])("Bekreft dag har %s", (_navn, nål) => {
    expect(BEKREFT).toContain(nål);
  });

  it("negativkontroll: DagSeksjon (referansen) har samme resolver og låste reise", () => {
    expect(DAGSEKSJON).toContain("hentReiseKnappLokalt(");
    expect(DAGSEKSJON).toContain("{ lonnsartId: reiseKnappLonnsartId, laast: true }");
  });

  it("knappen er kun i manuell modus", () => {
    expect(BEKREFT).toContain("manuell && orgId ? hentReiseKnappLokalt(orgId) : null");
    expect(BEKREFT).toContain("{manuell && !alleSendt && !ikkeAnsatt && !tomt && prosjektId ? (");
  });
});

/**
 * Ordre 2026-11-14 (9) — terskel og avstandsbånd på «+ Reise». Klassifiseringen
 * er delt (`klassifiserManuellReise`, testet i shared); her prøves at sporet
 * følger raden inn i forslaget og at begge flater bruker samme hook.
 */
describe("Ordre (9) — terskel-sporet på manuell reise", () => {
  const REGEL_KM = {
    reiseTerskelEnhet: "km" as const,
    reiseTerskelMin: 30,
    reiseTerskelM: 30000,
    reiseUnderTerskelType: "arbeidstid" as const,
    reiseOverTerskelType: "reisetid" as const,
  };

  it("under terskel → egen arbeidsrad (erReise false), regel lagret, ingen avstand/oppmøtested", () => {
    const k = klassifiserManuellReise({
      regel: REGEL_KM,
      reisetimer: 1.5,
      avstandM: 12000,
      grensepunkter: [],
      resolverLonnsartId: L_REISE,
      standardLonnsartId: L_NORMAL,
    });
    const spor = tilManuellReiseSpor(k, "opp1");
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: { manuellReise: [{ ...REISE, lonnsartId: k.lonnsartId!, reiseSpor: spor }] },
    });
    const rader = f.datoer[0]!.rader;
    const ny = rader[rader.length - 1]!;
    expect(ny).toMatchObject({
      lonnsartId: L_NORMAL,
      erReise: false,
      reiseKilde: null,
      reiseAvstandM: null,
      reiseOppmotestedId: null,
      tidKilde: "manuell",
    });
    expect(ny.reiseRegel).toMatchObject({ kategori: "arbeidstid", enhet: "km" });
    // Aldri slått sammen med andre rader: én rad mer enn uten reisen.
    expect(rader.length).toBe(beregnDagsforslag(manuellInput()).datoer[0]!.rader.length + 1);
    // Teller som arbeid, ikke reise, i «Send dagen».
    const { reise } = arbeidOgReise(rader);
    expect(reise).toBe(0);
  });

  it("over terskel med bånd → erReise true, båndets art, avstand og oppmøtested lagret", () => {
    const k = klassifiserManuellReise({
      regel: REGEL_KM,
      reisetimer: 1.5,
      avstandM: 45000,
      grensepunkter: [{ grenseM: 30000, lonnsartId: "L-bånd-30" }],
      resolverLonnsartId: L_REISE,
      standardLonnsartId: L_NORMAL,
    });
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: {
        manuellReise: [{ ...REISE, lonnsartId: k.lonnsartId!, reiseSpor: tilManuellReiseSpor(k, "opp1") }],
      },
    });
    const reise = f.datoer[0]!.rader.filter((r) => r.erReise);
    expect(reise).toHaveLength(1);
    expect(reise[0]).toMatchObject({
      lonnsartId: "L-bånd-30",
      reiseKilde: "manuell",
      reiseAvstandM: 45000,
      reiseOppmotestedId: "opp1",
    });
    expect(reise[0]!.reiseRegel).toMatchObject({ kategori: "reisetid", grensepunktTreff: true });
  });

  it("uten spor (regelsett ikke synket / eldre utkast) → reise-rad som før", () => {
    const f = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [REISE] } });
    expect(f.datoer[0]!.rader.filter((r) => r.erReise)[0]).toMatchObject({
      erReise: true,
      reiseKilde: "manuell",
      reiseRegel: null,
    });
  });

  it("begge flater sender sporet fra samme modal-hook videre til lagringen", () => {
    const MODAL = les("../components/timer-detalj/TimerSeksjon.tsx").replace(/\s+/g, " ");
    const HOOK = les("../components/timer-detalj/useManuellReise.ts");
    const BEKREFT = les("../../app/timer/bekreft-dag.tsx").replace(/\s+/g, " ");
    const DAGSEKSJON = les("../components/timer-detalj/prosjektkort/DagSeksjon.tsx").replace(/\s+/g, " ");
    expect(HOOK).toContain("løsManuellReise(");
    expect(HOOK).toContain("velgOppmotested(");
    expect(MODAL).toContain("useManuellReise(");
    expect(MODAL).toContain("manuellReise.spor ?? undefined");
    expect(DAGSEKSJON).toContain("leggTilTimerRad(db(), k, felt, maskin.linjer, reiseSpor)");
    expect(BEKREFT).toContain("timer, fraTid, tilTid, reiseSpor }");
  });
});

/**
 * Ordre 2026-11-14 (11) C: mangler firmaet standard ordinær lønnsart, ser
 * arbeideren «Firmaet mangler standard lønnsart — be firmaadmin sette den» og
 * lagring sperres — samme delte sjekk som web.
 */
describe("Ordre (11) C — mangler standard lønnsart (mobil)", () => {
  const MODAL = les("../components/timer-detalj/TimerSeksjon.tsx").replace(/\s+/g, " ");

  it("modalen bruker den delte sjekken og den felles teksten", () => {
    expect(MODAL).toContain("manuellReiseManglerArt(manuellKlassifisering)");
    expect(MODAL).toContain('t("timer.reiseTerskel.manglerArt")');
  });

  it("teksten i nb er veiledningen fra ordren", () => {
    const nb = JSON.parse(les("../../../../packages/shared/src/i18n/nb.json")) as Record<string, string>;
    expect(nb["timer.reiseTerskel.manglerArt"]).toBe(
      "Firmaet mangler standard lønnsart — be firmaadmin sette den",
    );
  });
});
