// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * SØK-2 forrige/neste (dokumentsok-visning-spec § 2, variant A): enhet = ordforekomst (hver <mark> i hele
 * dokumentet, dokumentrekkefølge), teller «n av m», rundgang ved grense, ↑/↓ kun med fokus i høyre rute,
 * synk mot lista via `onVelgForekomst`, chunk-modus for rent semantiske dokumenter.
 * Rød før: ingen teller/knapper, ingen `data-forekomst`, og alle <mark> i valgt chunk var amber.
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

import { Fulltekst, MARK_KLASSE, MARK_VALGT_KLASSE, finnScrollMål } from "../fulltekst";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    resources: {
      nb: {
        translation: {
          "ftdSok.sideHode": "Side {{side}}",
          "ftdSok.semantiskTreff": "semantisk treff",
          "ftdSok.forrigeTreff": "Forrige forekomst (↑)",
          "ftdSok.nesteTreff": "Neste forekomst (↓)",
          "ftdSok.tellerForekomst": "{{n}} av {{m}}",
        },
      },
    },
  });
});

const originalScrollTo = Element.prototype.scrollTo;
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as Element["scrollTo"];
});
afterEach(() => {
  cleanup();
});
afterEach(() => {
  Element.prototype.scrollTo = originalScrollTo;
  Element.prototype.scrollTo = vi.fn() as Element["scrollTo"];
});

// Tre forekomster av «dagmulkt»: chunk 1 (side 1), chunk 2 (side 1, to stykker? nei: én), chunk 4 (side 2).
const DOK: Chunk[] = [
  { id: "a", chunkIndex: 1, pageNumber: 1, sectionTitle: null, chunkText: "Dagmulkt ved forsinkelse. " },
  { id: "b", chunkIndex: 2, pageNumber: 1, sectionTitle: null, chunkText: "Sluttoppgjør etter overtakelse. " },
  { id: "c", chunkIndex: 3, pageNumber: 2, sectionTitle: null, chunkText: "Satsen for dagmulkt er 1 promille. " },
  { id: "d", chunkIndex: 4, pageNumber: 2, sectionTitle: null, chunkText: "Maksimal dagmulkt er 10 prosent." },
];

function marks(container: HTMLElement) {
  return Array.from(container.querySelectorAll("mark"));
}
function amber(container: HTMLElement) {
  return marks(container).filter((m) => m.className === MARK_VALGT_KLASSE);
}
function teller(container: HTMLElement) {
  return container.querySelector("[data-teller]")?.textContent;
}
function knapp(container: HTMLElement, navn: "Forrige forekomst (↑)" | "Neste forekomst (↓)") {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${navn}"]`)!;
}

function renderIRute(ui: React.ReactElement) {
  return render(
    <div data-rullebeholder="" tabIndex={0}>
      {ui}
    </div>,
  );
}

