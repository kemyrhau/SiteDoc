import { describe, it, expect } from "vitest";
import {
  løsOppmote,
  finnFastOppmotested,
  trengerOppmoteValg,
  tilIsoDato,
  finnPeriodeKonflikt,
  finnOverforinger,
  periodeDatoFraOverforing,
  leggTilDager,
  planleggOverforing,
  kontorOverforingOppsett,
  kontorOverforingRetning,
  type OppmotePeriodeInput,
} from "./oppmote";

// Fasit for POST 2026-11-15 (12) D. Hvert trinn i rekkefølgen har en test som
// blir rød hvis trinnet fjernes (negativkontroll).

const NARVIK = "kontor-narvik";
const RAMSUND = "kontor-ramsund";
const TROMSO = "kontor-tromso";
const E6 = "prosjekt-e6";
const ANNET = "prosjekt-annet";

const fast = (id: string, fra = "2026-01-01", til: string | null = null): OppmotePeriodeInput => ({
  type: "kontor",
  fast: true,
  oppmotestedId: id,
  projectId: null,
  fraDato: fra,
  tilDato: til,
});
const midl = (id: string, fra: string, til: string): OppmotePeriodeInput => ({
  type: "kontor",
  fast: false,
  oppmotestedId: id,
  projectId: null,
  fraDato: fra,
  tilDato: til,
});
const byggeplass = (prosjekt: string, fra: string, til: string | null): OppmotePeriodeInput => ({
  type: "byggeplass",
  fast: false,
  oppmotestedId: null,
  projectId: prosjekt,
  fraDato: fra,
  tilDato: til,
});

