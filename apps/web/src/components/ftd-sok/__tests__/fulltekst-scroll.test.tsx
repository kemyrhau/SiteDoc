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

import { Fulltekst, MARK_KLASSE, MARK_VALGT_KLASSE, RULLE_MARG } from "../fulltekst";
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
