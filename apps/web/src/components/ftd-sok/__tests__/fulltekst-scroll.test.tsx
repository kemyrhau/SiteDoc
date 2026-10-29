// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * SØK-1 S1a (dokumentsok-visning-spec § 6): T1 (scroll-mål er valgt chunk, også DOCX), T2 (valgt chunks
 * <mark> skiller seg fra øvrige), T8 høyre rute (semantisk setning markert), T4 i trefflista (side XOR avsnitt).
 * Rød før: Fulltekst scrollet til første <mark> på SIDEN (`scrollTilSide`), DOCX (side null) scrollet ikke,
 * og alle <mark> var like gule.
 */

type Chunk = { id: string; chunkIndex: number; pageNumber: number | null; chunkText: string; sectionTitle: string | null };
let chunks: Chunk[] = [];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ftdSok: {
      hentDokumentChunks: { useQuery: () => ({ data: chunks, isLoading: false }) },
    },
  },
}));
vi.mock("@/components/SignertLenke", () => ({ useSignertLenkeApner: () => () => undefined }));

import { Fulltekst, MARK_KLASSE, MARK_VALGT_KLASSE, RULLE_MARG, VALGT_AVSNITT_KLASSE } from "../fulltekst";
import { TreffListe } from "../treff-liste";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    resources: {
      nb: {
        translation: {
          "ftdSok.sideHode": "Side {{side}}",
          "ftdSok.side": "side {{side}}",
          "ftdSok.chunk": "avsnitt {{nr}}",
          "ftdSok.semantiskTreff": "semantisk treff",
          "ftdSok.antallTreffIDok": "{{treff}} treff i {{dok}} dokumenter",
        },
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PDF_SIDE3: Chunk[] = [
  { id: "a", chunkIndex: 4, pageNumber: 3, sectionTitle: null, chunkText: "Vernerunde gjennomføres ukentlig av bas. " },
  { id: "b", chunkIndex: 5, pageNumber: 3, sectionTitle: null, chunkText: "SJA skal utføres før risikofylt arbeid. Funn fra vernerunde føres i avvikslogg." },
];

/**
 * F3 (relay 29.10): `scrollIntoView` rullet ALLE forfedre — også `main` (overflow-y-auto uten synlig
 * rullefelt for siden) — så søkefeltet og trefflista forsvant. Rullingen skal kun skje i
 * `[data-rullebeholder]` (høyre rute) via beholderens egen `scrollTo`.
 * jsdom har ingen layout: geometrien stubbes — beholderen står på 100 px, chunk N på 100 + N·500 px.
 * Rød før: `RULLE_MARG` fantes ikke, og scrollIntoView ble kalt på chunk-ankeret.
 */
const BEHOLDER_TOPP = 100;
const chunkTopp = (n: number) => BEHOLDER_TOPP + n * 500;
const forventetRull = (n: number) => chunkTopp(n) - BEHOLDER_TOPP - RULLE_MARG;

const originalGbcr = Element.prototype.getBoundingClientRect;
const originalScrollTo = Element.prototype.scrollTo;
const originalScrollIntoView = Element.prototype.scrollIntoView;
afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGbcr;
  Element.prototype.scrollTo = originalScrollTo;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function rect(top: number): DOMRect {
  return { top, bottom: top + 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function spionerScroll() {
  const scrollIntoView: Element[] = [];
  const scrollTo: Array<{ el: Element; top: number | undefined }> = [];
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrollIntoView.push(this);
  });
  Element.prototype.scrollTo = vi.fn(function (this: Element, arg?: ScrollToOptions | number) {
    scrollTo.push({ el: this, top: typeof arg === "number" ? arg : arg?.top });
  }) as Element["scrollTo"];
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const n = this.getAttribute("data-chunk");
    if (n != null) return rect(chunkTopp(Number(n)));
    if (this.hasAttribute("data-rullebeholder")) return rect(BEHOLDER_TOPP);
    return rect(0);
  };
  return { scrollIntoView, scrollTo };
}

function renderIRute(ui: React.ReactElement) {
  return render(<div data-rullebeholder="">{ui}</div>);
}

describe("T1 — høyre rute scroller til valgt chunk", () => {
  it("PDF: målet er chunk 5 (andre forekomst på side 3), ikke første <mark> på siden", () => {
    chunks = PDF_SIDE3;
    const { scrollTo } = spionerScroll();
    renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="vernerunde" valgtChunkIndex={5} />);
    expect(scrollTo).toHaveLength(1);
    expect(scrollTo[0]!.top).toBe(forventetRull(5));
    expect(scrollTo[0]!.top).not.toBe(forventetRull(4));
  });

  it("DOCX (pageNumber null): scroller likevel til chunken", () => {
    chunks = [
      { id: "a", chunkIndex: 0, pageNumber: null, sectionTitle: null, chunkText: "Innledning om prosjektet. " },
      { id: "b", chunkIndex: 3, pageNumber: null, sectionTitle: "3. Frostsikring", chunkText: "Frostsikring av grunnmur." },
    ];
    const { scrollTo } = spionerScroll();
    renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="frostsikring" valgtChunkIndex={3} />);
    expect(scrollTo.map((s) => s.top)).toEqual([forventetRull(3)]);
  });

  it("A4: valgt chunk uten <mark> (semantisk) → scroller til chunken, ingen feil", () => {
    chunks = PDF_SIDE3;
    const { scrollTo } = spionerScroll();
    renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="bot" valgtChunkIndex={4} />);
    expect(scrollTo[0]!.top).toBe(forventetRull(4));
  });
});