describe("SØK-2 nav — forekomster i dokumentrekkefølge, teller, aktiv forekomst", () => {
  it("alle <mark> får data-forekomst 0..n-1 i dokumentrekkefølge; teller «1 av 3» ved liste-klikk på chunk 1", () => {
    chunks = DOK;
    const { container } = renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1} />);
    expect(marks(container).map((m) => m.getAttribute("data-forekomst"))).toEqual(["0", "1", "2"]);
    expect(teller(container)).toBe("1 av 3");
    // § 3: kun aktiv forekomst amber — andre gul, også når de ligger i samme chunk.
    expect(amber(container)).toHaveLength(1);
    expect(amber(container)[0]!.getAttribute("data-forekomst")).toBe("0");
    expect(marks(container)[1]!.className).toBe(MARK_KLASSE);
  });

  it("liste-klikk på chunk 3 → teller «2 av 3» (første forekomst i valgt chunk, ikke 1)", () => {
    chunks = DOK;
    const { container } = renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={3} />);
    expect(teller(container)).toBe("2 av 3");
    expect(amber(container)[0]!.getAttribute("data-forekomst")).toBe("1");
  });

  it("neste/forrige går i rundgang begge veier og melder chunk-bytte via onVelgForekomst", () => {
    chunks = DOK;
    const onVelg = vi.fn();
    const { container, rerender } = renderIRute(
      <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1} onVelgForekomst={onVelg} />,
    );
    // 1 → 2 (chunk 3): siden flytter valgtChunkIndex; rerender med ny prop må IKKE nullstille telleren.
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).toHaveBeenLastCalledWith(3);
    rerender(
      <div data-rullebeholder="" tabIndex={0}>
        <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={3} onVelgForekomst={onVelg} />
      </div>,
    );
    expect(teller(container)).toBe("2 av 3");
    expect(amber(container)[0]!.getAttribute("data-forekomst")).toBe("1");
    // 2 → 3 (chunk 4)
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).toHaveBeenLastCalledWith(4);
    rerender(
      <div data-rullebeholder="" tabIndex={0}>
        <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={4} onVelgForekomst={onVelg} />
      </div>,
    );
    expect(teller(container)).toBe("3 av 3");
    // 3 → 1: rundgang (chunk 1)
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).toHaveBeenLastCalledWith(1);
    rerender(
      <div data-rullebeholder="" tabIndex={0}>
        <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1} onVelgForekomst={onVelg} />
      </div>,
    );
    expect(teller(container)).toBe("1 av 3");
    // 1 → 3: rundgang bakover (chunk 4)
    fireEvent.click(knapp(container, "Forrige forekomst (↑)"));
    expect(onVelg).toHaveBeenLastCalledWith(4);
    rerender(
      <div data-rullebeholder="" tabIndex={0}>
        <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={4} onVelgForekomst={onVelg} />
      </div>,
    );
    expect(teller(container)).toBe("3 av 3");
    expect(amber(container)[0]!.getAttribute("data-forekomst")).toBe("2");
  });

  it("to forekomster i samme chunk: neste flytter amber uten å melde chunk-bytte", () => {
    chunks = [
      { id: "a", chunkIndex: 0, pageNumber: null, sectionTitle: null, chunkText: "Dagmulkt. Enda en dagmulkt her." },
    ];
    const onVelg = vi.fn();
    const { container } = renderIRute(
      <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={0} onVelgForekomst={onVelg} />,
    );
    expect(teller(container)).toBe("1 av 2");
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).not.toHaveBeenCalled();
    expect(teller(container)).toBe("2 av 2");
    expect(amber(container)[0]!.getAttribute("data-forekomst")).toBe("1");
    expect(marks(container)[0]!.className).toBe(MARK_KLASSE);
  });

  it("nav ruller til aktiv forekomst, ikke til chunk-ankeret", () => {
    chunks = [
      { id: "a", chunkIndex: 0, pageNumber: null, sectionTitle: null, chunkText: "Dagmulkt. Enda en dagmulkt her." },
    ];
    const { container } = renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={0} />);
    expect(finnScrollMål(container, 0, 1)?.getAttribute("data-forekomst")).toBe("1");
    expect(finnScrollMål(container, 0)?.getAttribute("data-chunk")).toBe("0");
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect");
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    const målte = spy.mock.instances.filter((el) => (el as Element).hasAttribute("data-forekomst"));
    expect(målte.map((el) => (el as Element).getAttribute("data-forekomst"))).toContain("1");
    spy.mockRestore();
  });
});

describe("SØK-2 nav — tastatur kun med fokus i ruta", () => {
  it("↓ utenfor ruta endrer ingenting; ↓ med fokus i ruta flytter amber og hindrer standard-rulling", () => {
    chunks = [
      { id: "a", chunkIndex: 0, pageNumber: null, sectionTitle: null, chunkText: "Dagmulkt. Enda en dagmulkt her." },
    ];
    const { container } = renderIRute(<Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={0} />);
    // Utenfor: document.body (søkefeltet/lista) — ingen reaksjon.
    const utenfor = fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(utenfor).toBe(true); // ikke preventDefault
    expect(teller(container)).toBe("1 av 2");
    // Med fokus i ruta:
    const rute = container.querySelector<HTMLElement>("[data-rullebeholder]")!;
    rute.focus();
    const innenfor = fireEvent.keyDown(rute, { key: "ArrowDown" });
    expect(innenfor).toBe(false); // preventDefault kalt
    expect(teller(container)).toBe("2 av 2");
    fireEvent.keyDown(rute, { key: "ArrowUp" });
    expect(teller(container)).toBe("1 av 2");
    // Modifikator (cmd+↓ = hopp til bunn) slippes gjennom.
    const mod = fireEvent.keyDown(rute, { key: "ArrowDown", metaKey: true });
    expect(mod).toBe(true);
    expect(teller(container)).toBe("1 av 2");
  });
});

