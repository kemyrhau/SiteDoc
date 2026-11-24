// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * A4 (plan § 4.17 del B, B50 A, B53 A, B57, B85 ja): ukelinja i «Etter ansatt». Tallene er
 * serverens ukeregnestykke (`uke` på sedelen) — skjermen regner ikke uka selv.
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

import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { byggAttesteringModell, type AttDeps, type AttSedel, type AttTimer } from "@/components/attestering/attestering-tabell";
import { attesterteMedUkevarsel, dagKanTrekkes, ukeTall, type AttUke } from "@/components/attestering/ukelinje";
import { beregnUkeregnestykke } from "@sitedoc/shared";

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
      gruppering="ansatt"
      verktoy={<span>uke-og-fane</span>}
      sedelUrl={(id) => `/sedel/${id}`}
      onReturnerDag={() => {}}
    />,
  );
}

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
beforeEach(() => { h.kall.length = 0; h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Ordinær", satsEnhet: null }]; lager.clear(); localStorage.setItem(VIS_LINJER, "false"); h.bruker.id = "u-leder"; });
afterEach(cleanup);

// Planens eksempeluke (uke 47): man 7,5 · tir 7,5 + 2,5 OT · ons 7,5 egenmelding · tor 6,5 · fre 5.
const DATOER = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
const rad = (timer: number, over: { ot?: boolean; fravaer?: boolean } = {}) => ({
  timer, overtidsnivaa: over.ot ? 50 : null, erReise: false, erFravaer: over.fravaer === true,
});
function lagUke(komplett = true): AttUke {
  const r = beregnUkeregnestykke(
    [
      { dato: DATOER[0]!, dagsnorm: 7.5, rader: [rad(7.5)] },
      { dato: DATOER[1]!, dagsnorm: 7.5, rader: [rad(7.5), rad(2.5, { ot: true })] },
      { dato: DATOER[2]!, dagsnorm: 7.5, rader: [rad(7.5, { fravaer: true })] },
      { dato: DATOER[3]!, dagsnorm: 7.5, rader: [rad(6.5)] },
      { dato: DATOER[4]!, dagsnorm: 7.5, rader: komplett ? [rad(5)] : [] },
    ],
    37.5,
  );
  return { ukestart: DATOER[0]!, regnestykke: r, komplett, manglerDager: komplett ? [] : [DATOER[4]!] };
}
function ukeSedler(uke: AttUke, antall = 5): AttSedel[] {
  return DATOER.slice(0, antall).map((dato, i) => sedel({ id: `s${i + 1}`, dato, uke, timer: [timer(`t${i + 1}`, { kortId: `k${i + 1}` })] }));
}
const DAG_MERKE = "timer.attestering.tabell.uke.dagKanTrekkes";

describe("A4 — ukelinja i «Etter ansatt»", () => {
  it("ukelinja viser uke, ukesum av ukenorm og gule B85-merker når uka er komplett", () => {
    const { container } = vis(ukeSedler(lagUke()));
    const linje = container.querySelector('[data-ukelinje="komplett"]') as HTMLElement;
    expect(linje).toBeTruthy();
    expect(linje.textContent).toContain("Kari Nordmann");
    expect(linje.textContent).toContain('timer.attestering.uke.label{"nr":47}');
    expect(linje.querySelector("[data-ukesum]")?.textContent).toBe('timer.attestering.tabell.uke.sum{"sum":"36,5","norm":"37,5"}');
    const merker = Array.from(linje.querySelectorAll('[data-ukevarsel="gul"]')).map((m) => m.textContent);
    expect(merker).toEqual([
      'timer.attestering.tabell.uke.underNorm{"timer":"1,0"}',
      'timer.attestering.tabell.uke.kanTrekkes{"timer":"1,0","overtid":"2,5"}',
    ]);
    expect(linje.querySelector("[data-uke-saa-langt]")).toBeNull();
  });

  it("dagsmerket «N t kan trekkes» står bare på tirsdagen, med dagens tall", () => {
    const { container } = vis(ukeSedler(lagUke()));
    const treff = Array.from(container.querySelectorAll("span")).filter((e) => e.children.length === 0 && e.textContent?.startsWith(DAG_MERKE));
    expect(treff.map((e) => e.textContent)).toEqual([`${DAG_MERKE}{"timer":"1,0"}`]);
    expect(dagKanTrekkes(lagUke(), DATOER[1]!)).toBe(1);
    expect(DATOER.filter((d) => d !== DATOER[1]).map((d) => dagKanTrekkes(lagUke(), d))).toEqual([0, 0, 0, 0]);
  });

  it("uka er ikke komplett: «Uka så langt» og dagene som mangler i grått, ingen dagsmerker", () => {
    const { container } = vis(ukeSedler(lagUke(false), 4));
    const linje = container.querySelector('[data-ukelinje="saaLangt"]') as HTMLElement;
    expect(linje).toBeTruthy();
    expect(linje.querySelector("[data-uke-saa-langt]")?.textContent).toContain("timer.attestering.tabell.uke.saaLangt");
    expect(linje.querySelector("[data-uke-saa-langt]")?.textContent).toContain("timer.attestering.tabell.uke.mangler");
    expect(linje.querySelectorAll('[data-ukevarsel="gul"]')).toHaveLength(0);
    expect(linje.querySelectorAll('[data-ukevarsel="graa"]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain(DAG_MERKE);
  });

  it("B57: krysset på ukelinja velger alle dagene i uka", () => {
    const { container, getAllByLabelText } = vis(ukeSedler(lagUke()));
    const ukeKryss = container.querySelector('[data-ukelinje] input[type="checkbox"]') as HTMLInputElement;
    expect(ukeKryss.getAttribute("aria-label")).toBe("timer.attestering.tabell.uke.velgUka");
    fireEvent.click(ukeKryss);
    const dagKryss = getAllByLabelText("timer.attestering.tabell.velgJobb") as HTMLInputElement[];
    expect(dagKryss).toHaveLength(5);
    expect(dagKryss.every((k) => k.checked)).toBe(true);
    expect(ukeKryss.checked).toBe(true);
  });

  it("B53 A: attestert dag under ukelinja har ↺ (Gjenåpne), ikke «Attester»", () => {
    const uke = lagUke();
    const sedler = ukeSedler(uke);
    sedler[1] = { ...sedler[1]!, attestertVisning: true, timer: [timer("t2", { kortId: "k2", attestertStatus: "accepted" })] };
    const { getAllByLabelText } = vis(sedler);
    expect(getAllByLabelText("timer.attestering.tabell.attesterDagen")).toHaveLength(4);
    expect(getAllByLabelText("timer.attestering.tabell.gjenaapneDagen")).toHaveLength(1);
    // Den attesterte dagen kan ikke krysses av.
    expect(getAllByLabelText("timer.attestering.tabell.velgJobb")).toHaveLength(4);
  });

  it("attesterteMedUkevarsel: bare dager med overtid som kan trekkes, i komplett uke med varsel", () => {
    const uke = lagUke();
    const attesterte = DATOER.map((dato, i) => ({ id: `a${i}`, dato, uke }));
    expect(attesterteMedUkevarsel(attesterte).map((s) => s.dato)).toEqual([DATOER[1]]);
    expect(attesterteMedUkevarsel(attesterte.map((s) => ({ ...s, uke: lagUke(false) })))).toEqual([]);
    expect(attesterteMedUkevarsel([{ dato: DATOER[1]!, uke: null }])).toEqual([]);
  });

  it("ukeTall: én desimal, to når den andre trengs, komma", () => {
    expect([ukeTall(1), ukeTall(36.5), ukeTall(0.25), ukeTall(37.5)]).toEqual(["1,0", "36,5", "0,25", "37,5"]);
  });
});
