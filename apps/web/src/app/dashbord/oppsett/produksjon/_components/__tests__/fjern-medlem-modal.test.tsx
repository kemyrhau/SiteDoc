// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Ordre 2026-11-05 (3), L1: bekreftelsen før et flytmedlem fjernes. Tilfelle A/B/C bestemmer
 * hva som sendes som `nyHovedansvarligPmId` — utelatt (serveren velger), valgt person, eller null.
 */

interface Forhandsvisning {
  antallApne: number;
  gjenvarende: Array<{ projectMemberId: string; navn: string; erHovedansvarlig: boolean }>;
  andreILeddet: number;
}

let forhandsvisning: Forhandsvisning;
const mutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dokumentflyt: {
      forhandsvisFjerning: { useQuery: () => ({ data: forhandsvisning, isLoading: false }) },
      fjernMedlem: { useMutation: () => ({ mutate, isPending: false }) },
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

import { FjernMedlemModal } from "../FjernMedlemModal";

const UTENFOR = [{ id: "pm-ola", navn: "Ola" }];

function vis() {
  render(
    <FjernMedlemModal
      medlem={{ id: "m-1", navn: "Kenneth" }}
      prosjektId="p-1"
      rolleNavn="Godkjenner"
      kandidaterUtenfor={UTENFOR}
      onClose={() => {}}
      onFjernet={() => {}}
    />,
  );
}

const knapp = (tekst: string) => screen.getByRole("button", { name: new RegExp(`^${tekst.replace(/\./g, "\\.")}`) });

beforeEach(() => mutate.mockReset());
afterEach(cleanup);

describe("FjernMedlemModal", () => {
  it("A: andre i leddet, ingen dokumenter → bare bekreft; serveren velger", () => {
    forhandsvisning = {
      antallApne: 0,
      gjenvarende: [{ projectMemberId: "pm-anne", navn: "Anne", erHovedansvarlig: false }],
      andreILeddet: 1,
    };
    vis();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(knapp("handling.fjern"));
    expect(mutate).toHaveBeenCalledWith({ id: "m-1", projectId: "p-1" });
  });

  it("🔴 B: åpne dokumenter → hovedansvarlig i leddet er forhåndsvalgt og sendes", () => {
    forhandsvisning = {
      antallApne: 41,
      gjenvarende: [
        { projectMemberId: "pm-anne", navn: "Anne", erHovedansvarlig: false },
        { projectMemberId: "pm-per", navn: "Per", erHovedansvarlig: true },
      ],
      andreILeddet: 2,
    };
    vis();
    expect(screen.getByText(/dokumentflyt\.fjernMedlem\.dokumenter/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("pm-per");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pm-anne" } });
    fireEvent.click(knapp("dokumentflyt.fjernMedlem.bekreftFlytt"));
    expect(mutate).toHaveBeenCalledWith({ id: "m-1", projectId: "p-1", nyHovedansvarligPmId: "pm-anne" });
  });

  it("🔴 C med dokumenter: erstatter påkrevd, ingen «uten erstatter»", () => {
    forhandsvisning = { antallApne: 3, gjenvarende: [], andreILeddet: 0 };
    vis();
    expect(screen.getByText(/dokumentflyt\.fjernMedlem\.eneste/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "dokumentflyt.fjernMedlem.utenErstatter" })).toBeNull();
    const hoved = knapp("dokumentflyt.fjernMedlem.bekreftFlytt") as HTMLButtonElement;
    expect(hoved.disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pm-ola" } });
    fireEvent.click(hoved);
    expect(mutate).toHaveBeenCalledWith({ id: "m-1", projectId: "p-1", nyHovedansvarligPmId: "pm-ola" });
  });

  it("B10: C uten dokumenter → «Fjern uten erstatter» sender null", () => {
    forhandsvisning = { antallApne: 0, gjenvarende: [], andreILeddet: 0 };
    vis();
    fireEvent.click(screen.getByRole("button", { name: "dokumentflyt.fjernMedlem.utenErstatter" }));
    expect(mutate).toHaveBeenCalledWith({ id: "m-1", projectId: "p-1", nyHovedansvarligPmId: null });
  });
});
