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
  const bruker = { id: "u-leder" };
  return { kall, data, velger, bruker, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: h.bruker.id, name: "Kari Leder" } } }) }));
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
vi.mock("@/components/attestering/ReiseRadMerke", () => ({ ReiseRadMerke: () => <span>reise-merke</span> }));
vi.mock("@/components/attestering/RedigerRadModal", () => ({ RedigerRadModal: () => <div>rediger-modal</div> }));
vi.mock("@/components/SignertLenke", () => ({
  SignertLenke: ({ url, title, children }: { url: string; title?: string; children: ReactNode }) => <a href={url} title={title}>{children}</a>,
}));
vi.mock("@/components/SignertBilde", () => ({
  SignertBilde: ({ url, alt }: { url: string; alt?: string }) => <img data-url={url} alt={alt} />,
}));

import { TIMER_TABELL_KOL_KEYS } from "@sitedoc/shared";
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
  maskinOverArbeidForklaring: (m: number, a: number) => `Maskin ${String(m).replace(".", ",")} t, arbeid ${String(a).replace(".", ",")} t`,
  tekst: {
    forslagSperre: "Uavklart forslag", maskinUtenTimerad: "Maskin uten timerad", maskinforerbevis: "Mangler bevis",
    merkeUtenTimerad: "Uten timerad", merkeUtenTimeradForklaring: "Maskinen er ikke koblet til en timerad.", merkeUtenForerbevis: "Uten førerbevis", merkeMaskinOverArbeid: "Maskin over arbeid",
    tilleggskrav: "Tilleggskrav", tilByggherre: "Til byggherre", fravaerUtenProsjekt: "Fravær", annetProsjekt: "Annet prosjekt", reise: "Reise", utenUnderprosjekt: "Uten",
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
// w15g (§ 4.15 del F): ✎ på linja i kortet åpner vinduet; feltene står der, ikke i kortet.
const vindu = () => document.querySelector("[data-linje-rett-vindu]") as HTMLElement;
const aapnePenn = (panel: HTMLElement, sel = '[data-timelinje="s1:timer:t1"]') => {
  fireEvent.click(panel.querySelector(`${sel} [data-linje-penn]`) as HTMLElement);
  return vindu();
};
const lagreVindu = () => fireEvent.click(within(vindu()).getByRole("button", { name: "handling.lagre" }));

// Katalogen: «Ordinær» er timebasert (satsEnhet null), så kortet retter den med fra–til (RETUR 1 w10a).
// A1 (B51 A): linjene er skjult som standard. Testene under er skrevet for linjene synlige — som en
// bruker som har slått av «Bare oversiktsrader» (valget huskes pr. bruker). A1-testene nullstiller.
const VIS_LINJER = "sitedoc_attestering_bareOversikt_u-leder";
// jsdom-miljøet her har ingen brukbar localStorage; et lager i minnet står i stedet.
const lager = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => lager.get(k) ?? null,
  setItem: (k: string, v: string) => { lager.set(k, String(v)); },
  removeItem: (k: string) => { lager.delete(k); },
  clear: () => lager.clear(),
});
beforeEach(() => { h.kall.length = 0; h.velger.props = null; h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }]; lager.clear(); localStorage.setItem(VIS_LINJER, "false"); h.bruker.id = "u-leder"; });
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

  it("w10a (B30 A): avkryssede jobber er utvalget; knappen teller jobber", () => {
    const { container, getByRole } = vis([toProsjekter()]);
    expect(getByRole("button", { name: /attesterUtvalget/ }).textContent).toContain('{"antall":2}');
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    fireEvent.click(within(jobb[1]!).getByRole("checkbox", { name: "timer.attestering.tabell.velgJobb" }));
    const knapp = getByRole("button", { name: /attesterUtvalget/ });
    expect(knapp.textContent).toContain('{"antall":1}');
    fireEvent.click(knapp);
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t2"], maskinIder: [], tilleggIder: [] } });
  });

  it("w10a: kryss på dagsraden velger alle jobbene på dagen", () => {
    const { container, getByRole } = vis([toProsjekter(), sedel({ id: "s2", dato: "2026-11-17", timer: [timer("t9")] })]);
    fireEvent.click(within(dagsrad(container, 0)).getByRole("checkbox", { name: "timer.attestering.tabell.velgDagen" }));
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    for (const j of jobb) expect((within(j).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1", "t2"], maskinIder: [], tilleggIder: [] } });
  });

  it("i attestert-fanen finnes ingen ✓ og ingen «Attester utvalget»", () => {
    const { queryAllByRole, queryByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })], true);
    expect(queryAllByRole("button", { name: "timer.attestering.attester" })).toHaveLength(0);
    expect(queryAllByRole("button", { name: "timer.attestering.tabell.attesterKort" })).toHaveLength(0);
    expect(queryByRole("button", { name: /attesterUtvalget|attesterDagen/ })).toBeNull();
  });
});

describe("T44 — ingenting attestanten trenger ligger bare i title eller bak hover", () => {
  it("w10a (A2): ✓ og ↩ er synlige knapper på dagsraden; linja har ingen knapper, og sperren står som tekst", () => {
    const { container, getAllByText } = vis([sedel({ id: "sperret" })]);
    const d = dagsrad(container);
    for (const navn of ["timer.attestering.tabell.attesterDagen", "timer.attestering.returner"]) {
      expect(within(d).getByRole("button", { name: navn }).className).not.toMatch(/opacity-0|invisible|hidden|group-hover/);
    }
    expect(within(linje(container, "sperret:timer:t1")).queryAllByRole("button")).toHaveLength(0);
    expect(getAllByText("Fravær over dagsnorm", { exact: false }).length).toBeGreaterThan(0);
  });
});

describe("T59 (web) — gjenåpne står på attestert linje og for jobben", () => {
  it("w10a (A2): ↺ står på jobben (dagsraden når dagen har én jobb), ikke på linja", () => {
    const { container, getAllByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })]);
    expect(within(linje(container, "s1:timer:t1")).queryAllByRole("button")).toHaveLength(0);
    const g = getAllByRole("button", { name: "timer.attestering.tabell.gjenaapneKort" });
    expect(g).toHaveLength(1);
    expect(dagsrad(container).contains(g[0]!)).toBe(true);
    fireEvent.click(g[0]!);
    expect(kallTil("gjenaapneRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
  });

  it("i attestert-fanen står «Gjenåpne dagen» i dagsumraden", () => {
    const { getByRole } = vis([sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] })], true);
    expect(getByRole("button", { name: /gjenaapneDagen/ })).toBeTruthy();
  });
});

describe("w10a (A1, A4) + w15g — fra–til og pause rettes i vinduet bak ✎; cellene er bare lesing", () => {
  const aapne = (c: HTMLElement) => { fireEvent.click(dagsrad(c)); return c.querySelector("[data-registrering]") as HTMLElement; };
  const felt = (panel: HTMLElement, navn: string) => within(panel).getByLabelText(`timer.attestering.registrering.${navn}`) as HTMLInputElement;

  it("cella er tekst: ingen knapp og intet felt på linja", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    expect(within(l).queryAllByRole("button")).toHaveLength(0);
    fireEvent.click(within(l).getAllByText(/7,50/)[0]!);
    expect(l.querySelector("input")).toBeNull();
    expect(l.textContent).toContain("07:00");
    expect(l.textContent).toContain("15:00");
  });

  it("kortet har ingen åpne felt; ✎ på linja åpner vinduet med fra, til og pause", () => {
    const { container } = vis([sedel()]);
    const panel = aapne(container);
    expect(panel.querySelector("input")).toBeNull();
    expect(panel.querySelector("select")).toBeNull();
    expect(panel.querySelector('[data-timelinje="s1:timer:t1"]')!.textContent).toContain("07:00–15:00");
    const v = aapnePenn(panel);
    expect(v.getAttribute("data-linje-rett-vindu")).toBe("timer");
    expect(felt(v, "fra").value).toBe("07:00");
    expect(felt(v, "pauseFelt").value).toBe("30");
  });

  it("endret til: timene regnes; ingenting lagres før «Lagre», som sender fra, til, timer og pause i ett kall", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    expect(within(v).queryByLabelText(/kolTimer|registrering\.timer$/)).toBeNull();
    expect(v.querySelector("[data-utregnet-timer]")!.textContent).toContain("7,50");
    fireEvent.change(felt(v, "til"), { target: { value: "16:00" } });
    fireEvent.blur(felt(v, "til"));
    fireEvent.keyDown(felt(v, "til"), { key: "Enter" });
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    lagreVindu();
    const k = kallTil("rettRadFelt");
    expect(k).toHaveLength(1);
    expect(k[0]!.input).toEqual({ radType: "timer", radId: "t1", felter: { fraTid: "07:00", tilTid: "16:00", timer: 8.5, pauseMin: 30 } });
  });

  it("endret pause sender samme fire felter", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    fireEvent.change(felt(v, "pauseFelt"), { target: { value: "60" } });
    lagreVindu();
    expect(kallTil("rettRadFelt")[0]!.input).toEqual({ radType: "timer", radId: "t1", felter: { fraTid: "07:00", tilTid: "15:00", timer: 7, pauseMin: 60 } });
  });

  it("avvist kall: vinduet blir stående med grunnen og feltene slik de var skrevet", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    fireEvent.change(felt(v, "til"), { target: { value: "16:00" } });
    lagreVindu();
    act(() => kallTil("rettRadFelt")[0]!.opts!.onError!({ message: "Over dagsnorm" }));
    expect(vindu()).toBeTruthy();
    expect(felt(vindu(), "til").value).toBe("16:00");
    expect(within(vindu()).getByRole("alert").textContent).toBe("Over dagsnorm");
  });

  it("lagret: vinduet lukkes og tabellen hentes på nytt", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    fireEvent.change(felt(v, "til"), { target: { value: "16:00" } });
    lagreVindu();
    act(() => kallTil("rettRadFelt")[0]!.opts!.onSuccess!(null));
    expect(vindu()).toBeNull();
  });

  it("ugyldig tid og for lang pause sendes ikke; grunnen står i vinduet", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    fireEvent.change(felt(v, "til"), { target: { value: "06:00" } });
    lagreVindu();
    expect(within(v).getByRole("alert").textContent).toBe("timer.attestering.registrering.ugyldigTid");
    fireEvent.change(felt(v, "til"), { target: { value: "15:00" } });
    fireEvent.change(felt(v, "pauseFelt"), { target: { value: "600" } });
    lagreVindu();
    expect(within(v).getByRole("alert").textContent).toBe("timer.attestering.registrering.pauseForLang");
    expect(kallTil("rettRadFelt")).toHaveLength(0);
  });

  it("«Avbryt» og Esc endrer ingenting", () => {
    const { container } = vis([sedel()]);
    const panel = aapne(container);
    let v = aapnePenn(panel);
    fireEvent.change(felt(v, "til"), { target: { value: "16:00" } });
    fireEvent.keyDown(felt(v, "til"), { key: "Escape" });
    expect(felt(v, "til").value).toBe("15:00");
    lagreVindu();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    v = aapnePenn(panel);
    fireEvent.change(felt(v, "til"), { target: { value: "16:00" } });
    fireEvent.click(within(v).getByRole("button", { name: "handling.avbryt" }));
    expect(vindu()).toBeNull();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
  });

  it("linja i vinduet sier hva arbeideren ser", () => {
    const { container } = vis([sedel()]);
    const v = aapnePenn(aapne(container));
    expect(v.querySelector("[data-korrigert-linje]")!.textContent).toBe('timer.korrigert.vinduLinje{"arbeider":"Kari Nordmann","attestant":"Kari Leder"}');
  });

  it("uten rett, på attestert linje og i attestert-fanen er tidene ikke redigerbare", () => {
    for (const [s, ro] of [
      [sedel({ redigerTillatt: false }), false],
      [sedel({ timer: [timer("t1", { attestertStatus: "attestert" })] }), false],
      [sedel(), true],
    ] as const) {
      const { container, unmount } = vis([s], ro);
      const panel = aapne(container);
      expect(within(panel).queryByLabelText("timer.attestering.registrering.til")).toBeNull();
      expect(panel.querySelector("[data-linje-penn]")).toBeNull();
      expect(panel.querySelector('[data-timelinje="s1:timer:t1"]')!.textContent).toContain("07:00–15:00");
      unmount();
    }
  });

  it("rettet felt viser verdien før retting som synlig tekst", () => {
    const { getByText } = vis([sedel({ timer: [timer("t1", { rettedeFelter: [{ felt: "timer", foer: "5", avNavn: "Leder", ved: "2026-11-16" }] })] })]);
    expect(getByText(/timer\.attestering\.tabell\.var\{"verdi":"5"\}/)).toBeTruthy();
  });
});

describe("T60/T73 (w10a) — faste kanter; avkrysning og knapper på de blå radene", () => {
  it("linja har faste kanter uten avkrysning og knapper; avkrysningen står på jobbens rad", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    const [venstre, hoyre] = [l.firstElementChild as HTMLElement, l.lastElementChild as HTMLElement];
    expect(venstre.style.position).toBe("sticky");
    expect(within(venstre).queryByRole("checkbox")).toBeNull();
    expect(hoyre.style.position).toBe("sticky");
    expect(hoyre.style.right).toBe("0px");
    expect(within(hoyre).queryAllByRole("button")).toHaveLength(0);
    const d = dagsrad(container);
    expect(within(d).getByRole("checkbox", { name: "timer.attestering.tabell.velgJobb" })).toBeTruthy();
    // Avkrysningen åpner ikke kortet.
    fireEvent.click(within(d).getByRole("checkbox"));
    expect(container.querySelector("[data-registrering]")).toBeNull();
  });
});

