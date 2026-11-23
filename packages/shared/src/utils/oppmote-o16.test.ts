/**
 * O16 (vedtak-timer-web.md § Reisevinduet pkt 1–2): oppmøtestedet i web-reisevinduet.
 *  - R2: `planleggOverforing` gir likt utfall som på `b7a9109c` for alle tilfeller uten en egen
 *    periode med sluttdato; det ene avviket (etterregistrering inn i en lukket egen periode) står for seg.
 *  - R1: egne perioder med sluttdato (avslutt, forkort, tredje kontor, senere periode urørt).
 *  - H2/H3: morgenreisen regnes fra riktig kontor uansett rekkefølge.
 *  - R4 (fjernes), R7a (kl. 12 for «Siste dag»), R7b (Avslutt-forslag), R8 (firmaadmins periode).
 */
import { describe, expect, it } from "vitest";
import {
  avsluttSisteDagForslag,
  erApenOverforing,
  gjelderFraForslag,
  leggTilDager,
  løsOppmote,
  overforingKonflikt,
  planleggOppmoteBytte,
  planleggOverforing,
  sisteDagForslag,
  type OppmotePeriodeInput,
  type OverforingPeriode,
  type OverforingPlan,
} from "./oppmote";

const D = "2026-11-10";
const FAST: OverforingPeriode = { id: "f", type: "kontor", fast: true, oppmotestedId: "narvik", projectId: null, fraDato: "2026-01-01", tilDato: null, kilde: "admin" };
const egen = (sted: string, fra: string, til: string | null = null, id = "o"): OverforingPeriode => ({
  id,
  type: "kontor",
  fast: false,
  oppmotestedId: sted,
  projectId: null,
  fraDato: fra,
  tilDato: til,
  kilde: "overforing",
});
const admin = (sted: string, fra: string, til: string | null = null): OverforingPeriode => ({ ...egen(sted, fra, til, "a"), kilde: "admin" });

/** `planleggOverforing` slik den sto på `b7a9109c` (før O16) — fasiten for R2. */
function gammelPlan(
  perioder: readonly OverforingPeriode[],
  input: { handling: "start" | "slutt"; oppmotestedId?: string | null; dato: string },
): OverforingPlan {
  const apen = perioder.find(erApenOverforing) ?? null;
  const lukk = (til: string): OverforingPlan =>
    apen ? { utfall: til < apen.fraDato ? "slettet" : "lukket", apen, til } : { utfall: "ingen", periode: null };
  if (input.handling === "slutt") return lukk(input.dato);
  const maal = input.oppmotestedId ?? null;
  const fastPaaDato = perioder.find((p) => p.fast && p.fraDato <= input.dato && (p.tilDato == null || input.dato <= p.tilDato));
  if (maal != null && fastPaaDato?.oppmotestedId === maal) return lukk(leggTilDager(input.dato, -1));
  if (apen && apen.oppmotestedId === maal && apen.fraDato <= input.dato) return { utfall: "ingen", periode: apen };
  if (perioder.some((p) => p.type === "kontor" && !p.fast && p.tilDato == null && p.kilde !== "overforing")) return { utfall: "konflikt" };
  const lukkTil = apen ? leggTilDager(input.dato, -1) : null;
  return {
    utfall: "opprettet",
    ny: { type: "kontor", fast: false, oppmotestedId: maal, projectId: null, fraDato: input.dato, tilDato: null, kilde: "overforing" },
    apen,
    lukkTil,
    slettApen: apen != null && lukkTil! < apen.fraDato,
  };
}

/** Utfører en plan på periodelista (slik serveren skriver den). */
function anvend(perioder: readonly OverforingPeriode[], plan: OverforingPlan): OverforingPeriode[] {
  let ut = [...perioder];
  if (plan.utfall === "lukket") ut = ut.map((p) => (p.id === plan.apen.id ? { ...p, tilDato: plan.til } : p));
  if (plan.utfall === "slettet") ut = ut.filter((p) => p.id !== plan.apen.id);
  if (plan.utfall === "opprettet") {
    if (plan.apen) {
      ut = plan.slettApen ? ut.filter((p) => p.id !== plan.apen!.id) : ut.map((p) => (p.id === plan.apen!.id ? { ...p, tilDato: plan.lukkTil } : p));
    }
    ut.push({ ...plan.ny, id: "ny" });
  }
  return ut;
}

