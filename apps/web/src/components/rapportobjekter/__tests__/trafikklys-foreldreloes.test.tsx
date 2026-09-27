// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { nb } from "@sitedoc/shared";
import { TrafikklysObjekt } from "../TrafikklysObjekt";

/**
 * 🔴 Foreldreløs trafikklys-verdi (del E, alene). `Checklist.templateId` er en levende FK:
 * svarene bor i `data` Json, opsjonene i malen. Er `valgtVerdi` en streng utenfor
 * `TRAFIKKLYS_VALG`, blir `erValgt` falsk for ALLE brikkene → feltet ser UBESVART ut mens
 * databasen har et svar. Fallbacken skal VISE den rå verdien, ikke svelge den.
 *
 * En test som bare sjekker at det ikke kastes er en tillatelse, ikke en test — derfor kreves
 * den RÅ verdien i utdataet.
 */

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: "nb",
      fallbackLng: "nb",
      resources: { nb: { translation: nb as Record<string, string> } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  }
});
afterEach(cleanup);

const noop = () => {};

describe("TrafikklysObjekt — foreldreløs verdi vises rått", () => {
  it("ukjent verdi utenfor TRAFIKKLYS_VALG → den RÅ verdien står i utdataet", () => {
    render(<TrafikklysObjekt objekt={{} as never} verdi="foreldreloes-42" onEndreVerdi={noop} />);
    expect(screen.getByText("foreldreloes-42")).toBeTruthy();
  });

  it("gyldig verdi (green) → INGEN foreldreløs-brikke (regresjonsvakt mot falsk-positiv)", () => {
    render(<TrafikklysObjekt objekt={{} as never} verdi="green" onEndreVerdi={noop} />);
    expect(screen.queryByTestId("trafikklys-foreldreloes")).toBeNull();
  });
});