describe("T38 — kolonneoppsettet lagres under attesteringens egen liste-nøkkel", () => {
  it("w10a (A3) + A2: flytting fra velgeren lagres som «timer-attestering-v3» (lagrede oppsett nullstilles én gang til)", () => {
    vi.useFakeTimers();
    try {
      vis([sedel()]);
      const flytt = h.velger.props!.onRekkefolgeEndring as (ny: string[]) => void;
      act(() => flytt(["timer", "dato", "ansatt"]));
      act(() => { vi.advanceTimersByTime(900); });
      const k = kallTil("lagreTabelloppsett");
      expect(k).toHaveLength(1);
      expect(k[0]!.input).toMatchObject({ liste: "timer-attestering-v3", oppsett: { kolonner: ["timer", "dato", "ansatt"], rekkefolge: true } });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("T49 — én verktøylinje, ingen nedtrekk utenfor tabellen", () => {
  const side = readFileSync(resolve(__dirname, "../app/dashbord/attestering/page.tsx"), "utf8");

  it("d2b-2 § 12.5: ingen nedtrekk og ingen pivot — alle visningene er tabellen", () => {
    // w1 (plan web-timeføring bilde 6, tillegget til B7): årsvelgeren ved ukevalget er den
    // eneste nedtrekken — ingen filternedtrekk for prosjekt, ansatt eller avdeling (T49).
    // w10b (B6): firmavalget i sidehodet er ingen filternedtrekk — det velger firmaet siden
    // gjelder, og står bare når det er mer enn ett firma å velge.
    const nedtrekk = side.match(/<select[\s\S]*?className/g) ?? [];
    expect(nedtrekk).toHaveLength(2);
    expect(nedtrekk.filter((n) => /aria-label=\{t\("timer\.attestering\.uke\.aar"\)\}/.test(n))).toHaveLength(1);
    expect(nedtrekk.filter((n) => /aria-label=\{t\("firma\.velgFirma"\)\}/.test(n))).toHaveLength(1);
    expect(side).toMatch(/\{firmaer\.length > 1 && \(\s*<select/);
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

// w10b (plan § 4.10 del D): konteksten er mengden prosjekter prosjektlederen attesterer på.
const R = { id: "pC", name: "Prosjekt C", internalProjectNumber: null, projectNumber: "SD-3" };
const treProsjekter = () =>
  sedel({
    timer: [
      timer("t1"),
      timer("t2", { projectId: "pB", project: Q, kortId: "kB" }),
      timer("t3", { projectId: "pC", project: R, kortId: "kC" }),
    ],
  });

describe("T30/R13 — prosjektlederen er låst til sine prosjekter", () => {
  it("🔴 mengde: linjene på pA og pB kan velges, pC står nedtonet; dagens Attester tar pA og pB", () => {
    const { container, getByRole } = visMed([treProsjekter()], { prosjektKontekst: new Set(["pA", "pB"]) });
    expect(linje(container, "s1:timer:t2").className).not.toMatch(/opacity-50/);
    const annen = linje(container, "s1:timer:t3");
    expect(annen.className).toMatch(/opacity-50/);
    expect(within(annen).queryByRole("checkbox")).toBeNull();
    fireEvent.click(getByRole("button", { name: /attesterDineProsjekter/ }));
    expect(kallTil("attester")).toHaveLength(0);
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1", "t2"], maskinIder: [], tilleggIder: [] } });
  });

  it("linja på et annet prosjekt står nedtonet uten avkrysning og handlinger; utvalget tar bare prosjektets linjer", () => {
    const { container, getByRole } = visMed([toProsjekter()], { prosjektKontekst: new Set(["pA"]) });
    const annen = linje(container, "s1:timer:t2");
    expect(annen.className).toMatch(/opacity-50/);
    expect(within(annen).queryByRole("checkbox")).toBeNull();
    expect(within(annen).queryAllByRole("button")).toHaveLength(0);
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    expect(within(jobb[0]!).getByRole("checkbox")).toBeTruthy();
    expect(within(jobb[1]!).queryByRole("checkbox")).toBeNull();
    fireEvent.click(getByRole("button", { name: /attesterUtvalget/ }));
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
  });

  it("dagsumraden attesterer prosjektets del — aldri hele sedelen", () => {
    const { getByRole, queryByRole } = visMed([toProsjekter()], { prosjektKontekst: new Set(["pA"]) });
    expect(queryByRole("button", { name: /attesterDagen/ })).toBeNull();
    fireEvent.click(getByRole("button", { name: /attesterDineProsjekter/ }));
    expect(kallTil("attester")).toHaveLength(0);
    expect(kallTil("attesterRader")[0]!.input).toEqual({ radIder: { timerIder: ["t1"], maskinIder: [], tilleggIder: [] } });
  });

  it("negativkontroll: uten kontekst (firmaet) kan begge linjene velges", () => {
    const { container } = visMed([toProsjekter()]);
    expect(linje(container, "s1:timer:t2").className).not.toMatch(/opacity-50/);
    for (const j of Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[]) expect(within(j).getByRole("checkbox")).toBeTruthy();
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
      { prosjektKontekst: new Set(["pA"]) },
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
    // A1: normmerket regnes fra linjene (9 t arbeid), ikke fra `totaltimer`.
    const ni = [timer("t1", { timer: "9", tilTid: "16:30" })];
    const { container } = visMed([sedel({ totaltimer: 9, dagsnorm: 7.5, timer: ni })]);
    expect(container.textContent).toMatch(/normMerke/);
    expect(document.body.textContent).toMatch(/normHover\.arbeid/);
    cleanup();
    const uten = visMed([sedel({ totaltimer: 9, dagsnorm: null, timer: ni })]);
    expect(uten.container.textContent).not.toMatch(/normMerke/);
    expect(document.body.textContent).not.toMatch(/normHover/);
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
    for (const k of ["timer.attestering.tabell.ukeAvvikOver", "timer.attestering.pivot.avvikTooltip", "timer.attestering.pivot.norm"]) {
      expect(nb[k]).toMatch(/Avvik denne uka/);
    }
    expect(nb["timer.attestering.pivot.avvikOver"]).toMatch(/ukenorm/);
  });
});

describe("w5 — kjernekolonner og «Tilbakestill til standard»", () => {
  const hodeKolonner = (c: HTMLElement) =>
    [...new Set(Array.from(c.querySelectorAll("[data-kolonne]")).map((e) => e.getAttribute("data-kolonne")))];
  afterEach(() => { delete h.data["bruker.hentTabelloppsett"]; });

  it("uten lagret oppsett vises standardkolonnene (A2: Prosjekt i stedet for Pr.nr. og Underprosjekt) og Reise og Overtid etter Timer (O13), Fra og Til i én", () => {
    const { container } = vis([sedel()]);
    expect(hodeKolonner(container)).toEqual([
      "dato", "ansatt", "prosjekt", "betegnelse", "fraTil", "timer", "reisetimer", "overtid",
      "maskin", "maskintimer", "vareOgMengde", "antall", "belop", "avvik",
    ]);
    expect(h.velger.props!.nullstillTekst).toBe("timer.attestering.tabell.tilbakestillStandard");
  });

  it("et lagret oppsett vises som det er, med Reise og Overtid satt inn etter Timer (O13 R3), og lagres ikke på nytt (WM69)", () => {
    vi.useFakeTimers();
    try {
      h.data["bruker.hentTabelloppsett"] = { kolonner: ["timer", "ansatt", "fraTid"], rekkefolge: true, bredder: {}, sortering: null };
      const { container } = vis([sedel()]);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(hodeKolonner(container)).toEqual(["timer", "reisetimer", "overtid", "ansatt", "fraTid"]);
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
        "aktivitet", "fraTid", "tilTid", "timer", "reisetimer", "overtid", "maskintimer", "antall", "belop", "mengde", "enhet",
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
      const oppsett = (k[0]!.input as { oppsett: { kolonner: string[]; rekkefolge?: boolean; tillagt?: string[]; bredder: Record<string, number> } }).oppsett;
      expect(oppsett.kolonner).toEqual([
        "dato", "ansatt", "prosjekt", "betegnelse", "fraTil", "timer", "reisetimer", "overtid",
        "maskin", "maskintimer", "vareOgMengde", "antall", "belop", "avvik",
      ]);
      expect(oppsett.rekkefolge).toBe(true);
      expect(oppsett.tillagt).toEqual(["reisetimer", "overtid"]);
      expect(oppsett.bredder).toEqual({});
      expect(hodeKolonner(container)[0]).toBe("dato");
    } finally {
      vi.useRealTimers();
    }
  });

  it("w10a (A4): Fra–til-cella er tekst — retting skjer i kortet", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    expect(within(l).queryAllByRole("button")).toHaveLength(0);
    expect(l.textContent).toMatch(/07:00.*15:00/);
  });
});

/** w8: raden som åpner registreringen — dagsraden når dagen har én jobb. */
const dagsrad = (c: HTMLElement, i = 0) => c.querySelectorAll('[data-rad="dag"]')[i] as HTMLElement;

describe("w8 — jobbraden åpner registreringen, timeradene gjør det ikke", () => {
  afterEach(() => { delete h.data["eksternKostObjekt.list"]; });

  it("klikk på dagsraden (én jobb) åpner, nytt klikk lukker; pil ▸/▾ og mørkere rad", () => {
    const { container } = vis([sedel()]);
    const d = () => dagsrad(container);
    expect(d().getAttribute("aria-expanded")).toBe("false");
    expect(d().querySelector("[data-pil]")!.textContent).toBe("▸");
    fireEvent.click(d());
    expect(container.querySelector("[data-registrering]")).not.toBeNull();
    expect(d().hasAttribute("data-aapen")).toBe(true);
    expect(d().getAttribute("aria-expanded")).toBe("true");
    expect(d().querySelector("[data-pil]")!.textContent).toBe("▾");
    expect(d().className).toContain("bg-blue-100");
    fireEvent.click(d());
    expect(container.querySelector("[data-registrering]")).toBeNull();
  });

  it("registreringen står rett under raden som ble klikket, over timeradene", () => {
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const rader = Array.from(container.querySelectorAll("[data-rad], [data-registrering], [data-linje]"));
    const iDag = rader.indexOf(dagsrad(container));
    expect(rader[iDag + 1]!.hasAttribute("data-registrering")).toBe(true);
    expect(rader[iDag + 2]!.getAttribute("data-linje")).toBe("s1:timer:t1");
  });

  it("timeraden åpner ikke registreringen og har verken avkrysning eller knapper (w10a)", () => {
    const { container } = vis([sedel()]);
    const l = linje(container, "s1:timer:t1");
    fireEvent.click(l);
    expect(container.querySelector("[data-registrering]")).toBeNull();
    expect(l.className).not.toContain("cursor-pointer");
    expect(within(l).queryByRole("checkbox")).toBeNull();
    expect(within(l).queryAllByRole("button")).toHaveLength(0);
  });

  it("knappene i dagsraden åpner ikke registreringen", () => {
    const { container } = vis([sedel()]);
    fireEvent.click(within(dagsrad(container)).getByRole("button", { name: "timer.attestering.tabell.attesterDagen" }));
    expect(container.querySelector("[data-registrering]")).toBeNull();
  });

  it("tastaturet: Enter på raden åpner", () => {
    const { container } = vis([sedel()]);
    expect(dagsrad(container).tabIndex).toBe(0);
    fireEvent.keyDown(dagsrad(container), { key: "Enter" });
    expect(container.querySelector("[data-registrering]")).not.toBeNull();
  });

  it("to jobber: dagsraden er ikke klikkbar; hver jobbrad åpner sin jobb", () => {
    const { container } = vis([toProsjekter()]);
    const dag = dagsrad(container);
    expect(dag.getAttribute("role")).toBeNull();
    expect(dag.querySelector("[data-pil]")).toBeNull();
    fireEvent.click(dag);
    expect(container.querySelector("[data-registrering]")).toBeNull();
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    fireEvent.click(jobb[1]!);
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(panel).not.toBeNull();
    const rader = Array.from(container.querySelectorAll("[data-rad], [data-registrering], [data-linje]"));
    expect(rader[rader.indexOf(jobb[1]!) + 1]).toBe(panel);
    expect(jobb[1]!.hasAttribute("data-aapen")).toBe(true);
    expect(jobb[0]!.hasAttribute("data-aapen")).toBe(false);
  });

  it("«Etter prosjekt»: jobbens rad åpner registreringen", () => {
    const { container } = visMed([toProsjekter()], { gruppering: "prosjekt" });
    fireEvent.click(dagsrad(container, 1));
    expect(container.querySelector("[data-registrering]")).not.toBeNull();
    expect(dagsrad(container, 1).hasAttribute("data-aapen")).toBe(true);
  });

  it("«Bare oversikt»: jobbraden åpner registreringen også der", () => {
    const { container, getByLabelText } = vis([sedel()]);
    fireEvent.click(getByLabelText("timer.attestering.tabell.bareOversikt"));
    fireEvent.click(dagsrad(container));
    expect(container.querySelector("[data-registrering]")).not.toBeNull();
    expect(container.querySelectorAll("[data-linje]")).toHaveLength(0);
  });

  it("underprosjekt-knapp flytter hele jobben (helJobb)", () => {
    h.data["eksternKostObjekt.list"] = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }, { id: "e2", proAdmId: "200", kortNavn: "Tak" }];
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const tak = within(panel).getAllByRole("button").find((b) => b.textContent?.includes("Tak"))!;
    fireEvent.click(tak);
    expect(kallTil("flyttTimerRadEco")[0]!.input).toEqual({ timerRadId: "t1", radType: "timer", externalCostObjectId: "e2", helJobb: true });
  });

  it("RETUR O12 vilkår 2: arbeidstid-reise først i kortet — jobbens underprosjekt vises, «hele jobben» sendes med jobbradens id", () => {
    h.data["eksternKostObjekt.list"] = [
      { id: "e1", proAdmId: "100", kortNavn: "Grunn" },
      { id: "e2", proAdmId: "200", kortNavn: "Tak" },
      { id: "e3", proAdmId: "300", kortNavn: "Vegg" },
    ];
    // «Til byggeplass» ført som arbeidstid kl. 06:30 med underprosjekt Tak; jobben (07–15) har Grunn.
    const reise = timer("r1", { fraTid: "06:30", tilTid: "07:00", timer: "0.5", pauseMin: 0, externalCostObjectId: "e2", arbeidReiseRetning: "ut" });
    const jobb = timer("t1", { externalCostObjectId: "e1" });
    const { container } = vis([sedel({ timer: [reise, jobb] })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const knapp = (navn: string) => within(panel).getAllByRole("button").find((b) => b.textContent?.includes(navn))!;
    expect(knapp("Grunn").getAttribute("aria-pressed")).toBe("true");
    expect(knapp("Tak").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(knapp("Vegg"));
    expect(kallTil("flyttTimerRadEco")[0]!.input).toEqual({ timerRadId: "t1", radType: "timer", externalCostObjectId: "e3", helJobb: true });
  });

  it("uten kortId (eldre rad) kan hele jobben ikke flyttes og del opp vises ikke", () => {
    h.data["eksternKostObjekt.list"] = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }];
    const { container } = vis([sedel({ timer: [timer("t1", { kortId: null })] })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const grunn = within(panel).getAllByRole("button").find((b) => b.textContent?.includes("Grunn"));
    expect(grunn === undefined || (grunn as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).queryByRole("button", { name: /registrering\.delOpp/ })).toBeNull();
  });

  it("«Del opp»: klokkeslettet forhåndsvises på serveren, deretter deles jobben", () => {
    vi.useFakeTimers();
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: /registrering\.delOpp/ }));
    const skjema = panel.querySelector("[data-del-opp]") as HTMLElement;
    fireEvent.change(within(skjema).getByPlaceholderText("11:00"), { target: { value: "10:00" } });
    // O15 pkt 3: forhåndsvisningen går litt etter siste tast.
    act(() => { vi.advanceTimersByTime(400); });
    vi.useRealTimers();
    const fv = kallTil("delJobb");
    expect(fv).toHaveLength(1);
    expect(fv[0]!.input).toEqual({ sheetId: "s1", kortId: "kA", kl: "10:00", externalCostObjectIdB: null, forhandsvis: true });
    act(() => fv[0]!.opts!.onSuccess!({ forhandsvisning: { timerA: 2.5, timerB: 5, maskinPaaA: 0, maskiner: [] } }));
    expect(skjema.textContent).toContain("2,50 t");
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ });
    fireEvent.click(knapper[knapper.length - 1]!);
    const alle = kallTil("delJobb");
    expect(alle).toHaveLength(2);
    expect(alle[1]!.input).toEqual({ sheetId: "s1", kortId: "kA", kl: "10:00", externalCostObjectIdB: null, maskinDeling: [] });
  });
});

describe("w5 / WM54 (w10a) — ✂ og «Rediger jobben» i kortet, bare når «rediger ved attestering» er på", () => {
  it("av: verken «Rediger jobben», ✂, tidsfelter eller del opp i kortet", () => {
    const { container } = vis([sedel({ redigerTillatt: false })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(within(panel).queryByRole("button", { name: /registrering\.redigerJobben/ })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "timer.attestering.meny.splittRad" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: /registrering\.delOpp/ })).toBeNull();
    expect(within(panel).queryByLabelText("timer.attestering.registrering.til")).toBeNull();
  });

  it("på: «Rediger jobben» øverst i kortet og ✂ ved timelinja åpner hver sin dialog", () => {
    const { container, queryByText } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    const rediger = within(panel).getByRole("button", { name: /registrering\.redigerJobben/ });
    // Øverst: i hodet, før første del.
    expect(rediger.compareDocumentPosition(within(panel).getByText("timer.attestering.registrering.lonnsart", { selector: "*" }) as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const timelinje = panel.querySelector('[data-timelinje="s1:timer:t1"]') as HTMLElement;
    fireEvent.click(within(timelinje).getByRole("button", { name: "timer.attestering.meny.splittRad" }));
    expect(queryByText("splitt-modal")).not.toBeNull();
    fireEvent.click(rediger);
    expect(queryByText("rediger-modal")).not.toBeNull();
  });

  it("S1: ✂ står ved maskinen på egen linje og ved tillegget, ikke ved maskinen på timelinja", () => {
    const { container } = vis([sedel({
      maskiner: [{ id: "m1", vehicleId: "v1", timer: "3", mengde: null, enhet: null, kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", timerRadId: null } as never],
      tillegg: [{ id: "g1", tilleggId: "x", antall: "1", kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", externalCostObjectId: null } as never],
    })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(within(panel).getAllByRole("button", { name: "timer.attestering.meny.splittRad" }).length).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  w5b (B14 A) — dagsrad øverst, jobbrad når dagen har flere jobber    */
/* ------------------------------------------------------------------ */

describe("w5b — dagsvisningen, alternativ A", () => {
  const dagsrader = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rad="dag"]')) as HTMLElement[];
  const jobbrader = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
  const venstreKant = (el: HTMLElement) => (el.firstElementChild as HTMLElement).className.match(/border-(blue|slate|emerald|violet|rose)-\d+/)?.[0];

  it("én jobb: dagsraden bærer dato med ukedag, ansatt, prosjektnavnet (O13), sum og dagens knapper — ingen jobbrad", () => {
    const { container } = vis([sedel()]);
    const [dag] = dagsrader(container);
    expect(dagsrader(container)).toHaveLength(1);
    expect(jobbrader(container)).toHaveLength(0);
    expect(dag!.textContent).toMatch(/\S+ 16\.11\./);
    expect(dag!.textContent).toContain("Kari Nordmann");
    // O13 (pkt 2): prosjektnavnet i stedet for pr.nr.; «1 jobb» er gått ut.
    expect(dag!.textContent).toContain("Prosjekt A");
    expect(dag!.textContent).not.toContain("1001");
    expect(dag!.textContent).not.toContain("antallJobber");
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
    // O13 (pkt 2): jobbraden viser prosjektnavnet i stedet for pr.nr.
    expect(jobb[0]!.textContent).toContain("Prosjekt A");
    expect(jobb[0]!.textContent).not.toContain("1001");
    expect(jobb[1]!.textContent).toContain("Prosjekt B");
    expect(jobb[1]!.textContent).not.toContain("SD-2");
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

  it("sortering gir flat liste: bare linjer, og dato, ansatt og prosjekt står på hver linje igjen", () => {
    const { container, getByText } = vis([toProsjekter()]);
    fireEvent.click(getByText("timer.eksport.kolTimer"));
    expect(container.querySelectorAll("[data-rad]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-blokk-slutt]")).toHaveLength(0);
    const l = linje(container, "s1:timer:t1");
    expect(l.textContent).toContain("16.11.");
    expect(l.textContent).toContain("Kari Nordmann");
    expect(l.textContent).toContain("Prosjekt A");
    expect(l.className).not.toMatch(/border-slate|border-emerald/);
  });

  it("normen står som merke bare når dagen avviker, med fortegn", () => {
    // A1: timene leses fra linjene (arbeid uten reise), ikke fra `totaltimer`.
    const over = vis([sedel({ dagsnorm: 7.5, timer: [timer("t1", { timer: "8" })] })]);
    expect(dagsrader(over.container)[0]!.textContent).toContain('normMerke{"avvik":"+0,5"}');
    cleanup();
    const under = vis([sedel({ dagsnorm: 7.5, timer: [timer("t1", { timer: "6" })] })]);
    expect(dagsrader(under.container)[0]!.textContent).toContain('normMerke{"avvik":"−1,5"}');
    cleanup();
    const lik = vis([sedel({ totaltimer: 99, dagsnorm: 7.5 })]);
    expect(lik.container.textContent).not.toMatch(/normMerke|normHover/);
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
    const { container } = visMed([toProsjekter()], { prosjektKontekst: new Set(["pA"]) });
    const [dag] = dagsrader(container);
    expect(within(dag!).getByRole("button", { name: /attesterDineProsjekter/ })).toBeTruthy();
    expect(jobbrader(container)).toHaveLength(2);
    // Jobben på det andre prosjektet har ingen knapper.
    expect(within(jobbrader(container)[1]!).queryAllByRole("button")).toHaveLength(0);
  });

  it("klikk på dagsraden åpner registreringen inne i blokka (jobbens kant), og dagens luft står etter siste timerad", () => {
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(panel.closest(".border-l-4")!.className).toContain("border-blue-400");
    const slutt = container.querySelector("[data-blokk-slutt]") as HTMLElement;
    expect(slutt.querySelector('[data-linje="s1:timer:t1"]')).toBeTruthy();
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
    const { container, queryByRole } = visMed([egen()], { prosjektKontekst: new Set(["pA"]) });
    expect(within(linje(container, "egen:timer:e1")).queryByRole("checkbox")).toBeNull();
    expect(queryByRole("button", { name: /attesterDineProsjekter/ })).toBeNull();
  });

  it("negativkontroll: uten flagget har den samme sedelen knappene og intet merke", () => {
    const { container, queryByText } = visMed([sedel({ id: "egen", egneTimer: false, timer: [timer("e1")] })]);
    expect(within(dagsrad(container)).getByRole("checkbox")).toBeTruthy();
    expect(within(dagsrad(container)).getByRole("button", { name: "timer.attestering.tabell.attesterDagen" })).toBeTruthy();
    expect(queryByText("timer.attestering.egneTimer.merke")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  w10a — kortets innhold: lønnsart, beskrivelse, kvittering, reise   */
/* ------------------------------------------------------------------ */

import { tillatteLonnsarter, jobbensBeskrivelser, erTimebasertLonnsart, TidFelter } from "@/components/attestering/RegistreringPanel";

describe("w10a (A1) — lønnsartvalget følger linjetypen", () => {
  const ktx = { reiseLonnsartId: "lr", grensepunktLonnsartIds: ["lg"] };
  const arter = [{ id: "l1", navn: "Ordinær" }, { id: "lr", navn: "Reise" }, { id: "lg", navn: "Reise 30–60 km" }, { id: "l2", navn: "Overtid 50 %" }];
  const linje = (erReise: boolean | null) => ({ erReise });

  it("O25: arbeidslinja tilbyr alle lønnsarter, også reise-lønnsarten; reiselinja bare reisearter", () => {
    const alle = ["l1", "lr", "lg", "l2"];
    expect(tillatteLonnsarter(linje(false), arter, ktx, "l1").map((x) => x.id)).toEqual(alle);
    expect(tillatteLonnsarter(linje(null), arter, ktx, "l1").map((x) => x.id)).toEqual(alle);
    expect(tillatteLonnsarter(linje(false), arter, null, "l1").map((x) => x.id)).toEqual(alle);
    expect(tillatteLonnsarter(linje(true), arter, ktx, "lr").map((x) => x.id)).toEqual(["lr", "lg"]);
  });

  it("reiselinja: den lagrede arten står alltid, også når den bryter regelen; uten kontekst bare den lagrede", () => {
    expect(tillatteLonnsarter(linje(true), arter, ktx, "l1").map((x) => x.id)).toEqual(["l1", "lr", "lg"]);
    expect(tillatteLonnsarter(linje(true), arter, null, "lr").map((x) => x.id)).toEqual(["lr"]);
  });

  it("i kortet: arbeidslinja viser alle arter (O25), og et valg sendes som lonnsartId", () => {
    h.data["timer.lonnsart.list"] = arter;
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [{ lonnsartId: "lg" }] };
    try {
      const { container } = vis([sedel()]);
      fireEvent.click(dagsrad(container));
      const panel = container.querySelector("[data-registrering]") as HTMLElement;
      const v = aapnePenn(panel);
      const valg = within(v).getByLabelText("timer.attestering.registrering.lonnsart") as HTMLSelectElement;
      expect(Array.from(valg.options).map((o) => o.value)).toEqual(["l1", "lr", "lg", "l2"]);
      fireEvent.change(valg, { target: { value: "l2" } });
      expect(kallTil("rettRadFelt")).toHaveLength(0);
      lagreVindu();
      expect(kallTil("rettRadFelt")[0]!.input).toEqual({ radType: "timer", radId: "t1", felter: { lonnsartId: "l2" } });
    } finally {
      delete h.data["timer.lonnsart.list"];
      delete h.data["organisasjon.hentArbeidstidDefaults"];
    }
  });
});

describe("RETUR 1 w10a (vilkår 1) — urørte felt viser lagret timetall", () => {
  const vist = (c: HTMLElement) => c.querySelector("[data-utregnet-timer]")!.textContent;

  it("lagret 4 t på 07–15 viser 4 t; utregnet først når et felt endres", () => {
    const { container, getByLabelText } = render(
      <TidFelter lagret={{ fraTid: "07:00", tilTid: "15:00", pauseMin: 0, timer: 4 }} tidsrunding={null} onLagre={() => {}} onFeil={() => {}} />,
    );
    expect(vist(container)).toBe('timer.attestering.registrering.timer{"timer":"4,00"}');
    fireEvent.change(getByLabelText("timer.attestering.registrering.til"), { target: { value: "16:00" } });
    expect(vist(container)).toBe('timer.attestering.registrering.timer{"timer":"9,00"}');
    fireEvent.keyDown(getByLabelText("timer.attestering.registrering.til"), { key: "Escape" });
    expect(vist(container)).toBe('timer.attestering.registrering.timer{"timer":"4,00"}');
  });

  it("i kortet og i vinduet: radens lagrede timer står, ikke spennet", () => {
    const { container } = vis([sedel({ totaltimer: 4, timer: [timer("t1", { timer: "4", pauseMin: 0 })], pauseMin: 0 })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(panel.querySelector('[data-timelinje="s1:timer:t1"]')!.textContent).toContain('"4,00"');
    expect(vist(aapnePenn(panel))).toContain('"4,00"');
  });
});

describe("RETUR 1 w10a (vilkår 2) — fra–til bare på timebaserte lønnsarter", () => {
  it("erTimebasertLonnsart: null og per_time ja; per_km, per_dag, per_natt og ukjent art nei", () => {
    const kat = [
      { id: "a", satsEnhet: null }, { id: "b", satsEnhet: "per_time" }, { id: "c", satsEnhet: "per_km" },
      { id: "d", satsEnhet: "per_dag" }, { id: "e", satsEnhet: "per_natt" },
    ];
    expect(["a", "b", "c", "d", "e", "x"].map((id) => erTimebasertLonnsart(id, kat))).toEqual([true, true, false, false, false, false]);
  });

  const aapne = (c: HTMLElement) => { fireEvent.click(dagsrad(c)); return c.querySelector("[data-registrering]") as HTMLElement; };

  it("per_time: fra–til i vinduet, ikke tallfelt", () => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: "per_time" }];
    const v = aapnePenn(aapne(vis([sedel()]).container));
    expect(within(v).getByLabelText("timer.attestering.registrering.til")).toBeTruthy();
    expect(within(v).queryByLabelText("timer.eksport.kolTimer")).toBeNull();
  });

  it("per_km: tallfeltet i vinduet; km sendes som timer, fra og til røres ikke", () => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Kjøregodtgjørelse", satsEnhet: "per_km" }];
    const v = aapnePenn(aapne(vis([sedel({ timer: [timer("t1", { timer: "120" })] })]).container));
    expect(within(v).queryByLabelText("timer.attestering.registrering.til")).toBeNull();
    const tall = within(v).getByLabelText("timer.eksport.kolTimer") as HTMLInputElement;
    expect(tall.value).toBe("120");
    fireEvent.change(tall, { target: { value: "135" } });
    fireEvent.blur(tall);
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    lagreVindu();
    expect(kallTil("rettRadFelt")[0]!.input).toEqual({ radType: "timer", radId: "t1", felter: { timer: 135 } });
  });

  it("per_dag: avvist retting — grunnen står i vinduet, som blir stående", () => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Diett", satsEnhet: "per_dag" }];
    const v = aapnePenn(aapne(vis([sedel({ timer: [timer("t1", { timer: "1" })] })]).container));
    const tall = within(v).getByLabelText("timer.eksport.kolTimer") as HTMLInputElement;
    fireEvent.change(tall, { target: { value: "2" } });
    lagreVindu();
    act(() => kallTil("rettRadFelt")[0]!.opts!.onError!({ message: "Avvist" }));
    expect(within(vindu()).getByRole("alert").textContent).toBe("Avvist");
  });
});

describe("w10a (A6) — «Hva gjorde du?» viser arbeiderens tekst, aldri aktiviteten", () => {
  const aapne = (c: HTMLElement) => { fireEvent.click(dagsrad(c)); return c.querySelector("[data-registrering]") as HTMLElement; };

  it("jobbensBeskrivelser: sortert på tid, hver tekst én gang, tomme bort", () => {
    expect(jobbensBeskrivelser([
      { fraTid: "12:00", beskrivelse: "Forskaling" },
      { fraTid: "07:00", beskrivelse: " Rigging " },
      { fraTid: "13:00", beskrivelse: "Forskaling" },
      { fraTid: "14:00", beskrivelse: "  " },
      { fraTid: "15:00", beskrivelse: null },
    ])).toEqual(["Rigging", "Forskaling"]);
  });

  it("tekstene står i del 3; aktiviteten står i hodet", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1", { fraTid: "12:00", tilTid: "15:00", timer: "3", pauseMin: 0, beskrivelse: "Forskaling" }),
      timer("t0", { fraTid: "07:00", tilTid: "11:30", timer: "4.5", pauseMin: 0, beskrivelse: "Rigging" }),
    ] })]);
    const panel = aapne(container);
    const del3 = panel.querySelector("[data-beskrivelse]") as HTMLElement;
    expect(Array.from(del3.querySelectorAll("p")).map((x) => x.textContent)).toEqual(["Rigging", "Forskaling"]);
    expect(del3.textContent).not.toContain("Graving");
    expect(panel.querySelector("[data-kort-hode]")!.textContent).toContain("Graving");
  });

  it("uten tekst: «Ikke utfylt» i fet skrift — aktiviteten settes ikke inn", () => {
    const { container } = vis([sedel()]);
    const del3 = aapne(container).querySelector("[data-beskrivelse]") as HTMLElement;
    const ikke = within(del3).getByText("timer.attestering.registrering.ikkeUtfylt");
    expect(ikke.className).toContain("font-semibold");
    expect(del3.textContent).not.toContain("Graving");
  });

  it("«Kommentar til dagen» står når sedelen har en, ellers ikke", () => {
    const med = vis([sedel({ beskrivelse: "Regn hele dagen" })]);
    expect(aapne(med.container).querySelector("[data-kommentar-dagen]")!.textContent).toContain("Regn hele dagen");
    cleanup();
    const uten = vis([sedel()]);
    expect(aapne(uten.container).querySelector("[data-kommentar-dagen]")).toBeNull();
  });
});

describe("w10a (A8) — kvitteringen står også i kortet under «Utlegg»", () => {
  it("kortets utlegg lenker til den signerte fila", () => {
    const { container } = vis([sedel({ utlegg: [{ id: "u1", belop: 120, expenseCategory: { navn: "Parkering" }, kortId: "kA", projectId: "pA", project: P,
      vedlegg: [{ id: "v1", fileName: "kvittering.jpg", mimeType: "image/jpeg", fileUrl: "/uploads/k.jpg?sig=1" }] }] })]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(Array.from(panel.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toContain("/uploads/k.jpg?sig=1");
  });
});

describe("w10a (A10) — reiseblokken får avkrysning og ✓ ↩ som en jobbrad", () => {
  it("reisen og jobben har hver sin rad med kryss, ✓ og ↩; reisekortet viser «—» i del 3", () => {
    const { container } = vis([sedel({ timer: [timer("r1", { erReise: true, kortId: null, fraTid: "06:30", tilTid: "07:00", timer: "0.5", pauseMin: 0 }), timer("t1")] })]);
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    expect(jobb).toHaveLength(2);
    for (const j of jobb) {
      expect(within(j).getByRole("checkbox", { name: "timer.attestering.tabell.velgJobb" })).toBeTruthy();
      expect(within(j).getByRole("button", { name: "timer.attestering.tabell.attesterKort" })).toBeTruthy();
      expect(within(j).getByRole("button", { name: "timer.attestering.tabell.returnerKort" })).toBeTruthy();
    }
    fireEvent.click(jobb[0]!);
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    expect(panel.getAttribute("data-registrering")).toBe("s1:reise");
    expect(within(panel.querySelector("[data-beskrivelse]") as HTMLElement).queryByText("timer.attestering.registrering.ikkeUtfylt")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  w12 — reisen i jobbens kort (plan § 4.11 del C; H.8 og H.9)        */
/* ------------------------------------------------------------------ */

describe("w12 (§ 4.11 C) — reiselinja i jobben, del 8 «Reise» og «Føres på»", () => {
  const ECO = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }, { id: "e2", proAdmId: "200", kortNavn: "Tak" }];
  const reise = (over: Partial<AttTimer> = {}) =>
    timer("r1", { erReise: true, reiseRetning: "ut", lonnsartId: "lr", fraTid: "06:00", tilTid: "07:00", timer: "1", pauseMin: 0, ...over });
  const aapnePanel = (c: HTMLElement, rad: HTMLElement = dagsrad(c)) => { fireEvent.click(rad); return c.querySelector("[data-registrering]") as HTMLElement; };
  const del = (panel: HTMLElement, nr: number) => panel.querySelector(`[data-del="${nr}"]`) as HTMLElement | null;
  beforeEach(() => {
    h.data["eksternKostObjekt.list"] = ECO;
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }, { id: "lr", navn: "Reise", satsEnhet: null }, { id: "l2", navn: "Overtid 50 %", satsEnhet: null }];
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [] };
  });
  afterEach(() => {
    delete h.data["eksternKostObjekt.list"];
    delete h.data["organisasjon.hentArbeidstidDefaults"];
  });

  it("reiselinja står sist i jobben, sier «Reise» og har ingen knapper eller kryss; ingen reiseblokk", () => {
    h.data["bruker.hentTabelloppsett"] = { kolonner: ["type", "betegnelse", "timer"], rekkefolge: true, bredder: {}, sortering: null };
    const { container } = vis([sedel({ timer: [reise(), timer("t1")] })]);
    delete h.data["bruker.hentTabelloppsett"];
    expect(container.querySelectorAll('[data-rad="jobb"]')).toHaveLength(0);
    expect(Array.from(container.querySelectorAll("[data-linje]")).map((e) => e.getAttribute("data-linje"))).toEqual(["s1:timer:t1", "s1:reise:r1"]);
    const l = linje(container, "s1:reise:r1");
    expect(within(l).queryAllByRole("button")).toHaveLength(0);
    expect(within(l).queryAllByRole("checkbox")).toHaveLength(0);
    expect(l.textContent).toContain("timer.attestering.tabell.type.reise");
  });

  it("✓ på jobbraden sender reisens id sammen med jobbens; jobbraden viser arbeidstimer og reisen i Reise (O13)", () => {
    const { container } = vis([sedel({ timer: [reise(), timer("t1"), timer("t2", { kortId: "kB", fraTid: "15:00", tilTid: "16:00", timer: "1", pauseMin: 0 })] })]);
    const [jobbA] = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    // O13 (pkt 3): den grå «reise X t» er gått ut; reisen står i Reise-kolonnen.
    expect(jobbA!.querySelector("[data-reise-sum]")).toBeNull();
    expect(jobbA!.querySelector('[data-tall="reise"]')!.textContent).toBe("1,00");
    expect(jobbA!.textContent).toContain("7,50");
    expect(jobbA!.textContent).not.toContain("8,50");
    fireEvent.click(within(jobbA!).getByRole("button", { name: "timer.attestering.tabell.attesterKort" }));
    const ider = (kallTil("attesterRader")[0]!.input as { radIder: { timerIder: string[] } }).radIder.timerIder;
    expect([...ider].sort()).toEqual(["r1", "t1"]);
  });

  it("del 1–7 er uendret av reisen; del 8 viser reisen", () => {
    const uten = vis([sedel()]);
    const p0 = aapnePanel(uten.container);
    const foer = [1, 2, 3, 4, 5, 6, 7].map((n) => del(p0, n)!.textContent);
    // D2a: del 8 står alltid når kortet kan rettes — tom («—») uten reise.
    expect(del(p0, 8)!.querySelector("[data-reiselinje]")).toBeNull();
    expect(del(p0, 8)!.textContent).toContain("—");
    cleanup();
    const med = vis([sedel({ timer: [timer("t1"), reise()] })]);
    const p1 = aapnePanel(med.container);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => del(p1, n)!.textContent)).toEqual(foer);
    const d8 = del(p1, 8)!;
    expect(d8.textContent).toContain("timer.attestering.registrering.reise");
    expect(d8.textContent).toContain("reise-merke");
    expect(d8.querySelector('[data-reiselinje="s1:reise:r1"]')).toBeTruthy();
  });

  it("H.9 (O25): arbeidslinja tilbyr alle lønnsarter, også reise-lønnsarten; reiselinja har ingen lønnsart-select (w15f: rettes i «✎ Rediger jobben»)", () => {
    const { container } = vis([sedel({ timer: [timer("t1"), reise()] })]);
    const p = aapnePanel(container);
    const v = aapnePenn(del(p, 2)!);
    const valg = Array.from((within(v).getByLabelText("timer.attestering.registrering.lonnsart") as HTMLSelectElement).options).map((o) => o.value);
    expect(valg).toEqual(["l1", "lr", "l2"]);
    expect(del(p, 8)!.querySelector("select")).toBeNull();
  });

  it("reise alene i et kort: jobbraden har navnefeltet og reisetimene i Timer og Reise (O13 R5), kortet har ikke underprosjektvalget i hodet", () => {
    const { container } = vis([sedel({ timer: [timer("t1"), reise({ kortId: "kR" })] })]);
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    expect(jobb).toHaveLength(2);
    // Reisen kl. 06:00 står først; kortet uten arbeid ordnes etter sin første linje.
    // O13 (R5): etiketten «Reise» er gått ut — navnefeltet står der; Timer og Reise viser 1,00.
    expect(jobb[0]!.textContent).not.toContain("timer.attestering.tabell.type.reise");
    expect(jobb[0]!.querySelector("[data-prosjektnavn]")!.textContent).toContain("Prosjekt A");
    expect(jobb[0]!.querySelector('[data-tall="reise"]')!.textContent).toBe("1,00");
    expect(jobb[0]!.textContent).toMatch(/1,00.*1,00/);
    const p = aapnePanel(container, jobb[0]!);
    expect(within(p).queryByText("timer.attestering.registrering.underprosjekt")).toBeNull();
    expect(del(p, 8)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  w15f — reiselinja er tekst med ✎; «Rett reisen» (plan § 4.15, del H pkt. 25) */
/* ------------------------------------------------------------------ */

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const dialogProto15 = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
dialogProto15.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
dialogProto15.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

describe("w15f — reiselinja i del 8 og «Rett reisen»", () => {
  const ECO = [{ id: "e1", proAdmId: "100", kortNavn: "Grunn" }, { id: "e2", proAdmId: "200", kortNavn: "Tak" }];
  const PROSJEKTER = [
    { id: "pA", name: "Prosjekt A", internalProjectNumber: "1001" },
    { id: "pB", name: "Prosjekt B", internalProjectNumber: "1002" },
    { id: "pC", name: "Prosjekt C", internalProjectNumber: "1003" },
  ];
  const BYGGEPLASSER = [
    { id: "bA1", projectId: "pA", name: "A sør" },
    { id: "bA2", projectId: "pA", name: "A nord" },
    { id: "bB1", projectId: "pB", name: "B hovedbygg" },
  ];
  const reise = (over: Partial<AttTimer> = {}) =>
    timer("r1", { erReise: true, reiseRetning: "ut", reiseKilde: "manuell", lonnsartId: "lr", fraTid: "06:25", tilTid: "07:00", timer: "0.58", pauseMin: 0, byggeplassId: "bA1", byggeplassNavn: "A sør", ...over });
  const visMed = (sedler: AttSedel[], prosjektKontekst?: ReadonlySet<string>) =>
    render(
      <AttesteringTabell
        dager={byggAttesteringModell(sedler, deps)}
        orgId="org1"
        readOnly={false}
        verktoy={<span />}
        sedelUrl={(id) => `/sedel/${id}`}
        onReturnerDag={() => {}}
        prosjektKontekst={prosjektKontekst}
      />,
    );
  const aapne = (c: HTMLElement) => { fireEvent.click(dagsrad(c)); return c.querySelector("[data-registrering]") as HTMLElement; };
  const del8 = (p: HTMLElement) => p.querySelector('[data-del="8"]') as HTMLElement;
  const penn = (p: HTMLElement) => within(del8(p)).queryByRole("button", { name: "timer.attestering.reiseRett.tittel" });
  const vindu = () => document.querySelector("[data-reise-rett-vindu]") as HTMLElement;
  const lagre = () => fireEvent.click(within(vindu()).getByRole("button", { name: "handling.lagre" }));
  beforeEach(() => {
    h.data["eksternKostObjekt.list"] = ECO;
    h.data["prosjekt.hentForTimer"] = PROSJEKTER;
    h.data["bygning.hentForFirma"] = BYGGEPLASSER;
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }, { id: "lr", navn: "Reise", satsEnhet: null }];
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [] };
  });
  afterEach(() => {
    for (const k of ["eksternKostObjekt.list", "prosjekt.hentForTimer", "bygning.hentForFirma", "organisasjon.hentArbeidstidDefaults"]) delete h.data[k];
  });

  it("reiselinja er tekst «fra–til · lønnsart · prosjekt · byggeplass · underprosjekt» uten åpne felt og uten «Føres på»", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    const p = aapne(container);
    const d8 = del8(p);
    expect(d8.querySelector("[data-reise-tekst]")!.textContent).toBe("06:25–07:00 · Ordinær · 1001 Prosjekt A · A sør · timer.prosjektkort.utenUnderprosjekt");
    expect(d8.querySelectorAll("input, select")).toHaveLength(0);
    expect(d8.querySelector("[data-fores-paa]")).toBeNull();
    expect(penn(p)).toBeTruthy();
  });

  it("✎ åpner vinduet med start, slutt, prosjekt, byggeplass og underprosjekt, og linja «havner i»", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    const v = vindu();
    expect((within(v).getByLabelText("timer.attestering.reiseRett.start") as HTMLInputElement).value).toBe("06:25");
    expect((within(v).getByLabelText("timer.attestering.reiseRett.slutt") as HTMLInputElement).value).toBe("07:00");
    expect((within(v).getByLabelText("timer.felt.prosjekt") as HTMLSelectElement).value).toBe("pA");
    expect(within(v).getByText("timer.felt.byggeplass")).toBeTruthy();
    expect(within(v).getByText("timer.attestering.registrering.underprosjekt")).toBeTruthy();
    expect(within(v).getAllByRole("button").some((b) => b.textContent?.includes("Tak"))).toBe(true);
    expect(v.querySelector("[data-havner-i]")).toBeTruthy();
  });

  it("prosjektlista har bare prosjektene attestanten kan attestere", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })], new Set(["pA", "pB"]));
    fireEvent.click(penn(aapne(container))!);
    const valg = Array.from((within(vindu()).getByLabelText("timer.felt.prosjekt") as HTMLSelectElement).options).map((o) => o.value);
    expect(valg).toEqual(["pA", "pB"]);
  });

  it("bytte av prosjekt: ett rettRadFelt-kall med prosjekt, foreslått byggeplass og tømt underprosjekt", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise({ externalCostObjectId: "e1" })] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.change(within(vindu()).getByLabelText("timer.felt.prosjekt"), { target: { value: "pB" } });
    lagre();
    expect(kallTil("flyttTimerRadEco")).toHaveLength(0);
    expect(kallTil("rettRadFelt").map((k) => k.input)).toEqual([
      { radType: "timer", radId: "r1", felter: { projectId: "pB", byggeplassId: "bB1", externalCostObjectId: null } },
    ]);
  });

  it("ny tid: ett rettRadFelt-kall med fra, til og timer", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.change(within(vindu()).getByLabelText("timer.attestering.reiseRett.slutt"), { target: { value: "07:25" } });
    lagre();
    expect(kallTil("rettRadFelt").map((k) => k.input)).toEqual([{ radType: "timer", radId: "r1", felter: { fraTid: "06:25", tilTid: "07:25", timer: 1 } }]);
  });

  it("bare underprosjektet endret: flyttTimerRadEco som før, uten helJobb", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise({ externalCostObjectId: "e1" })] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.click(within(vindu()).getAllByRole("button").find((b) => b.textContent?.includes("Tak"))!);
    lagre();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    expect(kallTil("flyttTimerRadEco").map((k) => k.input)).toEqual([{ timerRadId: "r1", radType: "timer", externalCostObjectId: "e2" }]);
  });

  it("«Avbryt» sender ingenting", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.change(within(vindu()).getByLabelText("timer.felt.prosjekt"), { target: { value: "pB" } });
    fireEvent.click(within(vindu()).getByRole("button", { name: "handling.avbryt" }));
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    expect(kallTil("flyttTimerRadEco")).toHaveLength(0);
  });

  it("firmavalget av: bare underprosjektet er åpent, og det lagres med flyttTimerRadEco", () => {
    const { container } = visMed([sedel({ redigerTillatt: false, timer: [timer("t1"), reise({ externalCostObjectId: "e1" })] })]);
    fireEvent.click(penn(aapne(container))!);
    const v = vindu();
    for (const navn of ["timer.attestering.reiseRett.start", "timer.attestering.reiseRett.slutt", "timer.felt.prosjekt", "timer.felt.byggeplass"]) {
      expect((within(v).getByLabelText(navn) as HTMLInputElement).disabled).toBe(true);
    }
    expect(v.textContent).toContain("timer.attestering.reiseRett.bareUnderprosjekt");
    fireEvent.click(within(v).getAllByRole("button").find((b) => b.textContent?.includes("Tak"))!);
    lagre();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    expect(kallTil("flyttTimerRadEco").map((k) => k.input)).toEqual([{ timerRadId: "r1", radType: "timer", externalCostObjectId: "e2" }]);
  });

  it("en attestert reise har ingen ✎", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise({ attestertStatus: "attestert" })] })]);
    expect(penn(aapne(container))).toBeNull();
  });

  it("lagret: vinduet lukkes og tabellen hentes på nytt — ingen melding", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.change(within(vindu()).getByLabelText("timer.felt.prosjekt"), { target: { value: "pB" } });
    lagre();
    act(() => kallTil("rettRadFelt")[0]!.opts!.onSuccess!(undefined));
    expect(vindu()).toBeNull();
  });

  // RETUR w15f (B48 A): reise uten underprosjekt i en jobb med underprosjekt — «Rediger jobben» tar
  // bare rader med samme underprosjekt, så lønnsarten må kunne rettes i «Rett reisen».
  it("RETUR w15f — lønnsarten (bare reisearter) rettes i vinduet når jobben har underprosjekt og reisen ikke", () => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }, { id: "lr", navn: "Reise", satsEnhet: null }, { id: "lr2", navn: "Reise sone 2", satsEnhet: null }];
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [{ lonnsartId: "lr2" }] };
    const { container } = visMed([sedel({ timer: [timer("t1", { externalCostObjectId: "e1" }), reise({ externalCostObjectId: null })] })]);
    fireEvent.click(penn(aapne(container))!);
    const art = within(vindu()).getByLabelText("timer.attestering.registrering.lonnsart") as HTMLSelectElement;
    expect(art.value).toBe("lr");
    expect(Array.from(art.options).map((o) => o.value)).toEqual(["lr", "lr2"]);
    fireEvent.change(art, { target: { value: "lr2" } });
    lagre();
    expect(kallTil("flyttTimerRadEco")).toHaveLength(0);
    expect(kallTil("rettRadFelt").map((k) => k.input)).toEqual([{ radType: "timer", radId: "r1", felter: { lonnsartId: "lr2" } }]);
  });

  it("RETUR w15f — firmavalget av: lønnsarten er låst", () => {
    const { container } = visMed([sedel({ redigerTillatt: false, timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    expect((within(vindu()).getByLabelText("timer.attestering.registrering.lonnsart") as HTMLSelectElement).disabled).toBe(true);
  });

  it("RETUR w15f (merknad) — urørt tid rundes ikke: et rent underprosjektbytte sender ingen ny tid", () => {
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [], tidsrundingMinutter: 15 };
    const { container } = visMed([sedel({ timer: [timer("t1"), reise({ externalCostObjectId: "e1" })] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.click(within(vindu()).getAllByRole("button").find((b) => b.textContent?.includes("Tak"))!);
    lagre();
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    expect(kallTil("flyttTimerRadEco").map((k) => k.input)).toEqual([{ timerRadId: "r1", radType: "timer", externalCostObjectId: "e2" }]);
  });

  it("RETUR w15f (merknad) — rørt tid rundes som før", () => {
    h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [], tidsrundingMinutter: 15 };
    const { container } = visMed([sedel({ timer: [timer("t1"), reise()] })]);
    fireEvent.click(penn(aapne(container))!);
    fireEvent.change(within(vindu()).getByLabelText("timer.attestering.reiseRett.slutt"), { target: { value: "07:20" } });
    lagre();
    expect(kallTil("rettRadFelt").map((k) => k.input)).toEqual([{ radType: "timer", radId: "r1", felter: { fraTid: "06:25", tilTid: "07:15", timer: expect.any(Number) } }]);
  });
});

/* ------------------------------------------------------------------ */
/*  w15g — kortet i informasjonsstatus: ✎ pr. linje (plan § 4.15 del H pkt. 32) */
/* ------------------------------------------------------------------ */

import { linjeRettKall } from "@/components/attestering/LinjeRettVindu";

describe("w15g (pkt. 32) — kortet er tekst; ✎ på hver ventende linje åpner vinduet", () => {
  const M = { id: "m1", vehicleId: "v1", timer: "3", mengde: null, enhet: null, kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", timerRadId: null } as never;
  const G = { id: "g1", tilleggId: "x", antall: "1", kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", externalCostObjectId: null } as never;
  const aapne = (c: HTMLElement) => { fireEvent.click(dagsrad(c)); return c.querySelector("[data-registrering]") as HTMLElement; };
  const medAlt = (over: Partial<AttSedel> = {}) => sedel({ maskiner: [M], tillegg: [G], ...over });

  it("ingen felt i kortet; ✎ på timelinja, maskinlinja og tillegget; «Rediger jobben», «Del opp», ✂ og underprosjektet står", () => {
    const panel = aapne(vis([medAlt()]).container);
    expect(panel.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(Array.from(panel.querySelectorAll("[data-linje-penn]")).map((b) => b.getAttribute("data-linje-penn"))).toEqual(["timer", "maskin", "tillegg"]);
    expect(within(panel).getByRole("button", { name: /registrering\.redigerJobben/ })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: /registrering\.delOpp/ })).toBeTruthy();
    expect(within(panel).getAllByRole("button", { name: "timer.attestering.meny.splittRad" }).length).toBeGreaterThan(0);
    expect(within(panel).getByText("timer.attestering.registrering.underprosjekt")).toBeTruthy();
  });

  it("maskinlinja: timer rettes i vinduet og sendes som én retting ved «Lagre»", () => {
    const v = aapnePenn(aapne(vis([medAlt()]).container), '[data-maskinlinje="m1"]');
    expect(v.getAttribute("data-linje-rett-vindu")).toBe("maskin");
    const tall = within(v).getByLabelText("timer.eksport.kolMaskintimer") as HTMLInputElement;
    expect(tall.value).toBe("3");
    fireEvent.change(tall, { target: { value: "4,5" } });
    fireEvent.blur(tall);
    expect(kallTil("rettRadFelt")).toHaveLength(0);
    lagreVindu();
    expect(kallTil("rettRadFelt")[0]!.input).toEqual({ radType: "maskin", radId: "m1", felter: { timer: 4.5 } });
  });

  it("maskinlinja over «høyst»: «Lagre» er sperret og ingenting sendes", () => {
    const v = aapnePenn(aapne(vis([medAlt()]).container), '[data-maskinlinje="m1"]');
    fireEvent.change(within(v).getByLabelText("timer.eksport.kolMaskintimer"), { target: { value: "9" } });
    const lagre = within(v).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
    expect(lagre.disabled).toBe(true);
    fireEvent.click(lagre);
    expect(kallTil("rettRadFelt")).toHaveLength(0);
  });

  it("tillegget: antall rettes i vinduet og sendes som én retting ved «Lagre»", () => {
    const v = aapnePenn(aapne(vis([medAlt()]).container), "[data-tilleggslinje]");
    expect(v.getAttribute("data-linje-rett-vindu")).toBe("tillegg");
    fireEvent.change(within(v).getByLabelText("timer.eksport.kolAntall"), { target: { value: "2" } });
    lagreVindu();
    expect(kallTil("rettRadFelt")[0]!.input).toEqual({ radType: "tillegg", radId: "g1", felter: { antall: 2 } });
  });

  it("firmavalget av, attestert linje eller attestert-fanen: ingen ✎ på arbeid, maskin og tillegg", () => {
    for (const [s, ro] of [
      [medAlt({ redigerTillatt: false }), false],
      [medAlt({ timer: [timer("t1", { attestertStatus: "attestert" })], maskiner: [{ ...(M as object), attestertStatus: "attestert" } as never], tillegg: [{ ...(G as object), attestertStatus: "attestert" } as never] }), false],
      [medAlt(), true],
    ] as const) {
      const { container, unmount } = vis([s], ro);
      expect(aapne(container).querySelector("[data-linje-penn]")).toBeNull();
      unmount();
    }
  });

  it("linjeRettKall: urørt → ingenting; tid og lønnsart i ett kall; ugyldig tall → feil", () => {
    const tl = { type: "timer" as const, radId: "t1", tittel: "", lagret: { fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, lonnsartId: "l1" }, timebasert: true, lonnsValg: [] };
    expect(linjeRettKall(tl, { type: "uendret" }, { type: "uendret" }, "l1")).toEqual({ type: "ingen" });
    expect(linjeRettKall(tl, { type: "ok", felter: { fraTid: "07:00", tilTid: "16:00", timer: 8.5, pauseMin: 30 } }, { type: "uendret" }, "l2"))
      .toEqual({ type: "rett", felter: { fraTid: "07:00", tilTid: "16:00", timer: 8.5, pauseMin: 30, lonnsartId: "l2" } });
    expect(linjeRettKall(tl, { type: "feil", nokkel: "x" }, { type: "uendret" }, "l1")).toEqual({ type: "feil", nokkel: "x" });
    const tillegg = { type: "tillegg" as const, radId: "g1", tittel: "", antall: 1 };
    expect(linjeRettKall(tillegg, { type: "uendret" }, { type: "feil" }, "")).toEqual({ type: "feil", nokkel: "timer.korrigert.vindu.ugyldigTall" });
    expect(linjeRettKall(tillegg, { type: "uendret" }, { type: "ok", verdi: null }, "")).toEqual({ type: "rett", felter: { antall: null } });
  });
});

describe("A2 (plan § 4.17 punkt 5, B56 A) — hover på prosjektnavnet; hoveren på hele raden er tatt ut (O6)", () => {
  // Hoveren sitter på navnet (Tooltip kobler aria-describedby på triggeren).
  const hoverFor = (el: HTMLElement | null) => {
    const id = (el?.getAttribute("aria-describedby") ?? "").split(" ").find(Boolean);
    const node = id ? document.getElementById(id) : null;
    return node?.querySelector("[data-prosjekt-hover]") ? node : null;
  };
  const navn = (rad: HTMLElement) => rad.querySelector("[data-prosjektnavn]") as HTMLElement | null;
  const blokker = (boks: HTMLElement) =>
    Array.from(boks.querySelectorAll("[data-prosjekt-hover-jobb]")).map((e) => Array.from(e.children).map((c) => c.textContent));
  const medTekst = () =>
    sedel({ timer: [
      timer("t1", { fraTid: "12:00", tilTid: "15:00", timer: "3", pauseMin: 0, beskrivelse: "Forskaling" }),
      timer("t0", { fraTid: "07:00", tilTid: "11:30", timer: "4.5", pauseMin: 0, beskrivelse: "Rigging" }),
      timer("t2", { fraTid: "15:00", tilTid: "16:00", timer: "1", pauseMin: 0, beskrivelse: null }),
    ] });

  afterEach(() => vi.useRealTimers());

  it("dagsraden med én jobb: hover på navnet viser nummer og navn og beskrivelsene i klokkeslett-rekkefølge", () => {
    vi.useFakeTimers();
    const { container } = vis([medTekst()]);
    const boks = hoverFor(navn(dagsrad(container)))!;
    expect(boks.getAttribute("role")).toBe("tooltip");
    expect(blokker(boks)).toEqual([["1001 · Prosjekt A", "timer.felt.radBeskrivelse RiggingForskaling"]]);
    expect(boks.className).toContain("invisible");
    fireEvent.mouseEnter(navn(dagsrad(container))!.parentElement!);
    act(() => { vi.advanceTimersByTime(400); });
    expect(boks.className).not.toContain("invisible");
  });

  it("«Velg parameter» har fortsatt alle kolonnene, også Pr.nr., Underprosjekt og Byggeplass", () => {
    vis([sedel()]);
    const grupper = h.velger.props!.grupper as { felter: { id: string }[] }[];
    const ider = grupper.flatMap((g) => g.felter.map((f) => f.id));
    for (const k of ["prosjekt", "prosjektnummer", "underprosjekt", "byggeplass"]) expect(ider).toContain(k);
    expect(new Set(ider)).toEqual(new Set(TIMER_TABELL_KOL_KEYS));
  });

  it("negativkontroll: raden selv har ingen hover lenger (O6 tatt ut), heller ikke med beskrivelse", () => {
    const { container } = vis([medTekst()]);
    expect(dagsrad(container).hasAttribute("aria-describedby")).toBe(false);
    expect(container.querySelector("[data-beskrivelse-hover]")).toBeNull();
    expect(document.querySelector("[data-beskrivelse-hover]")).toBeNull();
  });

  it("byggeplass og underprosjekt står i hoveren; «↳» ved navnet bare når jobben har underprosjekt", () => {
    const UP = { proAdmId: "100", kortNavn: "Grunn", navn: "Grunnarbeid" };
    const med = vis([sedel({ timer: [timer("t1", { byggeplassNavn: "Tomta", externalCostObjectId: "e1", underprosjekt: UP })] })]);
    const n = navn(dagsrad(med.container))!;
    expect(n.querySelector("[data-underprosjekt-pil]")?.textContent).toBe("↳");
    const tekst = hoverFor(n)!.textContent ?? "";
    expect(tekst).toContain("timer.felt.byggeplass: Tomta");
    expect(tekst).toContain("timer.felt.underprosjekt: ");
    // Linje 2 under navnet er borte; feltet viser bare navnet og pila.
    expect(n.textContent).toBe("Prosjekt A↳");
    med.unmount();
    // Negativkontroll: uten underprosjekt ingen pil, og ingen underprosjekt-linje i hoveren.
    const uten = vis([sedel()]);
    const n2 = navn(dagsrad(uten.container))!;
    expect(n2.querySelector("[data-underprosjekt-pil]")).toBeNull();
    expect(hoverFor(n2)!.textContent).not.toContain("timer.felt.underprosjekt");
  });

  it("flere jobber: hver jobbrad har sin hover; «N jobber» i dagsraden har én blokk pr. jobb", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1", { beskrivelse: "Graving grøft" }),
      timer("t2", { kortId: "kB", fraTid: "15:00", tilTid: "16:00", timer: "1", pauseMin: 0, beskrivelse: null }),
    ] })]);
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    expect(jobb).toHaveLength(2);
    expect(blokker(hoverFor(navn(jobb[0]!))!)).toEqual([["1001 · Prosjekt A", "timer.felt.radBeskrivelse Graving grøft"]]);
    expect(blokker(hoverFor(navn(jobb[1]!))!)).toEqual([["1001 · Prosjekt A"]]);
    const dagHover = hoverFor(dagsrad(container).querySelector("[data-antall-jobber]"))!;
    expect(blokker(dagHover)).toHaveLength(2);
  });

  it("reise i jobben: reisens tekst er ikke med (som i del 3)", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1", { beskrivelse: "Forskaling" }),
      timer("tr", { fraTid: "15:00", tilTid: "15:30", timer: "0.5", pauseMin: 0, beskrivelse: "Kjøring", erReise: true } as Partial<AttTimer>),
    ] })]);
    expect(blokker(hoverFor(navn(dagsrad(container)))!)).toEqual([["1001 · Prosjekt A", "timer.felt.radBeskrivelse Forskaling"]]);
  });
});

