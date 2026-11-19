// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * w1 (plan web-timeføring § 9): vare ført på PC kobles til jobben (g), avvik som korte
 * merker med forklaring på hover (B7), datoen som «17.11.» og årsvelger ved ukevalget.
 */

type Kall = { sti: string; input: unknown };
const h = vi.hoisted(() => {
  const kall: Kall[] = [];
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: undefined, isLoading: false });
        if (p === "useMutation")
          return () => ({ mutate: (input: unknown) => kall.push({ sti: navn, input }), isPending: false });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { kall, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({ index: i, key: i, start: i * 30 })),
    getTotalSize: () => count * 30,
    measureElement: () => {},
  }),
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/components/ui/KolonneVelger", () => ({ KolonneVelger: () => null }));
vi.mock("@/components/timer/SplittRadModal", () => ({ SplittRadModal: () => null }));
vi.mock("@/components/attestering/RedigerRadModal", () => ({ RedigerRadModal: () => null }));
vi.mock("@/components/SignertLenke", () => ({ SignertLenke: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/SignertBilde", () => ({ SignertBilde: () => null }));
// Byggeplassfeltet krever sidens kontekst; koblingen til timeraden er uavhengig av det.
vi.mock("@/components/timer/RadByggeplassFelt", () => ({
  useRadByggeplass: () => ({ kandidater: [], byggeplassId: null, setByggeplassId: () => {} }),
  RadByggeplassFelt: () => null,
}));

import { kortVareforbrukInput, vareTimerader, type KortVareforbrukInput } from "@sitedoc/shared";
import { KortVareforbrukModal } from "@/components/timer/KortVareforbrukModal";
import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import {
  byggAttesteringModell,
  visDato,
  spennerFlereAar,
  type AttDeps,
  type AttMaskin,
  type AttSedel,
  type AttTimer,
  type AttVare,
} from "@/components/attestering/attestering-tabell";
import { aarValg, isoUke, ukeOffsetForAar, ukerIAar } from "@/components/attestering/ukevalg";

const deps: AttDeps = {
  lonnsartNavn: (id) => (id === "ot" ? "Overtid 50 %" : "Timelønn"),
  aktivitetNavn: () => "",
  maskinNavn: () => "Volvo EC220E",
  tilleggNavn: () => "",
  avdelingNavn: () => null,
  normtakLinje: () => null,
  ukeAvvikTekst: () => null,
  maskinOverArbeidForklaring: (m: number, a: number) => `Maskin ${String(m).replace(".", ",")} t, arbeid ${String(a).replace(".", ",")} t`,
  tekst: {
    forslagSperre: "Uavklart forslag",
    maskinUtenTimerad: "Maskin uten timerad",
    maskinforerbevis: "Maskinarbeid uten registrert maskinførerbevis — flagget for synlighet.",
    merkeUtenTimerad: "Uten timerad",
    merkeUtenTimeradForklaring: "Maskinen er ikke koblet til en timerad, og står derfor som egen linje.",
    merkeUtenForerbevis: "Uten førerbevis", merkeMaskinOverArbeid: "Maskin over arbeid",
    tilleggskrav: "Tilleggskrav", tilByggherre: "Til byggherre", fravaerUtenProsjekt: "Fravær", annetProsjekt: "Annet prosjekt",
    reise: "Reise", statusVenter: "Venter", statusAttestert: "Attestert", statusReturnert: "Returnert",
  },
};
const P = { id: "pA", name: "Prosjekt A", internalProjectNumber: "1042", projectNumber: "SD-1" };
function timer(id: string, over: Partial<AttTimer> = {}): AttTimer {
  return {
    id, kortId: "kA", lonnsartId: "tl", aktivitetId: "a1", externalCostObjectId: null, projectId: "pA", byggeplassId: null,
    fraTid: "07:00", tilTid: "15:00", beskrivelse: null, timer: "7.5", pauseMin: 30, attestertStatus: "pending",
    project: P, byggeplassNavn: null, underprosjekt: null, rettedeFelter: [], ...over,
  };
}
function maskin(id: string, over: Partial<AttMaskin> = {}): AttMaskin {
  return {
    id, kortId: "kA", vehicleId: "v1", sheetTimerId: null, projectId: "pA", externalCostObjectId: null, byggeplassId: null,
    fraTid: null, tilTid: null, timer: "4", mengde: null, enhet: null, attestertStatus: "pending", project: P,
    manglerTimerad: false, ...over,
  };
}
function sedel(over: Partial<AttSedel> = {}): AttSedel {
  return {
    id: "s1", dato: "2026-11-17", totaltimer: 8, dagsnorm: 7.5, pauseMin: 30, tilleggHarKrav: false,
    redigerTillatt: true, manglerMaskinforerbevis: false, normStatus: "server", konfliktVentendeSiden: null,
    ansatt: { id: "u1", name: "Ola N.", email: "o@x", ansattnummer: "7", avdelingId: null },
    timer: [timer("t1"), timer("t2", { lonnsartId: "ot", fraTid: "15:00", tilTid: "15:30", timer: "0.5" })],
    maskiner: [], tillegg: [], utlegg: [], varer: [], ...over,
  };
}
function vis(sedler: AttSedel[]) {
  return render(
    <AttesteringTabell dager={byggAttesteringModell(sedler, deps)} orgId="org1" readOnly={false} verktoy={null} sedelUrl={(id) => `/s/${id}`} />,
  );
}
const linje = (c: HTMLElement, nokkel: string) => c.querySelector(`[data-linje="${nokkel}"]`) as HTMLElement | null;

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const dialogProto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
dialogProto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
dialogProto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

beforeEach(() => { h.kall.length = 0; });
afterEach(cleanup);

/* ------------------------------------------------------------------ */
/*  1 · Vare ført på PC kobles til jobben (g)                          */
/* ------------------------------------------------------------------ */

const SEDEL_RADER = [
  { id: "t2", projectId: "pA", fraTid: "15:00", tilTid: "15:30", timer: "0.5", erReise: false, attestertStatus: "pending" },
  { id: "t1", projectId: "pA", fraTid: "07:00", tilTid: "15:00", timer: "7.5", erReise: false, attestertStatus: "pending" },
  { id: "r1", projectId: "pA", fraTid: "06:30", tilTid: "07:00", timer: "0.5", erReise: true, attestertStatus: "pending" },
  { id: "e1", projectId: "pA", fraTid: "06:00", tilTid: "15:00", timer: "8", erReise: false, attestertStatus: "erstattet" },
  { id: "b1", projectId: "pB", fraTid: "05:00", tilTid: "06:00", timer: "1", erReise: false, attestertStatus: "pending" },
];

function lagreVareFraVinduet(timerRader: typeof SEDEL_RADER, velgRad?: string): KortVareforbrukInput {
  const v = render(
    <KortVareforbrukModal
      projectId="pA"
      prosjektNavn="Prosjekt A"
      dato="2026-11-17"
      dagsseddelId="s1"
      timerRader={timerRader}
      varer={[{ id: "vare1", navn: "Betong", varenummer: null, enhet: "m3" }]}
      byggeplasser={undefined}
      onClose={() => {}}
    />,
  );
  const selects = v.getAllByRole("combobox") as HTMLSelectElement[];
  const vareSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "vare1"))!;
  fireEvent.change(vareSelect, { target: { value: "vare1" } });
  if (velgRad) {
    const radSelect = selects.find((s) => Array.from(s.options).some((o) => o.value === "t1"))!;
    fireEvent.change(radSelect, { target: { value: velgRad } });
  }
  fireEvent.change(v.getByRole("spinbutton"), { target: { value: "4" } });
  fireEvent.click(v.getByRole("button", { name: "timer.prosjektkort.vareLagre" }));
  const k = h.kall.filter((x) => x.sti === "vareforbruk.opprett");
  expect(k).toHaveLength(1);
  cleanup();
  return k[0]!.input as KortVareforbrukInput;
}

/** Det serveren lagrer (`vareforbruk.opprett`): koblingen og radens kort (§ 4.3). */
function lagretVare(input: KortVareforbrukInput): AttVare {
  return {
    id: "v1", navn: "Betong", enhet: "m3", antall: input.antall, projectId: input.projectId,
    sheetTimerId: input.sheetTimerId ?? null, kortId: "kA", attestert: false,
  };
}

describe("w1 (g) — varen ført fra jobben på PC står på timeradens linje", () => {
  it("jobbens arbeidsrader: samme prosjekt, ikke reise, ikke erstattet, sortert på fra-tid", () => {
    expect(vareTimerader(SEDEL_RADER, "pA").map((r) => r.id)).toEqual(["t1", "t2"]);
  });

  it("vinduet sender timeraden (første arbeidsrad forvalgt) — og varen foldes på linja i attesteringen", () => {
    const input = lagreVareFraVinduet(SEDEL_RADER);
    expect(input).toMatchObject({ projectId: "pA", dagsseddelId: "s1", sheetTimerId: "t1", vareId: "vare1", antall: 4 });

    const { container } = vis([sedel({ varer: [lagretVare(input)] })]);
    expect(linje(container, "s1:timer:t1")!.textContent).toContain("Betong");
    expect(linje(container, "s1:vare:v1")).toBeNull();
  });

  it("med flere arbeidsrader kan raden velges, og varen står på den valgte linja", () => {
    const input = lagreVareFraVinduet(SEDEL_RADER, "t2");
    expect(input.sheetTimerId).toBe("t2");
    const { container } = vis([sedel({ varer: [lagretVare(input)] })]);
    expect(linje(container, "s1:timer:t2")!.textContent).toContain("Betong");
    expect(linje(container, "s1:timer:t1")!.textContent).not.toContain("Betong");
  });

  it("én arbeidsrad: ingen velger, raden sendes likevel", () => {
    const input = lagreVareFraVinduet([SEDEL_RADER[1]!]);
    expect(input.sheetTimerId).toBe("t1");
  });

  it("negativkontroll: uten kobling (gamle rader, H13) står varen som egen linje", () => {
    const utenKobling = { ...lagretVare(kortVareforbrukInput({ kortProsjektId: "pA", dato: "2026-11-17", vareId: "vare1", antall: 4, byggeplassId: null, dagsseddelId: "s1" })) };
    expect(utenKobling.sheetTimerId).toBeNull();
    const { container } = vis([sedel({ varer: [utenKobling] })]);
    expect(linje(container, "s1:vare:v1")).not.toBeNull();
    expect(linje(container, "s1:timer:t1")!.textContent).not.toContain("Betong");
  });

  it("uten timerad på jobben sendes ingen kobling", () => {
    const input = lagreVareFraVinduet([SEDEL_RADER[2]!]);
    expect(input.sheetTimerId).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  2 · Avvik som korte merker med forklaring på hover (B7)            */
/* ------------------------------------------------------------------ */

describe("w1 (B7) — avvik som korte merker på én linje", () => {
  const gammel = () =>
    sedel({ manglerMaskinforerbevis: true, maskiner: [maskin("m1", { manglerTimerad: true })] });

  it("maskinlinja uten kobling viser «Uten timerad» og «Uten førerbevis» som merker — ikke de lange setningene", () => {
    const { container } = vis([gammel()]);
    const l = linje(container, "s1:maskin:m1")!;
    const merker = Array.from(l.querySelectorAll("[data-avvik-merke]")).map((m) => m.textContent);
    expect(merker).toEqual(["Uten timerad", "Uten førerbevis"]);
    expect(l.textContent).not.toContain("flagget for synlighet");
    // w9 retur 1: merkene står hele — beholderen bryter heller enn å kutte (cella er `truncate`).
    const beholder = l.querySelector("[data-avvik-merke]")!.closest("span.flex")!;
    expect(beholder.className).toContain("flex-wrap");
    expect(beholder.className).toContain("whitespace-normal");
    for (const m of Array.from(l.querySelectorAll("[data-avvik-merke]"))) expect(m.className).not.toContain("whitespace-nowrap");
  });

  it("forklaringen vises når pekeren holdes over merket", () => {
    vi.useFakeTimers();
    const { container } = vis([gammel()]);
    const merke = Array.from(linje(container, "s1:maskin:m1")!.querySelectorAll("[data-avvik-merke]"))[1]!;
    act(() => { fireEvent.mouseEnter(merke.parentElement!); vi.advanceTimersByTime(500); });
    const tips = Array.from(document.querySelectorAll('[role="tooltip"]')).find((n) => n.className.includes("opacity-100"));
    expect(tips?.textContent).toContain("Maskinarbeid uten registrert maskinførerbevis");
    vi.useRealTimers();
  });

  it("modellen beholder hele teksten i linja (filter og ukeoversikt)", () => {
    const l = byggAttesteringModell([gammel()], deps)[0]!.kort.flatMap((k) => k.linjer).find((x) => x.kilde.type === "maskin")!;
    expect(l.linje.avvik).toEqual(["Maskin uten timerad", deps.tekst.maskinforerbevis]);
    expect(l.avvikMerker.map((m) => m.tekst)).toEqual(["Uten timerad", "Uten førerbevis"]);
  });

  it("negativkontroll: sperre uten merke står som tekst, som før", () => {
    const l = byggAttesteringModell([sedel()], { ...deps, normtakLinje: () => "Fravær over dagsnorm" })[0]!.kort[0]!.linjer[0]!;
    expect(l.avvikMerker).toEqual([{ tekst: "Fravær over dagsnorm", forklaring: null }]);
  });

  it("i18n: «Maskin uten timerad» (WM22) og nøklene finnes på nb og en", () => {
    const nb = JSON.parse(readFileSync(resolve(__dirname, "../../../../packages/shared/src/i18n/nb.json"), "utf8")) as Record<string, string>;
    const en = JSON.parse(readFileSync(resolve(__dirname, "../../../../packages/shared/src/i18n/en.json"), "utf8")) as Record<string, string>;
    expect(nb["timer.attestering.tabell.maskinUtenTimerad"]).toBe("Maskin uten timerad");
    for (const k of ["merke.utenTimerad", "merke.utenTimeradForklaring", "merke.utenForerbevis", "hjelp.merker", "hjelp.dato", "hjelp.aar"]) {
      expect(nb[`timer.attestering.tabell.${k}`]).toBeTruthy();
      expect(en[`timer.attestering.tabell.${k}`]).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  3 · Datoen som dd.mm. — året beholdes i eksporten                  */
/* ------------------------------------------------------------------ */

describe("w1 — datoen som «17.11.»", () => {
  it("visDato: dd.mm. uten år, dd.mm.åååå med", () => {
    expect(visDato("2026-11-17", false)).toBe("17.11.");
    expect(visDato("2026-11-17", true)).toBe("17.11.2026");
    expect(spennerFlereAar([{ dato: "2026-11-17" }, { dato: "2026-11-18" }])).toBe(false);
    expect(spennerFlereAar([{ dato: "2026-12-31" }, { dato: "2027-01-01" }])).toBe(true);
  });

  // w5b (B14 A): datoen står én gang, i dagsraden; linja skriver den ikke på nytt.
  const dagsrad = (c: HTMLElement, i: number) => c.querySelectorAll('[data-rad="dag"]')[i] as HTMLElement;

  it("tabellen viser 17.11. i dagsraden — ikke 2026-11-17", () => {
    const { container } = vis([sedel()]);
    expect(dagsrad(container, 0).textContent).toContain("17.11.");
    expect(container.textContent).not.toContain("2026-11-17");
  });

  it("dager fra to år (prosjektets attestering har ikke ukevalg): året står med", () => {
    const { container } = vis([sedel(), sedel({ id: "s0", dato: "2025-11-17" })]);
    const tekst = [dagsrad(container, 0).textContent, dagsrad(container, 1).textContent].join(" | ");
    expect(tekst).toContain("17.11.2026");
    expect(tekst).toContain("17.11.2025");
  });

  it("eksporten (Excel/CSV/PDF) bruker ikke skjermens formatering — året står", () => {
    const eksport = readFileSync(resolve(__dirname, "../lib/timer-rapport-eksport.ts"), "utf8");
    expect(eksport).toContain('dato: { i18n: "kolDato", verdi: (r) => r.dato }');
    expect(eksport).not.toContain("visDato");
  });
});

/* ------------------------------------------------------------------ */
/*  4 · Årsvelger ved ukevalget                                        */
/* ------------------------------------------------------------------ */

describe("w1 — årsvelgeren bytter år i én handling", () => {
  const idag = new Date(2026, 10, 17); // tirsdag uke 47 i 2026
  const ukestart = (offset: number) => {
    const d = new Date(2026, 10, 16);
    d.setDate(d.getDate() + offset * 7);
    return d;
  };

  it("samme uke året før: uke 47 i 2025", () => {
    const off = ukeOffsetForAar(ukestart(0), 2025, idag);
    expect(isoUke(ukestart(off))).toEqual({ aar: 2025, uke: 47 });
  });

  it("tilbake til i år gir offset 0", () => {
    const off2025 = ukeOffsetForAar(ukestart(0), 2025, idag);
    expect(ukeOffsetForAar(ukestart(off2025), 2026, idag)).toBe(0);
  });

  it("uke 53 til et år med 52 uker blir årets siste uke", () => {
    expect(ukerIAar(2026)).toBe(53);
    expect(ukerIAar(2025)).toBe(52);
    const uke53 = ukeOffsetForAar(ukestart(0), 2026, idag) + 6; // uke 53 i 2026
    expect(isoUke(ukestart(uke53))).toEqual({ aar: 2026, uke: 53 });
    const off = ukeOffsetForAar(ukestart(uke53), 2025, idag);
    expect(isoUke(ukestart(off))).toEqual({ aar: 2025, uke: 52 });
  });

  it("årene i velgeren: fem år tilbake til i år, og året som vises", () => {
    expect(aarValg(idag, 2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
    expect(aarValg(idag, 2018)).toContain(2018);
  });

  it("firmaets attestering har velgeren ved ukevalget; ukevalg forrige/neste/«Denne uka» står", () => {
    const side = readFileSync(resolve(__dirname, "../app/dashbord/firma/timer/attestering/page.tsx"), "utf8");
    expect(side).toContain("ukeOffsetForAar(ukestart, Number(e.target.value))");
    expect(side).toContain('t("timer.attestering.uke.aar")');
    expect(side).toContain("setUkeOffset((o) => o - 1)");
    expect(side).toContain("setUkeOffset((o) => o + 1)");
    expect(side).toContain('t("timer.attestering.uke.iDag")');
  });
});
