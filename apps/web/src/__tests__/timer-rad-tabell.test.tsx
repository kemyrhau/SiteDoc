// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent, cleanup } from "@testing-library/react";

/**
 * TimerRadTabell (spec prosjektkort-kortid R1/R5–R7/R19/R22/R25, T47/T48/T50, ordre d2b-1
 * commit 3): én tabell for attesteringen og rapportens Detaljer.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

// jsdom har ingen layout: virtualiseringen tegner alle radene.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({ index: i, key: i, start: i * 30 })),
    getTotalSize: () => count * 30,
    measureElement: () => {},
  }),
}));

import { TimerRadTabell, type TimerRadTabellRad } from "@/components/timer/TimerRadTabell";

type D = { navn: string | null; timer: number; maskiner: string[] };
const linje = (nokkel: string, d: D): TimerRadTabellRad<D> => ({
  kind: "linje", nokkel, data: d, underlinjer: Math.max(1, d.maskiner.length),
});
const rader: TimerRadTabellRad<D>[] = [
  { kind: "overskrift", nokkel: "o", innhold: "Prosjekt A" },
  linje("b", { navn: "Berit", timer: 2, maskiner: ["Graver", "Dumper"] }),
  linje("x", { navn: null, timer: 1, maskiner: [] }),
  linje("a", { navn: "Anne", timer: 3, maskiner: [] }),
  { kind: "sum", nokkel: "s", celle: (k) => (k === "timer" ? "6" : ""), sterk: true },
];
const celle = (k: string, d: D, under: number) =>
  k === "ansatt" ? (under === 0 ? d.navn : null) : k === "timer" ? (under === 0 ? String(d.timer) : null) : k === "maskin" ? d.maskiner[under] ?? null : null;

afterEach(cleanup);

const linjeTekst = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("[data-linje]")).map((e) => e.getAttribute("data-linje"));

describe("T50 — sortering gjelder besøket: stigende, synkende, kortrekkefølge", () => {
  it("klikk i hodet sorterer linjene og tar bort oversikts- og sumrader; tredje klikk gir kortrekkefølgen", () => {
    const { container, getByText, queryByText } = render(
      <TimerRadTabell kolonner={["ansatt", "timer"]} rader={rader} celle={celle}
        sorterVerdi={(k, d) => (k === "ansatt" ? d.navn : d.timer)} />,
    );
    expect(linjeTekst(container)).toEqual(["b", "x", "a"]);
    fireEvent.click(getByText("timer.eksport.kolAnsatt"));
    // Tom verdi står sist i begge retninger.
    expect(linjeTekst(container)).toEqual(["a", "b", "x"]);
    expect(queryByText("Prosjekt A")).toBeNull();
    expect(container.querySelector("svg path")?.getAttribute("d")).toBe("M18 15l-6-6-6 6");
    fireEvent.click(getByText("timer.eksport.kolAnsatt"));
    expect(linjeTekst(container)).toEqual(["b", "a", "x"]);
    fireEvent.click(getByText("timer.eksport.kolAnsatt"));
    expect(linjeTekst(container)).toEqual(["b", "x", "a"]);
    expect(getByText("Prosjekt A")).toBeTruthy();
  });

  it("uten sorterVerdi er det ingen sortering og ingen pil (rapporten, R19)", () => {
    const { container, getByText } = render(<TimerRadTabell kolonner={["ansatt"]} rader={rader} celle={celle} />);
    fireEvent.click(getByText("timer.eksport.kolAnsatt"));
    expect(linjeTekst(container)).toEqual(["b", "x", "a"]);
    expect(container.querySelector("svg path")).toBeNull();
  });
});

describe("T48 — bredden dras i hodet og dratt bredde vinner", () => {
  it("dragning gir ny bredde til kalleren", () => {
    let lagret: Record<string, number> | null = null;
    const { container } = render(
      <TimerRadTabell kolonner={["ansatt", "timer"]} rader={rader} celle={celle}
        bredder={{ timer: 90 }} onBreddeEndring={(b) => { lagret = b; }} />,
    );
    const hode = container.querySelector('[data-kolonne="ansatt"]') as HTMLElement;
    Object.defineProperty(hode, "offsetWidth", { value: 120 });
    fireEvent.mouseDown(hode.querySelector("div.cursor-col-resize") as HTMLElement, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });
    fireEvent.mouseUp(document);
    expect(lagret).toEqual({ timer: 90, ansatt: 180 });
  });

  it("lagret bredde står i grid-malen; uten lagring finnes ikke håndtaket", () => {
    const { container } = render(
      <TimerRadTabell kolonner={["ansatt", "timer"]} rader={rader} celle={celle} bredder={{ ansatt: 333 }} />,
    );
    const hode = container.querySelector(".sticky.top-0") as HTMLElement;
    expect(hode.style.gridTemplateColumns.split(" ")[0]).toBe("333px");
    expect(container.querySelector("div.cursor-col-resize")).toBeNull();
  });
});

describe("R22/R25 — faste kanter og skillet mellom linjer", () => {
  const props = {
    kolonner: ["ansatt", "maskin", "timer"] as const,
    rader,
    celle,
    venstre: { bredde: 40, celle: (d: D) => <input type="checkbox" aria-label={`velg ${d.navn}`} /> },
    hoyre: { bredde: 120, celle: (d: D) => <button>✓ {d.navn}</button> },
  };

  it("venstre- og høyrekolonnen står fast og spenner over alle tekstlinjene, én gang pr. linje", () => {
    const { container, getAllByRole } = render(<TimerRadTabell {...props} kolonner={[...props.kolonner]} />);
    const berit = container.querySelector('[data-linje="b"]') as HTMLElement;
    expect(berit.style.gridTemplateRows).toBe("repeat(2, auto)");
    const [venstre] = Array.from(berit.children) as HTMLElement[];
    const hoyre = berit.lastElementChild as HTMLElement;
    expect(venstre.style.position).toBe("sticky");
    expect(venstre.style.left).toBe("0px");
    expect(venstre.style.gridRow).toBe("1 / span 2");
    expect(venstre.className).toContain("border-l-4");
    expect(hoyre.style.position).toBe("sticky");
    expect(hoyre.style.right).toBe("0px");
    expect(hoyre.style.gridRow).toBe("1 / span 2");
    // Én avkrysning og én knapp pr. linje, ikke pr. tekstlinje.
    expect(getAllByRole("checkbox")).toHaveLength(3);
    expect(getAllByRole("button", { name: /✓/ })).toHaveLength(3);
  });

  it("underlinjene viser maskin nr. 1 og 2; øvrige celler er tomme på underlinja", () => {
    const { container } = render(<TimerRadTabell {...props} kolonner={[...props.kolonner]} />);
    const berit = container.querySelector('[data-linje="b"]') as HTMLElement;
    const pa = (rad: number) =>
      (Array.from(berit.children) as HTMLElement[])
        .filter((e) => e.style.gridRow === String(rad))
        .map((e) => e.textContent);
    expect(pa(1)).toEqual(["Berit", "Graver", "2"]);
    expect(pa(2)).toEqual(["", "Dumper", ""]);
  });

  it("bakgrunnen veksler pr. linje og skillestreken står på linja, ikke på underlinjene", () => {
    const { container } = render(<TimerRadTabell {...props} kolonner={[...props.kolonner]} />);
    const l = (n: string) => container.querySelector(`[data-linje="${n}"]`) as HTMLElement;
    expect(l("b").className).toContain("bg-white");
    expect(l("x").className).toContain("bg-gray-50");
    expect(l("a").className).toContain("bg-white");
    for (const n of ["b", "x", "a"]) expect(l(n).className).toContain("border-b");
    const celler = Array.from(l("b").children) as HTMLElement[];
    for (const c of celler) expect(c.className).not.toMatch(/(^|\s)border-[bt](\s|$|-\d)/);
  });
});

describe("T47/R19 — rapportens Detaljer bruker samme tabell og kolonneliste", () => {
  const rot = resolve(__dirname, "..");
  const td = readFileSync(resolve(rot, "components/timer/TimerRapportDetaljer.tsx"), "utf8");
  const side = readFileSync(resolve(rot, "app/dashbord/firma/timer/rapport/page.tsx"), "utf8");

  it("Detaljer tegnes av TimerRadTabell, uten egen grid eller egne overskrifter", () => {
    expect(td).toMatch(/<TimerRadTabell\b/);
    expect(td).not.toMatch(/useVirtualizer|KOL_META|kolTekst/);
  });

  it("rapporten har verken sortering eller kolonnefilter, men bredde og flytting", () => {
    const kall = td.slice(td.indexOf("<TimerRadTabell"), td.indexOf("/>", td.indexOf("<TimerRadTabell")));
    expect(kall).not.toMatch(/sorterVerdi|filter=/);
    expect(kall).toMatch(/onBreddeEndring=/);
    expect(kall).toMatch(/onRekkefolgeEndring=/);
    expect(td).toMatch(/liste: "timer-rapport-detaljer"/);
  });

  it("flytting i hodet skriver malens kolonnevalg — samme som «Velg parameter»", () => {
    expect(side).toMatch(/<TimerRapportDetaljer[\s\S]*?onKolonneRekkefolge=\{setValgteKolonner\}/);
  });
});
