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
        kjedeNokkel: "manuell-0",
        kjedeSide: "retur",
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
    ["reise-kortet (L2 § 7 C)", "<ReiseKort"],
    ["resolverens art til kortet", "resolverLonnsartId={reiseKnappLonnsartId}"],
    ["admin-hint ved skjult knapp", "timer.prosjektkort.reiseSkjultFlere"],
    ["hint-lenka", "/dashbord/firma/innstillinger#reise-regelsett"],
    ["knappen vises kun med lønnsart", "reiseKnappLonnsartId != null ?"],
  ])("Bekreft dag har %s", (_navn, nål) => {
    expect(BEKREFT).toContain(nål);
  });

  it("negativkontroll: DagSeksjon (referansen) har samme resolver og samme reise-kort", () => {
    expect(DAGSEKSJON).toContain("hentReiseKnappLokalt(");
    expect(DAGSEKSJON).toContain("<ReiseKort");
    expect(DAGSEKSJON).toContain("resolverLonnsartId={reiseKnappLonnsartId}");
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

  it("POST (13) L2: retning og kjøretid følger reise-raden; ikke-reise-rad bærer dem aldri", () => {
    const k = klassifiserManuellReise({
      regel: REGEL_KM,
      reisetimer: 1.5,
      avstandM: 45000,
      grensepunkter: [],
      resolverLonnsartId: L_REISE,
      standardLonnsartId: L_NORMAL,
    });
    const over = { ...tilManuellReiseSpor(k, "opp1"), reiseRetning: "retur" as const, reiseKjoretidMin: 50 };
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: { manuellReise: [{ ...REISE, lonnsartId: k.lonnsartId!, reiseSpor: over }] },
    });
    expect(f.datoer[0]!.rader.filter((r) => r.erReise)[0]).toMatchObject({
      reiseRetning: "retur",
      reiseKjoretidMin: 50,
    });
    const under = { ...over, erReise: false, reiseKilde: null };
    const g = beregnDagsforslag({
      ...manuellInput(),
      retting: { manuellReise: [{ ...REISE, lonnsartId: L_NORMAL, reiseSpor: under }] },
    });
    const sist = g.datoer[0]!.rader[g.datoer[0]!.rader.length - 1]!;
    expect(sist).toMatchObject({ erReise: false, reiseRetning: null, reiseKjoretidMin: null });
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
    const KORT = les("../components/timer-detalj/ReiseKort.tsx").replace(/\s+/g, " ");
    const HOOK = les("../components/timer-detalj/useManuellReise.ts");
    const BEKREFT = les("../../app/timer/bekreft-dag.tsx").replace(/\s+/g, " ");
    const DAGSEKSJON = les("../components/timer-detalj/prosjektkort/DagSeksjon.tsx").replace(/\s+/g, " ");
    // POST (13) L2 § 7 C: perioderesolveren velger oppmøtestedet, aldri «siste valg».
    expect(HOOK).toContain("løsOppmote(");
    expect(HOOK).toContain("løsReiseKort(");
    expect(HOOK).toContain("løsOverforingKort(");
    expect(HOOK).not.toContain("SecureStore");
    expect(HOOK).not.toContain("velgOppmotested(");
    expect(KORT).toContain("useManuellReise(");
    expect(KORT).toContain("let reiseSpor = resultat.spor;");
    // Del B: overføringen fører bare periode-id-en inn i samme spor, ingen nytt spor.
    expect(KORT).toContain("reiseSpor = medOverforingPeriodeId(reiseSpor,");
    expect(KORT).toMatch(/onLagre\(\{[^}]*\breiseSpor\b/);
    expect(DAGSEKSJON).toContain("l.reiseSpor");
    expect(BEKREFT).toContain("reiseSpor: l.reiseSpor");
  });

  it("gate (32) vilkår 1: sperreårsaken (også oppmoteIkkeValgt) står som rød tekst i kortet, ikke bare bak Lagre", () => {
    const KORT = les("../components/timer-detalj/ReiseKort.tsx").replace(/\s+/g, " ");
    expect(KORT).toContain('oppmoteIkkeValgt: "timer.reiseKort.sperre.oppmoteIkkeValgt"');
    expect(KORT).toContain(
      '{sperre && ( <Text className="text-xs font-medium text-red-700">{t(SPERRE_NOKKEL[sperre])}</Text> )}',
    );
  });
});

/**
 * Ordre 2026-11-14 (11) C: mangler firmaet standard ordinær lønnsart, ser
 * arbeideren «Firmaet mangler standard lønnsart — be firmaadmin sette den» og
 * lagring sperres — samme delte sjekk som web.
 */