describe("R2 — likt utfall som før O16 uten egne perioder med sluttdato", () => {
  const tilfeller: Array<[string, OverforingPeriode[], { handling: "start" | "slutt"; oppmotestedId?: string; dato: string }]> = [
    ["start uten egen", [FAST], { handling: "start", oppmotestedId: "ramsund", dato: D }],
    ["start annet kontor lukker åpen", [FAST, egen("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "harstad", dato: D }],
    ["start samme dag sletter åpen", [FAST, egen("ramsund", D)], { handling: "start", oppmotestedId: "harstad", dato: D }],
    ["start fast lukker åpen", [FAST, egen("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "narvik", dato: D }],
    ["start fast uten åpen", [FAST], { handling: "start", oppmotestedId: "narvik", dato: D }],
    ["start samme åpne", [FAST, egen("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "ramsund", dato: D }],
    ["start før åpen startet", [FAST, egen("ramsund", "2026-11-20")], { handling: "start", oppmotestedId: "ramsund", dato: D }],
    ["admin åpen gir konflikt", [FAST, admin("ramsund", "2026-11-01")], { handling: "start", oppmotestedId: "harstad", dato: D }],
    ["slutt lukker", [egen("r", "2026-11-01")], { handling: "slutt", dato: D }],
    ["slutt før start sletter", [egen("r", "2026-11-11")], { handling: "slutt", dato: D }],
    ["slutt uten egen", [FAST], { handling: "slutt", dato: D }],
    ["slutt rører ikke admin", [admin("r", "2026-11-01")], { handling: "slutt", dato: D }],
    ["egen lukket i fortiden røres ikke", [FAST, egen("r", "2026-10-01", "2026-10-15")], { handling: "start", oppmotestedId: "harstad", dato: D }],
  ];
  for (const [navn, perioder, input] of tilfeller) {
    it(navn, () => {
      expect(planleggOverforing(perioder, input)).toEqual(gammelPlan(perioder, input));
    });
  }

  it("avviket: etterregistrering inn i en lukket egen periode forkorter den (før: CONFLICT fra serveren)", () => {
    const perioder = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    const input = { handling: "start" as const, oppmotestedId: "harstad", dato: D };
    // Før: den lukkede egne ble ikke sett; den nye åpne overlappet den → serveren avviste.
    const foer = gammelPlan(perioder, input);
    expect(foer).toMatchObject({ utfall: "opprettet", apen: null });
    expect(overforingKonflikt(perioder, foer)).not.toBeNull();
    // Nå: den egne forkortes til dagen før, ingen konflikt.
    const naa = planleggOverforing(perioder, input);
    expect(naa).toMatchObject({ utfall: "opprettet", apen: { id: "o" }, lukkTil: "2026-11-09", slettApen: false });
    expect(overforingKonflikt(perioder, naa)).toBeNull();
  });
});

describe("R1 — egne perioder med sluttdato", () => {
  it("avslutt inne i perioden lukker den; etter sluttdatoen er det ingen endring", () => {
    const p = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    expect(planleggOverforing(p, { handling: "slutt", dato: D })).toMatchObject({ utfall: "lukket", til: D });
    expect(planleggOverforing(p, { handling: "slutt", dato: "2026-11-25" })).toEqual({ utfall: "ingen", periode: null });
    expect(planleggOverforing(p, { handling: "slutt", dato: "2026-11-20" })).toMatchObject({ utfall: "ingen", periode: { id: "o" } });
  });
  it("forkort: ny periode midt i en egen med sluttdato lukker den dagen før", () => {
    const p = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    expect(planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: D, tilDato: "2026-11-15" })).toMatchObject({
      utfall: "opprettet",
      lukkTil: "2026-11-09",
      ny: { fraDato: D, tilDato: "2026-11-15" },
    });
  });
  it("tredje kontor mot firmaadmins periode med sluttdato: overlapp oppdages", () => {
    const p = [FAST, admin("ramsund", "2026-11-01", "2026-11-20")];
    const plan = planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: D });
    expect(plan.utfall).toBe("opprettet");
    expect(overforingKonflikt(p, plan)).toMatchObject({ id: "a" });
    // Etter firmaadmins periode: ingen overlapp.
    expect(overforingKonflikt(p, planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: "2026-11-21" }))).toBeNull();
  });
  it("en senere egen periode røres ikke når den nye slutter før den starter", () => {
    const p = [FAST, egen("ramsund", "2026-11-20", "2026-11-30")];
    const plan = planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: D, tilDato: "2026-11-15" });
    expect(plan).toMatchObject({ utfall: "opprettet", apen: null, lukkTil: null, slettApen: false });
    expect(overforingKonflikt(p, plan)).toBeNull();
  });
});

describe("O16 pkt 2 — forslagene for datoene", () => {
  it("«Gjelder fra»: tur = sedelens dato, retur = dagen etter, kontor = kl. 12-regelen", () => {
    expect(gjelderFraForslag("tur", D, "06:00")).toBe(D);
    expect(gjelderFraForslag("retur", D, "15:00")).toBe("2026-11-11");
    expect(gjelderFraForslag("kontor", D, "06:00")).toBe(D);
    expect(gjelderFraForslag("kontor", D, "13:00")).toBe("2026-11-11");
  });
  it("«Siste dag»: retur = sedelens dato, tur = dagen før", () => {
    expect(sisteDagForslag("retur", D, "15:00")).toBe(D);
    expect(sisteDagForslag("tur", D, "06:00")).toBe("2026-11-09");
  });
  it("R7a: kontor → fast følger kl. 12-regelen for retur — før 12 dagen før", () => {
    expect(sisteDagForslag("kontor", D, "11:59")).toBe("2026-11-09");
  });
  it("R7a: kontor → fast følger kl. 12-regelen for retur — fra 12 sedelens dato", () => {
    expect(sisteDagForslag("kontor", D, "12:00")).toBe(D);
  });
  it("R7b: «Avslutt» foreslår dagen før sedelens dato", () => {
    expect(avsluttSisteDagForslag(D)).toBe("2026-11-09");
    expect(avsluttSisteDagForslag("2026-01-01")).toBe("2025-12-31");
  });
});

const bytte = (over: Partial<Parameters<typeof planleggOppmoteBytte>[0]>) =>
  planleggOppmoteBytte({
    valg: "tur",
    dato: D,
    startTid: "06:00",
    perioder: [FAST],
    dagensKontorId: "narvik",
    fastKontorId: "narvik",
    valgtKontorId: null,
    ...over,
  });

describe("planleggOppmoteBytte", () => {
  it("dagens kontor valgt: ingen periode", () => {
    expect(bytte({ valgtKontorId: "narvik" })).toEqual({ type: "ingen" });
    expect(bytte({ valgtKontorId: null })).toEqual({ type: "ingen" });
  });
  it("pkt 2–3: arbeiderens datoer sendes; «Til og med» tom = åpen", () => {
    const b = bytte({ valgtKontorId: "ramsund", gjelderFra: "2026-11-12", tilOgMed: "2026-11-30" });
    expect(b).toMatchObject({ type: "start", kall: { handling: "start", oppmotestedId: "ramsund", dato: "2026-11-12", tilDato: "2026-11-30" } });
    const aapen = bytte({ valgtKontorId: "ramsund" });
    expect(aapen.type === "start" && aapen.kall).toEqual({ handling: "start", oppmotestedId: "ramsund", dato: D });
  });
  it("«Til og med» før «Gjelder fra» er ugyldig", () => {
    expect(bytte({ valgtKontorId: "ramsund", tilOgMed: "2026-11-09" })).toMatchObject({ type: "start", ugyldig: "tilFoerFra" });
  });
  it("R4: et bytte som tømmer en egen periode sier at den fjernes", () => {
    const b = bytte({ valgtKontorId: "harstad", perioder: [FAST, egen("ramsund", D)], dagensKontorId: "ramsund" });
    expect(b).toMatchObject({ type: "start", fjernes: { id: "o" }, forkortes: null });
    const s = bytte({ valg: "retur", valgtKontorId: "narvik", perioder: [FAST, egen("ramsund", "2026-11-11")], dato: "2026-11-11", dagensKontorId: "ramsund", startTid: "15:00", sisteDag: "2026-11-10" });
    expect(s).toMatchObject({ type: "slutt", fjernes: { id: "o" } });
  });
  it("forkortes: en egen periode som slutter dagen før den nye", () => {
    const b = bytte({ valgtKontorId: "harstad", perioder: [FAST, egen("ramsund", "2026-11-01")], dagensKontorId: "ramsund" });
    expect(b).toMatchObject({ type: "start", forkortes: { periode: { id: "o" }, til: "2026-11-09" }, fjernes: null });
  });
  it("R8: firmaadmins periode avsluttes ikke fra reisevinduet", () => {
    const b = bytte({ valg: "retur", valgtKontorId: "narvik", perioder: [FAST, admin("ramsund", "2026-11-01")], dagensKontorId: "ramsund" });
    expect(b).toMatchObject({ type: "admin", periode: { id: "a" } });
  });
  it("R3: overlapp med firmaadmins periode med sluttdato oppdages i klienten", () => {
    const b = bytte({ valgtKontorId: "harstad", perioder: [FAST, admin("ramsund", "2026-11-01", "2026-11-20")], dagensKontorId: "ramsund" });
    // Firmaadmins periode med sluttdato er «gjeldende», men valgt kontor er ikke det faste → start med konflikt.
    expect(b).toMatchObject({ type: "start", konflikt: { id: "a" } });
  });
  it("R7a: kontor → fast mens egen midlertidig gjelder avsluttes etter kl. 12-regelen", () => {
    const p = [FAST, egen("ramsund", "2026-11-01")];
    expect(bytte({ valg: "kontor", valgtKontorId: "narvik", perioder: p, dagensKontorId: "ramsund", startTid: "07:00" })).toMatchObject({
      type: "slutt",
      kall: { handling: "slutt", dato: "2026-11-09" },
    });
    expect(bytte({ valg: "kontor", valgtKontorId: "narvik", perioder: p, dagensKontorId: "ramsund", startTid: "14:00" })).toMatchObject({
      type: "slutt",
      kall: { handling: "slutt", dato: D },
    });
  });
});

describe("H2/H3 — morgenreisen regnes fra riktig kontor uansett rekkefølge", () => {
  const kontorPaa = (dato: string, p: readonly OppmotePeriodeInput[]) => {
    const r = løsOppmote(dato, null, p, null);
    return "oppmotestedId" in r ? r.oppmotestedId : null;
  };

  it("H2: kveldsreisen til et nytt kontor først — morgenreisen samme dag regnes fra det faste", () => {
    const kveld = bytte({ valg: "retur", valgtKontorId: "ramsund", startTid: "16:00" });
    expect(kveld.type).toBe("start");
    if (kveld.type !== "start") return;
    expect(kveld.gjelderFra).toBe("2026-11-11");
    const etter = anvend([FAST], kveld.plan);
    expect(kontorPaa(D, etter)).toBe("narvik");
    expect(kontorPaa("2026-11-11", etter)).toBe("ramsund");
  });
  it("H3: hjemreisen til det faste først — morgenreisen samme dag regnes fra det midlertidige", () => {
    const p = [FAST, egen("ramsund", "2026-11-01")];
    const hjem = bytte({ valg: "retur", valgtKontorId: "narvik", perioder: p, dagensKontorId: "ramsund", startTid: "16:00" });
    expect(hjem).toMatchObject({ type: "slutt", sisteDag: D });
    if (hjem.type !== "slutt") return;
    const etter = anvend(p, planleggOverforing(p, hjem.kall));
    expect(kontorPaa(D, etter)).toBe("ramsund");
    expect(kontorPaa("2026-11-11", etter)).toBe("narvik");
  });
});
