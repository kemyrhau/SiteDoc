// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * RevisjonsListe — nedlastings-knapp pr. revisjon (orkestrator-SVAR 2026-10-10,
 * avvik 2): en revisjon der `fileUrl` er den KONVERTERTE SVG-en (DWG/DXF, original
 * ikke lagret) får INGEN knapp + melding; en PDF/bilde-revisjon (fileUrl = original)
 * får «Last ned». Vi gir aldri en fil som ser ut som originalen når den ikke er det.
 */

// Modal → enkel wrapper (unngår jsdom <dialog>.showModal). Rendrer barn når open.
vi.mock("@sitedoc/ui", () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

// trpc.useUtils() brukes av useSignertLenkeApner.
vi.mock("@/lib/trpc", () => ({
  trpc: { useUtils: () => ({ invalidate: vi.fn(() => Promise.resolve()) }) },
}));

// t() → nøkkel-gjennomslag (med {rev}-interpolering for tittelen).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (nokkel: string, vars?: Record<string, unknown>) =>
      vars ? `${nokkel}:${JSON.stringify(vars)}` : nokkel,
  }),
}));

import { RevisjonsListe, type RevisjonRad } from "../RevisjonsListe";

function rev(over: Partial<RevisjonRad>): RevisjonRad {
  return {
    id: "r1",
    revision: "A",
    version: 1,
    fileUrl: "/uploads/x.pdf",
    createdAt: "2026-10-10T00:00:00.000Z",
    ...over,
  };
}

afterEach(cleanup);

/** Åpne revisjons-modalen ved å klikke revisjons-chipen. */
function apneModal(revisjonKode: string) {
  fireEvent.click(screen.getByText(revisjonKode));
}

describe("RevisjonsListe — nedlasting pr. revisjon", () => {
  it("DWG-revisjon (konvertert .svg, ingen original) → INGEN knapp, viser melding", () => {
    render(<RevisjonsListe revisjoner={[rev({ fileUrl: "/uploads/konvertert.svg" })]} />);
    apneModal("A");
    expect(screen.queryByText("handling.lastNed")).toBeNull();
    expect(screen.getByText("tegninger.revisjon.ingenOriginal")).toBeTruthy();
  });

  it("PDF-revisjon (fileUrl = original) → «Last ned»-knapp, ingen melding", () => {
    render(<RevisjonsListe revisjoner={[rev({ fileUrl: "/uploads/original.pdf" })]} />);
    apneModal("A");
    expect(screen.getByText("handling.lastNed")).toBeTruthy();
    expect(screen.queryByText("tegninger.revisjon.ingenOriginal")).toBeNull();
  });

  it("bilde-revisjon (.png) → «Last ned»-knapp", () => {
    render(<RevisjonsListe revisjoner={[rev({ fileUrl: "/uploads/bilde.png" })]} />);
    apneModal("A");
    expect(screen.getByText("handling.lastNed")).toBeTruthy();
  });
});