describe("O13 — attesteringen etter vedtaksfila § Dagsvisningen pkt 2 og 3", () => {
  const OT = { id: "l2", navn: "Overtid 50 %", satsEnhet: null, overtidsnivaa: 50 };
  const LR = { id: "lr", navn: "Reise", satsEnhet: null, overtidsnivaa: null };
  const UP = { proAdmId: "100", kortNavn: "Grunn", navn: "Grunnarbeid" };
  const reise = (over: Partial<AttTimer> = {}) =>
    timer("r1", { erReise: true, reiseRetning: "ut", lonnsartId: "lr", fraTid: "06:00", tilTid: "07:00", timer: "1", pauseMin: 0, ...over });
  const overtid = (id = "o1", over: Partial<AttTimer> = {}) =>
    timer(id, { lonnsartId: "l2", fraTid: "15:00", tilTid: "17:00", timer: "2", pauseMin: 0, ...over });
  const medOppsett = (kolonner: string[]) => {
    h.data["bruker.hentTabelloppsett"] = { kolonner, rekkefolge: true, bredder: {}, sortering: null };
  };
  // Sum-radens celle for kolonnen: hodets rekkefølge, navnefeltet dekker «span N» kolonner.
  const celle = (rad: HTMLElement, kol: string): HTMLElement | null => {
    const kolonner = Array.from(document.querySelectorAll("[data-kolonne]")).map((e) => e.getAttribute("data-kolonne"));
    const barn = Array.from(rad.children) as HTMLElement[];
    let i = barn[0]?.querySelector('input[type="checkbox"]') || barn[0]?.querySelector("[data-pil]") ? 1 : 0;
    for (let ki = 0; ki < kolonner.length; ) {
      const b = barn[i++];
      if (!b) return null;
      const n = b.hasAttribute("data-navnefelt") || b.hasAttribute("data-lonnsartfelt") ? Number(/span (\d+)/.exec(b.style.gridColumn)![1]) : 1;
      if (kolonner.slice(ki, ki + n).includes(kol)) return n === 1 ? b : null;
      ki += n;
    }
    return null;
  };
  beforeEach(() => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null, overtidsnivaa: null }, OT, LR];
  });
  afterEach(() => { delete h.data["bruker.hentTabelloppsett"]; });

  describe("pkt 1 — prosjektnavnet i dagsrad og jobbrad", () => {
    it("gate A1–A3 vilkår 1: uten Prosjekt, Pr.nr. og Underprosjekt står navnet likevel i dags- og jobbraden", () => {
      medOppsett(["dato", "ansatt", "betegnelse", "fraTil", "timer", "avvik"]);
      const { container } = vis([
        sedel({ timer: [timer("t1"), timer("t2", { kortId: "kB", projectId: "pB", project: { id: "pB", name: "Prosjekt B", internalProjectNumber: "1002", projectNumber: "SD-2" } })] }),
      ]);
      // Lønnsartfeltet beholder Betegnelse og Fra–til; navnet står under ansattnavnet.
      expect((dagsrad(container).querySelector("[data-lonnsartfelt]") as HTMLElement).style.gridColumn).toBe("span 2");
      expect(dagsrad(container).textContent).toContain("Kari Nordmann");
      // To jobber: dagsraden viser «N jobber» (under ansattnavnet), jobbradene navnet.
      expect(dagsrad(container).textContent).toContain("timer.attestering.tabell.antallJobber");
      const jobber = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
      expect(jobber.map((j) => j.querySelector("[data-prosjektnavn]")?.firstElementChild?.textContent)).toEqual(["Prosjekt A", "Prosjekt B"]);
    });

    it("én jobb: navnet halvfet med «↳» for underprosjekt, ingen linje 2, i Prosjekt-kolonnen (A2)", () => {
      const { container } = vis([sedel({ timer: [timer("t1", { byggeplassNavn: "A sør", externalCostObjectId: "e1", underprosjekt: UP })] })]);
      const navn = dagsrad(container).querySelector("[data-prosjektnavn]") as HTMLElement;
      expect(navn).toBeTruthy();
      expect(navn.firstElementChild!.textContent).toBe("Prosjekt A");
      expect(navn.firstElementChild!.className).toContain("font-semibold");
      expect(navn.firstElementChild!.className).toContain("truncate");
      expect(navn.children[1]!.textContent).toBe("↳");
      expect(navn.textContent).not.toContain("A sør");
      const felt = dagsrad(container).querySelector("[data-navnefelt]") as HTMLElement;
      expect(felt.style.gridColumn).toBe("span 1");
      // A1: Betegnelse og Fra–til bærer lønnsartmerkene.
      expect((dagsrad(container).querySelector("[data-lonnsartfelt]") as HTMLElement).style.gridColumn).toBe("span 2");
    });

    it("uten byggeplass og underprosjekt: bare navnet", () => {
      const { container } = vis([sedel()]);
      const navn = dagsrad(container).querySelector("[data-prosjektnavn]") as HTMLElement;
      expect(navn.children).toHaveLength(1);
      expect(navn.textContent).toBe("Prosjekt A");
    });

    it("flere jobber: «N jobber» grått der navnefeltet begynner, hver jobbrad har sitt navn", () => {
      const { container } = vis([toProsjekter()]);
      const felt = dagsrad(container).querySelector("[data-navnefelt]") as HTMLElement;
      expect(felt.querySelector("[data-antall-jobber]")!.textContent).toBe('timer.attestering.tabell.antallJobber{"count":2}');
      expect(felt.querySelector("[data-antall-jobber]")!.className).toContain("text-gray-500");
      const jobb = container.querySelectorAll('[data-rad="jobb"]');
      expect(jobb[0]!.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
      expect(jobb[1]!.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt B");
    });
  });

  it("pkt 1 — én jobb og kort med bare reise: «1 jobb · 1 reise» (O15 pkt 5, beslutning c)", () => {
    const { container } = vis([sedel({ timer: [timer("t1"), reise({ projectId: "pB", project: Q, kortId: "kB" })] })]);
    expect(container.querySelectorAll('[data-rad="jobb"]').length).toBe(2);
    expect(dagsrad(container).querySelector("[data-antall-jobber]")!.textContent).toBe(
      'timer.attestering.tabell.antallJobber{"count":1} · timer.attestering.tabell.antallReiser{"count":1}',
    );
  });

  describe("pkt 2 — Reise og Overtid som egne kolonner", () => {
    it("dagsraden viser dagens reise og overtid; tomt ved 0", () => {
      const { container } = vis([sedel({ timer: [reise(), timer("t1"), overtid()] })]);
      const dag = dagsrad(container);
      expect(dag.querySelector('[data-tall="reise"]')!.textContent).toBe("1,00");
      expect(dag.querySelector('[data-tall="overtid"]')!.textContent).toBe("2,00");
      cleanup();
      const uten = vis([sedel()]);
      expect(dagsrad(uten.container).querySelector('[data-tall="reise"]')).toBeNull();
      expect(dagsrad(uten.container).querySelector('[data-tall="overtid"]')).toBeNull();
    });

    it("jobbraden viser jobbens reise og overtid; dagens sum er uendret", () => {
      const s = sedel({ timer: [timer("t1"), overtid("o1"), timer("t2", { projectId: "pB", project: Q, kortId: "kB" })] });
      const { container } = vis([s]);
      const jobb = container.querySelectorAll('[data-rad="jobb"]');
      expect(jobb[0]!.querySelector('[data-tall="overtid"]')!.textContent).toBe("2,00");
      expect(jobb[1]!.querySelector('[data-tall="overtid"]')).toBeNull();
      expect(dagsrad(container).querySelector('[data-tall="overtid"]')!.textContent).toBe("2,00");
      expect(dagsrad(container).textContent).toContain("17,00");
    });

    it("bare lønnsart med overtidsnivå 50/100 teller som overtid", () => {
      h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null, overtidsnivaa: null }, { ...OT, overtidsnivaa: null }];
      const { container } = vis([sedel({ timer: [timer("t1"), overtid()] })]);
      expect(dagsrad(container).querySelector('[data-tall="overtid"]')).toBeNull();
    });

    it("Reise og Overtid står tomme på linjene (R8)", () => {
      const { container } = vis([sedel({ timer: [reise(), timer("t1"), overtid()] })]);
      for (const n of ["s1:timer:t1", "s1:timer:o1", "s1:reise:r1"]) {
        expect(linje(container, n).querySelector("[data-tall]")?.closest(`[data-kol="reisetimer"],[data-kol="overtid"]`) ?? null).toBeNull();
      }
    });
  });

  describe("pkt 3 — lønnsartmerket på overtids- og reiselinja", () => {
    it("overtid lilla, reise blå, timetallet i samme farge; ordinær linje uten merke", () => {
      const { container } = vis([sedel({ timer: [reise(), timer("t1"), overtid()] })]);
      const ot = linje(container, "s1:timer:o1");
      expect(ot.querySelector('[data-lonnsart-merke="overtid"]')!.className).toContain("violet");
      expect(ot.querySelector('[data-tall="overtid"]')!.className).toContain("text-violet-700");
      const r = linje(container, "s1:reise:r1");
      expect(r.querySelector('[data-lonnsart-merke="reise"]')!.className).toContain("sky");
      expect(r.querySelector('[data-tall="reise"]')!.className).toContain("text-sky-700");
      expect(linje(container, "s1:timer:t1").querySelector("[data-lonnsart-merke]")).toBeNull();
    });

    it("reisenavnet kuttes ikke: Betegnelse spenner over de tomme cellene foran (B14c B)", () => {
      const { container } = vis([sedel({ timer: [reise(), timer("t1")] })]);
      const felt = linje(container, "s1:reise:r1").querySelector("[data-linjefelt]") as HTMLElement;
      expect(felt).toBeTruthy();
      expect(felt.querySelector('[data-lonnsart-merke="reise"]')).toBeTruthy();
    });

    it("ReiseRadMerke står ikke i tabellcella (R6), men i registreringen (del 8)", () => {
      h.data["organisasjon.hentArbeidstidDefaults"] = { reiseLonnsartId: "lr", reiseGrenser: [] };
      const { container } = vis([sedel({ timer: [reise(), timer("t1")] })]);
      expect(linje(container, "s1:reise:r1").textContent).not.toContain("reise-merke");
      fireEvent.click(dagsrad(container));
      const panel = container.querySelector("[data-registrering]") as HTMLElement;
      expect(panel.textContent).toContain("reise-merke");
      delete h.data["organisasjon.hentArbeidstidDefaults"];
    });

    it("merket gjelder også i sortert liste (R8)", () => {
      h.data["bruker.hentTabelloppsett"] = { kolonner: ["dato", "betegnelse", "timer"], rekkefolge: true, bredder: {}, sortering: { kolonne: "timer", retning: "asc" } };
      const { container } = vis([sedel({ timer: [timer("t1"), overtid()] })]);
      expect(container.querySelector('[data-lonnsart-merke="overtid"]')).toBeTruthy();
    });
  });

  it("pkt 4 — Timer-kolonnen har plass til «11,50» halvfet", () => {
    const kilde = readFileSync(resolve(__dirname, "../components/attestering/AttesteringTabell.tsx"), "utf8");
    const m = /\n  timer: (\d+),/.exec(kilde.slice(kilde.indexOf("const ATTESTERING_BREDDE")));
    expect(Number(m![1])).toBeGreaterThanOrEqual(60);
  });

  describe("R2 — navnefeltet følger brukerens kolonneoppsett", () => {
    it("skjult Pr.nr.: feltet dekker Underprosjekt; lønnsartfeltet Betegnelse og Fra–til (A1)", () => {
      // Avvik synlig: med Avvik skjult bærer Betegnelse avviket og står utenfor feltet (vilkår 1, under).
      medOppsett(["dato", "ansatt", "underprosjekt", "betegnelse", "fraTil", "timer", "avvik"]);
      const { container } = vis([sedel()]);
      expect((dagsrad(container).querySelector("[data-navnefelt]") as HTMLElement).style.gridColumn).toBe("span 1");
      expect((dagsrad(container).querySelector("[data-lonnsartfelt]") as HTMLElement).style.gridColumn).toBe("span 2");
    });

    it("flyttet kolonne mellom: feltet stopper der; Betegnelse og Fra–til bærer lønnsartmerkene (A1)", () => {
      medOppsett(["dato", "ansatt", "prosjektnummer", "underprosjekt", "timer", "betegnelse", "fraTil"]);
      const { container } = vis([sedel()]);
      const dag = dagsrad(container);
      expect((dag.querySelector("[data-navnefelt]") as HTMLElement).style.gridColumn).toBe("span 2");
      const lf = dag.querySelector("[data-lonnsartfelt]") as HTMLElement;
      expect(lf.style.gridColumn).toBe("span 2");
      expect(lf.textContent).toBe("Ordinær 7,5");
    });

    it("ingen av de fire synlige: første tekstkolonne etter Ansatt", () => {
      medOppsett(["dato", "ansatt", "timer", "aktivitet", "maskin"]);
      const { container } = vis([sedel()]);
      const dag = dagsrad(container);
      expect(dag.querySelector("[data-navnefelt]")).toBeNull();
      expect(celle(dag, "aktivitet")!.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
    });

    it("ingen tekstkolonne etter Ansatt: under navnet i Ansatt-cella", () => {
      medOppsett(["dato", "ansatt", "timer"]);
      const { container } = vis([sedel()]);
      const a = celle(dagsrad(container), "ansatt")!;
      expect(a.textContent).toContain("Kari Nordmann");
      expect(a.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
    });

    // Gate O13 trinn 2, vilkår 1: med Avvik skjult bærer Betegnelse avviket (som på 360c35a0).
    it("Avvik skjult → sperre og normmerke står i dagsraden og jobbraden (i Betegnelse, utenfor feltet)", () => {
      medOppsett(["dato", "ansatt", "prosjektnummer", "underprosjekt", "betegnelse", "fraTil", "timer"]);
      const en = vis([sedel({ id: "sperret", dagsnorm: 7.5, timer: [timer("t1", { timer: "8" })] })]);
      const dag = dagsrad(en.container);
      expect((dag.querySelector("[data-navnefelt]") as HTMLElement).style.gridColumn).toBe("span 2");
      expect(dag.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
      // A1: Betegnelse og Fra–til er lønnsartfeltet; avviket står etter lønnsartmerkene.
      const b = dag.querySelector("[data-lonnsartfelt]") as HTMLElement;
      expect(b.textContent).toContain("Ordinær 8");
      expect(b.textContent).toContain("Fravær over dagsnorm");
      expect(b.textContent).toContain('normMerke{"avvik":"+0,5"}');
      cleanup();
      // Flere jobber: Betegnelse er cella rett etter feltet (span 2 over Pr.nr. og Underprosjekt).
      const etterFeltet = (rad: HTMLElement) => {
        const felt = rad.querySelector("[data-navnefelt]") as HTMLElement;
        expect(felt.style.gridColumn).toBe("span 2");
        return felt.nextElementSibling as HTMLElement;
      };
      const to = vis([{ ...toProsjekter(), id: "sperret" }]);
      expect(etterFeltet(dagsrad(to.container)).textContent).toContain("Fravær over dagsnorm");
      const jobber = Array.from(to.container.querySelectorAll<HTMLElement>('[data-rad="jobb"]'));
      expect(jobber).toHaveLength(2);
      for (const j of jobber) {
        expect(j.querySelector("[data-prosjektnavn]")).toBeTruthy();
        expect(etterFeltet(j).textContent).toContain("Fravær over dagsnorm");
      }
    });

    it("Avvik skjult og bare Betegnelse av de fire: navnet i neste tekstkolonne, avviket i Betegnelse", () => {
      medOppsett(["dato", "ansatt", "betegnelse", "aktivitet", "timer"]);
      const { container } = vis([sedel({ id: "sperret" })]);
      const dag = dagsrad(container);
      expect(dag.querySelector("[data-navnefelt]")).toBeNull();
      expect(celle(dag, "aktivitet")!.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
      expect(celle(dag, "betegnelse")!.textContent).toContain("Fravær over dagsnorm");
    });

    it("A2: Prosjekt bærer navnefeltet; Byggeplass og Pr.nr. utenfor feltet står tomme i dagsrad og jobbrad", () => {
      medOppsett(["dato", "ansatt", "prosjekt", "byggeplass", "prosjektnummer", "betegnelse", "timer"]);
      const { container } = vis([toProsjekter()]);
      for (const rad of [dagsrad(container), ...Array.from(container.querySelectorAll<HTMLElement>('[data-rad="jobb"]'))]) {
        expect(celle(rad, "prosjekt")!.hasAttribute("data-navnefelt")).toBe(true);
        expect(celle(rad, "byggeplass")?.textContent ?? "").toBe("");
        expect(celle(rad, "prosjektnummer")?.textContent ?? "").toBe("");
      }
    });
  });

  it("R4 — «Etter prosjekt» får samme navnefelt og Reise/Overtid", () => {
    const { container } = visMed([sedel({ timer: [timer("t1"), overtid()] })], { gruppering: "prosjekt" });
    const rad = container.querySelector('[data-rad="dag"]') as HTMLElement;
    expect(rad.querySelector("[data-prosjektnavn]")!.textContent).toBe("Prosjekt A");
    expect(rad.querySelector('[data-tall="overtid"]')!.textContent).toBe("2,00");
  });

  it("R5 — kort med bare reise: Timer = reisetimene, Reise = det samme, ingen «Reise»-etikett", () => {
    const { container } = vis([toProsjekter(), sedel({ id: "s2", dato: "2026-11-17", timer: [timer("t3"), reise({ projectId: "pB", project: Q, kortId: "kB" })] })]);
    const jobb = Array.from(container.querySelectorAll<HTMLElement>('[data-rad="jobb"]')).find((j) => j.querySelector('[data-tall="reise"]'))!;
    expect(jobb.querySelector('[data-tall="reise"]')!.textContent).toBe("1,00");
    expect(celle(jobb, "timer")!.textContent).toBe("1,00");
    expect(jobb.textContent).not.toContain("timer.attestering.tabell.type.reise");
  });
});

describe("O13-tillegg — bredden og navnet «Reise»", () => {
  it("attesteringssiden har ikke sidebeholderens tak (max-w-7xl); firma-timer-layouten har det fortsatt", () => {
    const side = readFileSync(resolve(__dirname, "../app/dashbord/attestering/page.tsx"), "utf8");
    expect(side).not.toMatch(/className="[^"]*max-w-7xl/);
    expect(side).toMatch(/return \(\n    <div className="min-w-0">/);
    const firmaTimer = readFileSync(resolve(__dirname, "../app/dashbord/firma/timer/layout.tsx"), "utf8");
    expect(firmaTimer).toMatch(/mx-auto max-w-7xl/);
  });

  it("«Velg parameter» viser «Reisetimer» for tallkolonnen og «Reise» for eksportens ja/nei-kolonne; overskriften er «Reise»", () => {
    const { container } = vis([sedel()]);
    const grupper = h.velger.props!.grupper as { felter: { id: string; navn: string }[] }[];
    const navn = Object.fromEntries(grupper[0]!.felter.map((f) => [f.id, f.navn]));
    expect(navn.reisetimer).toBe("timer.eksport.kolReisetimerVelger");
    expect(navn.reise).toBe("timer.eksport.kolReise");
    expect(navn.reisetimer).not.toBe(navn.reise);
    expect(container.querySelector('[data-kolonne="reisetimer"]')!.textContent).toContain("timer.eksport.kolReisetimer");
    expect(container.querySelector('[data-kolonne="reisetimer"]')!.textContent).not.toContain("Velger");
  });
});

describe("O15 — «Del opp» og attesteringen etter Kenneths test på 722d394b", () => {
  const LR = { id: "lr", navn: "Reise", satsEnhet: null, overtidsnivaa: null };
  const UT = { erReise: true, reiseRetning: "ut", lonnsartId: "lr", fraTid: "06:26", tilTid: "06:56", timer: "0.5", pauseMin: 0 } as Partial<AttTimer>;
  const ARBEID_REISE = { arbeidReiseRetning: "ut", fraTid: "06:26", tilTid: "06:56", timer: "0.5", pauseMin: 0 } as Partial<AttTimer>;
  beforeEach(() => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null, overtidsnivaa: null }, LR];
  });
  afterEach(() => vi.useRealTimers());

  const aapneDelOpp = () => {
    vi.useFakeTimers();
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    const panel = container.querySelector("[data-registrering]") as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: /registrering\.delOpp/ }));
    const skjema = panel.querySelector("[data-del-opp]") as HTMLElement;
    const kl = within(skjema).getByPlaceholderText("11:00") as HTMLInputElement;
    return { skjema, kl };
  };

  it("pkt 1 — maskinen får A/B-felt med forslaget; retter du A, blir B resten; «Del opp» sender delingen", () => {
    const { skjema, kl } = aapneDelOpp();
    fireEvent.change(kl, { target: { value: "10:00" } });
    act(() => { vi.advanceTimersByTime(400); });
    vi.useRealTimers();
    const fv = kallTil("delJobb");
    act(() => fv[0]!.opts!.onSuccess!({ forhandsvisning: {
      timerA: 3, timerB: 4.5, maskinPaaA: 1,
      maskiner: [{ id: "m1", navn: "Volvo EC250", timer: 4.5, timerA: 3, timerB: 1.5 }],
    } }));
    const rad = skjema.querySelector('[data-maskin-deling="m1"]') as HTMLElement;
    expect(rad).toBeTruthy();
    const [a, b] = within(rad).getAllByRole("textbox") as HTMLInputElement[];
    expect(a!.value).toBe("3,00");
    expect(b!.value).toBe("1,50");
    fireEvent.change(a!, { target: { value: "2" } });
    expect(b!.value).toBe("2,50");
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ });
    fireEvent.click(knapper[knapper.length - 1]!);
    const alle = kallTil("delJobb");
    expect(alle[alle.length - 1]!.input).toEqual({
      sheetId: "s1", kortId: "kA", kl: "10:00", externalCostObjectIdB: null,
      maskinDeling: [{ id: "m1", timerA: 2, timerB: 2.5 }],
    });
  });

  it("pkt 1 (RETUR trinn 2) — tømt maskinfelt: blur sender ingenting, ingen rød servertekst, «Del opp» sperret", () => {
    const { skjema, kl } = aapneDelOpp();
    fireEvent.change(kl, { target: { value: "10:00" } });
    act(() => { vi.advanceTimersByTime(400); });
    vi.useRealTimers();
    act(() => kallTil("delJobb")[0]!.opts!.onSuccess!({ forhandsvisning: {
      timerA: 3, timerB: 4.5, maskinPaaA: 1,
      maskiner: [{ id: "m1", navn: "Volvo EC250", timer: 4.5, timerA: 3, timerB: 1.5 }],
    } }));
    const rad = skjema.querySelector('[data-maskin-deling="m1"]') as HTMLElement;
    const [a] = within(rad).getAllByRole("textbox") as HTMLInputElement[];
    const foer = kallTil("delJobb").length;
    fireEvent.change(a!, { target: { value: "" } });
    fireEvent.blur(a!);
    expect(kallTil("delJobb")).toHaveLength(foer);
    expect(skjema.querySelector("p.text-red-600")).toBeNull();
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ }) as HTMLButtonElement[];
    expect(knapper[knapper.length - 1]!.disabled).toBe(true);
    // Gyldig igjen: blur forhåndsviser med delingen.
    fireEvent.change(a!, { target: { value: "2" } });
    fireEvent.blur(a!);
    const siste = kallTil("delJobb")[kallTil("delJobb").length - 1]!;
    expect(siste.input).toMatchObject({ forhandsvis: true, maskinDeling: [{ id: "m1", timerA: 2, timerB: 2.5 }] });
  });

  it("pkt 3 — «10» tolkes som 10:00, forhåndsvises og skrives om til TT:MM", () => {
    const { skjema, kl } = aapneDelOpp();
    fireEvent.change(kl, { target: { value: "10" } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(kallTil("delJobb")[0]!.input).toMatchObject({ kl: "10:00", forhandsvis: true });
    fireEvent.blur(kl);
    expect(kl.value).toBe("10:00");
    expect(skjema.querySelector("[data-kl-feil]")).toBeNull();
  });

  it("pkt 3 — ukjent skrivemåte: rød tekst med eksempel, ingen forhåndsvisning, «Del opp» av", () => {
    const { skjema, kl } = aapneDelOpp();
    fireEvent.change(kl, { target: { value: "10" } });
    act(() => { vi.advanceTimersByTime(400); });
    act(() => kallTil("delJobb")[0]!.opts!.onSuccess!({ forhandsvisning: {
      timerA: 3, timerB: 4.5, maskinPaaA: 1, maskiner: [{ id: "m1", navn: "Volvo", timer: 5, timerA: 3, timerB: 2 }],
    } }));
    expect(skjema.textContent).toContain("3,00 t");
    h.kall.length = 0;
    fireEvent.change(kl, { target: { value: "10.3" } });
    // Forrige tids forhåndsvisning står ikke igjen.
    expect(skjema.textContent).not.toContain("3,00 t");
    expect(skjema.querySelector("[data-maskin-deling]")).toBeNull();
    act(() => { vi.advanceTimersByTime(400); });
    expect(kallTil("delJobb")).toHaveLength(0);
    fireEvent.blur(kl);
    expect(skjema.querySelector("[data-kl-feil]")!.textContent).toBe("timer.attestering.registrering.klokkeslettFeil");
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ }) as HTMLButtonElement[];
    expect(knapper[knapper.length - 1]!.disabled).toBe(true);
  });

  it("pkt 4 — reise ført som arbeidstid: «Reise · Ordinær» i Betegnelse, timene i Timer", () => {
    const { container } = vis([sedel({ timer: [timer("t1"), timer("t2", ARBEID_REISE)] })]);
    fireEvent.click(dagsrad(container));
    const merke = linje(container, "s1:timer:t2").querySelector("[data-reise-arbeid]") as HTMLElement;
    expect(merke).toBeTruthy();
    expect(merke.textContent).toBe("timer.attestering.tabell.type.reise·Ordinær");
    expect(linje(container, "s1:timer:t2").querySelector("[data-tall]")).toBeNull();
  });

  it("pkt 5 — kort med bare reise telles for seg: «2 jobber · 1 reise»; uten reise uendret", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1"), timer("t2", { projectId: "pB", project: Q, kortId: "kB" }),
      timer("r1", { ...UT, kortId: "kR" }),
    ] })]);
    expect(dagsrad(container).querySelector("[data-antall-jobber]")!.textContent).toBe(
      'timer.attestering.tabell.antallJobber{"count":2} · timer.attestering.tabell.antallReiser{"count":1}',
    );
    cleanup();
    const uten = vis([toProsjekter()]).container;
    expect(dagsrad(uten).querySelector("[data-antall-jobber]")!.textContent).toBe('timer.attestering.tabell.antallJobber{"count":2}');
  });

  it("pkt 5 — reise ført som arbeidstid alene i et kort telles også som reise", () => {
    const { container } = vis([sedel({ timer: [timer("t1"), timer("r1", { ...ARBEID_REISE, kortId: "kR" })] })]);
    expect(dagsrad(container).querySelector("[data-antall-jobber]")!.textContent).toBe(
      'timer.attestering.tabell.antallJobber{"count":1} · timer.attestering.tabell.antallReiser{"count":1}',
    );
  });

  it("pkt 6 — Fra–til står hel: faste sifferbredder og bredden satt i ATTESTERING_BREDDE", () => {
    const kilde = readFileSync(resolve(__dirname, "../components/attestering/AttesteringTabell.tsx"), "utf8");
    const m = /\n  fraTil: (\d+),/.exec(kilde.slice(kilde.indexOf("const ATTESTERING_BREDDE")));
    // Målt i lokal dev 2026-11-23: «06:56–07:00» er 85,4 px, cellen har 6 + 6 px padding → minst 98.
    expect(Number(m![1])).toBeGreaterThanOrEqual(98);
    const { container } = vis([sedel()]);
    fireEvent.click(dagsrad(container));
    expect(linje(container, "s1:timer:t1").querySelector("[data-fra-til].tabular-nums")!.textContent).toBe("07:00–15:00");
  });

  it("pkt 7 — kort med bare reise: hover med reiselinja «Til {sted} · 06:26–06:56» og beskrivelsen", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1", { beskrivelse: "Forskaling" }),
      timer("r1", { ...UT, kortId: "kR", beskrivelse: "Henter stillas" }),
    ] })]);
    const jobb = Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
    const hover = jobb.map((r) => {
      // A2: hoveren sitter på prosjektnavnet, ikke på raden.
      const id = (r.querySelector("[data-prosjektnavn]")?.getAttribute("aria-describedby") ?? "").split(" ").find(Boolean);
      const node = id ? document.getElementById(id) : null;
      return node ? Array.from(node.querySelectorAll("[data-beskrivelse]")).map((e) => e.textContent) : [];
    });
    const tekster = hover.find((x) => x[0] !== "Forskaling");
    expect(tekster).toEqual(['timer.prosjektkort.reiseTil{"sted":"Prosjekt A"} · 06:26–06:56', "Henter stillas"]);
  });
});