describe("Ordre (11) C — mangler standard lønnsart (mobil)", () => {
  // POST (13) L2: sjekken bor i den delte `løsReiseKort` (sperre «manglerArt»);
  // reise-kortet viser den felles teksten.
  const KORT = les("../components/timer-detalj/ReiseKort.tsx").replace(/\s+/g, " ");

  it("reise-kortet viser den felles teksten for sperren", () => {
    expect(KORT).toContain('manglerArt: "timer.reiseTerskel.manglerArt"');
    expect(KORT).toContain("t(SPERRE_NOKKEL[sperre])");
  });

  it("teksten i nb er veiledningen fra ordren", () => {
    const nb = JSON.parse(les("../../../../packages/shared/src/i18n/nb.json")) as Record<string, string>;
    expect(nb["timer.reiseTerskel.manglerArt"]).toBe(
      "Firmaet mangler standard lønnsart — be firmaadmin sette den",
    );
  });
});

// Ordre 2026-11-15 (17) P1 + Kenneth-vedtak 2026-11-15: rettet kort er fast
// punkt, beregnede naboer flytter seg, rettede naboer står.
describe("(17) reisekjeden i Bekreft dag", () => {
  const UT_A: DagsforslagManuellReise = { ...REISE, timer: 1, fraTid: "05:30", tilTid: "06:30" };
  const UT_B: DagsforslagManuellReise = { ...REISE, timer: 0.5, fraTid: "06:30", tilTid: "07:00" };
  const tider = (f: ReturnType<typeof beregnDagsforslag>) =>
    f.datoer[0]!.rader.map((r) => `${r.kjedeNokkel ?? "arbeid"} ${r.fraTid}–${r.tilTid}`);
  const arbeidFra = (f: ReturnType<typeof beregnDagsforslag>) =>
    f.datoer[0]!.rader.filter((r) => !r.erReise).map((r) => r.fraTid)[0];

  it("uten retting: kortene ligger etter hverandre, arbeid står", () => {
    const f = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [UT_A, UT_B] } });
    expect(tider(f)).toContain("manuell-0 05:30–06:30");
    expect(tider(f)).toContain("manuell-1 06:30–07:00");
    expect(arbeidFra(f)).toBe("07:00");
    expect(f.datoer[0]!.kjedeKonflikt).toBeNull();
  });

  it("rett midtkort: begge naboer flytter (forrige reise og arbeidsstart)", () => {
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: {
        manuellReise: [UT_A, UT_B],
        perDato: { [DATO]: { reiseTid: { "manuell-1": { fraTid: "07:00", tilTid: "07:30" } } } },
      },
    });
    expect(tider(f)).toContain("manuell-0 06:00–07:00");
    expect(tider(f)).toContain("manuell-1 07:00–07:30");
    expect(arbeidFra(f)).toBe("07:30");
  });

  it("rett midtkort: en rettet nabo står", () => {
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: {
        manuellReise: [UT_A, UT_B],
        perDato: {
          [DATO]: {
            reiseTid: {
              "manuell-0": { fraTid: "05:00", tilTid: "06:00" },
              "manuell-1": { fraTid: "07:00", tilTid: "07:30" },
            },
          },
        },
      },
    });
    expect(tider(f)).toContain("manuell-0 05:00–06:00");
    expect(tider(f)).toContain("manuell-1 07:00–07:30");
    expect(arbeidFra(f)).toBe("07:30");
  });

  it("forsinkelse: rettet ankomst gir lengre reise og senere arbeidsstart, timene følger", () => {
    const uten = beregnDagsforslag({ ...manuellInput(), retting: { manuellReise: [UT_B] } });
    const med = beregnDagsforslag({
      ...manuellInput(),
      retting: {
        manuellReise: [UT_B],
        perDato: { [DATO]: { reiseTid: { "manuell-0": { fraTid: "06:30", tilTid: "07:20" } } } },
      },
    });
    const reise = med.datoer[0]!.rader.find((r) => r.kjedeNokkel === "manuell-0")!;
    expect(reise).toMatchObject({ fraTid: "06:30", tilTid: "07:20", timer: 0.83 });
    expect(arbeidFra(med)).toBe("07:20");
    const sum = (f: typeof med) =>
      f.datoer[0]!.rader.filter((r) => !r.erReise).reduce((a, r) => a + r.timer, 0);
    expect(sum(med)).toBeLessThan(sum(uten));
  });

  it("overlapp med lagret rad: raden står, dagen får begrunnelse (ingen stille drop)", () => {
    const f = beregnDagsforslag({
      ...manuellInput(),
      retting: { manuellReise: [UT_B] },
      eksisterendeSedelPerDato: {
        [DATO]: { finnes: true, status: "draft", eksisterendeRader: [{ fraTid: "06:00", tilTid: "06:45" }] },
      } as unknown as ReturnType<typeof manuellInput>["eksisterendeSedelPerDato"],
    });
    expect(tider(f)).toContain("manuell-0 06:30–07:00");
    expect(f.datoer[0]!.kjedeKonflikt).toEqual({
      type: "overlapp", fraTid: "06:30", tilTid: "07:00", annenFraTid: "06:00", annenTilTid: "06:45",
    });
  });
});
