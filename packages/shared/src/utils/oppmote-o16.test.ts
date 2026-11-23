/**
 * O16 (vedtak-timer-web.md § Reisevinduet pkt 1–2): oppmøtestedet i web-reisevinduet.
 *  - R2/V1: et kall uten web-feltene (mobilen) gir likt utfall som på `b7a9109c` i hele det genererte
 *    rutenettet; med `medSluttdato` (web) står avvikene hver for seg.
 *  - V2: `slutt` med `periodeId` lukker/sletter nettopp den perioden boksen navngir.
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

// ── R2-vakt (O16 V1): generert rutenett, samme oppsett som Kontrollørens `relay/o16-r10/sammenlign.ts` ──
const dag = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
type Kall = { handling: "start" | "slutt"; oppmotestedId?: string; dato: string };
const tilstand = (ps: readonly OverforingPeriode[]) =>
  ps
    .filter((p) => !p.fast)
    .map((p) => `${p.id}:${p.oppmotestedId}:${p.fraDato.slice(8)}-${p.tilDato?.slice(8) ?? "∞"}`)
    .sort()
    .join(",");
/** Serverens utfall: plan + konfliktsjekk + skriving, som tekst. */
function serverUtfall(ps: readonly OverforingPeriode[], plan: OverforingPlan): string {
  if (plan.utfall === "konflikt") return "CONFLICT";
  if (plan.utfall === "opprettet" && overforingKonflikt(ps, plan)) return "CONFLICT";
  return `${plan.utfall}|${tilstand(anvend(ps, plan))}`;
}
const rutenett = (() => {
  const kand: OverforingPeriode[] = [];
  let k = 0;
  for (const s of ["A", "B"]) {
    for (let f = 2; f <= 8; f += 2) {
      kand.push(egen(s, dag(f), null, `e${k++}`));
      for (let t = f; t <= 9; t += 3) kand.push(egen(s, dag(f), dag(t), `e${k++}`));
    }
  }
  const adm = [null, { ...admin("C", dag(3)), id: "adm1" }, { ...admin("C", dag(3), dag(5)), id: "adm2" }];
  const overlapp = (a: OverforingPeriode, b: OverforingPeriode) =>
    a.fraDato <= (b.tilDato ?? "9999") && b.fraDato <= (a.tilDato ?? "9999");
  const gyldig = (ps: OverforingPeriode[]) => {
    const m = ps.filter((p) => !p.fast);
    if (m.filter((p) => p.tilDato == null).length > 1) return false;
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (overlapp(m[i]!, m[j]!)) return false;
    return true;
  };
  const sett: OverforingPeriode[][] = [];
  for (const a of adm) {
    const base = a ? [FAST, a] : [FAST];
    sett.push(base);
    for (let i = 0; i < kand.length; i++) {
      sett.push([...base, kand[i]!]);
      for (let j = i + 1; j < kand.length; j++) sett.push([...base, kand[i]!, kand[j]!]);
    }
  }
  const kall: Kall[] = [];
  for (let n = 1; n <= 10; n++) {
    kall.push({ handling: "slutt", dato: dag(n) });
    for (const s of ["narvik", "A", "B", "C"]) kall.push({ handling: "start", oppmotestedId: s, dato: dag(n) });
  }
  return { sett: sett.filter(gyldig), kall };
})();
const klasse = (k: Kall, foer: string, naa: string) =>
  `${k.handling}${k.handling === "start" ? (k.oppmotestedId === "narvik" ? "→fast" : "→annet") : ""} | ${foer.split("|")[0]} → ${naa.split("|")[0]}`;

