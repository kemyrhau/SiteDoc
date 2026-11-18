// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent, cleanup, act, within } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Attesteringens Sedler-fane som tabell (spec prosjektkort-kortid d2b-1, § 12.8.5):
 * T38, T43, T44, T49, T59 (web), T60, T61. Rød før commit 4: komponenten fantes ikke.
 */

type Kall = { sti: string; input: unknown; opts?: { onSuccess?: (d: unknown) => void; onError?: (e: { message: string }) => void } };
const h = vi.hoisted(() => {
  const kall: Kall[] = [];
  const data: Record<string, unknown> = {};
  const velger: { props: Record<string, unknown> | null } = { props: null };
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation")
          return (felles?: Kall["opts"]) => ({
            mutate: (input: unknown, opts?: Kall["opts"]) => kall.push({ sti: navn, input, opts: opts ?? felles }),
            isPending: false,
          });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { kall, data, velger, trpc: lag([]) };
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
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/components/ui/KolonneVelger", () => ({
  KolonneVelger: (p: Record<string, unknown>) => { h.velger.props = p; return null; },
}));
vi.mock("@/components/timer/SplittRadModal", () => ({ SplittRadModal: () => <div>splitt-modal</div> }));
vi.mock("@/components/attestering/RedigerRadModal", () => ({ RedigerRadModal: () => <div>rediger-modal</div> }));
vi.mock("@/components/SignertLenke", () => ({
  SignertLenke: ({ url, title, children }: { url: string; title?: string; children: ReactNode }) => <a href={url} title={title}>{children}</a>,
}));
vi.mock("@/components/SignertBilde", () => ({
  SignertBilde: ({ url, alt }: { url: string; alt?: string }) => <img data-url={url} alt={alt} />,
}));

import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { byggAttesteringModell, filtrerModell, AVVIK_FILTER, type AttDeps, type AttSedel, type AttTimer } from "@/components/attestering/attestering-tabell";

const deps: AttDeps = {
  lonnsartNavn: () => "Ordinær",
  aktivitetNavn: () => "Graving",
  maskinNavn: () => "Gravemaskin",
  tilleggNavn: () => "Smusstillegg",
  avdelingNavn: () => null,
  normtakLinje: (s) => (s.id === "sperret" ? "Fravær over dagsnorm" : null),
  ukeAvvikTekst: () => null,
  tekst: {
    forslagSperre: "Uavklart forslag", maskinUtenTimerad: "Maskin uten timerad", maskinforerbevis: "Mangler bevis",
    merkeUtenTimerad: "Uten timerad", merkeUtenTimeradForklaring: "Maskinen er ikke koblet til en timerad.", merkeUtenForerbevis: "Uten førerbevis",
    tilleggskrav: "Tilleggskrav", tilByggherre: "Til byggherre", fravaerUtenProsjekt: "Fravær", annetProsjekt: "Annet prosjekt", reise: "Reise",
    statusVenter: "Venter", statusAttestert: "Attestert", statusReturnert: "Returnert",
  },
};
const P = { id: "pA", name: "Prosjekt A", internalProjectNumber: "1001", projectNumber: "SD-1" };
function timer(id: string, over: Partial<AttTimer> = {}): AttTimer {
  return {
    id, kortId: "kA", lonnsartId: "l1", aktivitetId: "a1", externalCostObjectId: null, projectId: "pA", byggeplassId: null,
    fraTid: "07:00", tilTid: "15:00", beskrivelse: null, timer: "7.5", pauseMin: 30, attestertStatus: "pending",
    project: P, byggeplassNavn: null, underprosjekt: null, rettedeFelter: [], ...over,
  };
}
function sedel(over: Partial<AttSedel> = {}): AttSedel {
  return {
    id: "s1", dato: "2026-11-16", totaltimer: 7.5, dagsnorm: 7.5, pauseMin: 30, tilleggHarKrav: false,
    redigerTillatt: true, manglerMaskinforerbevis: false, normStatus: "server", konfliktVentendeSiden: null,
    ansatt: { id: "u1", name: "Kari Nordmann", email: "k@x", ansattnummer: "12", avdelingId: null },
    timer: [timer("t1")], maskiner: [], tillegg: [], utlegg: [], varer: [], ...over,
  };
}

function vis(sedler: AttSedel[], readOnly = false) {
  return render(
    <AttesteringTabell
      dager={byggAttesteringModell(sedler, deps)}
      orgId="org1"
      readOnly={readOnly}
      verktoy={<span>uke-og-fane</span>}
      ukeoversikt={() => <div>ukeoversikt-innhold</div>}
      sedelUrl={(id) => `/sedel/${id}`}
      onReturnerDag={() => {}}
    />,
  );
}
const linje = (c: HTMLElement, nokkel: string) => c.querySelector(`[data-linje="${nokkel}"]`) as HTMLElement;
const kallTil = (navn: string) => h.kall.filter((k) => k.sti.endsWith(navn));

beforeEach(() => { h.kall.length = 0; h.velger.props = null; });
afterEach(cleanup);

