// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * w15g (plan § 4.15 del F, del H pkt. 29 og 33): merket «Korrigert av» hos arbeideren — på linja
 * på dagen og på dagen i Mine timer — og linja i «Rediger arbeid» som sier hva arbeideren ser.
 * Serverens del (pkt. 28, 37, 39, 40 og isolasjonen) står i `w15g-korrigert-av.integration.test.ts`.
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation") return () => ({ mutate: () => {}, isPending: false });
        if (p === "useUtils") return () => lag([]);
        return lag([...sti, p]);
      },
    });
  return { data, trpc: lag([]), sesjon: { navn: "Kari Leder" as string | null } };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: h.sesjon.navn ? { user: { name: h.sesjon.navn } } : { user: {} } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k), i18n: { language: "nb" } }),
}));
vi.mock("@/components/timer/MaskinVelger", () => ({ MaskinVelger: () => null }));

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

import {
  KorrigeringProvider,
  KorrigertAvDag,
  KorrigertMerke,
  KorrigertMerkeVisning,
  type Korrigering,
  type KorrigeringerPrRad,
} from "@/components/timer/KorrigertMerke";
import { RedigerRadModal } from "@/components/attestering/RedigerRadModal";

afterEach(cleanup);

// 21.11. kl. 14:32 lokal tid.
const VED = new Date(2026, 10, 21, 14, 32);
const KARI: Korrigering = {
  avNavn: "Kari Leder",
  ved: VED,
  felter: [
    { felt: "tilTid", foer: "15:35", etter: "15:50", foerTekst: null, etterTekst: null },
    { felt: "projectId", foer: "p1", etter: "p2", foerTekst: "1050 Sitedoc Boligfelt B12", etterTekst: "1060 Kontor Narvik" },
    { felt: "externalCostObjectId", foer: "e1", etter: null, foerTekst: "1050-01 · Grunnarbeid", etterTekst: null },
    { felt: "timer", foer: 7.5, etter: 7.75, foerTekst: null, etterTekst: null },
  ],
};
const TID = 'timer.korrigert.tidspunkt{"dato":"21.11.","klokke":"14:32"}';

describe("w15g pkt. 29 — merket på linja", () => {
  it("«Korrigert av Kari Leder 21.11. kl. 14:32» med hvert felt før → etter under", () => {
    const { container } = render(<KorrigertMerkeVisning korrigering={KARI} />);
    const merke = container.querySelector("[data-korrigert-merke]")!;
    expect(merke.querySelector("span")!.textContent).toBe(`timer.korrigert.avMedTid${JSON.stringify({ navn: "Kari Leder", tid: TID })}`);
    const felter = merke.querySelector("[data-korrigert-felter]")!.textContent;
    expect(felter).toBe(
      "timer.korrigert.felt.tilTid 15:35 → 15:50 · " +
        "timer.korrigert.felt.prosjekt 1050 Sitedoc Boligfelt B12 → 1060 Kontor Narvik · " +
        "timer.korrigert.felt.underprosjekt 1050-01 · Grunnarbeid → timer.prosjektkort.utenUnderprosjekt · " +
        "timer.korrigert.felt.timer 7,50 → 7,75",
    );
    // Verdien før står gjennomstreket.
    expect(Array.from(merke.querySelectorAll("s")).map((s) => s.textContent)).toEqual(["15:35", "1050 Sitedoc Boligfelt B12", "1050-01 · Grunnarbeid", "7,50"]);
  });

  it("uten navn: «Korrigert ved attestering» med tidspunktet — aldri e-postadressen", () => {
    const { container } = render(<KorrigertMerkeVisning korrigering={{ ...KARI, avNavn: null }} />);
    expect(container.querySelector("[data-korrigert-merke] span")!.textContent).toBe(`timer.korrigert.vedAttesteringMedTid${JSON.stringify({ tid: TID })}`);
  });

  it("linja uten retting har ikke merke; uten kontekst (dagskortet) heller ikke", () => {
    const k: KorrigeringerPrRad = { timer: { t1: KARI }, tillegg: {}, maskin: {} };
    const { container } = render(
      <KorrigeringProvider korrigeringer={k}>
        <div data-rad="t1"><KorrigertMerke type="timer" radId="t1" /></div>
        <div data-rad="t2"><KorrigertMerke type="timer" radId="t2" /></div>
        <div data-rad="m1"><KorrigertMerke type="maskin" radId="t1" /></div>
      </KorrigeringProvider>,
    );
    expect(container.querySelector('[data-rad="t1"] [data-korrigert-merke]')).toBeTruthy();
    expect(container.querySelector('[data-rad="t2"] [data-korrigert-merke]')).toBeNull();
    expect(container.querySelector('[data-rad="m1"] [data-korrigert-merke]')).toBeNull();
    cleanup();
    const uten = render(<KorrigertMerke type="timer" radId="t1" />);
    expect(uten.container.innerHTML).toBe("");
  });

  it("id-felt uten navn (slettet lønnsart) viser «—», aldri rå id", () => {
    const slettet: Korrigering = { ...KARI, felter: [{ felt: "lonnsartId", foer: "lonnsart-uuid-1", etter: "lonnsart-uuid-2", foerTekst: null, etterTekst: "Overtid 50 %" }] };
    const { container } = render(<KorrigertMerkeVisning korrigering={slettet} />);
    const felter = container.querySelector("[data-korrigert-felter]")!.textContent;
    expect(felter).toBe("timer.korrigert.felt.lonnsart — → Overtid 50 %");
    expect(felter).not.toContain("uuid");
  });

  it("maskinlinja og tilleggslinja bruker samme merke", () => {
    const k: KorrigeringerPrRad = { timer: {}, tillegg: { g1: KARI }, maskin: { m1: KARI } };
    const { container } = render(
      <KorrigeringProvider korrigeringer={k}>
        <KorrigertMerke type="maskin" radId="m1" />
        <KorrigertMerke type="tillegg" radId="g1" />
      </KorrigeringProvider>,
    );
    expect(container.querySelectorAll("[data-korrigert-merke]")).toHaveLength(2);
  });
});

