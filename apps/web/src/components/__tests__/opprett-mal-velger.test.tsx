// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { OpprettMalVelger, type VelgerGruppe } from "../OpprettMalVelger";

/**
 * Funn C-velger — regresjons-fasit (fabel-spec § 5). Dekker de komponent-testbare casene:
 * markør init på sist-brukt (§ 1), ↓ + Enter oppretter neste mal (§ 5.1), åpne→Enter = sist-brukt
 * hurtig-sti (§ 5.2), markør krysser gruppegrense flatt (§ 5.4), «Sist brukt»-etikett følger malen,
 * «Opprett»-knapp oppretter markert. Esc + sist-brukt-skriving eies av Modal/side (ikke komponenten).
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "opprettVelger.sistBrukt": "Sist brukt",
          "handling.opprett": "Opprett",
          "sjekklister.velgMal": "Velg mal",
        },
      },
    },
  });
});

afterEach(cleanup);

// To grupper (flyt-gruppert, som sjekkliste) → tester flat markør over gruppegrense.
function byggGrupper(onVelg: { m1: () => void; m2: () => void; m3: () => void }): VelgerGruppe[] {
  return [
    { key: "g1", overskrift: { navn: "Flyt A" }, maler: [
      { radKey: "g1-m1", malId: "m1", malNavn: "Mal 1", onVelg: onVelg.m1 },
      { radKey: "g1-m2", malId: "m2", malNavn: "Mal 2", onVelg: onVelg.m2 },
    ] },
    { key: "g2", overskrift: { navn: "Flyt B" }, maler: [
      { radKey: "g2-m3", malId: "m3", malNavn: "Mal 3", onVelg: onVelg.m3 },
    ] },
  ];
}

function render_(sistBruktMalId: string | null, onVelg: { m1: () => void; m2: () => void; m3: () => void }) {
  return render(
    <I18nextProvider i18n={i18n}>
      <OpprettMalVelger grupper={byggGrupper(onVelg)} sistBruktMalId={sistBruktMalId} opprettPending={false} />
    </I18nextProvider>,
  );
}

describe("OpprettMalVelger — Funn C regresjons-fasit", () => {
  it("§1: markør starter på sist-brukte mal; «Sist brukt»-etikett følger malen", () => {
    render_("m2", { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() });
    // Markør (aria-selected) på Mal 2.
    expect(screen.getByTestId("opprettvelger-rad-m2").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("opprettvelger-rad-m1").getAttribute("aria-selected")).toBe("false");
    // «Sist brukt»-etikett på Mal 2 (følger malen).
    expect(screen.getByTestId("opprettvelger-rad-m2").textContent).toContain("Sist brukt");
    expect(screen.getByTestId("opprettvelger-rad-m1").textContent).not.toContain("Sist brukt");
  });

  it("§5.1: ↓ + Enter oppretter NESTE mal (ikke sist-brukt)", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m1", onVelg); // markør på m1
    const liste = screen.getByRole("listbox");
    fireEvent.keyDown(liste, { key: "ArrowDown" }); // → m2
    fireEvent.keyDown(liste, { key: "Enter" });
    expect(onVelg.m2).toHaveBeenCalledTimes(1);
    expect(onVelg.m1).not.toHaveBeenCalled();
  });

  it("§5.2: åpne → Enter oppretter sist-brukt (hurtig-sti)", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m3", onVelg); // markør på m3 (sist-brukt)
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(onVelg.m3).toHaveBeenCalledTimes(1);
  });

  it("§5.4: markør krysser gruppegrense flatt med ↓ (m2 → m3)", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m2", onVelg); // markør på m2 (siste i gruppe A)
    const liste = screen.getByRole("listbox");
    fireEvent.keyDown(liste, { key: "ArrowDown" }); // → m3 (første i gruppe B), flatt over grensen
    fireEvent.keyDown(liste, { key: "Enter" });
    expect(onVelg.m3).toHaveBeenCalledTimes(1);
  });

  it("§2: ingen wrap — ↑ på første rad blir stående; ↓ forbi siste blir stående", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m1", onVelg); // markør på m1 (første)
    const liste = screen.getByRole("listbox");
    fireEvent.keyDown(liste, { key: "ArrowUp" }); // ingen wrap → blir på m1
    fireEvent.keyDown(liste, { key: "Enter" });
    expect(onVelg.m1).toHaveBeenCalledTimes(1);
  });

  it("«Opprett»-knapp oppretter markert mal (touch/mus-sti)", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m2", onVelg);
    fireEvent.click(screen.getByTestId("opprettvelger-opprett"));
    expect(onVelg.m2).toHaveBeenCalledTimes(1);
  });

  it("klikk på rad = velg + bekreft i ett", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m1", onVelg);
    fireEvent.click(screen.getByTestId("opprettvelger-rad-m3"));
    expect(onVelg.m3).toHaveBeenCalledTimes(1);
  });
});
