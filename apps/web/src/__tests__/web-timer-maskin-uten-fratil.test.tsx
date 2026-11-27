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
import { RedigerTimerRad } from "@/components/timer/RedigerTimerRad";
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
    expect(container.querySelector('input[type=number][step="any"]')).not.toBeNull();
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

  it("runde 7 (Kenneth 2026-11-27: «Del opp maskin» deler bare timer): ingen underprosjekt-felt — delene arver timeradens", () => {
    vis();
    fireEvent.click(screen.getByText("timer.splitt.leggTilRad"));
    expect(screen.queryByText(/timer\.felt\.underprosjekt/)).toBeNull();
  });

  it("ingen fra–til i vinduet, heller ikke i referansen", () => {
    vis();
    expect(tidsfelt()).toBe(0);
    expect(screen.queryByText(/timer\.felt\.startTid/)).toBeNull();
    expect(document.body.textContent).not.toContain("07:00");
  });

  it("lagring: første del beholder lagret fra–til, ny del får fraTid/tilTid null", () => {
    const { container } = vis();
    const timer = container.ownerDocument.querySelector('input[type=number][step="any"]') as HTMLInputElement;
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

/**
 * RETUR 4 runde 2 V2 (Kenneth 2026-11-26: «når reise har med minutter må også lønnsarter
 * tilpasses deretter»): attesteringens timefelt for timer-rad og maskin godtar 3,62 t.
 */
describe("VAKTTEST 2026-11-26 (Kenneth: «alt fungerer såvidt jeg kan se», runde 2) — RETUR 4 runde 2 V2 — attesteringens timefelt godtar minutter", () => {
  const sett362 = (felt: HTMLInputElement) => {
    fireEvent.change(felt, { target: { value: "3.62" } });
    expect(felt.checkValidity()).toBe(true);
  };

  it("RedigerMaskinRad: 3,62 er gyldig og sendes", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RedigerMaskinRad
        organizationId="o1"
        rad={{ key: "k1", originalId: "m1", projectId: "p1", externalCostObjectId: null, byggeplassId: null, vehicleId: "v1", fraTid: null, tilTid: null, timer: 2, mengde: null, enhet: null } as never}
        prosjekter={[{ id: "p1", name: "P1" }] as never}
        onChange={onChange}
        onSlett={() => {}}
      />,
    );
    const felt = container.querySelector("input[type=number]") as HTMLInputElement;
    sett362(felt);
    fireEvent.blur(felt);
    expect(onChange).toHaveBeenCalledWith({ timer: 3.62 });
  });

  it("RedigerTimerRad: 3,62 er gyldig og sendes", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RedigerTimerRad
        organizationId="o1"
        rad={{ key: "k1", originalId: "t1", projectId: "p1", externalCostObjectId: null, byggeplassId: null, lonnsartId: "l1", aktivitetId: "a1", fraTid: "10:53", tilTid: "15:00", timer: 4, beskrivelse: null } as never}
        prosjekter={[{ id: "p1", name: "P1" }] as never}
        tidsrundingMinutter={null}
        onChange={onChange}
        onSlett={() => {}}
      />,
    );
    const felt = container.querySelector("input[type=number]") as HTMLInputElement;
    sett362(felt);
    fireEvent.blur(felt);
    expect(onChange).toHaveBeenCalledWith({ timer: 3.62 });
  });

  it("«Rediger arbeid» (RedigerRadModal): timer-raden og maskinraden godtar 3,62", () => {
    h.data["timer.dagsseddel.hentForAttestering"] = {
      id: "s1", organizationId: "o1", ansatt: { id: "u1", name: "Ola", email: "ola@x", ansattnummer: null },
      prosjekt: { name: "P1" }, tillegg: [], pauseFra: null, pauseTil: null,
      timer: [{ id: "t1", projectId: "p1", externalCostObjectId: null, lonnsartId: "l1", aktivitetId: "a1", fraTid: "10:53", tilTid: "15:00", timer: "4.12", attestertStatus: "pending", kortId: "k1" }],
      maskiner: [{ ...MASKIN_ORIGINAL, kortId: "k1", attestertStatus: "pending" }],
    };
    h.data["maskin.equipment.list"] = UTSTYR;
    render(<RedigerRadModal sheetId="s1" projectId="p1" ecoId={null} onLukk={() => {}} />);
    const felter = Array.from(document.querySelectorAll<HTMLInputElement>("input[type=number]"));
    const timerFelt = felter.find((f) => f.value === "4.12")!;
    const maskinFelt = screen.getByTestId("maskin-hoyst").previousElementSibling!.querySelector("input[type=number]") as HTMLInputElement;
    sett362(timerFelt);
    sett362(maskinFelt);
  });
});
