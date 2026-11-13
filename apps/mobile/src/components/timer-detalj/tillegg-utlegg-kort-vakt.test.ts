import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * T8, T10, T11 (tillegg-utlegg-prosjektkort-spec.md § 9) — kildevakter.
 *  T8: «Del» (SplittRadModal) på tillegg — delene arver originalens byggeplass/underprosjekt (B5).
 *  T10: dagskortet får ingen kort-felt eller kortlås (B1). Hashen i
 *       `dagskort-isolert-vakt.test.ts` er uendret.
 *  T11: uten kort-kontekst (dagskortet) skriver seksjonene `null, null` = arv.
 * Atferden (DB) er dekket av `prosjektkort/kortTilleggUtlegg.test.ts`.
 */

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const flat = (x: string) => x.replace(/\s+/g, " ");

const SPLITT = flat(les("SplittRadModal.tsx"));
const TILLEGG = flat(les("TilleggSeksjon.tsx"));
const UTLEGG = flat(les("UtleggSeksjon.tsx"));
const DAGSKORT = les("../../../app/timer/[id].tsx");
const GRUPPE = les("ProsjektGruppe.tsx");

/** Insert-blokka for resten av tillegg-delene i SplittRadModal. */
function splittTilleggInsert(kilde: string): string {
  const i = kilde.indexOf("db.insert(sheetTilleggLocal)");
  return i < 0 ? "" : kilde.slice(i, kilde.indexOf(".run()", i));
}

describe("T8 — Del på tillegg arver kortets felt", () => {
  it("🔴 delene får originalens byggeplass og underprosjekt", () => {
    const blokk = splittTilleggInsert(SPLITT);
    expect(blokk).toContain("tilleggId: o.tilleggId");
    expect(blokk).toContain("byggeplassId: o.byggeplassId ?? null");
    expect(blokk).toContain("externalCostObjectId: o.externalCostObjectId ?? null");
  });

  it("negativkontroll: en insert uten feltene fanges, og tom kilde gir tom blokk", () => {
    const mutant = SPLITT.replace("byggeplassId: o.byggeplassId ?? null,", "");
    expect(splittTilleggInsert(mutant)).not.toContain("byggeplassId: o.byggeplassId");
    expect(splittTilleggInsert("")).toBe("");
  });
});

const KORTFELT_PROP = "kortFelt?: { byggeplassId: string | null; externalCostObjectId: string | null };";
const TILLEGG_SKRIV = [
  "skrivLonnstillegg(",
  "byggeplassId: kortFelt?.byggeplassId ?? null,",
  "externalCostObjectId: kortFelt?.externalCostObjectId ?? null,",
];

describe("T11 — uten kort-kontekst skrives null, null (arv)", () => {
  it("🔴 kortFelt er valgfri prop på begge seksjonene", () => {
    expect(TILLEGG).toContain(KORTFELT_PROP);
    expect(UTLEGG).toContain(KORTFELT_PROP);
  });

  it("🔴 tillegg: ny rad skrives via skrivLonnstillegg med kortFelt ?? null", () => {
    for (const s of TILLEGG_SKRIV) expect(TILLEGG).toContain(s);
    expect(TILLEGG).not.toContain("db.insert(sheetTilleggLocal)");
  });

  it("🔴 utlegg: nytt utlegg bærer kortFelt ?? null (også via onOpprett i Bekreft dag)", () => {
    expect(UTLEGG).toContain("byggeplassId: kortFelt?.byggeplassId ?? null,");
    expect(UTLEGG).toContain("externalCostObjectId: kortFelt?.externalCostObjectId ?? null,");
    const i = UTLEGG.indexOf("const nytt: NyttUtlegg = {");
    expect(i).toBeGreaterThan(0);
    expect(UTLEGG.slice(i, UTLEGG.indexOf("};", i))).toContain("kortFelt?.byggeplassId");
  });

  it("🔴 prosjektbytte på eksisterende tillegg nuller kortfeltene (byggeplass hører til prosjektet)", () => {
    expect(TILLEGG).toContain("...(prosjektByttet ? { byggeplassId: null, externalCostObjectId: null } : {}),");
  });

  it("negativkontroll: ?? null byttet mot en fast verdi fanges", () => {
    const mutant = TILLEGG.replace("byggeplassId: kortFelt?.byggeplassId ?? null,", "byggeplassId: \"x\",");
    expect(TILLEGG_SKRIV.every((s) => mutant.includes(s))).toBe(false);
  });
});

