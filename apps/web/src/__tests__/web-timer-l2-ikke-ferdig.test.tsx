// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

/**
 * Plan § 8.22 L2 «ikke ferdig» (Kenneth 2026-11-21): i prosjektkort-modus står en jobb uten «Hva gjorde
 * du?» merket «Mangler beskrivelse» i kortets hode — også når kortet er lukket. «Send dagen» sender
 * ikke; den åpner første jobb som mangler. I timerad-vinduet er feltet påkrevd. Dagskort-modus urørt.
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const kall: string[] = [];
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation")
          return () => ({ mutate: () => kall.push(navn), mutateAsync: async () => {}, isPending: false });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { data, kall, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashbord/timer/s1",
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { name: "Ola" } } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k), i18n: { language: "nb" } }),
}));
vi.mock("@/components/timer/MaskinVelger", () => ({ MaskinVelger: () => null }));
vi.mock("@/kontekst/prosjekt-kontekst", () => ({ useProsjekt: () => ({ prosjektId: null }) }));
vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ firmaId: "o1", firma: null }) }));
vi.mock("@/kontekst/byggeplass-kontekst", async (orig) => ({
  ...(await orig<object>()),
  useByggeplass: () => ({ aktivByggeplass: null }),
}));

const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

import DagsseddelDetaljSide from "@/app/dashbord/timer/[id]/page";

afterEach(() => {
  cleanup();
  h.kall.length = 0;
});

const DATO = "2026-11-21T00:00:00.000Z";
const rad = (id: string, projectId: string, kortId: string, beskrivelse: string | null, fra: string, til: string) => ({
  id, projectId, lonnsartId: "l1", aktivitetId: "a1", externalCostObjectId: null, vehicleId: null, byggeplassId: null,
  fraTid: fra, tilTid: til, timer: "2", pauseMin: 0, beskrivelse, attestertStatus: null, erReise: false, kortId, createdAt: DATO,
});

/** To jobber: k1 (Boligfelt, med beskrivelse), k2 (Skole, uten). 2 + 2 t — ingen pausespørsmål. */
function vis(o: {
  modus: "prosjektkort" | "dagskort";
  status?: string;
  k2Beskrivelse?: string | null;
  /** k1: arbeidsraden uten tekst; beskrivelsen står bare på en `erstattet` rad i samme jobb. */
  k1KunErstattetTekst?: boolean;
}) {
  h.data["timer.dagsseddel.hentMedId"] = {
    id: "s1", userId: "u1", organizationId: "o1", dato: DATO, status: o.status ?? "draft",
    startAt: null, endAt: null, pauseMin: 0, beskrivelse: null, aktivitetId: null, aktivitet: null,
    attestertVed: null, lederKommentar: null, manglerMaskinforerbevis: false,
    timer: [
      rad("t1", "p1", "k1", o.k1KunErstattetTekst ? null : "Graving", "07:00", "09:00"),
      ...(o.k1KunErstattetTekst
        ? [{ ...rad("t3", "p1", "k1", "Gammel tekst", "07:00", "09:00"), attestertStatus: "erstattet" }]
        : []),
      rad("t2", "p2", "k2", o.k2Beskrivelse === undefined ? null : o.k2Beskrivelse, "09:00", "11:00"),
    ],
    maskiner: [], tillegg: [], utlegg: [],
  };
  h.data["organisasjon.hentArbeidstidDefaults"] = {
    timerRegistreringsmodus: o.modus, standardStartTid: "07:00", standardPauseMin: 30, standardPauseEtterTimer: 5.5,
  };
  h.data["prosjekt.hentForTimer"] = [
    { id: "p1", name: "Boligfelt", internalProjectNumber: "1050" },
    { id: "p2", name: "Skole", internalProjectNumber: "1060" },
  ];
  h.data["timer.lonnsart.list"] = [{ id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true }];
  h.data["timer.aktivitet.list"] = [{ id: "a1", navn: "Anleggsarbeid", aktiv: true }];
  return render(<DagsseddelDetaljSide />);
}

const merker = () => document.querySelectorAll("[data-testid=mangler-beskrivelse]");
const kortKnapp = (navn: string) =>
  screen.getAllByRole("button").find((b) => b.getAttribute("aria-expanded") !== null && b.textContent?.includes(navn))!;