// O17 (vedtak-timer-web.md § Reisevinduet pkt 21): reise mellom to kontorer vises som «{fra} → {til}».
describe("O17 pkt 21 — kontorreise i attesteringen", () => {
  const LR = { id: "lr", navn: "Reise", satsEnhet: null, overtidsnivaa: null };
  const KONTOR = {
    erReise: true, reiseRetning: "ut", reiseKilde: "overforing", reiseOppmotestedId: "kt", lonnsartId: "lr",
    fraTid: "15:00", tilTid: "18:50", timer: "3.83", pauseMin: 0,
    reiseRegel: { overforing: { fra: { type: "kontor", oppmotestedId: "kt" }, til: { type: "kontor", oppmotestedId: "kn" }, periodeId: "p1" } },
  } as Partial<AttTimer>;
  beforeEach(() => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null, overtidsnivaa: null }, LR];
    h.data["oppmotested.hentForFirma"] = [{ id: "kt", navn: "Tromsø" }, { id: "kn", navn: "Narvik kontor" }];
  });
  afterEach(() => {
    delete h.data["oppmotested.hentForFirma"];
  });
  const hoverTekster = (container: HTMLElement) =>
    (Array.from(container.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[]).map((r) => {
      // A2: hoveren sitter på prosjektnavnet, ikke på raden.
      const id = (r.querySelector("[data-prosjektnavn]")?.getAttribute("aria-describedby") ?? "").split(" ").find(Boolean);
      const node = id ? document.getElementById(id) : null;
      return node ? Array.from(node.querySelectorAll("[data-beskrivelse]")).map((e) => e.textContent) : [];
    });

  it("kort med bare kontorreisen: hover viser «Tromsø → Narvik kontor · 15:00–18:50»", () => {
    const { container } = vis([sedel({ timer: [timer("t1", { beskrivelse: "Forskaling" }), timer("r1", { ...KONTOR, kortId: "kR" })] })]);
    const tekster = hoverTekster(container).find((x) => x[0] !== "Forskaling");
    expect(tekster).toEqual(['timer.prosjektkort.reiseRute{"fra":"Tromsø","til":"Narvik kontor"} · 15:00–18:50']);
  });

  it("vakt: vanlig reise til byggeplass er uendret «Til {sted}»", () => {
    const { container } = vis([sedel({ timer: [
      timer("t1", { beskrivelse: "Forskaling" }),
      timer("r1", { ...KONTOR, reiseRegel: null, kortId: "kR" }),
    ] })]);
    const tekster = hoverTekster(container).find((x) => x[0] !== "Forskaling");
    expect(tekster).toEqual(['timer.prosjektkort.reiseTil{"sted":"Prosjekt A"} · 15:00–18:50']);
  });
});

