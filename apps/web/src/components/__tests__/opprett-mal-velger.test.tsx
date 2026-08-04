// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { OpprettMalVelger, type VelgerGruppe } from "../OpprettMalVelger";

/**
 * Opprett-velger — regresjons-fasit. Dekker Funn C (fabel-spec § 5): markør init på sist-brukt (§ 1),
 * ↓ + Enter oppretter neste mal (§ 5.1), åpne→Enter = hurtig-sti (§ 5.2), markør krysser gruppegrense
 * flatt (§ 5.4), «Sist brukt»-etikett følger malen, «Opprett»-knapp. PLUSS gruppering-v2 (§ 9): begge
 * overskrifter synlige, markør flatt over TO overskrifter i ett trykk, prefiks-sort, HMS-seksjon sist.
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

// Én faggruppe med to flyt-undergrupper (m1,m2 i Flyt A; m3 i Flyt B) → tester flat markør over
// flyt-gruppegrense (Funn C § 5.4) innenfor samme faggruppe-seksjon.
function byggGrupper(onVelg: { m1: () => void; m2: () => void; m3: () => void }): VelgerGruppe[] {
  return [
    { key: "fag1", overskrift: { navn: "Tømrer" }, undergrupper: [
      { key: "flytA", overskrift: { navn: "Flyt A" }, maler: [
        { radKey: "flytA-m1", malId: "m1", malNavn: "Mal 1", onVelg: onVelg.m1 },
        { radKey: "flytA-m2", malId: "m2", malNavn: "Mal 2", onVelg: onVelg.m2 },
      ] },
      { key: "flytB", overskrift: { navn: "Flyt B" }, maler: [
        { radKey: "flytB-m3", malId: "m3", malNavn: "Mal 3", onVelg: onVelg.m3 },
      ] },
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
    expect(screen.getByTestId("opprettvelger-rad-m2").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("opprettvelger-rad-m1").getAttribute("aria-selected")).toBe("false");
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

  it("§5.4: markør krysser flyt-gruppegrense flatt med ↓ (m2 → m3)", () => {
    const onVelg = { m1: vi.fn(), m2: vi.fn(), m3: vi.fn() };
    render_("m2", onVelg); // markør på m2 (siste i Flyt A)
    const liste = screen.getByRole("listbox");
    fireEvent.keyDown(liste, { key: "ArrowDown" }); // → m3 (første i Flyt B), flatt over grensen
    fireEvent.keyDown(liste, { key: "Enter" });
    expect(onVelg.m3).toHaveBeenCalledTimes(1);
  });

  it("§2: ingen wrap — ↑ på første rad blir stående", () => {
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

describe("OpprettMalVelger — gruppering-v2 regresjons-fasit (§ 9)", () => {
  it("§9.1: én faggruppe + én flyt + 2 maler → begge overskrifter synlige", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OpprettMalVelger
          grupper={[
            { key: "fag", overskrift: { navn: "Tømrer" }, undergrupper: [
              { key: "flyt", overskrift: { navn: "Egenkontroll" }, maler: [
                { radKey: "r1", malId: "a", malNavn: "Mal A", onVelg: vi.fn() },
                { radKey: "r2", malId: "b", malNavn: "Mal B", onVelg: vi.fn() },
              ] },
            ] },
          ]}
          sistBruktMalId={null}
          opprettPending={false}
        />
      </I18nextProvider>,
    );
    expect(screen.getByText("Tømrer")).toBeTruthy();
    expect(screen.getByText("Egenkontroll")).toBeTruthy();
  });

  it("§9.2: ↓ hopper flatt over TO overskrifter (faggruppe A/flyt 2 siste rad → faggruppe B/flyt 1 første)", () => {
    const onVelg = { mA2: vi.fn(), mB1: vi.fn() };
    render(
      <I18nextProvider i18n={i18n}>
        <OpprettMalVelger
          grupper={[
            { key: "fagB", overskrift: { navn: "B-fag" }, undergrupper: [
              { key: "b1", overskrift: { navn: "Flyt B1" }, maler: [
                { radKey: "b1r", malId: "mB1", malNavn: "Mal B1", onVelg: onVelg.mB1 },
              ] },
              { key: "b2", overskrift: { navn: "Flyt B2" }, maler: [
                { radKey: "b2r", malId: "mB2", malNavn: "Mal B2", onVelg: vi.fn() },
              ] },
            ] },
            { key: "fagA", overskrift: { navn: "A-fag" }, undergrupper: [
              { key: "a1", overskrift: { navn: "Flyt A1" }, maler: [
                { radKey: "a1r", malId: "mA1", malNavn: "Mal A1", onVelg: vi.fn() },
              ] },
              { key: "a2", overskrift: { navn: "Flyt A2" }, maler: [
                { radKey: "a2r", malId: "mA2", malNavn: "Mal A2", onVelg: onVelg.mA2 },
              ] },
            ] },
          ]}
          sistBruktMalId="mA2" // markør på siste rad i faggruppe A (A-fag sorteres først)
          opprettPending={false}
        />
      </I18nextProvider>,
    );
    const liste = screen.getByRole("listbox");
    fireEvent.keyDown(liste, { key: "ArrowDown" }); // mA2 → mB1 (hopper Flyt-A2-slutt + B-fag + Flyt-B1)
    fireEvent.keyDown(liste, { key: "Enter" });
    expect(onVelg.mB1).toHaveBeenCalledTimes(1);
    expect(onVelg.mA2).not.toHaveBeenCalled();
  });

  it("§9.3: prefiks-sort — «KB2-010» før «KB2-100»; mal uten prefiks nederst", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OpprettMalVelger
          grupper={[
            { key: "fag", overskrift: { navn: "Fag" }, undergrupper: [
              { key: "flyt", overskrift: { navn: "Flyt" }, maler: [
                { radKey: "x", malId: "utenprefiks", malNavn: "Uten prefiks", onVelg: vi.fn() },
                { radKey: "y", malId: "kb100", malNavn: "Hundre", prefix: "KB2-100", onVelg: vi.fn() },
                { radKey: "z", malId: "kb010", malNavn: "Ti", prefix: "KB2-010", onVelg: vi.fn() },
              ] },
            ] },
          ]}
          sistBruktMalId={null}
          opprettPending={false}
        />
      </I18nextProvider>,
    );
    const rader = screen.getAllByRole("option").map((el) => el.getAttribute("data-testid"));
    expect(rader).toEqual([
      "opprettvelger-rad-kb010",
      "opprettvelger-rad-kb100",
      "opprettvelger-rad-utenprefiks",
    ]);
  });

  it("HMS-seksjon (sorterSist) pinnes nederst uansett alfabet", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OpprettMalVelger
          grupper={[
            { key: "hms", overskrift: { navn: "HMS" }, sorterSist: true, undergrupper: [
              { key: "hms-u", maler: [{ radKey: "h", malId: "hmsmal", malNavn: "HMS-avvik", onVelg: vi.fn() }] },
            ] },
            { key: "fag", overskrift: { navn: "Ventilasjon" }, undergrupper: [
              { key: "flyt", overskrift: { navn: "Flyt" }, maler: [
                { radKey: "v", malId: "vmal", malNavn: "V-mal", onVelg: vi.fn() },
              ] },
            ] },
          ]}
          sistBruktMalId={null}
          opprettPending={false}
        />
      </I18nextProvider>,
    );
    // «Ventilasjon» (V) alfabetisk etter «HMS» (H), men HMS pinnes sist → V-mal først, HMS-mal sist.
    const rader = screen.getAllByRole("option").map((el) => el.getAttribute("data-testid"));
    expect(rader).toEqual(["opprettvelger-rad-vmal", "opprettvelger-rad-hmsmal"]);
  });
});