describe("F3 — forfedre rulles ikke", () => {
  it("scrollIntoView kalles aldri; kun [data-rullebeholder] får scrollTo", () => {
    chunks = PDF_SIDE3;
    const { scrollIntoView, scrollTo } = spionerScroll();
    renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="vernerunde" valgtChunkIndex={5} />);
    expect(scrollIntoView).toHaveLength(0);
    expect(scrollTo).toHaveLength(1);
    expect(scrollTo[0]!.el.hasAttribute("data-rullebeholder")).toBe(true);
  });

  it("uten [data-rullebeholder] rulles Fulltekst sin egen beholder — aldri document/main", () => {
    chunks = PDF_SIDE3;
    const { scrollIntoView, scrollTo } = spionerScroll();
    render(<Fulltekst prosjektId="p" documentId="d" søkeord="vernerunde" valgtChunkIndex={5} />);
    expect(scrollIntoView).toHaveLength(0);
    expect(scrollTo).toHaveLength(1);
    expect(scrollTo[0]!.el.tagName).toBe("DIV");
    expect(scrollTo[0]!.el.querySelector('[data-chunk="5"]')).not.toBeNull();
  });
});

describe("T2 — valgt chunks markeringer er sterkere enn øvrige", () => {
  it("<mark> i valgt chunk har valgt-klassen, andre forekomster vanlig gul", () => {
    chunks = PDF_SIDE3;
    spionerScroll();
    const { container } = render(<Fulltekst prosjektId="p" documentId="d" søkeord="vernerunde" valgtChunkIndex={5} />);
    const iValgt = container.querySelectorAll('[data-chunk="5"] mark');
    const iAnnen = container.querySelectorAll('[data-chunk="4"] mark');
    expect(iValgt.length).toBe(1);
    expect(iAnnen.length).toBe(1);
    expect(iValgt[0]!.className).toBe(MARK_VALGT_KLASSE);
    expect(iAnnen[0]!.className).toBe(MARK_KLASSE);
    expect(MARK_VALGT_KLASSE).not.toBe(MARK_KLASSE);
  });

  it("sidehodet bruker egen søkenøkkel (ikke timer-rapportens)", () => {
    chunks = PDF_SIDE3;
    spionerScroll();
    const { container } = render(<Fulltekst prosjektId="p" documentId="d" valgtChunkIndex={null} />);
    expect(container.textContent).toContain("Side 3");
    expect(container.textContent).not.toContain("footerSide");
  });
});

describe("T8 høyre rute — semantisk setning markert i valgt chunk", () => {
  it("E1: setningen får semantisk stil + etikett, ikke gult", () => {
    chunks = [
      {
        id: "a",
        chunkIndex: 2,
        pageNumber: 2,
        sectionTitle: null,
        chunkText: "Kontraktssummen er fast. Ved forsinkelse påløper dagmulkt pr. kalenderdag. Sluttoppgjør etter NS 8405.",
      },
    ];
    spionerScroll();
    const { container } = render(
      <Fulltekst
        prosjektId="p"
        documentId="d"
        søkeord="bot ved forsinkelse"
        valgtChunkIndex={2}
        semantiskSetning="Ved forsinkelse påløper dagmulkt pr. kalenderdag."
      />,
    );
    const sem = container.querySelector('[data-semantisk="true"]');
    expect(sem?.textContent).toBe("Ved forsinkelse påløper dagmulkt pr. kalenderdag.");
    expect(sem?.querySelector("mark")).toBeNull();
    expect(container.textContent).toContain("semantisk treff");
  });
});

/**
 * Hel-avsnitt-markering (relay 29.10, Røstbakken «dagmulkt»). Målt på test `e8aac60a` via `aiSok.sok`:
 * alle ni treff kom med `semantiskSetning: null` — ingen av chunkene inneholder ordet eller stammen, så
 * `finnBesteSetning` (ai-sok-service.ts) gir null og S5 har ingenting å markere. Høyre rute stod da helt
 * umarkert etter rulling. Nå får valgt `[data-chunk]` egen klasse uansett setning/ordtreff.
 * Rød før: `VALGT_AVSNITT_KLASSE` fantes ikke, og ingen chunk hadde klasse.
 */