describe("w15g pkt. 29 — merket på dagen i Mine timer", () => {
  const tekst = (k: Parameters<typeof KorrigertAvDag>[0]["korrigertAv"]) => {
    const { container, unmount } = render(<KorrigertAvDag korrigertAv={k} />);
    const t = container.querySelector("[data-korrigert-dag]")?.textContent ?? null;
    unmount();
    return t;
  };
  it("«Korrigert av Kari Leder», «… m.fl.» når flere, «Korrigert ved attestering» uten navn, ingenting uten retting", () => {
    expect(tekst({ navn: "Kari Leder", flere: false })).toBe('timer.korrigert.av{"navn":"Kari Leder"}');
    expect(tekst({ navn: "Kari Leder", flere: true })).toBe('timer.korrigert.avFlere{"navn":"Kari Leder"}');
    expect(tekst({ navn: null, flere: false })).toBe("timer.korrigert.vedAttestering");
    expect(tekst(null)).toBeNull();
    expect(tekst(undefined)).toBeNull();
  });
});

describe("w15g pkt. 33 — «Rediger arbeid» sier hva arbeideren ser", () => {
  const SHEET = {
    id: "s1", organizationId: "o1", ansatt: { id: "u1", name: "Ola Tømrer", email: "ola@x", ansattnummer: null },
    prosjekt: { name: "Sitedoc Boligfelt B12" }, timer: [], maskiner: [], tillegg: [], pauseFra: null, pauseTil: null,
  };
  const vis = () => render(<RedigerRadModal sheetId="s1" projectId="p1" ecoId={null} onLukk={() => {}} />);

  it("linja «Ola Tømrer ser «Korrigert av Kari Leder» på linjene du endrer.», og vinduet har ingen ✎", () => {
    h.data["timer.dagsseddel.hentForAttestering"] = SHEET;
    h.sesjon.navn = "Kari Leder";
    vis();
    const linje = document.querySelector("[data-korrigert-linje]")!;
    expect(linje.textContent).toBe('timer.korrigert.rrmLinje{"arbeider":"Ola Tømrer","attestant":"Kari Leder"}');
    expect(document.querySelector("[data-linje-penn]")).toBeNull();
  });

  it("attestanten uten navn: linja sier «Korrigert ved attestering», som merket", () => {
    h.data["timer.dagsseddel.hentForAttestering"] = SHEET;
    h.sesjon.navn = null;
    vis();
    expect(document.querySelector("[data-korrigert-linje]")!.textContent).toBe('timer.korrigert.rrmLinjeUtenNavn{"arbeider":"Ola Tømrer"}');
    h.sesjon.navn = "Kari Leder";
  });
});