describe("R2 — et kall uten web-feltene (mobilen) gir nøyaktig dagens utfall", () => {
  it("hele rutenettet, også egne perioder med sluttdato: likt i alle tilfeller", () => {
    let tot = 0;
    let medSluttdatoEgen = 0;
    const avvik: string[] = [];
    for (const ps of rutenett.sett) {
      for (const k of rutenett.kall) {
        tot++;
        if (ps.some((p) => p.kilde === "overforing" && p.tilDato != null && p.tilDato >= k.dato)) medSluttdatoEgen++;
        const foer = serverUtfall(ps, gammelPlan(ps, k));
        const naa = serverUtfall(ps, planleggOverforing(ps, k));
        if (foer !== naa) avvik.push(`${tilstand(ps)} ; ${JSON.stringify(k)} ; ${foer} → ${naa}`);
      }
    }
    expect(tot).toBe(7850);
    expect(medSluttdatoEgen).toBe(4240);
    expect(avvik).toEqual([]);
  });

  it("med `medSluttdato` (web, `start`): avvikene står hver for seg, alle med egen periode med sluttdato", () => {
    const klasser = new Map<string, number>();
    for (const ps of rutenett.sett) {
      for (const k of rutenett.kall) {
        if (k.handling !== "start") continue;
        const foer = serverUtfall(ps, gammelPlan(ps, k));
        const naa = serverUtfall(ps, planleggOverforing(ps, { ...k, medSluttdato: true }));
        if (foer === naa) continue;
        expect(ps.some((p) => p.kilde === "overforing" && p.tilDato != null && p.tilDato >= k.dato)).toBe(true);
        const kl = klasse(k, foer, naa);
        klasser.set(kl, (klasser.get(kl) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries([...klasser].sort())).toEqual({
      // Godkjent (trinn 1 R2): etterregistrering inn i en egen periode med sluttdato forkorter den.
      "start→annet | CONFLICT → opprettet": 828,
      // R1: samme kontor som den egne perioden med sluttdato gjelder → ingen ny periode.
      "start→annet | CONFLICT → ingen": 390,
      // Web sender aldri `start` til fast kontor (R2: hjemreise går som `slutt` med `periodeId`).
      "start→fast | ingen → lukket": 144,
      "start→fast | ingen → slettet": 516,
      "start→fast | slettet → lukket": 36,
      "start→fast | slettet → slettet": 152,
    });
  });

  it("avviket: etterregistrering inn i en lukket egen periode forkorter den bare med web-feltet", () => {
    const perioder = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    const input = { handling: "start" as const, oppmotestedId: "harstad", dato: D };
    // Mobilen (uten felt): som før — den lukkede egne ses ikke, og serveren avviser overlappen.
    const mobil = planleggOverforing(perioder, input);
    expect(mobil).toEqual(gammelPlan(perioder, input));
    expect(overforingKonflikt(perioder, mobil)).not.toBeNull();
    // Web (`medSluttdato`): den egne forkortes til dagen før, ingen konflikt.
    const web = planleggOverforing(perioder, { ...input, medSluttdato: true });
    expect(web).toMatchObject({ utfall: "opprettet", apen: { id: "o" }, lukkTil: "2026-11-09", slettApen: false });
    expect(overforingKonflikt(perioder, web)).toBeNull();
  });
});

describe("V2 — `slutt` med `periodeId` virker på nettopp den perioden", () => {
  it("hele rutenettet: bare den navngitte perioden endres, alle andre står urørt", () => {
    let n = 0;
    for (const ps of rutenett.sett) {
      for (const valgt of ps.filter((p) => p.kilde === "overforing" && !p.fast)) {
        for (let d = 1; d <= 10; d++) {
          n++;
          const plan = planleggOverforing(ps, { handling: "slutt", dato: dag(d), periodeId: valgt.id });
          const etter = anvend(ps, plan);
          for (const p of ps.filter((x) => x.id !== valgt.id)) expect(etter).toContainEqual(p);
          if (plan.utfall === "lukket" || plan.utfall === "slettet") expect(plan.apen.id).toBe(valgt.id);
          else expect(plan).toEqual({ utfall: "ingen", periode: valgt });
        }
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("A 02–02 og B 04–∞, seddel 05: «Siste dag» og «Avslutt» 03/02/01 fjerner B, A står urørt", () => {
    const A = egen("A", dag(2), dag(2), "A");
    const B = egen("B", dag(4), null, "B");
    const ps = [FAST, A, B];
    // Alle tre ligger før B startet (04) → B slettes (før V2: 02 ga «ingen», 01 slettet A).
    const fasit: Record<number, string> = { 3: "slettet", 2: "slettet", 1: "slettet" };
    for (const siste of [3, 2, 1]) {
      const b = planleggOppmoteBytte({
        valg: "tur",
        dato: dag(5),
        startTid: "07:00",
        perioder: ps,
        dagensKontorId: "B",
        fastKontorId: "narvik",
        valgtKontorId: "narvik",
        sisteDag: dag(siste),
      });
      expect(b).toMatchObject({ type: "slutt", periode: { id: "B" }, kall: { handling: "slutt", dato: dag(siste), periodeId: "B" } });
      if (b.type !== "slutt") return;
      // Boksens «… fjernes» regnes fra samme periode som kallet.
      expect(b.fjernes?.id ?? null).toBe(fasit[siste] === "slettet" ? "B" : null);
      // «Siste dag» (boksens kall) og «Avslutt» (samme kall fra periodelinja) gir samme utfall.
      for (const kall of [b.kall, { handling: "slutt" as const, dato: dag(siste), periodeId: B.id }]) {
        const plan = planleggOverforing(ps, kall);
        expect(plan.utfall).toBe(fasit[siste]);
        const etter = anvend(ps, plan);
        expect(etter).toContainEqual(A);
        expect(etter.some((p) => p.id === "B")).toBe(false);
      }
    }
  });
});

describe("R1 — egne perioder med sluttdato", () => {
  it("avslutt (web, `periodeId`) inne i perioden lukker den; på/etter sluttdatoen er det ingen endring", () => {
    const p = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    expect(planleggOverforing(p, { handling: "slutt", dato: D, periodeId: "o" })).toMatchObject({ utfall: "lukket", til: D });
    expect(planleggOverforing(p, { handling: "slutt", dato: "2026-11-25", periodeId: "o" })).toMatchObject({ utfall: "ingen", periode: { id: "o" } });
    expect(planleggOverforing(p, { handling: "slutt", dato: "2026-11-20", periodeId: "o" })).toMatchObject({ utfall: "ingen", periode: { id: "o" } });
    // Mobilen (uten `periodeId`): som før — bare den åpne ses.
    expect(planleggOverforing(p, { handling: "slutt", dato: D })).toEqual({ utfall: "ingen", periode: null });
  });
  it("forkort: ny periode midt i en egen med sluttdato lukker den dagen før", () => {
    const p = [FAST, egen("ramsund", "2026-11-01", "2026-11-20")];
    expect(planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: D, tilDato: "2026-11-15", medSluttdato: true })).toMatchObject({
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
    const plan = planleggOverforing(p, { handling: "start", oppmotestedId: "harstad", dato: D, tilDato: "2026-11-15", medSluttdato: true });
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
    expect(aapen.type === "start" && aapen.kall).toEqual({ handling: "start", oppmotestedId: "ramsund", dato: D, medSluttdato: true });
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
