// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * «Tegningssiden låser seg etter Last opp ny revisjon» (Kenneth 2026-10-10).
 *
 * Rotårsak (målt i ekte Chrome, se leveransen): `LastOppRevisjonKnapp` ligger inne
 * i `RedigerTegningModal` sitt <form>. Knappene mangler `type`, så de arver
 * `type="submit"` og submitter det YTRE skjemaet. Submit → lagring lykkes →
 * `RedigerTegningModal` lukkes (ytre native <dialog> blir display:none). Den indre
 * revisjons-dialogen er en DOM-etterkommer av den ytre, så når den åpner mens den
 * ytre er lukket, rendres den 0×0 (usynlig — «ingen A→B-valg») men er fortsatt
 * `:modal` i top-layer → hele siden blir inert → LÅST. Opplastingen sendes aldri.
 *
 * Kontrakt: ingen knapp i revisjonsflyten får submitte et omsluttende skjema.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

const mutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: {
    tegning: {
      lastOppRevisjon: {
        useMutation: () => ({ mutate, isPending: false, error: null }),
      },
    },
  },
}));

import { LastOppRevisjonKnapp } from "../LastOppRevisjonKnapp";

// jsdom implementerer ikke <dialog>.showModal/close (Modal bruker native <dialog>).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Velg en fil → kjører handleFil → /api/upload → setValgt (åpner indre dialog). */
async function velgFil(filnavn = "fallplan.dwg") {
  const upload = {
    fileUrl: "/uploads/ny.dwg",
    fileName: filnavn,
    fileType: "application/acad",
    fileSize: 123,
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => upload,
  } as Response);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [new File(["x"], filnavn)], configurable: true });
  fireEvent.change(input);
  // vent til filnavnet dukker opp i den indre dialogen (valgt satt)
  await waitFor(() => expect(screen.getByText(/tegninger\.revisjon\.fil/)).toBeTruthy());
}

describe("Revisjon modal-i-modal — ingen knapp submitter omsluttende skjema", () => {
  it("klikk «Last opp ny revisjon» (trigger) submitter ikke det ytre skjemaet", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <LastOppRevisjonKnapp drawingId="d1" gjeldendeRevisjon="A" />
      </form>,
    );
    // trigger-knappen er den første med denne teksten (indre bekreft deler nøkkel)
    fireEvent.click(screen.getAllByText("tegninger.revisjon.lastOpp")[0]!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bekreft og avbryt i revisjons-dialogen submitter ikke det ytre skjemaet", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <LastOppRevisjonKnapp drawingId="d1" gjeldendeRevisjon="A" />
      </form>,
    );
    await velgFil();

    // bekreft (= andre knapp med lastOpp-nøkkelen, inne i dialogen)
    const lastOppKnapper = screen.getAllByText("tegninger.revisjon.lastOpp");
    fireEvent.click(lastOppKnapper[lastOppKnapper.length - 1]!);
    expect(onSubmit).not.toHaveBeenCalled();
    // ekte opplasting ble faktisk sendt (fullføres fra begge steder)
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ drawingId: "d1", revision: "B", fileUrl: "/uploads/ny.dwg" }),
    );

    fireEvent.click(screen.getByText("handling.avbryt"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
