// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

import { KonverteringMarkorLinje } from "../KonverteringMarkorLinje";

afterEach(cleanup);

describe("KonverteringMarkorLinje — stille konverteringsmetadata", () => {
  it("markør med sha → «Konvertert … · versjon <kort 8>»", () => {
    render(
      <KonverteringMarkorLinje
        markor={{ kodeversjon: "2034396e1234", konvertertTid: "2026-10-11T08:45:00.000Z", motor: "egen" }}
        erKonvertert
      />,
    );
    const el = screen.getByText(/tegninger\.markor\.konvertert:/);
    expect(el.textContent).toContain('"versjon":"2034396e"'); // kuttet til 8 tegn
  });

  it("sha «ukjent» → egen «ukjent versjon»-nøkkel (ikke tom streng)", () => {
    render(
      <KonverteringMarkorLinje
        markor={{ kodeversjon: "ukjent", konvertertTid: "2026-10-11T08:45:00.000Z", motor: "egen" }}
        erKonvertert
      />,
    );
    expect(screen.getByText(/tegninger\.markor\.konvertertUkjent/)).toBeTruthy();
  });

  it("ingen markør + konvertert → «før versjonsmerking»", () => {
    render(<KonverteringMarkorLinje markor={null} erKonvertert />);
    expect(screen.getByText("tegninger.markor.foerMerking")).toBeTruthy();
  });

  it("ingen markør + ikke konvertert (ren bildeopplasting) → ingenting", () => {
    const { container } = render(<KonverteringMarkorLinje markor={null} erKonvertert={false} />);
    expect(container.firstChild).toBeNull();
  });
});