describe("T43 — «Attester utvalget»", () => {
  it("sender de synlige ventende linjene i ett kall; linjer med sperre står og meldingen teller dem", () => {
    const { getByRole, getByText } = vis([
      sedel({ id: "s1", timer: [timer("t1"), timer("t2", { attestertStatus: "attestert" })] }),
      sedel({ id: "sperret", dato: "2026-11-17", timer: [timer("t3")] }),
    ]);
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    const k = kallTil("attesterRader");
    expect(k).toHaveLength(1);
    expect(k[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
    expect(getByText(/timer\.attestering\.tabell\.stoende\{"count":1\}/)).toBeTruthy();
  });

  it("avkryssede linjer er utvalget når noen er krysset av", () => {
    const { container, getByRole } = vis([sedel({ timer: [timer("t1"), timer("t2")] })]);
    fireEvent.click(within(linje(container, "s1:timer:t2")).getByRole("checkbox"));
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t2"], maskinIder: [], tilleggIder: [] } });
  });

  it("i attestert-fanen finnes ingen ✓ og ingen «Attester utvalget»", () => {
    const { queryAllByRole, queryByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })], true);
    expect(queryAllByRole("button", { name: "timer.attestering.attester" })).toHaveLength(0);
    expect(queryAllByRole("button", { name: "timer.attestering.tabell.attesterKort" })).toHaveLength(0);
    expect(queryByRole("button", { name: /attesterUtvalget|attesterDagen/ })).toBeNull();
  });
});

describe("T44 — ingenting attestanten trenger ligger bare i title eller bak hover", () => {
  it("✓, ↩, ✂ og penn er synlige knapper på hver ventende linje, og sperren står som tekst", () => {
    const { container, getAllByText } = vis([sedel({ id: "sperret" })]);
    const l = linje(container, "sperret:timer:t1");
    for (const navn of ["timer.attestering.attester", "timer.attestering.returner", "timer.attestering.meny.splittRad", "timer.attestering.meny.rediger"]) {
      const knapp = within(l).getByRole("button", { name: navn });
      expect(knapp.className).not.toMatch(/opacity-0|invisible|hidden|group-hover/);
    }
    expect(within(l).getByRole("button", { name: "timer.attestering.attester" })).toHaveProperty("disabled", true);
    expect(getAllByText("Fravær over dagsnorm", { exact: false }).length).toBeGreaterThan(0);
  });
});

describe("T59 (web) — gjenåpne står på attestert linje og for jobben", () => {
  it("↺ på linja sender linjas rader; jobben har sin egen ↺ (w5b: i dagsraden når dagen har én jobb)", () => {
    const { container, getAllByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })]);
    fireEvent.click(within(linje(container, "s1:timer:t1")).getByRole("button", { name: "timer.attestering.tabell.gjenaapneLinje" }));
    expect(kallTil("gjenaapneRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
    expect(getAllByRole("button", { name: "timer.attestering.tabell.gjenaapneKort" })).toHaveLength(1);
  });

  it("i attestert-fanen står «Gjenåpne dagen» i dagsumraden", () => {
    const { getByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })], true);
    expect(getByRole("button", { name: /gjenaapneDagen/ })).toBeTruthy();
  });
});

describe("T61 — retting i cella", () => {
  const timerCelle = (c: HTMLElement) =>
    within(linje(c, "s1:timer:t1")).getAllByRole("button", { name: /7,50/ })[0] as HTMLElement;

  it("Enter lagrer én celle i ett kall; avvist kall viser grunnen i cella", () => {
    const { container, getByDisplayValue, getByText } = vis([sedel()]);
    fireEvent.click(timerCelle(container));
    const felt = getByDisplayValue("7.5");
    fireEvent.change(felt, { target: { value: "8" } });
    fireEvent.keyDown(felt, { key: "Enter" });
    const k = kallTil("rettRadFelt");
    expect(k).toHaveLength(1);
    expect(k[0]!.input).toEqual({ radType: "timer", radId: "t1", felter: { timer: 8 } });
    act(() => k[0]!.opts!.onError!({ message: "Over dagsnorm" }));
    expect(getByText("Over dagsnorm")).toBeTruthy();
  });

  it("Esc angrer uten kall", () => {
    const { container, getByDisplayValue, queryByDisplayValue } = vis([sedel()]);
    fireEvent.click(timerCelle(container));
    fireEvent.keyDown(getByDisplayValue("7.5"), { key: "Escape" });
    expect(queryByDisplayValue("7.5")).toBeNull();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
  });

  it("uten rett, på attestert linje og i attestert-fanen er cellene ikke redigerbare", () => {
    for (const [s, ro] of [
      [sedel({ redigerTillatt: false }), false],
      [sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] }), false],
      [sedel(), true],
    ] as const) {
      const { container, unmount } = vis([s], ro);
      expect(within(linje(container, "s1:timer:t1")).queryAllByTitle("timer.attestering.tabell.rettCelle")).toHaveLength(0);
      unmount();
    }
  });

  it("rettet felt viser verdien før retting som synlig tekst", () => {
    const { getByText } = vis([sedel({ timer: [timer("t1", { rettedeFelter: [{ felt: "timer", foer: "5", avNavn: "Leder", ved: "2026-11-16" }] })] })]);
    expect(getByText(/timer\.attestering\.tabell\.var\{"verdi":"5"\}/)).toBeTruthy();
  });
});

describe("T60/T73 — faste kanter og én knappeliste pr. linje", () => {
  it("avkrysning til venstre og knapper til høyre står fast på linja", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    const [venstre, hoyre] = [l.firstElementChild as HTMLElement, l.lastElementChild as HTMLElement];
    expect(venstre.style.position).toBe("sticky");
    expect(within(venstre).getByRole("checkbox")).toBeTruthy();
    expect(hoyre.style.position).toBe("sticky");
    expect(hoyre.style.right).toBe("0px");
    expect(within(hoyre).getByRole("button", { name: "timer.attestering.attester" })).toBeTruthy();
  });
});