const sendKnapp = () =>
  screen.getAllByRole("button").find((b) => /timer\.(prosjektkort\.sendDagen|detalj\.sendTilLeder)/.test(b.textContent ?? ""))!;

describe("§ 8.22 L2 — merket «Mangler beskrivelse» i kortet", () => {
  it("prosjektkort-modus: jobben uten beskrivelse er merket, også lukket; jobben med er ikke", () => {
    vis({ modus: "prosjektkort" });
    expect(merker()).toHaveLength(1);
    const skole = kortKnapp("Skole");
    expect(skole.getAttribute("aria-expanded")).toBe("false");
    expect(skole.querySelector("[data-testid=mangler-beskrivelse]")).not.toBeNull();
    expect(kortKnapp("Boligfelt").querySelector("[data-testid=mangler-beskrivelse]")).toBeNull();
  });

  it("blank beskrivelse teller som mangler; tekst fjerner merket", () => {
    vis({ modus: "prosjektkort", k2Beskrivelse: "  " });
    expect(merker()).toHaveLength(1);
    cleanup();
    vis({ modus: "prosjektkort", k2Beskrivelse: "Forskaling" });
    expect(merker()).toHaveLength(0);
  });

  it("sendt dag: ingen merke", () => {
    vis({ modus: "prosjektkort", status: "sent" });
    expect(merker()).toHaveLength(0);
  });

  it("vakt dagskort-modus: aldri merket", () => {
    vis({ modus: "dagskort" });
    expect(merker()).toHaveLength(0);
    expect(document.body.textContent).not.toContain("timer.dagsoversikt.manglerBeskrivelse");
  });
});

describe("§ 8.22 L2 — «Send dagen»", () => {
  it("prosjektkort-modus: sender ikke, åpner jobben som mangler og sier hvorfor", () => {
    vis({ modus: "prosjektkort" });
    fireEvent.click(sendKnapp());
    expect(h.kall).not.toContain("timer.dagsseddel.send");
    expect(kortKnapp("Skole").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("timer.prosjektkort.sendSperretBeskrivelse");
  });

  it("prosjektkort-modus: alle jobber har beskrivelse → sendes", () => {
    vis({ modus: "prosjektkort", k2Beskrivelse: "Forskaling" });
    fireEvent.click(sendKnapp());
    expect(h.kall).toContain("timer.dagsseddel.send");
  });

  it("vakt dagskort-modus: sendes uten beskrivelse som før", () => {
    vis({ modus: "dagskort" });
    fireEvent.click(sendKnapp());
    expect(h.kall).toContain("timer.dagsseddel.send");
  });
});

describe("§ 8.22 L2 — «Hva gjorde du?» i timerad-vinduet", () => {
  const aapneNyTimer = (kort: string) => {
    fireEvent.click(kortKnapp(kort));
    fireEvent.click(screen.getByText("timer.prosjektkort.nyTimer"));
    return document.querySelector("dialog[open] textarea") as HTMLTextAreaElement;
  };
  const etikett = (felt: HTMLTextAreaElement) => felt.parentElement!.querySelector("label")!.textContent ?? "";

  it("prosjektkort-modus, jobb uten beskrivelse: påkrevd med rød markør", () => {
    vis({ modus: "prosjektkort" });
    const felt = aapneNyTimer("Skole");
    expect(felt.required).toBe(true);
    expect(etikett(felt)).toContain("*");
    expect(etikett(felt)).not.toContain("label.valgfritt");
  });

  it("prosjektkort-modus, jobben har alt beskrivelse (ett kort = én beskrivelse): valgfritt", () => {
    vis({ modus: "prosjektkort" });
    const felt = aapneNyTimer("Boligfelt");
    expect(felt.required).toBe(false);
    expect(etikett(felt)).toContain("label.valgfritt");
  });

  it("tekst bare på en «erstattet» rad i jobben teller ikke — feltet er påkrevd (samme filter som sperren)", () => {
    vis({ modus: "prosjektkort", k1KunErstattetTekst: true });
    const felt = aapneNyTimer("Boligfelt");
    expect(felt.required).toBe(true);
    expect(etikett(felt)).toContain("*");
  });
});