describe("A1 (plan § 4.17 del A, B51 A) — gult på dagen", () => {
  const arter = [
    { id: "l1", navn: "Ordinær", satsEnhet: null },
    { id: "l2", navn: "Overtid 50 %", satsEnhet: null, overtidsnivaa: 50 },
    { id: "lf", navn: "Sykemelding", satsEnhet: null, type: "fravaer" },
  ];
  const dag = () =>
    sedel({
      timer: [
        timer("t1", { fraTid: "07:00", tilTid: "15:00", timer: "7.5" }),
        timer("t2", { lonnsartId: "l2", fraTid: "15:00", tilTid: "17:00", timer: "2", pauseMin: 0 }),
      ],
    });

  it("linjene er skjult som standard; negativkontroll: slått av vises de", () => {
    lager.clear();
    const en = vis([dag()]);
    expect(en.container.querySelector("[data-linje]")).toBeNull();
    expect((en.getByLabelText("timer.attestering.tabell.bareOversikt") as HTMLInputElement).checked).toBe(true);
    en.unmount();
    localStorage.setItem(VIS_LINJER, "false");
    const to = vis([dag()]);
    expect(to.container.querySelector("[data-linje]")).not.toBeNull();
  });

  it("valget huskes pr. bruker: samme bruker ser linjene etter ny visning, en annen bruker gjør det ikke", () => {
    lager.clear();
    const en = vis([dag()]);
    fireEvent.click(en.getByLabelText("timer.attestering.tabell.bareOversikt"));
    expect(lager.get(VIS_LINJER)).toBe("false");
    en.unmount();
    const to = vis([dag()]);
    expect(to.container.querySelector("[data-linje]")).not.toBeNull();
    to.unmount();
    h.bruker.id = "u-annen";
    const tre = vis([dag()]);
    expect(tre.container.querySelector("[data-linje]")).toBeNull();
  });

  it("lønnsartmerkene på dagsraden: overtid er gul, ordinær grå; hover viser linjene", () => {
    h.data["timer.lonnsart.list"] = arter;
    const { container } = vis([dag()]);
    const merker = Array.from(dagsrad(container).querySelectorAll("[data-lonnsart-oversikt]")) as HTMLElement[];
    // Testens deps gir alle arter navnet «Ordinær»; varselet kommer fra katalogen (overtidsnivå 50).
    expect(merker.map((m) => [m.textContent, m.getAttribute("data-lonnsart-oversikt")])).toEqual([
      ["Ordinær 7,5", ""],
      ["Ordinær 2", "overtid"],
    ]);
    expect(merker[1]!.className).toContain("amber");
    expect(merker[0]!.className).not.toContain("amber");
    const tips = (m: HTMLElement) => document.getElementById(m.getAttribute("aria-describedby")!)?.textContent;
    expect(tips(merker[1]!)).toBe("15:00–17:00 2 t");
    expect(tips(merker[0]!)).toBe("07:00–15:00 7,5 t");
  });

  it("overtid og fravær gir gul linje; negativkontroll: ordinær linje er ikke gul", () => {
    h.data["timer.lonnsart.list"] = arter;
    const { container } = vis([
      sedel({
        timer: [
          timer("t1", { fraTid: "07:00", tilTid: "10:00", timer: "3" }),
          timer("t2", { lonnsartId: "l2", fraTid: "15:00", tilTid: "17:00", timer: "2", pauseMin: 0 }),
          timer("t3", { lonnsartId: "lf", fraTid: "10:00", tilTid: "12:00", timer: "2", pauseMin: 0 }),
        ],
      }),
    ]);
    expect(linje(container, "s1:timer:t2").className).toContain("bg-amber-50");
    expect(linje(container, "s1:timer:t3").className).toContain("bg-amber-50");
    expect(linje(container, "s1:timer:t1").className).not.toContain("bg-amber-50");
  });

  it("normmerket: fravær fyller normen — 5 t arbeid + 2,5 t fravær mot 7,5 gir ikke merke", () => {
    h.data["timer.lonnsart.list"] = arter;
    const full = vis([sedel({ dagsnorm: 7.5, timer: [timer("t1", { timer: "5" }), timer("t3", { lonnsartId: "lf", timer: "2.5" })] })]);
    expect(dagsrad(full.container).textContent).not.toContain("normMerke");
    full.unmount();
    // Negativkontroll: uten fravær står dagen 2,5 t under.
    const under = vis([sedel({ dagsnorm: 7.5, timer: [timer("t1", { timer: "5" })] })]);
    expect(dagsrad(under.container).textContent).toContain('normMerke{"avvik":"−2,5"}');
  });
});