describe("løsOppmote — rekkefølgen", () => {
  it("trinn 1: byggeplass-periode på dagens prosjekt → byggeplass (vinner over GPS, midlertidig og fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31"), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, RAMSUND)).toEqual({ kilde: "byggeplass", projectId: E6 });
  });

  it("trinn 1 gjelder bare dagens prosjekt — annet prosjekt faller videre", () => {
    const perioder = [fast(NARVIK), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", ANNET, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 1 gjelder bare innenfor perioden", () => {
    const perioder = [fast(NARVIK), byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2027-02-01", E6, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 2: GPS-start på kontor → det kontoret (vinner over midlertidig og fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, RAMSUND)).toEqual({ kilde: "gps", oppmotestedId: RAMSUND });
  });

  it("trinn 3: midlertidig kontor-periode → midlertidig (vinner over fast)", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-10", E6, perioder, null)).toEqual({ kilde: "midlertidig", oppmotestedId: TROMSO });
  });

  it("trinn 3: perioden er inklusiv i begge ender", () => {
    const perioder = [fast(NARVIK), midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(løsOppmote("2026-12-01", null, perioder, null).kilde).toBe("midlertidig");
    expect(løsOppmote("2027-01-31", null, perioder, null).kilde).toBe("midlertidig");
    expect(løsOppmote("2027-02-01", null, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 4: fast kontor → fast", () => {
    expect(løsOppmote("2026-06-01", E6, [fast(NARVIK)], null)).toEqual({ kilde: "fast", oppmotestedId: NARVIK });
  });

  it("trinn 4: fast sted gjelder ikke før fraDato", () => {
    expect(løsOppmote("2025-12-31", E6, [fast(NARVIK)], null)).toEqual({ kilde: "ikkeValgt" });
  });

  it("trinn 5: ingen perioder og ingen GPS → ikkeValgt (aldri gjetting)", () => {
    expect(løsOppmote("2026-06-01", E6, [], null)).toEqual({ kilde: "ikkeValgt" });
  });
});

describe("løsOppmote — Narvik → Ramsund og etterregistrering", () => {
  // Fast Narvik fra 1.1.2026; byttet til fast Ramsund 1.9.2026 (serveren lukker
  // Narvik med tilDato 31.8).
  const perioder = [fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")];

  it("dato etter byttet → Ramsund (fast)", () => {
    expect(løsOppmote("2026-10-01", E6, perioder, null)).toEqual({ kilde: "fast", oppmotestedId: RAMSUND });
  });

  it("etterregistrering i gammel periode → det gamle stedet (Narvik)", () => {
    const r = løsOppmote("2026-08-15", E6, perioder, null);
    expect(r).toMatchObject({ oppmotestedId: NARVIK });
  });

  it("overlappende lukket periode: nyeste fraDato vinner", () => {
    const p = [fast(NARVIK, "2026-01-01", "2026-12-31"), midl(TROMSO, "2026-06-01", "2026-06-30")];
    expect(løsOppmote("2026-06-15", null, p, null)).toEqual({ kilde: "midlertidig", oppmotestedId: TROMSO });
  });
});

describe("hjelpere", () => {
  it("finnFastOppmotested gir gjeldende fast, ikke lukkede", () => {
    expect(finnFastOppmotested([fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")])).toBe(RAMSUND);
    expect(finnFastOppmotested([midl(TROMSO, "2026-12-01", "2027-01-31")])).toBeNull();
  });

  it("trengerOppmoteValg: kun ved ≥ 2 kontorer og aldri hatt fast sted", () => {
    expect(trengerOppmoteValg(2, [])).toBe(true);
    expect(trengerOppmoteValg(1, [])).toBe(false);
    expect(trengerOppmoteValg(0, [])).toBe(false);
    expect(trengerOppmoteValg(3, [fast(NARVIK)])).toBe(false);
    expect(trengerOppmoteValg(3, [byggeplass(E6, "2026-12-01", null)])).toBe(true);
    expect(trengerOppmoteValg(3, [midl(TROMSO, "2026-12-01", "2027-01-31")])).toBe(true);
  });

  it("tilIsoDato normaliserer Date og streng", () => {
    expect(tilIsoDato(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12-01");
    expect(tilIsoDato("2026-12-01T00:00:00.000Z")).toBe("2026-12-01");
  });
});

describe("finnPeriodeKonflikt", () => {
  it("midlertidig mot midlertidig: overlapp avvises, tilstøtende godtas", () => {
    const eks = [midl(TROMSO, "2026-12-01", "2027-01-31")];
    expect(finnPeriodeKonflikt(midl(RAMSUND, "2027-01-31", "2027-02-10"), eks)).toBe(eks[0]);
    expect(finnPeriodeKonflikt(midl(RAMSUND, "2027-02-01", "2027-02-10"), eks)).toBeNull();
  });

  it("midlertidig mot fast (også lukket historikk) er lov", () => {
    expect(finnPeriodeKonflikt(midl(TROMSO, "2026-06-01", "2026-06-30"), [fast(NARVIK, "2026-01-01", "2026-08-31"), fast(RAMSUND, "2026-09-01")])).toBeNull();
  });

  it("byggeplass: samme prosjekt avvises, annet prosjekt godtas", () => {
    const eks = [byggeplass(E6, "2026-12-01", "2027-01-31")];
    expect(finnPeriodeKonflikt(byggeplass(E6, "2027-01-15", null), eks)).toBe(eks[0]);
    expect(finnPeriodeKonflikt(byggeplass(ANNET, "2027-01-15", null), eks)).toBeNull();
  });

  it("fast: må starte etter gjeldende fast, og skriver ikke om historikk", () => {
    const apen = fast(RAMSUND, "2026-09-01");
    const lukket = fast(NARVIK, "2026-01-01", "2026-08-31");
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-10-01"), [lukket, apen])).toBeNull();
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-09-01"), [lukket, apen])).toBe(apen);
    expect(finnPeriodeKonflikt(fast(TROMSO, "2026-08-01"), [lukket])).toBe(lukket);
  });
});

describe("finnOverforinger — første/siste dag i periode", () => {
  const perioder = (): OppmotePeriodeInput[] => [
    { ...fast(NARVIK), id: "p-fast" },
    { ...midl(TROMSO, "2026-11-10", "2026-11-20"), id: "p-midl" },
  ];

  it("første dag i midlertidig periode gir ut fra fast til midlertidig", () => {
    expect(finnOverforinger("2026-11-10", perioder())).toEqual([
      {
        retning: "ut",
        fra: { type: "kontor", oppmotestedId: NARVIK },
        til: { type: "kontor", oppmotestedId: TROMSO },
        periodeId: "p-midl",
      },
    ]);
  });

  it("siste dag gir retur til fast sted", () => {
    expect(finnOverforinger("2026-11-20", perioder())).toEqual([
      {
        retning: "retur",
        fra: { type: "kontor", oppmotestedId: TROMSO },
        til: { type: "kontor", oppmotestedId: NARVIK },
        periodeId: "p-midl",
      },
    ]);
  });

  it("dag inne i perioden gir ingen overføring", () => {
    expect(finnOverforinger("2026-11-15", perioder())).toEqual([]);
  });

  it("én-dags periode gir både ut og retur", () => {
    const r = finnOverforinger("2026-11-12", [fast(NARVIK), midl(RAMSUND, "2026-11-12", "2026-11-12")]);
    expect(r.map((o) => o.retning)).toEqual(["ut", "retur"]);
    expect(r[0]!.periodeId).toBeNull();
  });

  it("uten fast sted (ikkeValgt) finnes ingen hjemsted og ingen overføring", () => {
    expect(finnOverforinger("2026-11-10", [midl(TROMSO, "2026-11-10", "2026-11-20")])).toEqual([]);
  });

  it("byggeplass-periode gir ut til prosjektet første dag", () => {
    expect(finnOverforinger("2026-11-01", [fast(NARVIK), { ...byggeplass(E6, "2026-11-01", null), id: "p-bp" }])).toEqual([
      {
        retning: "ut",
        fra: { type: "kontor", oppmotestedId: NARVIK },
        til: { type: "byggeplass", projectId: E6 },
        periodeId: "p-bp",
      },
    ]);
  });

  it("midlertidig til samme kontor som fast gir ingen overføring", () => {
    expect(finnOverforinger("2026-11-10", [fast(NARVIK), midl(NARVIK, "2026-11-10", "2026-11-20")])).toEqual([]);
  });

  it("fast periode alene gir ingen overføring", () => {
    expect(finnOverforinger("2026-01-01", [fast(NARVIK)])).toEqual([]);
  });
});

// ── POST (13) del B — kl. 12-regelen og overføringsperioder ──────────────────
describe("periodeDatoFraOverforing — kl. 12-regelen", () => {
  it("Tur før 12 → samme dag; kl. 12 og senere → dagen etter", () => {
    expect(periodeDatoFraOverforing("2026-11-15", "06:30", "tur")).toBe("2026-11-15");
    expect(periodeDatoFraOverforing("2026-11-15", "11:59", "tur")).toBe("2026-11-15");
    expect(periodeDatoFraOverforing("2026-11-15", "12:00", "tur")).toBe("2026-11-16");
    expect(periodeDatoFraOverforing("2026-11-30", "15:00", "tur")).toBe("2026-12-01");
  });
  it("Retur før 12 → dagen før; kl. 12 og senere → samme dag", () => {
    expect(periodeDatoFraOverforing("2026-11-15", "07:00", "retur")).toBe("2026-11-14");
    expect(periodeDatoFraOverforing("2026-11-15", "12:00", "retur")).toBe("2026-11-15");
    expect(periodeDatoFraOverforing("2027-01-01", "08:00", "retur")).toBe("2026-12-31");
  });
  it("manglende fraTid regnes som 00:00 («Avslutt» = slutt dagen før)", () => {
    expect(periodeDatoFraOverforing("2026-11-15", null, "retur")).toBe("2026-11-14");
    expect(periodeDatoFraOverforing("2026-11-15", undefined, "tur")).toBe("2026-11-15");
  });
  it("leggTilDager krysser måned og år", () => {
    expect(leggTilDager("2026-02-28", 1)).toBe("2026-03-01");
    expect(leggTilDager("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("finnOverforinger — overføringsperioder (kilde='overforing')", () => {
  const ovf = (til: string | null): OppmotePeriodeInput => ({
    id: "p-ovf",
    type: "kontor",
    fast: false,
    oppmotestedId: TROMSO,
    projectId: null,
    fraDato: "2026-11-10",
    tilDato: til,
    kilde: "overforing",
  });

  it("åpen overføringsperiode gir ingen «ut» (Tur-raden finnes alt) og ingen retur", () => {
    expect(finnOverforinger("2026-11-10", [{ ...fast(NARVIK), id: "f" }, ovf(null)])).toEqual([]);
    expect(finnOverforinger("2026-11-12", [{ ...fast(NARVIK), id: "f" }, ovf(null)])).toEqual([]);
  });

  it("avsluttet overføringsperiode gir retur på tilDato", () => {
    expect(finnOverforinger("2026-11-20", [{ ...fast(NARVIK), id: "f" }, ovf("2026-11-20")])).toEqual([
      {
        retning: "retur",
        fra: { type: "kontor", oppmotestedId: TROMSO },
        til: { type: "kontor", oppmotestedId: NARVIK },
        periodeId: "p-ovf",
      },
    ]);
  });

  it("admin-periode (kilde='admin') gir fortsatt «ut» første dag", () => {
    const admin = { ...ovf("2026-11-20"), kilde: "admin" as const };
    expect(finnOverforinger("2026-11-10", [{ ...fast(NARVIK), id: "f" }, admin])[0]?.retning).toBe("ut");
  });

  it("løsOppmote: åpen overføringsperiode gjelder som midlertidig fra fraDato", () => {
    const r = løsOppmote("2026-12-01", null, [fast(NARVIK), ovf(null)], null);
    expect(r).toEqual({ kilde: "midlertidig", oppmotestedId: TROMSO });
  });
});

// ── POST (13) del B: planleggOverforing — én regel for server og mobil ──────
describe("planleggOverforing", () => {
  const FAST = { id: "f", type: "kontor" as const, fast: true, oppmotestedId: "narvik", projectId: null, fraDato: "2026-01-01", tilDato: null, kilde: "admin" as const };
  const apenOvf = (sted: string, fra: string) => ({ id: "o", type: "kontor" as const, fast: false, oppmotestedId: sted, projectId: null, fraDato: fra, tilDato: null, kilde: "overforing" as const });

  it("start uten åpen overføring oppretter ny åpen kilde=overforing", () => {
    const plan = planleggOverforing([FAST], { handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" });
    expect(plan).toMatchObject({ utfall: "opprettet", apen: null, lukkTil: null, slettApen: false, ny: { oppmotestedId: "ramsund", fraDato: "2026-11-10", tilDato: null, fast: false, kilde: "overforing" } });
  });
  it("start til annet kontor lukker åpen overføring dagen før", () => {
    const plan = planleggOverforing([FAST, apenOvf("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "harstad", dato: "2026-11-10" });
    expect(plan).toMatchObject({ utfall: "opprettet", lukkTil: "2026-11-09", slettApen: false });
  });
  it("start samme dag som åpen startet sletter den (tom)", () => {
    const plan = planleggOverforing([FAST, apenOvf("ramsund", "2026-11-10")], { handling: "start", oppmotestedId: "harstad", dato: "2026-11-10" });
    expect(plan).toMatchObject({ utfall: "opprettet", slettApen: true });
  });
  it("start til eget fast kontor lukker åpen overføring dagen før", () => {
    expect(planleggOverforing([FAST, apenOvf("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "narvik", dato: "2026-11-10" }))
      .toMatchObject({ utfall: "lukket", til: "2026-11-09" });
    expect(planleggOverforing([FAST], { handling: "start", oppmotestedId: "narvik", dato: "2026-11-10" })).toEqual({ utfall: "ingen", periode: null });
  });
  it("start til samme åpne kontor er ingen endring", () => {
    expect(planleggOverforing([FAST, apenOvf("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "ramsund", dato: "2026-11-10" }).utfall).toBe("ingen");
  });
  it("åpen admin-satt midlertidig periode gir konflikt", () => {
    const admin = { ...apenOvf("ramsund", "2026-11-01"), kilde: "admin" as const };
    expect(planleggOverforing([FAST, admin], { handling: "start", oppmotestedId: "harstad", dato: "2026-11-10" })).toEqual({ utfall: "konflikt" });
  });
  it("slutt lukker på dato, slutt før start sletter, slutt uten åpen er ingen", () => {
    expect(planleggOverforing([apenOvf("r", "2026-11-01")], { handling: "slutt", dato: "2026-11-10" })).toMatchObject({ utfall: "lukket", til: "2026-11-10" });
    expect(planleggOverforing([apenOvf("r", "2026-11-10")], { handling: "slutt", dato: "2026-11-09" })).toMatchObject({ utfall: "slettet" });
    expect(planleggOverforing([FAST], { handling: "slutt", dato: "2026-11-10" })).toEqual({ utfall: "ingen", periode: null });
  });
  it("slutt rører aldri admin-perioder", () => {
    const admin = { ...apenOvf("r", "2026-11-01"), kilde: "admin" as const };
    expect(planleggOverforing([admin], { handling: "slutt", dato: "2026-11-10" })).toEqual({ utfall: "ingen", periode: null });
  });
});

describe("kontorOverforingOppsett (del B)", () => {
  const ovf = (sted: string, fra: string): OppmotePeriodeInput => ({ type: "kontor", fast: false, oppmotestedId: sted, projectId: null, fraDato: fra, tilDato: null, kilde: "overforing" });
  const KONTORER = [NARVIK, RAMSUND, TROMSO];

  it("tilbys ikke med færre enn 2 aktive kontorer", () => {
    expect(kontorOverforingOppsett("2026-11-10", E6, [fast(NARVIK)], [NARVIK])).toBeNull();
  });
  it("viser de andre kontorene enn der dagen starter", () => {
    expect(kontorOverforingOppsett("2026-11-10", E6, [fast(NARVIK)], KONTORER)).toEqual({
      fraKontorId: NARVIK,
      fastKontorId: NARVIK,
      andre: [RAMSUND, TROMSO],
    });
  });
  it("under overføring starter reisen på det midlertidige kontoret, fast kontor er med i lista", () => {
    const o = kontorOverforingOppsett("2026-11-10", E6, [fast(NARVIK), ovf(RAMSUND, "2026-11-05")], KONTORER)!;
    expect(o.fraKontorId).toBe(RAMSUND);
    expect(o.andre).toEqual([NARVIK, TROMSO]);
    expect(kontorOverforingRetning(o, NARVIK)).toBe("retur");
    expect(kontorOverforingRetning(o, TROMSO)).toBe("tur");
  });
  it("tilbys ikke når oppmøtested ikke er valgt eller dagen er en byggeplass-periode", () => {
    expect(kontorOverforingOppsett("2026-11-10", E6, [], KONTORER)).toBeNull();
    const bp: OppmotePeriodeInput = { type: "byggeplass", fast: false, oppmotestedId: null, projectId: E6, fraDato: "2026-11-01", tilDato: null };
    expect(kontorOverforingOppsett("2026-11-10", E6, [fast(NARVIK), bp], KONTORER)).toBeNull();
  });
});