describe("Hel-avsnitt-markering — valgt chunk får bakgrunn + strek i venstre kant", () => {
  // Chunk 1036 = avsnitt 1037 i trefflista (1-indeksert). Teksten er den målte gab-chunken på test.
  const GAB_1036: Chunk[] = [
    {
      id: "a",
      chunkIndex: 1036,
      pageNumber: null,
      sectionTitle: null,
      chunkText: "Valgfritt\n$DRIFTS- OG VEDLIKEHOLDSDOKUMENTASJON\na)\tOmfang og prisgrunnlag\n\nPost omfatter gatevarmneanlegg (teknisk rom og utendørs anlegg)\n",
    },
    { id: "b", chunkIndex: 1037, pageNumber: null, sectionTitle: null, chunkText: "Protokoller over egenkontroller og innregulering.\n" },
  ];
  const klasser = VALGT_AVSNITT_KLASSE.split(" ");
  const harAvsnittsklasse = (el: Element | null) => !!el && klasser.every((k) => el.classList.contains(k));
  const markerte = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("[data-chunk]"))
      .filter((el) => harAvsnittsklasse(el))
      .map((el) => el.getAttribute("data-chunk"));

  it("rent semantisk treff uten setning og uten ordtreff: valgt chunk markert, naboen ikke", () => {
    chunks = GAB_1036;
    spionerScroll();
    const { container } = render(
      <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1036} semantiskSetning={null} />,
    );
    expect(harAvsnittsklasse(container.querySelector('[data-chunk="1036"]'))).toBe(true);
    expect(harAvsnittsklasse(container.querySelector('[data-chunk="1037"]'))).toBe(false);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.querySelector('[data-semantisk="true"]')).toBeNull();
  });

  it("bare ett avsnitt markert om gangen; markeringen følger valgtChunkIndex", () => {
    chunks = GAB_1036;
    spionerScroll();
    const { container, rerender } = render(
      <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1036} />,
    );
    expect(markerte(container)).toEqual(["1036"]);
    rerender(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1037} />);
    expect(markerte(container)).toEqual(["1037"]);
    rerender(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={null} />);
    expect(markerte(container)).toEqual([]);
  });

  it("ordtreff: valgt chunk har avsnittsklasse OG sterk <mark>; chunken er fortsatt inline (flyten i whitespace-pre-wrap brytes ikke)", () => {
    chunks = PDF_SIDE3;
    spionerScroll();
    const { container } = render(
      <Fulltekst prosjektId="p" documentId="d" søkeord="vernerunde" valgtChunkIndex={5} />,
    );
    const valgt = container.querySelector('[data-chunk="5"]')!;
    expect(valgt.tagName).toBe("SPAN");
    expect(harAvsnittsklasse(valgt)).toBe(true);
    expect(valgt.querySelector("mark")?.className).toBe(MARK_VALGT_KLASSE);
    expect(harAvsnittsklasse(container.querySelector('[data-chunk="4"]'))).toBe(false);
    // Inline + clone: bakgrunn og venstre strek på hvert linjefragment, ikke `block` (ville gitt linjeskift
    // ved hver chunk-grense). Palettfarge (sitedoc-secondary), ikke gul/amber (ordtreff) eller lilla (S5).
    expect(VALGT_AVSNITT_KLASSE).toContain("box-decoration-clone");
    expect(VALGT_AVSNITT_KLASSE).not.toMatch(/\bblock\b|yellow|amber|purple/);
  });
});

describe("T4 i trefflista — side XOR avsnitt", () => {
  const basis = {
    documentId: "d1",
    filename: "f.pdf",
    fileUrl: null,
    docType: "pdf",
    folderId: null,
    metode: "tekst" as const,
  };

  it("PDF-treff viser «side 2» og ikke «avsnitt»; DOCX-treff viser «avsnitt 4» og ikke «side»", () => {
    const { container } = render(
      <TreffListe
        søkeord="dagmulkt"
        valgtId={null}
        onVelgTreff={() => undefined}
        treff={[
          { ...basis, id: "t1", chunkText: "Dagmulkt.", chunkIndex: 1, pageNumber: 2, sectionTitle: null },
          { ...basis, id: "t2", documentId: "d2", chunkText: "Dagmulkt.", chunkIndex: 3, pageNumber: null, sectionTitle: null },
        ]}
      />,
    );
    const rader = container.querySelectorAll("button.block");
    expect(rader[0]!.textContent).toContain("side 2");
    expect(rader[0]!.textContent).not.toContain("avsnitt");
    expect(rader[1]!.textContent).toContain("avsnitt 4");
    expect(rader[1]!.textContent).not.toMatch(/side \d/);
  });
});