describe("A3 (plan § 4.17 del D, B55) — «Reise under terskel» på dagen", () => {
  const a3Deps: AttDeps = {
    ...deps,
    reiseUnderTerskelMerke: (u) => ({ tekst: "Reise under terskel", forklaring: `Reisen er ${u.maalt} km. Terskel ${u.terskel} km.` }),
  };
  const reiseRegel = (over: Record<string, unknown> = {}) => ({ enhet: "km", terskelM: 30000, regelKategori: "arbeidstid", ...over });
  const visDag = (regel: unknown) => {
    h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }, { id: "lr", navn: "Reise", satsEnhet: null }];
    const s = sedel({
      timer: [
        timer("t1", { fraTid: "07:00", tilTid: "15:00", timer: "7.5" }),
        timer("r1", { erReise: true, reiseRetning: "ut", lonnsartId: "lr", fraTid: "06:30", tilTid: "07:00", timer: "0.5", pauseMin: 0, reiseRegel: regel, reiseAvstandM: 22000 }),
      ],
    });
    return render(
      <AttesteringTabell
        dager={byggAttesteringModell([s], a3Deps)}
        orgId="org1"
        readOnly={false}
        verktoy={<span>uke-og-fane</span>}
        ukeoversikt={() => <div>ukeoversikt-innhold</div>}
        sedelUrl={(id) => `/sedel/${id}`}
        onReturnerDag={() => {}}
      />,
    );
  };
  const reiseMerke = (c: HTMLElement) =>
    (Array.from(dagsrad(c).querySelectorAll("[data-lonnsart-oversikt]")) as HTMLElement[]).find((m) => m.textContent?.startsWith("Ordinær 0,5"));

  it("merket står i dagsraden med forklaring i hover; reiselinja og reisens lønnsartmerke er gule", () => {
    const { container } = visDag(reiseRegel());
    const merke = within(dagsrad(container)).getByText("Reise under terskel");
    const tips = document.getElementById(merke.closest("[aria-describedby]")!.getAttribute("aria-describedby")!);
    expect(tips?.textContent).toContain("Reisen er 22 km. Terskel 30 km.");
    expect(linje(container, "s1:reise:r1").className).toContain("bg-amber-50");
    expect(reiseMerke(container)?.getAttribute("data-lonnsart-oversikt")).toBe("reise");
    // Ingen handling i varselet (B83 kommer senere): merket er ikke en knapp.
    expect(merke.closest("button")).toBeNull();
  });

  it("negativkontroll: reisen fulgte regelen (ingen regelKategori) — intet merke, linja er ikke gul", () => {
    const { container } = visDag(reiseRegel({ regelKategori: undefined }));
    expect(within(dagsrad(container)).queryByText("Reise under terskel")).toBeNull();
    expect(linje(container, "s1:reise:r1").className).not.toContain("bg-amber-50");
    expect(reiseMerke(container)?.getAttribute("data-lonnsart-oversikt")).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/*  D2a + D2b — paret etter «Del opp» og flytteknappen                  */
/* ------------------------------------------------------------------ */

describe("D2a — kort A og B åpne side om side etter «Del opp»", () => {
  const toKort = (over: Partial<AttSedel> = {}) =>
    sedel({ timer: [timer("t1", { tilTid: "11:00", timer: "3.5" }), timer("t2", { kortId: "kB", fraTid: "11:00", pauseMin: 0, timer: "4" })], ...over });
  const jobbrader = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-rad="jobb"]')) as HTMLElement[];
  const paneler = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-registrering]")) as HTMLElement[];
  const lukk = (panel: HTMLElement) => fireEvent.click(within(panel).getAllByRole("button", { name: "handling.lukk" })[0]!);

  function delOgAapnePar(c: HTMLElement) {
    fireEvent.click(jobbrader(c)[0]!);
    const panel = c.querySelector("[data-registrering]") as HTMLElement;
    vi.useFakeTimers();
    fireEvent.click(within(panel).getByRole("button", { name: /registrering\.delOpp/ }));
    const skjema = panel.querySelector("[data-del-opp]") as HTMLElement;
    fireEvent.change(within(skjema).getByPlaceholderText("11:00"), { target: { value: "10:00" } });
    act(() => { vi.advanceTimersByTime(400); });
    vi.useRealTimers();
    act(() => kallTil("delJobb")[0]!.opts!.onSuccess!({ forhandsvisning: { timerA: 2.5, timerB: 1, maskinPaaA: 0, maskiner: [] } }));
    const knapper = within(skjema).getAllByRole("button", { name: /registrering\.delOpp/ });
    fireEvent.click(knapper[knapper.length - 1]!);
    act(() => kallTil("delJobb")[1]!.opts!.onSuccess!({ kortIdB: "kB" }));
  }

  afterEach(() => { h.kall.length = 0; });

  it("test 1: etter «Del opp» står A og B i samme rad, merket «Kort A» og «Kort B»", () => {
    const { container } = vis([toKort()]);
    delOgAapnePar(container);
    const par = container.querySelector("[data-kort-par]") as HTMLElement;
    expect(par).not.toBeNull();
    expect(par.getAttribute("style")).toContain("minmax(min(100%, 632px), 1fr)");
    const [a, b] = paneler(par);
    expect(a!.getAttribute("data-registrering")).toBe("s1:kA");
    expect(a!.getAttribute("data-par-rolle")).toBe("a");
    expect(b!.getAttribute("data-registrering")).toBe("s1:kB");
    expect(b!.getAttribute("data-par-rolle")).toBe("b");
    expect(a!.querySelector("[data-kort-merke]")!.textContent).toBe("timer.attestering.registrering.kortA");
    expect(b!.querySelector("[data-kort-merke]")!.textContent).toBe("timer.attestering.registrering.kortB");
    // Begge jobbradene står som åpne.
    expect(jobbrader(container).every((r) => r.hasAttribute("data-aapen"))).toBe(true);
  });

  it("test 2: ✕ lukker ett kort om gangen", () => {
    const { container } = vis([toKort()]);
    delOgAapnePar(container);
    lukk(paneler(container)[0]!);
    expect(container.querySelector("[data-kort-par]")).toBeNull();
    expect(paneler(container).map((p) => p.getAttribute("data-registrering"))).toEqual(["s1:kB"]);
    lukk(paneler(container)[0]!);
    expect(paneler(container)).toHaveLength(0);
  });

  it("test 2b: ✕ på B lar A stå; klikk på B-ens rad lukker bare B; en annen rad lukker paret", () => {
    const { container } = vis([toKort()]);
    delOgAapnePar(container);
    lukk(paneler(container)[1]!);
    expect(paneler(container).map((p) => p.getAttribute("data-registrering"))).toEqual(["s1:kA"]);
    cleanup();
    h.kall.length = 0;
    const v = vis([toKort()]);
    delOgAapnePar(v.container);
    fireEvent.click(jobbrader(v.container)[1]!);
    expect(paneler(v.container).map((p) => p.getAttribute("data-registrering"))).toEqual(["s1:kA"]);
    fireEvent.click(jobbrader(v.container)[0]!);
    expect(paneler(v.container)).toHaveLength(0);
  });

  it("test 3: del 8 «Reise» står i begge kortene når kortet kan rettes, også uten reise", () => {
    const { container } = vis([toKort()]);
    delOgAapnePar(container);
    for (const p of paneler(container)) expect(p.querySelector('[data-del="8"]')).not.toBeNull();
  });
});

