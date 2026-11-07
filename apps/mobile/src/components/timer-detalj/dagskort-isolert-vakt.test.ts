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

// ORDRE 37 — varesøket ruller «Vare»-blokka over tastaturet. Kun søkefeltet
// styrer rullingen; TastaturScrollView får bare ref-videresending, og
// dagskortets seksjoner sender ingen ref (atferd som før).
const SCROLL = les("TastaturScrollView.tsx");
const DAGSKORT_SEKSJONER = [
  "ArbeidstidSeksjon.tsx",
  "MaskinSeksjon.tsx",
  "SplittRadModal.tsx",
  "TilleggSeksjon.tsx",
  "TimerSeksjon.tsx",
  "UtleggSeksjon.tsx",
];
const inputTagg = (kilde: string, kjennetegn: string) => {
  const i = kilde.indexOf(kjennetegn);
  return i < 0 ? "" : kilde.slice(kilde.lastIndexOf("<TextInput", i), kilde.indexOf("/>", i));
};

describe("ORDRE 37 — varesøket over tastaturet", () => {
  it("🔴 søkefeltet (value={sok}) har fokus-styringen", () => {
    const tagg = inputTagg(MODAL, "value={sok}");
    expect(tagg).toContain("onFocus={varesokFokus.onFocus}");
    expect(tagg).toContain("onBlur={varesokFokus.onBlur}");
  });

  it("🔴 antall-feltet ruller ikke (iOS ruller det fram som før)", () => {
    const tagg = inputTagg(MODAL, "value={antall}");
    expect(tagg).toContain("keyboardType=");
    expect(tagg).not.toContain("onFocus");
  });

  it("🔴 Keyboard-lytteren fjernes ved unmount, og abonnementet har .remove()", () => {
    expect(MODAL).toMatch(/useEffect\(\(\) => \(\) => varesokFokus\.rydd\(\), \[varesokFokus\]\)/);
    const util = les("../../utils/varesokRulling.ts");
    expect(util).toContain("abonnement?.remove();");
    expect(util).toMatch(/onBlur: fjern/);
    expect(util).toMatch(/rydd: fjern/);
  });

  it("🔴 rulleflaten i modalen er TastaturScrollView med ref", () => {
    expect(MODAL).toMatch(/<TastaturScrollView\s+ref=\{rulleRef\}/);
  });

  it("🔴 TastaturScrollView videresender ref og beholder insets + handled", () => {
    expect(SCROLL).toContain("forwardRef<");
    expect(SCROLL).toMatch(/<ScrollView \{\.\.\.props\} ref=\{ref\} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">/);
  });

  it.each(DAGSKORT_SEKSJONER)("🔴 %s sender ingen ref til TastaturScrollView", (fil) => {
    const kilde = les(fil);
    const i = kilde.indexOf("<TastaturScrollView");
    expect(i).toBeGreaterThan(0);
    expect(kilde.slice(i, kilde.indexOf(">", i))).not.toContain("ref=");
  });

  it("negativkontroll: inputTagg finner taggen og gir tomt for ukjent kjennetegn", () => {
    expect(inputTagg(MODAL, "value={sok}")).toContain("onChangeText={setSok}");
    expect(inputTagg(MODAL, "finnes-ikke")).toBe("");
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

  it("🔴 Redirect bærer aapnetEksisterende videre (notisen «dagen finnes» overlever)", () => {
    const flat = DAGSKORT.replace(/\s+/g, " ");
    const i = flat.indexOf('pathname: "/timer/[id]/prosjektkort"');
    expect(i).toBeGreaterThan(0);
    const blokk = flat.slice(i, flat.indexOf("/>", i));
    expect(blokk).toContain(
      "...(params.aapnetEksisterende ? { aapnetEksisterende: params.aapnetEksisterende } : {})",
    );
  });

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

// ORDRE 36a — påkrevd «Hva gjorde du i dag?» bor KUN i Bekreft dag.
describe("ORDRE 36a — beskrivelsessperren rører ikke dagskortet", () => {
  it.each(["manglerBeskrivelse", "beskrivelsePerProsjekt", "beskrivelsePerKort", "kortMedArbeid", "BekreftDagBeskrivelse", "sisteBeskrivelser"])(
    "🔴 dagskortet inneholder ikke «%s»",
    (navn) => {
      expect(DAGSKORT).not.toContain(navn);
    },
  );
});

// ORDRE 36b — «Del opp»/«Slett» og beskrivelse-fokus i rad-modalene er
// prosjektkort-flytens. Standard = dagens atferd (ingen handlinger, ingen
// autofokus), og dagskortets seksjoner sender dem aldri.
const TIMER_SEKSJON = les("TimerSeksjon.tsx");
const GRUPPE = les("ProsjektGruppe.tsx");
const DAGSOVERSIKT_PROPS = ["handlinger=", "fokusBeskrivelse="];

/** Alle `<Tagg … />`-åpninger i kilden (til første `/>` eller `>` på toppnivå). */
function tagger(kilde: string, navn: string): string[] {
  const ut: string[] = [];
  let i = kilde.indexOf(`<${navn}`);
  while (i >= 0) {
    ut.push(kilde.slice(i, kilde.indexOf("/>", i)));
    i = kilde.indexOf(`<${navn}`, i + 1);
  }
  return ut;
}

describe("ORDRE 36b — rad-modalenes nye props rører ikke dagskortet", () => {
  it("negativkontroll: modal-taggene finnes i seksjonene", () => {
    expect(tagger(TIMER_SEKSJON, "TimerRadModal").length).toBeGreaterThan(0);
    expect(tagger(MASKIN, "MaskinRadModal").length).toBeGreaterThan(0);
  });

  it.each(DAGSOVERSIKT_PROPS)("🔴 seksjonenes egne modal-kall sender ikke «%s»", (prop) => {
    for (const tagg of [...tagger(TIMER_SEKSJON, "TimerRadModal"), ...tagger(MASKIN, "MaskinRadModal")]) {
      expect(tagg).not.toContain(prop);
    }
  });

  it.each(["handlinger", "fokusBeskrivelse", "RadHandlinger", "ProsjektkortDagsoversikt"])(
    "🔴 dagskortet og ProsjektGruppe inneholder ikke «%s»",
    (navn) => {
      expect(DAGSKORT).not.toContain(navn);
      expect(GRUPPE).not.toContain(navn);
    },
  );

  it("🔴 standardverdiene er dagens atferd", () => {
    expect(TIMER_SEKSJON).toContain("fokusBeskrivelse = false,");
    expect(TIMER_SEKSJON).toContain("handlinger?: RadHandlingerProps;");
    expect(MASKIN).toContain("handlinger?: RadHandlingerProps;");
    // RadHandlinger rendres kun når handlinger er sendt.
    for (const kilde of [TIMER_SEKSJON, MASKIN]) {
      expect(kilde.match(/<RadHandlinger/g)?.length).toBe(1);
      expect(kilde).toContain("{handlinger && <RadHandlinger handlinger={handlinger} />}");
    }
  });

  it("negativkontroll: et dagskort-kall med handlinger eller snudd standard fanges", () => {
    const mutant = TIMER_SEKSJON.replace("<TimerRadModal", "<TimerRadModal handlinger={x}");
    expect(tagger(mutant, "TimerRadModal").some((t) => t.includes("handlinger="))).toBe(true);
    expect(TIMER_SEKSJON.replace("fokusBeskrivelse = false,", "fokusBeskrivelse = true,")).not.toContain(
      "fokusBeskrivelse = false,",
    );
  });
});

// ORDRE 36b (kort = prosjekt+byggeplass+underprosjekt, dag-seksjonen):
// delte seksjoner har fått `reise`, `prosjektValg` og kortlås via kontekst.
// Dagskortet sender ingen av dem, og grenen med prop udefinert er dagens atferd.
const flat = (x: string) => x.replace(/\s+/g, " ");
const UTLEGG = flat(les("UtleggSeksjon.tsx"));
const KONTEKST = flat(les("prosjektkortKontekst.ts"));
const REISE_VILKAAR = [
  "{(!reise || reiseVisByggeplass || !!valgtByggeplassId) && (",
  "{(!reise || reiseVisUnderprosjekt || !!valgtEcoId) && (",
];
const UTLEGG_CHIPS = "{!erRedigering && prosjektValg && prosjektValg.length > 1 && (";

describe("ORDRE 36b — kortvalg og dag-seksjonen rører ikke dagskortet", () => {
  it.each(["prosjektValg=", "reise=", "DagSeksjon", "KortValgModal", "ProsjektkortKontekst", "kortRadFlytt"])(
    "🔴 dagskortet inneholder ikke «%s»",
    (navn) => {
      expect(DAGSKORT).not.toContain(navn);
    },
  );

  it("🔴 nye props er valgfrie, og uten dem er visningen som før", () => {
    expect(flat(TIMER_SEKSJON)).toContain("reise?: { lonnsartId: string | null }");
    expect(UTLEGG).toContain("prosjektValg?: { id: string; navn: string }[]");
    for (const v of REISE_VILKAAR) expect(flat(TIMER_SEKSJON)).toContain(v);
    expect(UTLEGG).toContain(UTLEGG_CHIPS);
  });

  it("🔴 utenfor et kort er kortlåsen null (standard-kontekst false)", () => {
    expect(KONTEKST).toContain("createContext<KortLaas | boolean>(false)");
    expect(KONTEKST).toContain('return typeof v === "object" ? v : null;');
  });

  it("negativkontroll: skjult byggeplass uten reise og chips uten prosjektValg fanges", () => {
    const mutant = flat(TIMER_SEKSJON).replace("(!reise || reiseVisByggeplass", "(reiseVisByggeplass");
    expect(mutant).not.toContain(REISE_VILKAAR[0]);
    expect(UTLEGG.replace("prosjektValg && prosjektValg.length > 1", "true")).not.toContain(UTLEGG_CHIPS);
  });
});
