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

import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { byggAttesteringModell, type AttDeps, type AttSedel, type AttTimer } from "@/components/attestering/attestering-tabell";

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
    tilleggskrav: "Tilleggskrav", tilByggherre: "Til byggherre", fravaerUtenProsjekt: "Fravær", reise: "Reise",
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
      ukeoversikt={<div>ukeoversikt-innhold</div>}
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

describe("T59 (web) — gjenåpne står på attestert linje og i oversiktsraden", () => {
  it("↺ på linja sender linjas rader; oversiktsraden har sin egen ↺", () => {
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

describe("T49 — én verktøylinje, ingen nedtrekk utenfor tabellen i Sedler-visningen", () => {
  const side = readFileSync(resolve(__dirname, "../app/dashbord/firma/timer/attestering/page.tsx"), "utf8");

  it("prosjekt/ansatt/avdeling-nedtrekkene står bare i pivotvisningene", () => {
    const sedlerGren = side.slice(side.indexOf("<AttesteringTabell"));
    expect(sedlerGren).not.toMatch(/<select/);
    expect(side).toMatch(/visning !== "sedler" && \(/);
    expect(side).not.toMatch(/<ProsjektGruppe|<SeddelKort|attesterGruppe/);
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
