// @vitest-environment jsdom
/**
 * Runde 9 (Kenneth 2026-11-28): nedtrekk med flere enn 5 valg har søk (`SokbarNedtrekk`).
 * Lukket ser den ut som nedtrekket; høyst 5 valg er vanlig `<select>`.
 * Pluss kildetekst-vakter for «Lagre over testpanelet» — layout kan ikke måles i jsdom (målt i Chromium).
 *
 * Negativkontroll mot develop `c37a2790`: komponenten fantes ikke, `ProsjektRadVelger` søkte først
 * over 7, «Rediger timer-rad» hadde ingen fast knapperad og `RedigerRadModal` hadde `overflow-hidden`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SOK_TERSKEL, SokbarNedtrekk } from "./SokbarNedtrekk";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));

afterEach(cleanup);

const ARTER = ["Timelønn", "Overtid 50 %", "Overtid 100 %", "Reisetid", "Kjøring", "Helligdag"];

function vis(antall: number, value = "", onChange = vi.fn(), onBlur = vi.fn()) {
  render(
    <SokbarNedtrekk aria-label="Lønnsart" value={value} onChange={onChange} onBlur={onBlur} className="w-full rounded border px-3 py-2 text-sm">
      <option value="">— Velg —</option>
      {ARTER.slice(0, antall).map((a, i) => (
        <option key={a} value={`l${i}`}>
          {a}
        </option>
      ))}
    </SokbarNedtrekk>,
  );
  return { onChange, onBlur };
}

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–5 i testpanelet, runde 9) — SokbarNedtrekk", () => {
  it("terskelen er 5", () => {
    expect(SOK_TERSKEL).toBe(5);
  });

  it("høyst 5 valg: vanlig <select>, tomt «velg»-valg teller ikke", () => {
    const { onChange } = vis(5, "l0");
    const s = screen.getByRole("combobox", { name: "Lønnsart" });
    expect(s.tagName).toBe("SELECT");
    fireEvent.change(s, { target: { value: "l2" } });
    expect(onChange).toHaveBeenCalledWith({ target: { value: "l2" } });
  });

  it("6 valg: lukket viser valgt tekst; åpnet har søk som filtrerer", () => {
    const { onChange } = vis(6, "l0");
    const knapp = screen.getByRole("combobox", { name: "Lønnsart" });
    expect(knapp.tagName).toBe("BUTTON");
    expect(knapp.textContent).toBe("Timelønn");
    expect(knapp.className).toContain("w-full rounded border px-3 py-2 text-sm");
    fireEvent.click(knapp);
    fireEvent.change(screen.getByRole("textbox", { name: "handling.sok" }), { target: { value: "over" } });
    const valg = screen.getAllByRole("option").map((o) => o.textContent);
    // Det valgte står alltid i lista, også når det ikke treffer søket.
    expect(valg).toEqual(["Timelønn", "Overtid 50 %", "Overtid 100 %"]);
    fireEvent.click(screen.getByRole("option", { name: "Overtid 100 %" }));
    expect(onChange).toHaveBeenCalledWith({ target: { value: "l2" } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("tastatur: pil ned og Enter velger, Esc lukker uten valg", () => {
    const { onChange } = vis(6, "l0");
    fireEvent.click(screen.getByRole("combobox", { name: "Lønnsart" }));
    const sok = screen.getByRole("textbox", { name: "handling.sok" });
    fireEvent.change(sok, { target: { value: "reise" } });
    fireEvent.keyDown(sok, { key: "ArrowDown" });
    fireEvent.keyDown(sok, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ target: { value: "l3" } });

    fireEvent.click(screen.getByRole("combobox", { name: "Lønnsart" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "handling.sok" }), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ingen treff: tekst i lista; deaktivert valg kan ikke velges", () => {
    const onChange = vi.fn();
    render(
      <SokbarNedtrekk aria-label="Prosjekt" value="" onChange={onChange}>
        {["A", "B", "C", "D", "E"].map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
        <option value="F" disabled>
          F lukket
        </option>
      </SokbarNedtrekk>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Prosjekt" }));
    fireEvent.click(screen.getByRole("option", { name: "F lukket" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "handling.sok" }), { target: { value: "zzz" } });
    expect(screen.getByText("sokbarNedtrekk.ingenTreff")).toBeTruthy();
  });
});

describe("VAKTTEST 2026-11-28 (Kenneth: Godkjent steg 1–5 i testpanelet, runde 9) — Runde 9 — vakter i kildeteksten", () => {
  const les = (sti: string) => readFileSync(resolve(__dirname, sti), "utf8");

  it("ProsjektRadVelger søker over samme terskel", () => {
    expect(les("./ProsjektRadVelger.tsx")).toMatch(/prosjekter\.length > SOK_TERSKEL &&/);
  });

  it("«Rediger timer-rad»: knapperaden står fast nederst i vinduet", () => {
    expect(les("../../app/dashbord/timer/[id]/page.tsx")).toMatch(
      /data-testid="timerrad-knapper" className="sticky bottom-0[^"]*bg-white/,
    );
  });

  it("RedigerRadModal: dialogen ruller selv — ingen overflow-hidden eller indre høydetak", () => {
    const kilde = les("../attestering/RedigerRadModal.tsx");
    expect(kilde).toMatch(/className="max-h-\[90vh\] max-w-4xl"\n/);
    expect(kilde).not.toMatch(/max-h-\[calc\(90vh-7rem\)\]/);
    expect(kilde).toMatch(/sticky top-0 z-10[^"]*bg-white/);
  });
});