describe("SØK-2 nav — synk mot lista og rent semantisk dokument", () => {
  it("forekomst i chunk utenfor lista: onVelgForekomst(chunkIndex) kalles — siden avgjør om valgtTreffId beholdes", () => {
    chunks = DOK;
    const onVelg = vi.fn();
    const { container } = renderIRute(
      <Fulltekst
        prosjektId="p"
        documentId="d"
        søkeord="dagmulkt"
        valgtChunkIndex={1}
        treffChunkIndekser={[1, 4]}
        onVelgForekomst={onVelg}
      />,
    );
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    // chunk 3 er ikke i lista — Fulltekst melder likevel chunkIndex 3; lista beholder valgt treff (page-logikk).
    expect(onVelg).toHaveBeenCalledWith(3);
  });

  it("rent semantisk dokument (0 <mark>): enhet = dokumentets treff-chunks fra lista, teller over chunks", () => {
    chunks = DOK;
    const onVelg = vi.fn();
    const { container, rerender } = renderIRute(
      <Fulltekst
        prosjektId="p"
        documentId="d"
        søkeord="bot"
        valgtChunkIndex={2}
        treffChunkIndekser={[2, 4]}
        onVelgForekomst={onVelg}
      />,
    );
    expect(marks(container)).toHaveLength(0);
    expect(teller(container)).toBe("1 av 2");
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).toHaveBeenLastCalledWith(4);
    rerender(
      <div data-rullebeholder="" tabIndex={0}>
        <Fulltekst
          prosjektId="p"
          documentId="d"
          søkeord="bot"
          valgtChunkIndex={4}
          treffChunkIndekser={[2, 4]}
          onVelgForekomst={onVelg}
        />
      </div>,
    );
    expect(teller(container)).toBe("2 av 2");
    fireEvent.click(knapp(container, "Neste forekomst (↓)"));
    expect(onVelg).toHaveBeenLastCalledWith(2); // rundgang
  });

  it("ingen <mark> og ingen treff-chunks → kontrollen skjules, filnavn-raden står", () => {
    chunks = DOK.map((c) => ({ ...c, document: { filename: "kontrakt.pdf" } })) as Chunk[];
    const { container } = renderIRute(
      <Fulltekst prosjektId="p" documentId="d" søkeord="bot" valgtChunkIndex={2} treffChunkIndekser={[]} />,
    );
    expect(container.querySelector("[data-teller]")).toBeNull();
    expect(container.querySelector('button[aria-label="Neste forekomst (↓)"]')).toBeNull();
    expect(container.querySelector("[data-nav-rad]")?.textContent).toContain("kontrakt.pdf");
  });

  it("liste-klikk (ny valgtChunkIndex uten nav) nullstiller telleren til første forekomst i chunken", async () => {
    chunks = DOK;
    const { container, rerender } = renderIRute(
      <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={4} />,
    );
    expect(teller(container)).toBe("3 av 3");
    await act(async () => {
      rerender(
        <div data-rullebeholder="" tabIndex={0}>
          <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={1} />
        </div>,
      );
    });
    expect(teller(container)).toBe("1 av 3");
    // Chunk uten forekomst valgt fra lista (semantisk rad i blandet dokument): «– av 3».
    await act(async () => {
      rerender(
        <div data-rullebeholder="" tabIndex={0}>
          <Fulltekst prosjektId="p" documentId="d" søkeord="dagmulkt" valgtChunkIndex={2} />
        </div>,
      );
    });
    expect(teller(container)).toBe("– av 3");
    expect(amber(container)).toHaveLength(0);
  });
});
