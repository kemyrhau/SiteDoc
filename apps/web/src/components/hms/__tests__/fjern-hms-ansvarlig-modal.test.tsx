// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Ordre 2026-11-05 (9): bekreftelsen før firma-rollen HMS-ansvarlig fjernes fra HMS-flytkortet.
 * Teksten sier at rollen fjernes i hele firmaet; åpne saker med ballen hos personen telles.
 */

let antallApne = 0;
const mutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    organisasjon: {
      forhandsvisFjernHmsAnsvarlig: { useQuery: () => ({ data: { antallApne }, isLoading: false }) },
      settFirmaHmsAnsvarlig: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

// <dialog>.showModal finnes ikke i jsdom — innholdet er det som testes.
vi.mock("@sitedoc/ui", () => ({
  Modal: ({ title, children }: { title: string; children: ReactNode }) => (
    <div role="dialog" aria-label={title}>{children}</div>
  ),
  Spinner: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));

import { FjernHmsAnsvarligModal } from "../FjernHmsAnsvarligModal";

const ANSVARLIG = { userId: "u-1", navn: "Kari", organizationId: "org-1", organisasjonNavn: "Firma AS" };

beforeEach(() => mutate.mockReset());
afterEach(cleanup);

describe("FjernHmsAnsvarligModal", () => {
  it("lukket når ansvarlig er null", () => {
    render(<FjernHmsAnsvarligModal ansvarlig={null} onClose={() => {}} onFjernet={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sier at rollen fjernes i hele firmaet; ingen saker → ingen saksboks", () => {
    antallApne = 0;
    render(<FjernHmsAnsvarligModal ansvarlig={ANSVARLIG} onClose={() => {}} onFjernet={() => {}} />);
    expect(screen.getByText(/hms\.fjernAnsvarlig\.omfang:.*Firma AS/)).toBeTruthy();
    expect(screen.queryByText(/hms\.fjernAnsvarlig\.saker/)).toBeNull();
  });

  it("åpne saker hos personen → antallet vises", () => {
    antallApne = 3;
    render(<FjernHmsAnsvarligModal ansvarlig={ANSVARLIG} onClose={() => {}} onFjernet={() => {}} />);
    expect(screen.getByText(/hms\.fjernAnsvarlig\.saker:.*"antall":3/)).toBeTruthy();
  });

  it("Fjern → settFirmaHmsAnsvarlig med harTilgang false i firmaet som ga rollen", () => {
    render(<FjernHmsAnsvarligModal ansvarlig={ANSVARLIG} onClose={() => {}} onFjernet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "handling.fjern" }));
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", organizationId: "org-1", harTilgang: false });
  });

  it("Avbryt → lukker uten å fjerne", () => {
    const onClose = vi.fn();
    render(<FjernHmsAnsvarligModal ansvarlig={ANSVARLIG} onClose={onClose} onFjernet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "handling.avbryt" }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
