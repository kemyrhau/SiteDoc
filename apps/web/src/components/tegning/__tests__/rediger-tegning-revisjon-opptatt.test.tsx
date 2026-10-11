// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Issue 1 (2026-10-11): fra klikk på «Last opp ny revisjon» til revisjonsdialogen er åpen
 * (filvelger + opplasting) skal den ytre RedigerTegningModal sin «Lagre»/«Avbryt» ikke kunne
 * avbryte oppdateringen. LastOppRevisjonKnapp melder «opptatt» (lasterOpp || valgt) og modalen
 * deaktiverer knappene. Rød før fiks (knappene var aktive i lasterOpp-vinduet).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

const mutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: { tegning: { lastOppRevisjon: { useMutation: () => ({ mutate, isPending: false, error: null }) } } },
}));

import { RedigerTegningModal } from "../RedigerTegningModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TEGNING = {
  id: "d1",
  name: "Plan 1",
  drawingNumber: null,
  discipline: null,
  drawingType: null,
  status: "utkast",
  floor: null,
  originator: null,
  description: null,
  revision: "A",
};

function lagre(): HTMLButtonElement {
  return screen.getByText("handling.lagre").closest("button") as HTMLButtonElement;
}

describe("RedigerTegningModal — Lagre/Avbryt låst mens revisjon lastes opp", () => {
  it("Lagre er aktiv før opplasting, deaktivert når fil er valgt (opptatt)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ fileUrl: "/uploads/ny.dwg", fileName: "ny.dwg", fileType: "dwg", fileSize: 1 }),
    } as Response);

    render(
      <RedigerTegningModal
        open
        onClose={vi.fn()}
        tegning={TEGNING}
        onLagre={vi.fn()}
        lagrer={false}
      />,
    );

    // Før: Lagre er aktiv.
    expect(lagre().disabled).toBe(false);

    // Velg fil → handleFil → /api/upload → valgt satt → onOpptatt(true).
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [new File(["x"], "ny.dwg")], configurable: true });
    fireEvent.change(input);

    // Etter: Lagre (og Avbryt) deaktivert mens revisjonsflyten er opptatt.
    await waitFor(() => expect(lagre().disabled).toBe(true));
    const avbrytKnapper = screen.getAllByText("handling.avbryt").map((e) => e.closest("button") as HTMLButtonElement);
    // Den ytre Avbryt er deaktivert (den indre dialogens Avbryt er en annen knapp).
    expect(avbrytKnapper.some((b) => b.disabled)).toBe(true);
  });
});
