import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE 34 — dagskortet (`app/timer/[id].tsx`) isoleres fra Bekreft dag
// (Kenneth 2026-11-07). Nye props på delte komponenter har standard = dagens
// atferd, og dagskortet sender dem aldri. Vakten FEILER hvis noen fører
// Bekreft dag-propsene inn i dagskortet eller snur standardverdien.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const DAGSKORT = les("../../../app/timer/[id].tsx");
const MODAL = les("KortVareforbrukModal.tsx");
const MASKIN = les("MaskinSeksjon.tsx");

const BEKREFT_DAG_PROPS = [
  "forblirApen",
  "fortIDag",
  "overtidValg",
  "overtidFra",
  "overtidLonnsartId",
  "stegOvertidFra",
];

describe("ORDRE 34 — dagskortet er isolert fra Bekreft dag", () => {
  it("negativkontroll: dagskort-kilden er lest og er den riktige fila", () => {
    expect(DAGSKORT.length).toBeGreaterThan(1000);
    expect(DAGSKORT).toContain("ProsjektGruppe");
  });

  it.each(BEKREFT_DAG_PROPS)("🔴 dagskortet bruker ikke «%s»", (navn) => {
    expect(DAGSKORT).not.toContain(navn);
  });

  it("🔴 KortVareforbrukModal: standard forblirApen = false (lukker etter lagre som før)", () => {
    expect(MODAL).toMatch(/forblirApen = false/);
    // Ved «nullstill» returneres FØR onLagret — lukking skjer kun uten forblirApen.
    const flat = MODAL.replace(/\s+/g, " ");
    const blokk = /=== "nullstill"\) \{([^}]*)\}/.exec(flat)?.[1];
    expect(blokk).toBeDefined();
    expect(blokk).toContain("return;");
    expect(blokk).not.toContain("onLagret");
    expect(flat.slice(flat.indexOf('=== "nullstill"'))).toContain("onLagret();");
  });

  it("prosjektkortets MaskinSeksjon har fortsatt mengde (pkt 1b alt. 1 — kun fjernet i Bekreft dag)", () => {
    expect(MASKIN).toContain("mengde");
  });
});

// ORDRE 35 (I2) — prosjektkortet har egen rute (`app/timer/[id]/prosjektkort.tsx`).
// Dagskortet sender dit med én Redirect og bærer ingen kort-JSX lenger.
// JSX-taggrekkefølgen er frosset: = develop b3e96829 minus kort-taggene
// (ProsjektkortSamleside, RedigerArbeidstidModal). Endres dagskortets JSX med
// vilje: regenerer hashen med `jsxTagger` og begrunn det i commit-meldingen.
const DAGSKORT_TAGG_HASH =
  "2e7dc562c28106f98e32d41236f706395b4b34af9f8a7de30f607081c602dbfb";

function jsxTagger(kilde: string): string {
  const uten = kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const start = uten.indexOf('\n  return (\n    <SafeAreaView className="flex-1 bg-gray-50"');
  if (start < 0) return "";
  return [...uten.slice(start).matchAll(/<([A-Z][A-Za-z.]*)/g)].map((m) => m[1]).join(" ");
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

describe("ORDRE 35 — prosjektkortet er flyttet ut av dagskortet", () => {
  it.each(["ProsjektkortSamleside", "RedigerArbeidstidModal", "timer-detalj/prosjektkort/", "tilKortTimerRader", "tilKortMaskinRader", "visRammeModal"])(
    "🔴 dagskortet inneholder ikke «%s»",
    (navn) => {
      expect(DAGSKORT).not.toContain(navn);
    },
  );

  it("🔴 nøyaktig én Redirect, og den er styrt av kortModus mot prosjektkort-ruten", () => {
    expect(DAGSKORT.match(/<Redirect/g)?.length).toBe(1);
    const flat = DAGSKORT.replace(/\s+/g, " ");
    expect(flat).toMatch(/if \(kortModus\) \{ return \( <Redirect href=\{\{ pathname: "\/timer\/\[id\]\/prosjektkort"/);
  });

  it("🔴 dagskortets JSX-taggrekkefølge er frosset", () => {
    expect(hash(jsxTagger(DAGSKORT))).toBe(DAGSKORT_TAGG_HASH);
  });

  it("negativkontroll: én tagg ekstra eller tom kilde gir annen hash", () => {
    const tagger = jsxTagger(DAGSKORT);
    expect(tagger.split(" ").length).toBeGreaterThan(100);
    const mutant = DAGSKORT.replace("<MiniToast", "<ProsjektkortSamleside /><MiniToast");
    expect(hash(jsxTagger(mutant))).not.toBe(DAGSKORT_TAGG_HASH);
    expect(jsxTagger("")).toBe("");
  });
});
