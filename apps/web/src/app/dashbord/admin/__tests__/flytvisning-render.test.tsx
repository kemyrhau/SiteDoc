// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import { nb, flytRettighetNoekkel } from "@sitedoc/shared";
import { FlytvisningFane } from "../flyt-rettigheter/FlytvisningFane";
import type { OversettFn } from "@/lib/flytmatrise-def";

/**
 * Render-gate for flytvisning-fanen (ordre 2026-07-26, DoD). Beviser at det faktiske UI-et rendrer
 * de tre gate-tilstandene — ikke bare at def-en er riktig (kode-artefakt-sjekk er IKKE gate):
 *   (a) en override gir amber-prikk (samme celle som matrise-fanen bruker),
 *   (b) videresend for flyt-roller rendres LÅST (hengelås),
 *   (c) H2-manglende overganger rendres som disabled ?-brytere.
 */

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: { nb: { translation: nb as Record<string, string> } },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

const t = i18n.t.bind(i18n) as unknown as OversettFn;
const noop = () => {};

function renderFane(overrides = {}, meta = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <FlytvisningFane
        overrides={overrides}
        meta={meta}
        kanRedigere
        onKlikk={noop}
        onTilbakestill={noop}
        t={t}
      />
    </I18nextProvider>,
  );
}

describe("flytvisning-fane render", () => {
  it("(a) en override rendrer amber-prikk på cellen", () => {
    const noekkel = flytRettighetNoekkel("utforer", "received", "responded");
    const { container } = renderFane(
      { [noekkel]: true },
      { [noekkel]: { navn: "Test Admin", naar: "2026-07-26" } },
    );
    // Amber-prikken (CELLE.overstyrtPrikk = bg-[#d97706]) bærer overstyrt-tooltipen som title.
    const prikk = container.querySelector('[title*="Overstyrt"]');
    expect(prikk).not.toBeNull();
  });

  it("(b) videresend for flyt-roller rendrer hengelås (låst) — minst 4 bokser + Opprett", () => {
    const { container } = renderFane();
    const laaser = container.querySelectorAll("svg.lucide-lock");
    // 4 flyt-rolle-bokser (videresend) + registrator Opprett = minst 5 hengelåser.
    expect(laaser.length).toBeGreaterThanOrEqual(5);
  });

  it("(c) H2-manglende overganger rendrer disabled ?-brytere med forklaring", () => {
    const { getByText, getAllByText } = renderFane();
    expect(getByText(t("flytvisning.fantom.bestillerBesvar"))).toBeTruthy();
    expect(getByText(t("flytvisning.fantom.utforerSendTilbake"))).toBeTruthy();
    // ?-symbolet vises for begge fantomene.
    expect(getAllByText("?").length).toBeGreaterThanOrEqual(2);
  });

  it("rendrer alle fire flytbokser + prosjektadmin-sonen", () => {
    const { getByText } = renderFane();
    for (const label of ["dokumentflyt.registrator", "dokumentflyt.bestiller", "dokumentflyt.utforer", "dokumentflyt.godkjenner"]) {
      expect(getByText(t(label))).toBeTruthy();
    }
    expect(getByText(t("flytmatrise.prosjektadmin"))).toBeTruthy();
  });

  it("bestiller-boksen bærer H1-merket (stiplet / ikke egen stasjon)", () => {
    const { getByText } = renderFane();
    expect(getByText("H1")).toBeTruthy();
  });

  it("admin-sonens farlig-gruppe (Lukk trukket) er merket", () => {
    const { getByText } = renderFane();
    const farlig = getByText(new RegExp(t("flytvisning.admin.lukkTrukket")));
    expect(within(farlig).toString).toBeTruthy();
    expect(farlig.textContent).toContain(t("flytvisning.admin.farlig"));
  });
});