describe("D2b — flytt en linje til et annet kort", () => {
  const P_TILL = { proAdmId: "TILL-001", kortNavn: "Tillegg", navn: null };
  const tl = (over: Record<string, unknown> = {}) => ({ id: "g1", tilleggId: "x", antall: "1", kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", externalCostObjectId: null, ...over }) as never;
  const ma = (over: Record<string, unknown> = {}) => ({ id: "m1", vehicleId: "v1", timer: "3", mengde: null, enhet: null, kortId: "kA", projectId: "pA", project: P, attestertStatus: "pending", timerRadId: null, ...over }) as never;
  const va = (over: Partial<AttSedel["varer"] extends (infer V)[] | undefined ? V : never> = {}) =>
    ({ id: "v1", navn: "Fugesand", enhet: "sekk", antall: 3, projectId: "pA", sheetTimerId: "t1", kortId: "kA", attestert: false, ...over });
  const ut = (over: Record<string, unknown> = {}) => ({ id: "u1", belop: "100", expenseCategory: { navn: "Parkering" }, kortId: "kA", projectId: "pA", project: P, ...over }) as never;
  const kortB = (over: Partial<AttTimer> = {}) => timer("t2", { kortId: "kB", fraTid: "11:00", pauseMin: 0, timer: "4", externalCostObjectId: "eT", underprosjekt: P_TILL, ...over });
  const dag = (over: Partial<AttSedel> = {}) => sedel({ timer: [timer("t1", { tilTid: "11:00", timer: "3.5" }), kortB()], ...over });
  const aapneA = (c: HTMLElement) => {
    fireEvent.click(c.querySelectorAll('[data-rad="jobb"]')[0] as HTMLElement);
    return c.querySelector('[data-registrering="s1:kA"]') as HTMLElement;
  };

  afterEach(() => { h.kall.length = 0; });

  it("test 4: kortet alene med ett mål — «→ TILL-001 · 11:00–15:00» flytter tillegget", () => {
    const { container } = vis([dag({ tillegg: [tl()] })]);
    const panel = aapneA(container);
    const knapp = panel.querySelector('[data-tilleggslinje] [data-flytt-knapp]') as HTMLElement;
    expect(knapp.textContent).toBe('timer.attestering.registrering.flytt.til{"navn":"TILL-001 · 11:00–15:00"}');
    fireEvent.click(knapp);
    expect(kallTil("flyttLinjeTilKort")[0]!.input).toEqual({ sheetId: "s1", radType: "tillegg", radId: "g1", tilKortId: "kB" });
  });

  it("test 5: uten underprosjekt heter målet «Uten · fra–til»; flere mål gir «→ Flytt til ▾» med liste", () => {
    const { container } = vis([dag({
      timer: [timer("t1", { tilTid: "11:00", timer: "3.5" }), timer("t2", { kortId: "kB", fraTid: "11:00", tilTid: "13:00", pauseMin: 0, timer: "2" }), kortB({ id: "t3", kortId: "kC", fraTid: "13:00" } as Partial<AttTimer>)],
      maskiner: [ma()],
    })]);
    const panel = aapneA(container);
    const knapp = panel.querySelector("[data-maskinlinje] [data-flytt-knapp]") as HTMLElement;
    expect(knapp.textContent).toContain("timer.attestering.registrering.flytt.flyttTil");
    fireEvent.click(knapp);
    const valg = Array.from(panel.querySelectorAll("[data-flytt-liste] [role=menuitem]")).map((b) => b.textContent);
    expect(valg).toEqual(["timer.attestering.registrering.uten · 11:00–13:00", "TILL-001 · 13:00–15:00"]);
    fireEvent.click(panel.querySelectorAll("[data-flytt-liste] [role=menuitem]")[1] as HTMLElement);
    expect(kallTil("flyttLinjeTilKort")[0]!.input).toEqual({ sheetId: "s1", radType: "maskin", radId: "m1", tilKortId: "kC" });
  });

  it("retur 3 runde 6: koblet tillegg tilbys bare kort med timerad; ukoblet får også kortet uten", () => {
    // kC har bare et ukoblet tillegg (ingen timerad). kB har timeraden t2.
    const kortC = tl({ id: "g9", kortId: "kC", externalCostObjectId: "eX" });
    const koblet = vis([dag({ tillegg: [tl({ sheetTimerId: "t1" }), kortC] })]);
    const k1 = aapneA(koblet.container).querySelector("[data-tilleggslinje] [data-flytt-knapp]") as HTMLElement;
    expect(k1.textContent).toBe('timer.attestering.registrering.flytt.til{"navn":"TILL-001 · 11:00–15:00"}');
    cleanup();
    const ukoblet = vis([dag({ tillegg: [tl(), kortC] })]);
    const k2 = aapneA(ukoblet.container).querySelector("[data-tilleggslinje] [data-flytt-knapp]") as HTMLElement;
    expect(k2.textContent).toContain("timer.attestering.registrering.flytt.flyttTil");
  });

  it("test 6: ingen mål — én jobb, annet prosjekt eller målkort som ikke venter — gir ingen knapp", () => {
    const en = vis([sedel({ tillegg: [tl()] })]);
    fireEvent.click(dagsrad(en.container));
    expect(en.container.querySelector("[data-flytt-knapp]")).toBeNull();
    cleanup();
    const annet = vis([dag({ timer: [timer("t1", { tilTid: "11:00" }), kortB({ projectId: "pB" })], tillegg: [tl()] })]);
    expect(aapneA(annet.container).querySelector("[data-flytt-knapp]")).toBeNull();
    cleanup();
    const attestert = vis([dag({ timer: [timer("t1", { tilTid: "11:00" }), kortB({ attestertStatus: "attestert" })], tillegg: [tl()] })]);
    expect(aapneA(attestert.container).querySelector("[data-flytt-knapp]")).toBeNull();
  });

  it("test 7: vare åpner mengdefeltet — «1,00 av 3,00 sekk · 2,00 sekk blir i dette kortet», Flytt sender mengden", () => {
    const { container } = vis([dag({ varer: [va()] })]);
    const panel = aapneA(container);
    fireEvent.click(panel.querySelector("[data-varelinje] [data-flytt-knapp]") as HTMLElement);
    const skjema = panel.querySelector("[data-vare-flytt]") as HTMLElement;
    const felt = within(skjema).getByLabelText("timer.attestering.registrering.flytt.mengde") as HTMLInputElement;
    expect(felt.value).toBe("1,00");
    expect(skjema.textContent).toContain('flytt.vareAv{"antall":"3,00","enhet":"sekk"}');
    expect(skjema.textContent).toContain('flytt.vareBlir{"rest":"2,00","enhet":"sekk","kilde":"timer.attestering.registrering.flytt.detteKortet"}');
    fireEvent.change(felt, { target: { value: "4" } });
    expect((within(skjema).getByRole("button", { name: "timer.attestering.registrering.flytt.flytt" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(felt, { target: { value: "1,5" } });
    fireEvent.click(within(skjema).getByRole("button", { name: "timer.attestering.registrering.flytt.flytt" }));
    expect(kallTil("flyttLinjeTilKort")[0]!.input).toEqual({ sheetId: "s1", radType: "vare", radId: "v1", tilKortId: "kB", mengde: 1.5 });
    fireEvent.click(within(skjema).getByRole("button", { name: "handling.avbryt" }));
    expect(panel.querySelector("[data-vare-flytt]")).toBeNull();
  });

  it("test 8: attestert vare og utlegg i kort med attestert linje har ingen knapp; uten «rediger ved attestering» ingen knapper", () => {
    const a = vis([dag({ varer: [va({ attestert: true })], utlegg: [ut()], tillegg: [tl({ attestertStatus: "attestert" })] })]);
    const p = aapneA(a.container);
    expect(p.querySelector("[data-varelinje] [data-flytt-knapp]")).toBeNull();
    expect(p.querySelector("[data-utleggslinje] [data-flytt-knapp]")).toBeNull();
    cleanup();
    const venter = vis([dag({ utlegg: [ut()] })]);
    expect(aapneA(venter.container).querySelector("[data-utleggslinje] [data-flytt-knapp]")).not.toBeNull();
    cleanup();
    const av = vis([dag({ redigerTillatt: false, tillegg: [tl()], maskiner: [ma()], varer: [va()], utlegg: [ut()] })]);
    expect(aapneA(av.container).querySelector("[data-flytt-knapp]")).toBeNull();
  });

  it("test 9: feil fra serveren står i kortet", () => {
    const { container } = vis([dag({ tillegg: [tl()] })]);
    const panel = aapneA(container);
    fireEvent.click(panel.querySelector("[data-tilleggslinje] [data-flytt-knapp]") as HTMLElement);
    act(() => kallTil("flyttLinjeTilKort")[0]!.opts!.onError!({ message: "Målkortet har linjer som ikke venter" }));
    expect(panel.textContent).toContain("Målkortet har linjer som ikke venter");
  });
});
