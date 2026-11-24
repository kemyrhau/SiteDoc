// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A4b (orkestrator 2026-11-24, Kenneth-hjemmel): (1) linjevarselet «kan trekkes» begrenset til
 * linjas overtid, (2) ukelinja mørk blå som skissen v22-uke.png, (3) normkortet på hover med én
 * opplysning pr. linje.
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
import { linjeKanTrekkes, ukeTall, type AttUke } from "@/components/attestering/ukelinje";
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

function vis(sedler: AttSedel[], gruppering: "ansatt" | "prosjekt" = "ansatt") {
  return render(
    <AttesteringTabell
      dager={byggAttesteringModell(sedler, deps)}
      orgId="org1"
      readOnly={false}
      gruppering={gruppering}
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

// Uke 47: tirsdag har to jobber med 0,5 t og 2,0 t overtid; uka er under ukenorm, så hele den
// førte overtiden (2,5 t) kan trekkes.
const DATOER = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
const rad = (timer: number, ot = false) => ({ timer, overtidsnivaa: ot ? 50 : null, erReise: false, erFravaer: false });
function lagUke(komplett = true): AttUke {
  const r = beregnUkeregnestykke(
    [
      { dato: DATOER[0]!, dagsnorm: 7.5, rader: [rad(7.5)] },
      { dato: DATOER[1]!, dagsnorm: 7.5, rader: [rad(5), rad(0.5, true), rad(2, true)] },
      { dato: DATOER[2]!, dagsnorm: 7.5, rader: [rad(7.5)] },
      { dato: DATOER[3]!, dagsnorm: 7.5, rader: [rad(6.5)] },
      { dato: DATOER[4]!, dagsnorm: 7.5, rader: [rad(5)] },
    ],
    37.5,
  );
  return { ukestart: DATOER[0]!, regnestykke: r, komplett, manglerDager: [] };
}
// Som siden (`attestering/page.tsx` `ukeAvvikTekst`): ukas tall, aldri mer enn linjas overtid.
const linjeDeps: AttDeps = {
  ...deps,
  ukeAvvikTekst: (s, linjeTimer) => {
    const n = linjeKanTrekkes(s.uke, linjeTimer);
    return n > 0.005 && s.uke ? `${ukeTall(n)} t av ${ukeTall(s.uke.regnestykke.sumOvertid)} t overtid kan trekkes` : null;
  },
};
function tirsdag(uke: AttUke): AttSedel {
  return sedel({
    id: "s2", dato: DATOER[1]!, uke, totaltimer: 7.5,
    timer: [
      timer("t-ord", { kortId: "kA", timer: "5", tilTid: "12:30" }),
      timer("t-ot1", { kortId: "kA", lonnsartId: "l2", fraTid: "12:30", tilTid: "13:00", timer: "0.5" }),
      timer("t-ot2", { kortId: "kB", lonnsartId: "l2", fraTid: "13:00", tilTid: "15:00", timer: "2" }),
    ],
    ukeAvvikRadIder: ["t-ot1", "t-ot2"],
  });
}
const avvikPaa = (dager: ReturnType<typeof byggAttesteringModell>, id: string) =>
  dager.flatMap((d) => d.kort.flatMap((k) => k.linjer)).find((l) => l.nokkel === `s2:timer:${id}`)!.avvikMerker.map((m) => m.tekst);

describe("A4b (1) — linjevarselet begrenses til linjas overtid", () => {
  it("to jobber med 0,5 t og 2,0 t overtid: linjene sier 0,5 og 2,0 av 2,5 t", () => {
    const uke = lagUke();
    expect(uke.regnestykke.kanTrekkes).toBe(2.5);
    expect(uke.regnestykke.sumOvertid).toBe(2.5);
    const dager = byggAttesteringModell([tirsdag(uke)], linjeDeps);
    expect(avvikPaa(dager, "t-ot1")).toContain("0,5 t av 2,5 t overtid kan trekkes");
    expect(avvikPaa(dager, "t-ot2")).toContain("2,0 t av 2,5 t overtid kan trekkes");
  });

  it("en linje uten overtid får ikke teksten", () => {
    const dager = byggAttesteringModell([tirsdag(lagUke())], linjeDeps);
    expect(avvikPaa(dager, "t-ord").join(" ")).not.toContain("kan trekkes");
    expect(linjeKanTrekkes(lagUke(), 0)).toBe(0);
  });

  it("ukas tall er taket: linja får aldri mer enn uka", () => {
    const uke = lagUke();
    const lite: AttUke = { ...uke, regnestykke: { ...uke.regnestykke, kanTrekkes: 1 } };
    expect([linjeKanTrekkes(lite, 0.5), linjeKanTrekkes(lite, 2)]).toEqual([0.5, 1]);
    expect(linjeKanTrekkes(lagUke(false), 2)).toBe(0);
  });

  it("nb-teksten har ikke lenger «Uke N:»", () => {
    const nb = JSON.parse(readFileSync(resolve(__dirname, "../../../../packages/shared/src/i18n/nb.json"), "utf-8")) as Record<string, string>;
    expect(nb["timer.attestering.tabell.uke.linjeKanTrekkes"]).toBe("{{timer}} t av {{overtid}} t overtid kan trekkes");
  });
});

describe("A4b (2) — ukelinja har skissens kontrast", () => {
  it("ukelinja i «Etter ansatt» er mørk blå med hvit tekst; kryss og gule merker står", () => {
    const sedler = DATOER.map((dato, i) => sedel({ id: `s${i + 1}`, dato, uke: lagUke(), timer: [timer(`t${i + 1}`, { kortId: `k${i + 1}` })] }));
    const { container } = vis(sedler);
    const rad = container.querySelector('[data-tone="uke"]') as HTMLElement;
    expect(rad).toBeTruthy();
    expect(rad.className).toContain("bg-sitedoc-primary");
    expect(rad.className).toContain("text-white");
    expect(rad.className).not.toContain("bg-gray-100");
    expect(rad.querySelector("[data-ukelinje]")).toBeTruthy();
    expect(rad.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(rad.querySelectorAll('[data-ukevarsel="gul"]').length).toBeGreaterThan(0);
  });

  it("gruppeoverskriften i «Etter prosjekt» er uendret lys grå", () => {
    const { container } = vis([sedel()], "prosjekt");
    expect(container.querySelector('[data-tone="uke"]')).toBeNull();
  });
});

describe("A4b (3) — normkortet: én opplysning pr. linje", () => {
  it("arbeid 8,5 t med 1,0 t overtid: tre separate linjer som ikke brytes", () => {
    h.data["timer.lonnsart.list"] = [
      { id: "l1", navn: "Ordinær", satsEnhet: null, overtidsnivaa: null },
      { id: "l2", navn: "Overtid 50 %", satsEnhet: null, overtidsnivaa: 50 },
    ];
    vis([
      sedel({
        totaltimer: 8.5,
        timer: [timer("t1"), timer("t2", { lonnsartId: "l2", fraTid: "15:00", tilTid: "16:00", timer: "1" })],
      }),
    ]);
    const linjer = Array.from(document.body.querySelectorAll("[data-forklaring-linje]")) as HTMLElement[];
    expect(linjer.map((l) => l.textContent)).toEqual([
      'timer.attestering.tabell.normHover.arbeid{"arbeid":"8,50","norm":"7,50"}',
      'timer.attestering.tabell.normHover.overtid{"timer":"1,00"}',
      'timer.attestering.tabell.normHover.sum{"timer":"8,50"}',
    ]);
    expect(linjer.every((l) => l.className.includes("whitespace-nowrap") && l.className.includes("block"))).toBe(true);
    // Hele kortet står i tooltip-noden som merket peker på (aria-describedby).
    const merke = Array.from(document.querySelectorAll("[aria-describedby]")).find((e) => e.textContent?.includes("normMerke"));
    const boks = merke && document.getElementById(merke.getAttribute("aria-describedby")!.split(" ").pop()!);
    expect(boks?.textContent).toContain("normHover.overtid");
  });
});
