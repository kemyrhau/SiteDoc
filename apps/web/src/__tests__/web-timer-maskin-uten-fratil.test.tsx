// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

/**
 * Plan § 8.22 punkt 1 (Kenneth): maskin føres bare med antall timer, aldri fra–til, noe sted.
 * Attesteringens maskinrader — `RedigerMaskinRad` («Del opp»/`SplittRadModal` og «Rediger sedel»/
 * `AttesteringDetalj_Edit`) og `KompaktMaskinRad` i «Rediger arbeid» (`RedigerRadModal`) — har
 * ikke fra–til-felt. Lagret fraTid/tilTid endres ikke: de sendes uendret videre ved lagring.
 * En ny del i «Splitt maskin-rad» får ingen skjult forhåndsutfylling (fraTid null).
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const kall: Array<{ prosedyre: string; input: unknown }> = [];
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation")
          return () => ({ mutate: (input: unknown) => kall.push({ prosedyre: navn, input }), isPending: false });
        if (p === "useUtils") return () => lag([]);
        return lag([...sti, p]);
      },
    });
  return { data, kall, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { name: "Kari Leder" } } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));

const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

import { RedigerMaskinRad } from "@/components/timer/RedigerMaskinRad";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import { RedigerRadModal } from "@/components/attestering/RedigerRadModal";

afterEach(() => {
  cleanup();
  h.kall.length = 0;
  for (const k of Object.keys(h.data)) delete h.data[k];
});

const UTSTYR = [{ id: "v1", merke: "Volvo", modell: "EC140", internNavn: null, internNummer: "1", kategori: "anleggsmaskin" }];
const MASKIN_ORIGINAL = {
  id: "m1", vehicleId: "v1", projectId: "p1", externalCostObjectId: null, byggeplassId: null,
  fraTid: "07:00", tilTid: "15:00", timer: "2", mengde: null, enhet: null,
};

const tidsfelt = (rot: ParentNode = document) => rot.querySelectorAll("input[type=time]").length;

describe("§ 8.22 punkt 1 — RedigerMaskinRad («Del opp», «Rediger sedel»)", () => {
  it("ingen fra–til-felt; antall timer står", () => {
    const { container } = render(
      <RedigerMaskinRad
        organizationId="o1"
        rad={{ key: "k1", originalId: "m1", projectId: "p1", externalCostObjectId: null, byggeplassId: null, vehicleId: "v1", fraTid: "07:00", tilTid: "15:00", timer: 2, mengde: null, enhet: null } as never}
        prosjekter={[{ id: "p1", name: "P1" }] as never}
        onChange={() => {}}
        onSlett={() => {}}
      />,
    );
    expect(tidsfelt(container)).toBe(0);
    expect(container.querySelector('input[type=number][step="0.25"]')).not.toBeNull();
  });
});

describe("§ 8.22 punkt 1 — «Splitt maskin-rad»", () => {
  const vis = () => {
    h.data["maskin.equipment.list"] = UTSTYR;
    return render(
      <SplittRadModal
        radType="maskin"
        original={MASKIN_ORIGINAL}
        sheetId="s1"
        organizationId="o1"
        prosjekter={[{ id: "p1", name: "P1" }] as never}
        tidsrundingMinutter={null}
        onLukk={() => {}}
        onLagret={() => {}}
      />,
    );
  };

  it("ingen fra–til i vinduet, heller ikke i referansen", () => {
    vis();
    expect(tidsfelt()).toBe(0);
    expect(screen.queryByText(/timer\.felt\.startTid/)).toBeNull();
    expect(document.body.textContent).not.toContain("07:00");
  });

  it("lagring: første del beholder lagret fra–til, ny del får fraTid/tilTid null", () => {
    const { container } = vis();
    const timer = container.ownerDocument.querySelector('input[type=number][step="0.25"]') as HTMLInputElement;
    fireEvent.change(timer, { target: { value: "1.5" } });
    fireEvent.blur(timer);
    fireEvent.click(screen.getByText("timer.splitt.leggTilRad"));
    fireEvent.click(screen.getByText("timer.splitt.lagre"));
    expect(h.kall).toHaveLength(1);
    const rader = (h.kall[0]!.input as { nyeRader: Array<{ fraTid: string | null; tilTid: string | null }> }).nyeRader;
    expect(rader).toHaveLength(2);
    expect(rader[0]).toMatchObject({ fraTid: "07:00", tilTid: "15:00" });
    expect(rader[1]).toMatchObject({ fraTid: null, tilTid: null });
  });
});

describe("§ 8.22 punkt 1 — «Rediger arbeid» (RedigerRadModal)", () => {
  const vis = () => {
    h.data["timer.dagsseddel.hentForAttestering"] = {
      id: "s1", organizationId: "o1", ansatt: { id: "u1", name: "Ola", email: "ola@x", ansattnummer: null },
      prosjekt: { name: "P1" }, tillegg: [], pauseFra: null, pauseTil: null,
      timer: [{ id: "t1", projectId: "p1", externalCostObjectId: null, lonnsartId: "l1", aktivitetId: "a1", fraTid: "07:00", tilTid: "15:00", timer: "8", attestertStatus: "pending", kortId: "k1" }],
      maskiner: [{ ...MASKIN_ORIGINAL, kortId: "k1", attestertStatus: "pending" }],
    };
    h.data["maskin.equipment.list"] = UTSTYR;
    return render(<RedigerRadModal sheetId="s1" projectId="p1" ecoId={null} onLukk={() => {}} />);
  };

  it("maskinraden har ingen fra–til-felt (arbeidsraden har sine to)", () => {
    vis();
    const maskinRad = screen.getByTestId("maskin-hoyst").previousElementSibling!;
    expect(tidsfelt(maskinRad)).toBe(0);
    expect(tidsfelt()).toBe(2);
  });

  it("lagring sender lagret fra–til på maskinraden uendret", () => {
    vis();
    const maskinRad = screen.getByTestId("maskin-hoyst").previousElementSibling!;
    const timer = maskinRad.querySelector("input[type=number]") as HTMLInputElement;
    fireEvent.change(timer, { target: { value: "1.5" } });
    fireEvent.blur(timer);
    fireEvent.click(screen.getByText("timer.rediger.lagre"));
    expect(h.kall).toHaveLength(1);
    const maskin = (h.kall[0]!.input as { nyeRader: { maskin: Array<{ fraTid: string | null; tilTid: string | null; timer: number }> } }).nyeRader.maskin;
    expect(maskin).toHaveLength(1);
    expect(maskin[0]).toMatchObject({ fraTid: "07:00", tilTid: "15:00", timer: 1.5 });
  });
});