describe("T10 — dagskortet får verken kortFelt eller kortlås (B1)", () => {
  it.each(["kortFelt", "KortLaasFelt", "useKortLaas", "raderPaaKort"])("🔴 dagskortet og ProsjektGruppe inneholder ikke «%s»", (navn) => {
    expect(DAGSKORT).not.toContain(navn);
    expect(GRUPPE).not.toContain(navn);
  });

  it("🔴 KortLaasFelt rendres kun bak kortlåsen i begge modalene", () => {
    for (const k of [TILLEGG, UTLEGG]) {
      expect(k).toContain("const kortLaas = useKortLaas();");
      expect(k.match(/<KortLaasFelt/g)?.length).toBe(1);
      expect(k).toMatch(/\{kortLaas && \S+ && <KortLaasFelt projectId=\{\S+\} kortLaas=\{kortLaas\} \/>\}/);
    }
  });

  it("negativkontroll: kildene er lest, og en ubetinget KortLaasFelt fanges", () => {
    expect(DAGSKORT).toContain("ProsjektGruppe");
    expect(GRUPPE).toContain("TilleggSeksjon");
    const mutant = TILLEGG.replace(/\{kortLaas && \S+ && (<KortLaasFelt[^}]*\}[^}]*\} \/>)\}/, "$1");
    expect(mutant).not.toMatch(/\{kortLaas && \S+ && <KortLaasFelt/);
  });
});

// T7 (kortskjermen) — tillegg/utlegg hører til kortet: kortskjermen filtrerer
// dem på kortet, tar dem med i Endre/Slett (B4) og lagrer nye med kortets felt.
// Dag-seksjonen på samlesiden har dem ikke lenger.
const KORTSKJERM = flat(les("../../../app/timer/[id]/kort/[projectId].tsx"));
const DAGSEKSJON = les("prosjektkort/DagSeksjon.tsx");
const KORTSKJERM_KRAV = [
  "const kTillegg = raderPaaKort(tilleggRader, kontekst, valg);",
  "const kUtlegg = raderPaaKort(utleggRader, kontekst, valg);",
  "kTillegg.length + kUtlegg.length === 0",
  "tilleggRader, utleggRader, sedel: kontekst, kort: valg,",
  "<ProsjektkortKontekst.Provider value={{ byggeplassId: valg.byggeplassId, ecoId: valg.ecoId }}>",
  "rader={kTillegg}",
  "rader={kUtlegg}",
  "kortFelt={{ byggeplassId: lagretByggeplassForKort(valg, kontekst), externalCostObjectId: valg.ecoId }}",
];

describe("T7 — kortskjermen fører tillegg og utlegg", () => {
  it.each(KORTSKJERM_KRAV)("🔴 kortskjermen inneholder «%s»", (krav) => {
    expect(KORTSKJERM).toContain(krav);
  });

  it("🔴 dag-seksjonen fører ikke lenger tillegg eller utlegg", () => {
    expect(DAGSEKSJON).not.toContain("<TilleggSeksjon");
    expect(DAGSEKSJON).not.toContain("<UtleggSeksjon");
  });

  it("negativkontroll: gammel kortskjerm (utlegg={0}, ingen seksjoner) fanges", () => {
    const gammel = KORTSKJERM.replace("const kTillegg = raderPaaKort(tilleggRader, kontekst, valg);", "").replace(
      "rader={kTillegg}",
      "",
    );
    expect(gammel).not.toContain(KORTSKJERM_KRAV[0]);
    expect(gammel).not.toContain("rader={kTillegg}");
    expect(`${DAGSEKSJON}<TilleggSeksjon`).toContain("<TilleggSeksjon");
  });
});

describe("T12 — Bekreft dag fører tillegg og utlegg pr. kort (B6)", () => {
  const SKJERM = flat(les("../../../app/timer/bekreft-dag.tsx"));
  const LONN = flat(les("BekreftDagLonnUtlegg.tsx"));
  const KRAV_SKJERM = [
    "knyttLonnUtleggTilKort(lonnUtlegg, arbeidKort, forslag)",
    "kort={arbeidKort}",
    "kortMedFlestTimer(beregnet.forslag)?.projectId",
  ];
  const KRAV_LONN = ["const visKortValg = kort.length > 1;", "byggeplassId: k.byggeplassId", "...nyttKort(projectId)", "...nyttKort(u.projectId)"];

  it("🔴 skjermen gir linjene kort ved lagring, og komponenten viser kortvalg ved flere kort", () => {
    for (const k of KRAV_SKJERM) expect(SKJERM).toContain(k);
    for (const k of KRAV_LONN) expect(LONN).toContain(k);
  });

  it("negativkontroll: gammel lagring (lonnUtlegg rett inn) og linje uten kort fanges", () => {
    const gammel = SKJERM.replace("knyttLonnUtleggTilKort(lonnUtlegg, arbeidKort, forslag)", "lonnUtlegg");
    expect(gammel).not.toContain(KRAV_SKJERM[0]);
    const uten = LONN.replace("...nyttKort(projectId)", "projectId");
    expect(uten).not.toContain(KRAV_LONN[2]);
  });
});
