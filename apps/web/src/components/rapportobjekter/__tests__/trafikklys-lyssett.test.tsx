// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, PROSJEKT_MODULER } from "@sitedoc/shared";
import { TrafikklysObjekt } from "../TrafikklysObjekt";

/**
 * 🔴 Valgbart lyssett (krav c pkt 1, 2, 4 — web). Rendreren skal lese `objekt.config.options` når
 * de finnes og falle til det kanoniske settet ellers. En test som bare sjekker at det ikke kastes
 * er en tillatelse, ikke en test — derfor kreves NØYAKTIG antall lys og de faktiske etikettene.
 *
 * pkt 4 rendrer de TO systemmalene som lyver i dag, hentet fra deres FAKTISKE deklarasjoner i
 * PROSJEKT_MODULER (ikke en kopi skrevet her) — de skal vise sitt eget lyssett, ikke Godkjent/
 * Anmerkning/Avvik/Ikke relevant.
 */

const nbMap = nb as Record<string, string>;

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: "nb",
      fallbackLng: "nb",
      resources: { nb: { translation: nbMap } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  }
});
afterEach(cleanup);

const noop = () => {};

function objektMed(options?: unknown) {
  return { config: options === undefined ? {} : { options } } as never;
}

function finnTrafikklys(slug: string, label: string): { options: unknown } {
  const modul = PROSJEKT_MODULER.find((m) => m.slug === slug);
  const objekt = modul?.maler.flatMap((m) => m.objekter).find((o) => o.type === "traffic_light" && o.label === label);
  if (!objekt) throw new Error(`Fant ikke traffic_light «${label}» i «${slug}»`);
  return { options: (objekt.config as { options: unknown }).options };
}

describe("TrafikklysObjekt — valgbart lyssett", () => {
  it("(c1) egne options → NØYAKTIG dem, i rekkefølge, med de etikettene — ikke kanonisk sett", () => {
    render(
      <TrafikklysObjekt
        objekt={objektMed([
          { value: "red", label: "Åpent" },
          { value: "yellow", label: "Under behandling" },
          { value: "green", label: "Lukket" },
        ])}
        verdi={null}
        onEndreVerdi={noop}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("Åpent")).toBeTruthy();
    expect(screen.getByText("Under behandling")).toBeTruthy();
    expect(screen.getByText("Lukket")).toBeTruthy();
    // Det kanoniske settet skal IKKE ha lekket inn.
    expect(screen.queryByText(nbMap["standardopsjon.anmerkning"]!)).toBeNull();
    expect(screen.queryByText(nbMap["standardopsjon.ikkeRelevant"]!)).toBeNull();
  });

  it("(c2) uten options → kanonisk TRAFIKKLYS_VALG uendret (fire lys, i18n-etiketter)", () => {
    render(<TrafikklysObjekt objekt={objektMed()} verdi={null} onEndreVerdi={noop} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    for (const nokkel of ["godkjent", "anmerkning", "avvik", "ikkeRelevant"]) {
      expect(screen.getByText(nbMap[`standardopsjon.${nokkel}`]!)).toBeTruthy();
    }
  });

  it("(c4) HMS-avvik «Status» rendrer tre lys Åpent/Under behandling/Lukket (faktisk deklarasjon)", () => {
    render(<TrafikklysObjekt objekt={objektMed(finnTrafikklys("hms-avvik", "Status").options)} verdi={null} onEndreVerdi={noop} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText(nbMap["standardopsjon.apent"]!)).toBeTruthy();
    expect(screen.getByText(nbMap["standardopsjon.underBehandling"]!)).toBeTruthy();
    expect(screen.getByText(nbMap["standardopsjon.lukket"]!)).toBeTruthy();
    expect(screen.queryByText(nbMap["standardopsjon.godkjent"]!)).toBeNull();
  });

  it("(c4) Godkjenning «Beslutning» rendrer Avvist + Ikke behandlet (faktisk deklarasjon)", () => {
    render(<TrafikklysObjekt objekt={objektMed(finnTrafikklys("godkjenning", "Beslutning").options)} verdi={null} onEndreVerdi={noop} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText(nbMap["standardopsjon.avvist"]!)).toBeTruthy();
    expect(screen.getByText(nbMap["standardopsjon.ikkeBehandlet"]!)).toBeTruthy();
    expect(screen.getByText(nbMap["standardopsjon.delvisGodkjent"]!)).toBeTruthy();
    // «Avvik» (kanonisk rød) skal IKKE vises — malen sier «Avvist».
    expect(screen.queryByText(nbMap["standardopsjon.avvik"]!)).toBeNull();
  });
});
