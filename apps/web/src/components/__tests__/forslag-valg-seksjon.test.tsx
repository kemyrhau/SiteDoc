// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import nb from "@sitedoc/shared/src/i18n/nb.json";
import {
  byggForsonInputFraValg,
  type ForsonRad,
  type ForsonInput,
} from "@sitedoc/shared";
import { ForslagValgSeksjon } from "@/components/timer/ForslagValgSeksjon";

/**
 * V19-C (C-1) gate: arbeiderens «Bekreft» skal bygge forsonDagskort-input via den
 * DELTE byggForsonInputFraValg — ikke en egen web-kopi. Testen feiler rødt uten
 * komponenten (ingen Bekreft finnes) og uten at den kaller helperen (input blir feil).
 * Dekker også Q3(b): et tidsrom på bare én side er ikke valgbart, og lesevisningen
 * (C-2) har ingen Bekreft-knapp.
 */

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: { nb: { translation: nb as Record<string, string> } },
    interpolation: { escapeValue: false },
  });
});

afterEach(() => cleanup());

function rad(
  id: string,
  fraTid: string | null,
  tilTid: string | null,
  timer: number,
): ForsonRad {
  return { id, projectId: "p1", lonnsartId: "l1", aktivitetId: "a1", timer, fraTid, tilTid };
}

function tegn(
  sedel: ForsonRad[],
  forslag: ForsonRad[],
  onBekreft: (i: ForsonInput) => void,
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ForslagValgSeksjon sedelRader={sedel} forslag={forslag} onBekreft={onBekreft} />
    </I18nextProvider>,
  );
}

describe("ForslagValgSeksjon (C-1)", () => {
  it("«Bruk mobilen for hele dagen» + Bekreft bygger input via byggForsonInputFraValg", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [rad("mob1", "07:00", "15:30", 8)];
    const onBekreft = vi.fn();
    tegn(sedel, forslag, onBekreft);

    fireEvent.click(screen.getByText("Bruk mobilen for hele dagen"));
    fireEvent.click(screen.getByText("Bekreft valg"));

    expect(onBekreft).toHaveBeenCalledTimes(1);
    // Fasiten er nøyaktig det den delte helperen gir for «velg forslag for alt».
    expect(onBekreft.mock.calls[0]![0]).toEqual(
      byggForsonInputFraValg(sedel, forslag, { mob1: "forslag" }),
    );
    // Konkret: web-raden erstattes in-place (8 t), ingen ny rad (ikke 15,5 t).
    const input = onBekreft.mock.calls[0]![0] as ForsonInput;
    expect(input.nyeRader).toHaveLength(0);
    expect(input.oppdateringer).toMatchObject([{ id: "web1", timer: 8 }]);
  });

  it("uten valg → Bekreft beholder PC (konservativt, tom input)", () => {
    const sedel = [rad("web1", "07:00", "15:00", 7.5)];
    const forslag = [rad("mob1", "07:00", "15:30", 8)];
    const onBekreft = vi.fn();
    tegn(sedel, forslag, onBekreft);

    fireEvent.click(screen.getByText("Bekreft valg"));
    // V19.9.7: byggForsonInputFraValg returnerer også `slettinger` (tom for ren V19-A).
    expect(onBekreft.mock.calls[0]![0]).toEqual({ oppdateringer: [], nyeRader: [], slettinger: [] });
  });

  it("et tidsrom på bare én side er ikke valgbart (Q3(b)) — radio bare på parede slots", () => {
    // web 07–11 og en IKKE-overlappende forslagsrad 12–16 → to ensidige slots.
    const sedel = [rad("web1", "07:00", "11:00", 4)];
    const forslag = [rad("mob2", "12:00", "16:00", 4)];
    tegn(sedel, forslag, vi.fn());
    // Ingen av sidene er en radio (ingen parede slots).
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    // Og «finnes bare på én side»-notisen vises.
    expect(screen.getAllByText(/Finnes bare på én side/).length).toBeGreaterThan(0);
  });

  it("parede slots gir to radio-valg (PC + mobil)", () => {
    tegn([rad("web1", "07:00", "15:00", 7.5)], [rad("mob1", "07:00", "15:30", 8)], vi.fn());
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("lesevisning (C-2): ingen Bekreft-knapp, ingen radio, viser «venter siden»", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ForslagValgSeksjon
          sedelRader={[rad("web1", "07:00", "15:00", 7.5)]}
          forslag={[rad("mob1", "07:00", "15:30", 8)]}
          modus="lesevisning"
          venterSiden={new Date("2026-10-04T08:00:00Z")}
        />
      </I18nextProvider>,
    );
    expect(screen.queryByText("Bekreft valg")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/venter på arbeiderens valg siden/)).toBeTruthy();
  });
});
