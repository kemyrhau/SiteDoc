// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Ordre 2026-11-05 (12) E: feiler forhåndsvisningen, vet ikke admin hva deaktiveringen
 * avslutter — «Deaktiver» er sperret, feilmeldingen står, og modalen kan lukkes.
 */

type Query = { data: unknown; isLoading: boolean; isError: boolean };
let query: Query;
const mutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    organisasjon: {
      forhandsvisDeaktivering: { useQuery: () => query },
      settAnsattStatus: { useMutation: () => ({ mutate, isPending: false, isError: false }) },
    },
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
  }),
}));

import { DeaktiverModal } from "../DeaktiverModal";

const onLukk = vi.fn();

function vis() {
  render(
    <DeaktiverModal
      bruker={{ id: "u-1", name: "Kari" }}
      organizationId="o-1"
      onLukk={onLukk}
      onSuksess={() => {}}
    />,
  );
}

const deaktiverKnapp = () => screen.getByRole("button", { name: "firma.ansatte.deaktiver.bekreft" });

beforeEach(() => {
  mutate.mockReset();
  onLukk.mockReset();
});
afterEach(cleanup);

describe("DeaktiverModal — forhåndsvisningen feilet", () => {
  beforeEach(() => {
    query = { data: undefined, isLoading: false, isError: true };
  });

  it("🔴 Deaktiver er sperret og sender ingenting", () => {
    vis();
    const knapp = deaktiverKnapp();
    expect((knapp as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(knapp);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("feilmeldingen vises, og Avbryt lukker modalen", () => {
    vis();
    expect(screen.getByText("firma.ansatte.deaktiver.feil")).toBeTruthy();
    const avbryt = screen.getAllByRole("button", { name: "handling.avbryt" });
    expect(avbryt).toHaveLength(2);
    for (const b of avbryt) fireEvent.click(b);
    expect(onLukk).toHaveBeenCalledTimes(2);
  });
});

describe("DeaktiverModal — forhåndsvisningen laster (ordre 13, M3)", () => {
  it("🔴 Deaktiver er IKKE sperret av lastingen — bare feil og pågående lagring sperrer", () => {
    query = { data: undefined, isLoading: true, isError: false };
    vis();
    const knapp = deaktiverKnapp();
    expect((knapp as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(knapp);
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", organizationId: "o-1", aktiv: false });
  });
});

describe("DeaktiverModal — forhåndsvisningen lastet", () => {
  it("Deaktiver er aktiv og sender deaktiveringen", () => {
    query = {
      data: { prosjekter: [], antallFlytledd: 0, antallTilInnsender: 0, antallHmsSaker: 0, alene: [], hoppetOver: [] },
      isLoading: false,
      isError: false,
    };
    vis();
    const knapp = deaktiverKnapp();
    expect((knapp as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(knapp);
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", organizationId: "o-1", aktiv: false });
  });
});