describe("T38 — kolonneoppsettet lagres under attesteringens egen liste-nøkkel", () => {
  it("flytting fra velgeren lagres som «timer-attestering»", () => {
    vi.useFakeTimers();
    try {
      vis([sedel()]);
      const flytt = h.velger.props!.onRekkefolgeEndring as (ny: string[]) => void;
      act(() => flytt(["timer", "dato", "ansatt"]));
      act(() => { vi.advanceTimersByTime(900); });
      const k = kallTil("lagreTabelloppsett");
      expect(k).toHaveLength(1);
      expect(k[0]!.input).toMatchObject({ liste: "timer-attestering", oppsett: { kolonner: ["timer", "dato", "ansatt"], rekkefolge: true } });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("T49 — én verktøylinje, ingen nedtrekk utenfor tabellen", () => {
  const side = readFileSync(resolve(__dirname, "../app/dashbord/firma/timer/attestering/page.tsx"), "utf8");

  it("d2b-2 § 12.5: ingen nedtrekk og ingen pivot — alle visningene er tabellen", () => {
    // w1 (plan web-timeføring bilde 6, tillegget til B7): årsvelgeren ved ukevalget er den
    // eneste nedtrekken — ingen filternedtrekk for prosjekt, ansatt eller avdeling (T49).
    const nedtrekk = side.match(/<select[\s\S]*?className/g) ?? [];
    expect(nedtrekk).toHaveLength(1);
    expect(nedtrekk[0]).toMatch(/aria-label=\{t\("timer\.attestering\.uke\.aar"\)\}/);
    expect(side).not.toMatch(/<ProsjektPivot|<AnsattPivot|<ProsjektGruppe|<SeddelKort|attesterGruppe/);
    expect(side).toMatch(/gruppering=\{visning === "sedler" \? "dag" : visning\}/);
  });

  it("sidens uke, visning og fane går inn i tabellens verktøylinje; ramma fyller vinduet", () => {
    const { getByText } = vis([sedel()]);
    expect(getByText("uke-og-fane")).toBeTruthy();
    const tabell = readFileSync(resolve(__dirname, "../components/attestering/AttesteringTabell.tsx"), "utf8");
    expect(tabell).toMatch(/rammeKlasse="h-\[calc\(100vh/);
  });

  it("ukeoversikten er lukket til den åpnes fra verktøylinja (R18)", () => {
    const { queryByText, getByRole } = vis([sedel()]);
    expect(queryByText("ukeoversikt-innhold")).toBeNull();
    fireEvent.click(getByRole("button", { name: "timer.attestering.tabell.ukeoversikt" }));
    expect(queryByText("ukeoversikt-innhold")).toBeTruthy();
  });

  it("hjelpeteksten står på siden (?-ikonet), ikke som løs beskrivelse over tabellen", () => {
    expect(side).toMatch(/<HjelpKnapp>[\s\S]*firma\.timer\.attesteringBeskrivelse[\s\S]*<\/HjelpKnapp>/);
  });
});

/* ------------------------------------------------------------------ */
/*  Ordre d2b-2 (R12, R13): grupperinger, ukeoversikt, prosjektkontekst  */
/* ------------------------------------------------------------------ */

const Q = { id: "pB", name: "Prosjekt B", internalProjectNumber: null, projectNumber: "SD-2" };
const toProsjekter = () => sedel({ timer: [timer("t1"), timer("t2", { projectId: "pB", project: Q, kortId: "kB" })] });

function visMed(sedler: AttSedel[], props: Partial<Parameters<typeof AttesteringTabell>[0]> = {}) {
  return render(
    <AttesteringTabell
      dager={byggAttesteringModell(sedler, deps)}
      orgId="org1"
      readOnly={false}
      verktoy={null}
      sedelUrl={(id) => `/sedel/${id}`}
      onReturnerDag={() => {}}
      {...props}
    />,
  );
}

describe("T30/R13 — prosjektattesteringen er låst til prosjektet", () => {
  it("linja på et annet prosjekt står nedtonet uten avkrysning og handlinger; utvalget tar bare prosjektets linjer", () => {
    const { container, getByRole } = visMed([toProsjekter()], { prosjektKontekst: "pA" });
    const annen = linje(container, "s1:timer:t2");
    expect(annen.className).toMatch(/opacity-50/);
    expect(within(annen).queryByRole("checkbox")).toBeNull();
    expect(within(annen).queryAllByRole("button")).toHaveLength(0);
    expect(within(linje(container, "s1:timer:t1")).getByRole("checkbox")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
  });

  it("dagsumraden attesterer prosjektets del — aldri hele sedelen", () => {
    const { getByRole, queryByRole } = visMed([toProsjekter()], { prosjektKontekst: "pA" });
    expect(queryByRole("button", { name: /attesterDagen/ })).toBeNull();
    fireEvent.click(getByRole("button", { name: /attesterProsjektetsDel/ }));
    expect(kallTil("attester")).toHaveLength(0);
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
  });

  it("negativkontroll: uten kontekst (firmaet) kan begge linjene velges", () => {
    const { container } = visMed([toProsjekter()]);
    expect(linje(container, "s1:timer:t2").className).not.toMatch(/opacity-50/);
    expect(within(linje(container, "s1:timer:t2")).getByRole("checkbox")).toBeTruthy();
  });
});

describe("R12 — «Etter prosjekt» og «Etter ansatt» er grupperinger av samme rader", () => {
  it("«Etter prosjekt» har én grupperad pr. prosjekt med prosjektets sum, og ingen dagsumrad (T28)", () => {
    const { getByText, queryByText, container } = visMed([toProsjekter()], { gruppering: "prosjekt" });
    expect(getByText("1001 Prosjekt A")).toBeTruthy();
    expect(getByText("SD-2 Prosjekt B")).toBeTruthy();
    expect(queryByText(/timer\.attestering\.tabell\.dagsum/)).toBeNull();
    expect(linje(container, "s1:timer:t1")).toBeTruthy();
    expect(linje(container, "s1:timer:t2")).toBeTruthy();
  });

  it("«Etter ansatt» viser de samme linjene som dag for dag (T45)", () => {
    const s = [toProsjekter(), sedel({ id: "s2", ansatt: { id: "u2", name: "Ola", email: "o@x", ansattnummer: null, avdelingId: null }, timer: [timer("t3")] })];
    const linjer = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-linje]")).map((e) => e.getAttribute("data-linje")).sort();
    const dag = linjer(visMed(s).container);
    cleanup();
    const ansatt = visMed(s, { gruppering: "ansatt" });
    expect(linjer(ansatt.container)).toEqual(dag);
    expect(ansatt.getByText("Kari Nordmann (12)")).toBeTruthy();
    expect(ansatt.getAllByText("Ola").length).toBeGreaterThan(0);
  });

  it("ukeoversikten får tabellens dager, og klikk på en dag filtrerer tabellen til den dagen", () => {
    const s = [toProsjekter(), sedel({ id: "s2", dato: "2026-11-17", timer: [timer("t3")] })];
    const { getByRole, container, getByText } = visMed(s, {
      ukeoversikt: (api) => (
        <button type="button" onClick={() => api.velgDato("2026-11-17")}>{`dager:${api.dager.length}`}</button>
      ),
    });
    fireEvent.click(getByRole("button", { name: "timer.attestering.tabell.ukeoversikt" }));
    fireEvent.click(getByText("dager:2"));
    expect(linje(container, "s1:timer:t1")).toBeNull();
    expect(linje(container, "s2:timer:t3")).toBeTruthy();
    // Ukeoversikten teller fortsatt hele uken (datofilteret holdes utenfor).
    expect(getByText("dager:2")).toBeTruthy();
  });
});

describe("d2b-3 (d) — kvitteringen på utlegget åpnes i tabellen", () => {
  const medUtlegg = (vedlegg: { id: string; fileName: string; mimeType: string; fileUrl: string }[]) =>
    sedel({ utlegg: [{ id: "u1", belop: 120, expenseCategory: { navn: "Parkering" }, kortId: "kA", projectId: "pA", project: P, vedlegg }] });

  it("bilde som miniatyr og PDF som binders — begge lenker til den signerte fila", () => {
    const { container } = visMed([
      medUtlegg([
        { id: "v1", fileName: "kvittering.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/k.jpg?sig=1" },
        { id: "v2", fileName: "faktura.pdf", mimeType: "application/pdf", fileUrl: "/uploads/f.pdf?sig=2" },
      ]),
    ]);
    const lenker = Array.from(linje(container, "s1:utlegg:u1").querySelectorAll("a"));
    expect(lenker.map((a) => a.getAttribute("href"))).toEqual(["/uploads/k.jpg?sig=1", "/uploads/f.pdf?sig=2"]);
    expect(lenker[0]!.title).toMatch(/aapneKvittering.*kvittering\.jpg/);
    expect(lenker[0]!.querySelector("img")?.getAttribute("data-url")).toBe("/uploads/k.jpg?sig=1");
    expect(lenker[1]!.querySelector("img")).toBeNull();
  });

  it("negativkontroll: uten vedlegg (eller utenfor prosjektkonteksten) ingen lenke", () => {
    const { container } = visMed([medUtlegg([])]);
    expect(linje(container, "s1:utlegg:u1").querySelectorAll("a")).toHaveLength(0);
    const annet = visMed(
      [sedel({ utlegg: [{ id: "u2", belop: 80, expenseCategory: null, kortId: "kB", projectId: "pB", project: null, vedlegg: [{ id: "v3", fileName: "b.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/b.jpg?sig=3" }] }] })],
      { prosjektKontekst: "pA" },
    );
    expect(linje(annet.container, "s1:utlegg:u2").querySelectorAll("a")).toHaveLength(0);
  });
});

describe("d2b-3 (c, e) — dagsnorm på detaljen og ukeavvikets tekst", () => {
  const kilde = (rel: string) => readFileSync(resolve(__dirname, rel), "utf-8");

  it("detaljen bruker serverens dagsnorm og tilleggskrav — ingen overstyring til null/false", () => {
    const d = kilde("../components/timer/AttesteringDetalj.tsx");
    expect(d).toMatch(/dagsnorm: sheet\.dagsnorm > 0 \? sheet\.dagsnorm : null/);
    expect(d).not.toMatch(/dagsnorm: null/);
    expect(d).not.toMatch(/tilleggHarKrav: false/);
  });

  it("med dagsnorm teller «over normen» i «Krever vurdering», og dagteksten står (w5b: på hover av merket)", () => {
    const { container } = visMed([sedel({ totaltimer: 9, dagsnorm: 7.5 })]);
    expect(container.textContent).toMatch(/normMerke/);
    expect(document.body.textContent).toMatch(/dagenAvNorm/);
    cleanup();
    const uten = visMed([sedel({ totaltimer: 9, dagsnorm: null })]);
    expect(uten.container.textContent).not.toMatch(/normMerke/);
    expect(document.body.textContent).not.toMatch(/dagenAvNorm/);
    const vurder = (dagsnorm: number | null) =>
      filtrerModell(byggAttesteringModell([sedel({ totaltimer: 9, dagsnorm })], deps), {
        verdier: { avvik: AVVIK_FILTER.kreverVurdering },
        beskrivelseSok: "",
      }).length;
    expect(vurder(7.5)).toBe(1);
    expect(vurder(null)).toBe(0);
  });

  it("teksten sier at avviket gjelder uka (nb)", () => {
    const nb = JSON.parse(kilde("../../../../packages/shared/src/i18n/nb.json")) as Record<string, string>;
    for (const k of ["timer.attestering.tabell.ukeAvvikOver", "timer.attestering.tabell.ukeAvvikUnder", "timer.attestering.pivot.avvikTooltip", "timer.attestering.pivot.norm"]) {
      expect(nb[k]).toMatch(/Avvik denne uka/);
    }
    expect(nb["timer.attestering.pivot.avvikOver"]).toMatch(/ukenorm/);
  });
});

describe("w5 — kjernekolonner og «Tilbakestill til standard»", () => {
  const hodeKolonner = (c: HTMLElement) =>
    [...new Set(Array.from(c.querySelectorAll("[data-kolonne]")).map((e) => e.getAttribute("data-kolonne")))];
  afterEach(() => { delete h.data["bruker.hentTabelloppsett"]; });

  it("uten lagret oppsett vises de 13 standardkolonnene, Fra og Til i én", () => {
    const { container } = vis([sedel()]);
    expect(hodeKolonner(container)).toEqual([
      "dato", "ansatt", "prosjektnummer", "underprosjekt", "betegnelse", "fraTil", "timer",
      "maskin", "maskintimer", "vareOgMengde", "antall", "belop", "avvik",
    ]);
    expect(h.velger.props!.nullstillTekst).toBe("timer.attestering.tabell.tilbakestillStandard");
  });

  it("et lagret oppsett vises som det er og lagres ikke på nytt (WM69)", () => {
    vi.useFakeTimers();
    try {
      h.data["bruker.hentTabelloppsett"] = { kolonner: ["timer", "ansatt", "fraTid"], rekkefolge: true, bredder: {}, sortering: null };
      const { container } = vis([sedel()]);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(hodeKolonner(container)).toEqual(["timer", "ansatt", "fraTid"]);
      expect(kallTil("lagreTabelloppsett")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("et gammelt oppsett med 26-kolonnersstandarden uten rekkefølge vises i samme rekkefølge som før w5 (WM69)", () => {
    // Develop-standarden før w5. Den lagres uten `rekkefolge` når brukeren drar en bredde,
    // sorterer eller trykker «Nullstill» — slike oppsett finnes i drift.
    const gammelStandard = [
      "dato", "ansatt", "ansattnr", "prosjektnummer", "prosjekt", "byggeplass", "underprosjekt",
      "type", "betegnelse", "aktivitet", "fraTid", "tilTid", "timer", "pause",
      "maskin", "maskintimer", "mengde", "enhet",
      "vare", "vareenhet", "varemengde",
      "antall", "belop", "beskrivelse", "status", "avvik",
    ];
    vi.useFakeTimers();
    try {
      h.data["bruker.hentTabelloppsett"] = { kolonner: gammelStandard, bredder: { timer: 90 }, sortering: null };
      const { container } = vis([sedel()]);
      act(() => { vi.advanceTimersByTime(2000); });
      // Målt med effektivRekkefolge på develop (52d795f7): listas rekkefølge, ikke standardens.
      expect(hodeKolonner(container)).toEqual([
        "dato", "ansatt", "ansattnr", "prosjekt", "byggeplass", "underprosjekt", "type", "betegnelse",
        "aktivitet", "fraTid", "tilTid", "timer", "maskintimer", "antall", "belop", "mengde", "enhet",
        "beskrivelse", "status", "prosjektnummer", "pause", "maskin", "vare", "vareenhet", "varemengde", "avvik",
      ]);
      expect(kallTil("lagreTabelloppsett")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("«Tilbakestill til standard» lagrer standardlista i sin egen rekkefølge og uten bredder", () => {
    vi.useFakeTimers();
    try {
      h.data["bruker.hentTabelloppsett"] = { kolonner: ["timer", "ansatt"], rekkefolge: true, bredder: { timer: 200 }, sortering: null };
      const { container } = vis([sedel()]);
      act(() => (h.velger.props!.onToggle as (id: string) => void)("__reset__"));
      act(() => { vi.advanceTimersByTime(900); });
      const k = kallTil("lagreTabelloppsett");
      expect(k).toHaveLength(1);
      const oppsett = (k[0]!.input as { oppsett: { kolonner: string[]; rekkefolge?: boolean; bredder: Record<string, number> } }).oppsett;
      expect(oppsett.kolonner).toEqual([
        "dato", "ansatt", "prosjektnummer", "underprosjekt", "betegnelse", "fraTil", "timer",
        "maskin", "maskintimer", "vareOgMengde", "antall", "belop", "avvik",
      ]);
      expect(oppsett.rekkefolge).toBe(true);
      expect(oppsett.bredder).toEqual({});
      expect(hodeKolonner(container)[0]).toBe("dato");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Fra–til-cella har to knapper, så fra og til rettes hver for seg", () => {
    const { container } = vis([sedel()]);
    const l = within(linje(container, "s1:timer:t1"));
    const fra = l.getByRole("button", { name: /07:00/ });
    const til = l.getByRole("button", { name: /15:00/ });
    expect(fra).not.toBe(til);
    // Samme celle: begge står under samme flex-span.
    expect(fra.parentElement!.parentElement).toBe(til.parentElement!.parentElement);
  });
});

describe("w5 — klikk på linja åpner registreringen", () => {
  afterEach(() => { delete h.data["eksternKostObjekt.list"]; });

  it("klikk åpner, nytt klikk lukker; avkrysning åpner ikke", () => {
    const { container } = vis([sedel()]);
    const l = () => linje(container, "s1:timer:t1");
    fireEvent.click(within(l()).getByRole("checkbox"));
    expect(container.querySelector("[data-registrering]")).toBeNull();
    fireEvent.click(l());
    expect(container.querySelector("[data-registrering]")).not.toBeNull();
    fireEvent.click(l());
    expect(container.querySelector("[data-registrering]")).toBeNull();
  });

  it("underprosjekt-knapp flytter hele jobben (helJobb)", () => {
    h.data["eksternKostObjekt.list"] = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }, { id: "e2", proAdmId: "200", kortNavn: "Tak" }];
    const { container } = vis([sedel()]);
    fireEvent.click(linje(container, "s1:timer:t1"));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const tak = within(panel).getAllByRole("button").find((b) => b.textContent?.includes("Tak"))!;
    fireEvent.click(tak);
    expect(kallTil("flyttTimerRadEco")[0]!.input).toEqual({ timerRadId: "t1", radType: "timer", externalCostObjectId: "e2", helJobb: true });
  });

  it("uten kortId (eldre rad) kan hele jobben ikke flyttes og del opp vises ikke", () => {
    h.data["eksternKostObjekt.list"] = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }];
    const { container } = vis([sedel({ timer: [timer("t1", { kortId: null })] })]);
    fireEvent.click(linje(container, "s1:timer:t1"));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const grunn = within(panel).getAllByRole("button").find((b) => b.textContent?.includes("Grunn"));
    expect(grunn === undefined || (grunn as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).queryByRole("button", { name: /registrering\.delOpp/ })).toBeNull();
  });

  it("«Del opp»: klokkeslettet forhåndsvises på serveren, deretter deles jobben", () => {
    const { container } = vis([sedel()]);
    fireEvent.click(linje(container, "s1:timer:t1"));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: /registrering\.delOpp/ }));
    const skjema = panel.querySelector("[data-del-opp]") as HTMLElement;
    fireEvent.change(within(skjema).getByPlaceholderText("11:00"), { target: { value: "10:00" } });
    const fv = kallTil("delJobb");
    expect(fv).toHaveLength(1);
    expect(fv[0]!.input).toEqual({ sheetId: "s1", kortId: "kA", kl: "10:00", externalCostObjectIdB: null, forhandsvis: true });
    act(() => fv[0]!.opts!.onSuccess!({ forhandsvisning: { timerA: 2.5, timerB: 5, maskinPaaA: 0, maskinTilB: 0 } }));
    expect(skjema.textContent).toContain("2,50 t");
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ });
    fireEvent.click(knapper[knapper.length - 1]!);
    const alle = kallTil("delJobb");
    expect(alle).toHaveLength(2);
    expect(alle[1]!.input).toEqual({ sheetId: "s1", kortId: "kA", kl: "10:00", externalCostObjectIdB: null });
  });
});

describe("w5 / WM54 — penn og ✂ bare når «rediger ved attestering» er på", () => {
  it("av: verken penn, ✂ eller retting i registreringen", () => {
    const { container } = vis([sedel({ redigerTillatt: false })]);
    const l = linje(container, "s1:timer:t1");
    expect(within(l).queryByRole("button", { name: "timer.attestering.meny.splittRad" })).toBeNull();
    expect(within(l).queryByRole("button", { name: "timer.attestering.meny.rediger" })).toBeNull();
    fireEvent.click(l);
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(within(panel).queryByRole("button", { name: /registrering\.delOpp/ })).toBeNull();
  });

  it("på: penn og ✂ vises på ventende linje", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    expect(within(l).getByRole("button", { name: "timer.attestering.meny.splittRad" })).toBeTruthy();
    expect(within(l).getByRole("button", { name: "timer.attestering.meny.rediger" })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  w5b (B14 A) — dagsrad øverst, jobbrad når dagen har flere jobber    */
/* ------------------------------------------------------------------ */

describe("w5b — dagsvisningen, alternativ A", () => {
  const dagsrader = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rad="dag"]')) as HTMLElement[];
  const jobbrader = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
  const venstreKant = (el: HTMLElement) => (el.firstElementChild as HTMLElement).className.match(/border-(blue|amber|emerald|violet|rose)-\d+/)?.[0];

  it("én jobb: dagsraden bærer dato med ukedag, ansatt, pr.nr., «1 jobb», sum og dagens knapper — ingen jobbrad", () => {
    const { container } = vis([sedel()]);
    const [dag] = dagsrader(container);
    expect(dagsrader(container)).toHaveLength(1);
    expect(jobbrader(container)).toHaveLength(0);
    expect(dag!.textContent).toMatch(/\S+ 16\.11\./);
    expect(dag!.textContent).toContain("Kari Nordmann");
    expect(dag!.textContent).toContain("1001");
    expect(dag!.textContent).toContain('antallJobber{"count":1}');
    expect(dag!.textContent).toContain("7,50");
    expect(within(dag!).getByRole("button", { name: "timer.attestering.tabell.attesterDagen" })).toBeTruthy();
    expect(within(dag!).getByRole("button", { name: "timer.attestering.returner" })).toBeTruthy();
    // Dagsummen nederst er borte, og jobbens ✓ ↩ står ikke som egne knapper (dagens dekker dem).
    expect(container.textContent).not.toMatch(/tabell\.dagsum/);
    expect(container.querySelectorAll('[aria-label="timer.attestering.tabell.attesterKort"]')).toHaveLength(0);
    // Linja skriver ikke dato, ansatt og pr.nr. på nytt.
    const l = linje(container, "s1:timer:t1");
    expect(l.textContent).not.toContain("16.11.");
    expect(l.textContent).not.toContain("Kari Nordmann");
    expect(l.textContent).not.toContain("1001");
    expect(l.textContent).toContain("7,50");
  });

  it("to jobber: én dagsrad, så hver jobb med egen jobbrad, egen kantfarge og egne knapper", () => {
    const { container } = vis([toProsjekter()]);
    const [dag] = dagsrader(container);
    const jobb = jobbrader(container);
    expect(dagsrader(container)).toHaveLength(1);
    expect(jobb).toHaveLength(2);
    expect(dag!.textContent).toContain('antallJobber{"count":2}');
    expect(dag!.textContent).not.toContain("1001");
    expect(dag!.textContent).toContain("15,00");
    expect(jobb[0]!.textContent).toContain("1001");
    expect(jobb[1]!.textContent).toContain("SD-2");
    for (const j of jobb) {
      expect(within(j).getByRole("button", { name: "timer.attestering.tabell.attesterKort" })).toBeTruthy();
      expect(within(j).getByRole("button", { name: "timer.attestering.tabell.returnerKort" })).toBeTruthy();
    }
    // Rekkefølgen: dagsrad, jobb A, linja på A, jobb B, linja på B.
    const rekke = Array.from(container.querySelectorAll("[data-rad], [data-linje]")).map((e) => e.getAttribute("data-rad") ?? e.getAttribute("data-linje"));
    expect(rekke).toEqual(["dag", "jobb", "s1:timer:t1", "jobb", "s1:timer:t2"]);
    // Kortene skilles: hver sin kantfarge på jobbraden og linjene, og strek over jobbraden.
    const a = venstreKant(jobb[0]!), b = venstreKant(jobb[1]!);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(venstreKant(linje(container, "s1:timer:t1"))).toBe(a);
    expect(venstreKant(linje(container, "s1:timer:t2"))).toBe(b);
    for (const j of jobb) expect(j.className).toContain("border-t");
    // Én ramme pr. dag: luften kommer etter dagens siste rad, ikke mellom jobbene.
    const slutt = container.querySelectorAll("[data-blokk-slutt]");
    expect(slutt).toHaveLength(1);
    expect(slutt[0]!.querySelector('[data-linje="s1:timer:t2"]')).toBeTruthy();
    // Linja på jobb B skriver ikke pr.nr. når det er likt jobbens.
    expect(linje(container, "s1:timer:t2").textContent).not.toContain("SD-2");
  });

  it("to dager gir to blokker med luft etter hver", () => {
    const { container } = vis([sedel(), sedel({ id: "s2", dato: "2026-11-17", timer: [timer("t9")] })]);
    expect(dagsrader(container)).toHaveLength(2);
    expect(container.querySelectorAll("[data-blokk-slutt]")).toHaveLength(2);
  });

  it("«Bare oversiktsrader»: én jobb blir én rad; to jobber gir dagsrad og jobbrader", () => {
    const { container, getByLabelText } = vis([sedel(), sedel({ id: "s2", dato: "2026-11-17", timer: [timer("t3"), timer("t4", { projectId: "pB", project: Q, kortId: "kB" })] })]);
    fireEvent.click(getByLabelText("timer.attestering.tabell.bareOversikt"));
    expect(container.querySelectorAll("[data-linje]")).toHaveLength(0);
    expect(dagsrader(container)).toHaveLength(2);
    expect(jobbrader(container)).toHaveLength(2);
    // Dagen med én jobb er nå én rad: dagsraden er også blokkens siste rad.
    const slutt = Array.from(container.querySelectorAll("[data-blokk-slutt]"));
    expect(slutt).toHaveLength(2);
    expect(slutt[0]!.querySelector('[data-rad="dag"]')).toBeTruthy();
  });

  it("sortering gir flat liste: bare linjer, og dato, ansatt og pr.nr. står på hver linje igjen", () => {
    const { container, getByText } = vis([toProsjekter()]);
    fireEvent.click(getByText("timer.eksport.kolTimer"));
    expect(container.querySelectorAll("[data-rad]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-blokk-slutt]")).toHaveLength(0);
    const l = linje(container, "s1:timer:t1");
    expect(l.textContent).toContain("16.11.");
    expect(l.textContent).toContain("Kari Nordmann");
    expect(l.textContent).toContain("1001");
    expect(l.className).not.toMatch(/border-amber|border-emerald/);
  });

  it("normen står som merke bare når dagen avviker, med fortegn", () => {
    const over = vis([sedel({ totaltimer: 8, dagsnorm: 7.5 })]);
    expect(dagsrader(over.container)[0]!.textContent).toContain('normMerke{"avvik":"+0,5"}');
    cleanup();
    const under = vis([sedel({ totaltimer: 6, dagsnorm: 7.5 })]);
    expect(dagsrader(under.container)[0]!.textContent).toContain('normMerke{"avvik":"−1,5"}');
    cleanup();
    const lik = vis([sedel({ totaltimer: 7.5, dagsnorm: 7.5 })]);
    expect(lik.container.textContent).not.toMatch(/normMerke|dagenAvNorm/);
  });

  it("«Etter prosjekt»: ingen dagsrad med «N jobber» — hver jobb er en blokk med dato og ansatt", () => {
    const { container } = visMed([toProsjekter()], { gruppering: "prosjekt" });
    const blokker = dagsrader(container);
    expect(blokker).toHaveLength(2);
    for (const b of blokker) {
      expect(b.textContent).toContain("16.11.");
      expect(b.textContent).toContain("Kari Nordmann");
      expect(b.textContent).not.toMatch(/antallJobber/);
      expect(within(b).getByRole("button", { name: "timer.attestering.tabell.attesterKort" })).toBeTruthy();
    }
    expect(container.querySelectorAll("[data-blokk-slutt]")).toHaveLength(2);
  });

  it("prosjektets attestering: dagsradens «Attester» gjelder prosjektets del, og jobbradene står", () => {
    const { container } = visMed([toProsjekter()], { prosjektKontekst: "pA" });
    const [dag] = dagsrader(container);
    expect(within(dag!).getByRole("button", { name: /attesterProsjektetsDel/ })).toBeTruthy();
    expect(jobbrader(container)).toHaveLength(2);
    // Jobben på det andre prosjektet har ingen knapper.
    expect(within(jobbrader(container)[1]!).queryAllByRole("button")).toHaveLength(0);
  });

  it("klikk på en linje åpner registreringen inne i blokka, før dagens luft", () => {
    const { container } = vis([sedel()]);
    fireEvent.click(linje(container, "s1:timer:t1"));
    const slutt = container.querySelector("[data-blokk-slutt]") as HTMLElement;
    expect(slutt.querySelector("[data-registrering]")).toBeTruthy();
  });
});

describe("w7 (B15) — egne timer: synlige, merket, uten handlinger", () => {
  const egen = () => sedel({ id: "egen", egneTimer: true, timer: [timer("e1")] });
  const andres = () => sedel({ id: "andres", dato: "2026-11-17", timer: [timer("a1")] });

  it("firmaattesteringen: egen linje nedtonet uten avkrysning og knapper; dagen har merket, ingen «Attester»", () => {
    const { container, getAllByText, getAllByRole } = visMed([egen(), andres()]);
    const l = linje(container, "egen:timer:e1");
    expect(l.className).toMatch(/opacity-50/);
    expect(within(l).queryByRole("checkbox")).toBeNull();
    expect(within(l).queryAllByRole("button")).toHaveLength(0);
    expect(getAllByText("timer.attestering.egneTimer.merke").length).toBe(1);
    // Retur 1: merket står i handlingscellen (høyre, der knappene ellers står), ikke i Avvik-kolonnen.
    expect(getAllByText("timer.attestering.egneTimer.merke")[0]!.closest("div.justify-end")).toBeTruthy();
    // Én «Attester dagen» — den andres dag.
    expect(getAllByRole("button", { name: "timer.attestering.tabell.attesterDagen" })).toHaveLength(1);
  });

  it("«Attester utvalget» hopper over egen sedel", () => {
    const { getByRole } = visMed([egen(), andres()]);
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["a1"], maskinIder: [], tilleggIder: [] } });
  });

  it("attestert-fanen: ingen «Gjenåpne dagen» og ingen ↺ på egen sedel", () => {
    const { queryByRole, queryAllByRole } = visMed(
      [sedel({ id: "egen", egneTimer: true, timer: [timer("e1", { attestertStatus: "attestert" })] })],
      { readOnly: true },
    );
    expect(queryByRole("button", { name: /gjenaapneDagen/ })).toBeNull();
    expect(queryAllByRole("button", { name: /gjenaapne/ })).toHaveLength(0);
  });

  it("prosjektattesteringen: egen sedel er utenfor konteksten også der", () => {
    const { container, queryByRole } = visMed([egen()], { prosjektKontekst: "pA" });
    expect(within(linje(container, "egen:timer:e1")).queryByRole("checkbox")).toBeNull();
    expect(queryByRole("button", { name: /attesterProsjektetsDel/ })).toBeNull();
  });

  it("negativkontroll: uten flagget har den samme sedelen knappene og intet merke", () => {
    const { container, queryByText } = visMed([sedel({ id: "egen", egneTimer: false, timer: [timer("e1")] })]);
    expect(within(linje(container, "egen:timer:e1")).getByRole("checkbox")).toBeTruthy();
    expect(within(linje(container, "egen:timer:e1")).getByRole("button", { name: "timer.attestering.attester" })).toBeTruthy();
    expect(queryByText("timer.attestering.egneTimer.merke")).toBeNull();
  });
});
