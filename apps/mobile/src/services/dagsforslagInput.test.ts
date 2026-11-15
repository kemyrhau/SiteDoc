import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OppmotePeriodeInput } from "@sitedoc/shared";

/**
 * Gate (32) vilkår 3 — koblingstest for LES-fasen: `samleDagsforslagInput`
 * skal kjøre perioderesolveren (`løsOppmote` → `brukOppmoteResolver`) før
 * matrisecellene slås opp. En byggeplass-periode på dagens prosjekt betyr at
 * arbeideren bor på plassen → ingen reise, selv om GPS-start er kontoret.
 *
 * Dreper M6: `brukOppmoteResolver(...)` byttet ut med rå `gpsStart/gpsSlutt`
 * i `dagsforslagInput.ts` — da gir kontor-starten en ut-celle og reise.
 *
 * Katalogene mockes (ren data inn); den ekte lese-fasen og den ekte rene
 * utregningen (`beregnDagsforslag`) kjører.
 */
const DATO = "2026-10-01";
const NARVIK = { id: "narvik", lat: 68.4385, lng: 17.4272, radiusM: 200 };
const BYGGEPLASS = { id: "b1", projectId: "p1", navn: "Bru", lat: 68.9, lng: 18.0, radiusM: 200 };

const holder = vi.hoisted(() => ({ perioder: [] as OppmotePeriodeInput[] }));

vi.mock("./oppmotePeriodeKatalog", () => ({
  hentOppmotePerioderLokalt: () => holder.perioder,
}));
vi.mock("./prosjektKatalog", () => ({
  hentProsjekterLokalt: () => [{ id: "p1", lat: 68.9, lng: 18.0 }],
}));
vi.mock("./kalenderKatalog", () => ({
  hentArbeidsdagTiderLokalt: () => ({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30 }),
}));
vi.mock("./arbeidstidSvarKatalog", () => ({ hentDagsnormLokalt: () => null }));
vi.mock("./timerKatalog", () => ({
  hentStandardLonnsartLokalt: () => ({ id: "L-normal" }),
  hentReiseLonnsartId: () => "L-reise",
}));
vi.mock("./organizationSettingKatalog", () => ({
  hentOrganizationSettingLokalt: () => ({
    reiseTerskelEnhet: "minutter",
    reiseTerskelMin: 30,
    reiseTerskelM: null,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
    tidsrundingMinutter: null,
    standardPauseEtterTimer: 4,
  }),
}));
vi.mock("./reisetidMatriseKatalog", () => ({
  hentMatriseRadLokalt: (o: string, b: string) =>
    o === "narvik" && b === "b1" ? { kjoretidMin: 120, avstandM: 90000 } : null,
}));
vi.mock("./byggeplassKatalog", () => ({
  hentByggeplasserForFirmaLokalt: () => [BYGGEPLASS],
  hentByggeplasserForProsjektLokalt: () => [BYGGEPLASS],
}));
vi.mock("./oppmotestedKatalog", () => ({ hentOppmotederLokalt: () => [NARVIK] }));
vi.mock("./reiseGrensepunktKatalog", () => ({ hentReiseGrensepunkterLokalt: () => [] }));
vi.mock("./overforingOppslag", () => ({ hentOverforingOppslagLokalt: () => [] }));

import { samleDagsforslagInput, type LokalDb } from "./dagsforslagInput";
import { beregnDagsforslag } from "../utils/dagsforslag";

/** Tom lokal DB: aktivitet + lønnsarter, ingen eksisterende sedel. */
function lagDb(): LokalDb {
  let kall = 0;
  const svar = [
    [{ id: "a1", navn: "Anleggsarbeid" }],
    [{ id: "L-normal", navn: "Normal", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 }],
  ];
  const kjede = { from: () => kjede, where: () => kjede, all: () => svar[kall++] ?? [] };
  return { select: () => kjede } as unknown as LokalDb;
}

function les() {
  return samleDagsforslagInput(lagDb(), {
    userId: "u1",
    orgId: "org1",
    // GPS-start på Kontor Narvik (innenfor geofencen).
    dag: { startAt: `${DATO}T07:00:00`, startLat: NARVIK.lat, startLng: NARVIK.lng, oppmotestedId: null, byggeplassId: null },
    sluttIso: `${DATO}T15:00:00`,
    endLat: null,
    endLng: null,
    kontekstByggeplassId: "b1",
    aktivtProsjektId: "p1",
    sisteSegmentKilde: "bruker",
  });
}
const reiseRader = (input: ReturnType<typeof les>) =>
  beregnDagsforslag(input).datoer.flatMap((d) => d.rader).filter((r) => r.erReise);

describe("samleDagsforslagInput — perioderesolveren før matrisen (gate (32) vilkår 3)", () => {
  beforeEach(() => {
    holder.perioder = [];
  });

  it("negativkontroll: uten periode gir kontor-start i Narvik reise ut til byggeplassen", () => {
    const input = les();
    expect(input.reiseOppslag?.start).toMatchObject({ type: "kontor", oppmotestedId: "narvik" });
    expect(input.reiseOppslag?.utCelle).toMatchObject({ kjoretidMin: 120 });
    expect(reiseRader(input).length).toBeGreaterThan(0);
  });

  it("byggeplass-periode på dagens prosjekt → start på plassen, ingen ut-celle, ingen reise", () => {
    holder.perioder = [
      { id: "per-bp", type: "byggeplass", fast: false, oppmotestedId: null, projectId: "p1", fraDato: DATO, tilDato: "2026-10-05" },
    ] as OppmotePeriodeInput[];
    const input = les();
    expect(input.reiseOppslag?.start).toEqual({ type: "byggeplass", byggeplassId: "b1" });
    expect(input.reiseOppslag?.utCelle).toBeNull();
    expect(reiseRader(input)).toHaveLength(0);
  });
});
