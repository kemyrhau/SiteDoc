// @vitest-environment jsdom
/**
 * TILLEGG 2026-11-15 (13) L2 del C: oppmøtested-modalen bruker samme adressesøk
 * (`oppmotested.geokod` → `sokAdresser`) og klikkbare treffliste som byggeplass.
 *  - flere treff → liste; klikk setter lat/lng + adressetekst
 *  - ett treff → settes direkte
 *  - 0 treff → tekst om at stedet kan lagres med punkt fra kartet, og Lagre er
 *    IKKE sperret når punktet settes på kartet
 * trpc og kart mockes — ingen eksterne kall.
 */
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import nb from "../../../../../../../packages/shared/src/i18n/nb.json";

type Treff = { lat: number; lng: number; label: string };

const h = vi.hoisted(() => ({
  geokodOpts: null as null | { onSuccess: (t: Treff[]) => void },
  geokodKall: [] as unknown[],
  opprettKall: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => (nb as Record<string, string>)[k] ?? k,
    i18n: { language: "nb" },
  }),
}));

vi.mock("@sitedoc/ui", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// Kartet: en knapp som «klikker» et punkt.
vi.mock("next/dynamic", () => ({
  default: () =>
    function KartStub({ onVelgPosisjon }: { onVelgPosisjon: (lat: number, lng: number) => void }) {
      return (
        <button type="button" onClick={() => onVelgPosisjon(69.65, 18.95)}>
          kart-klikk
        </button>
      );
    },
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") return () => ({ data: [], isLoading: false });
        if (navn === "useMutation")
          return (opts: { onSuccess: (t: Treff[]) => void }) => {
            if (key === "oppmotested.geokod") h.geokodOpts = opts;
            return {
              mutate: (input: unknown) => {
                if (key === "oppmotested.geokod") h.geokodKall.push(input);
                if (key === "oppmotested.opprett") h.opprettKall.push(input);
              },
              isPending: false,
            };
          };
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import { OppmotestedModal } from "./OppmotestedModal";

const ORG = "11111111-1111-1111-1111-111111111111";
const N = nb as Record<string, string>;

afterEach(() => {
  cleanup();
  h.geokodOpts = null;
  h.geokodKall = [];
  h.opprettKall = [];
});

function aapne() {
  render(<OppmotestedModal orgId={ORG} rad={null} onLukk={() => {}} />);
  fireEvent.change(screen.getByLabelText(N["firma.oppmotested.felt.navn"]!), {
    target: { value: "Kontor Tromsø" },
  });
  fireEvent.change(screen.getByLabelText(N["firma.oppmotested.felt.adresse"]!), {
    target: { value: "sommerfeldtsgate 65 tromsø" },
  });
  fireEvent.click(screen.getByRole("button", { name: N["firma.oppmotested.geokod"]! }));
}

const lagreKnapp = () => screen.getByRole("button", { name: N["handling.lagre"]! }) as HTMLButtonElement;
const latFelt = () => screen.getByLabelText(N["firma.oppmotested.felt.lat"]!) as HTMLInputElement;

describe("OppmotestedModal — adressesøk med treffliste", () => {
  it("søket går til oppmotested.geokod med adressen", () => {
    aapne();
    expect(h.geokodKall).toEqual([{ organizationId: ORG, adresse: "sommerfeldtsgate 65 tromsø" }]);
  });

  it("flere treff → klikkbar liste; valgt treff setter punkt og adressetekst", () => {
    aapne();
    act(() => h.geokodOpts!.onSuccess([
      { lat: 69.65, lng: 18.95, label: "Sommerfeldts gate 65, 9013 TROMSØ" },
      { lat: 69.66, lng: 18.96, label: "Sommerfeldts gate 63, 9013 TROMSØ" },
    ]));
    fireEvent.click(screen.getByRole("button", { name: "Sommerfeldts gate 63, 9013 TROMSØ" }));
    expect(latFelt().value).toBe("69.66");
    expect((screen.getByLabelText(N["firma.oppmotested.felt.adresse"]!) as HTMLInputElement).value).toBe(
      "Sommerfeldts gate 63, 9013 TROMSØ",
    );
    expect(screen.queryByRole("button", { name: "Sommerfeldts gate 65, 9013 TROMSØ" })).toBeNull();
    expect(lagreKnapp().disabled).toBe(false);
  });

  it("ett treff → settes direkte uten liste", () => {
    aapne();
    act(() => h.geokodOpts!.onSuccess([{ lat: 69.65, lng: 18.95, label: "Sommerfeldts gate 65, 9013 TROMSØ" }]));
    expect(latFelt().value).toBe("69.65");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("0 treff → tekst om lagring med kartpunkt; Lagre ikke sperret etter kart-klikk", () => {
    aapne();
    act(() => h.geokodOpts!.onSuccess([]));
    expect(screen.getByText(N["firma.oppmotested.geokodIngen"]!)).toBeTruthy();
    expect(lagreKnapp().disabled).toBe(true); // ingen punkt ennå
    fireEvent.click(screen.getByRole("button", { name: "kart-klikk" }));
    expect(lagreKnapp().disabled).toBe(false);
    fireEvent.click(lagreKnapp());
    expect(h.opprettKall).toHaveLength(1);
    expect(h.opprettKall[0]).toMatchObject({
      navn: "Kontor Tromsø",
      adresse: "sommerfeldtsgate 65 tromsø",
      lat: 69.65,
      lng: 18.95,
    });
  });
});
