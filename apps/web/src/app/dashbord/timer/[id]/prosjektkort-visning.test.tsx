/**
 * Prosjektkort L1: sedelen rendres i begge moduser med samme data. Dagskort
 * skal ikke vise noe av prosjektkort-flaten (og omvendt), og modusen leses fra
 * hentArbeidstidDefaults.timerRegistreringsmodus.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashbord/timer/s1",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        if (navn === "useQuery") {
          const key = sti.join(".");
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

const sheet = {
  id: "s1",
  organizationId: "o1",
  dato: "2026-11-05T00:00:00.000Z",
  status: "draft",
  startAt: "2026-11-05T06:00:00.000Z",
  endAt: "2026-11-05T14:30:00.000Z",
  pauseMin: 30,
  beskrivelse: null,
  aktivitetId: "a1",
  aktivitet: { id: "a1", navn: "Arbeid" },
  attestertVed: null,
  lederKommentar: null,
  manglerMaskinforerbevis: false,
  byggeplassId: null,
  tillegg: [],
  maskiner: [],
  utlegg: [],
  timer: [
    {
      id: "r1",
      projectId: "p1",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      byggeplassId: null,
      fraTid: "07:00",
      tilTid: "11:00",
      timer: "4",
      pauseMin: 0,
      beskrivelse: null,
      attestertStatus: "pending",
      erReise: false,
    },
    {
      id: "r2",
      projectId: "p2",
      lonnsartId: "l1",
      aktivitetId: "a1",
      externalCostObjectId: null,
      vehicleId: null,
      byggeplassId: null,
      fraTid: "11:00",
      tilTid: "15:30",
      timer: "4",
      pauseMin: 30,
      beskrivelse: null,
      attestertStatus: "pending",
      erReise: false,
    },
  ],
};

function rendre(modus: string | undefined, overstyr: Partial<typeof sheet> = {}) {
  h.data = {
    "timer.dagsseddel.hentMedId": { ...sheet, ...overstyr },
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Barnehage", internalProjectNumber: "2050" },
      { id: "p3", name: "Ledig", internalProjectNumber: "2060" },
    ],
    "organisasjon.hentArbeidstidDefaults":
      modus === undefined ? {} : { timerRegistreringsmodus: modus },
    "vareforbruk.hentMineForDato": [],
  };
  return renderToStaticMarkup(<Side />);
}

describe("timer-sedel — visningsmodus", () => {
  beforeEach(() => {
    h.data = {};
  });

  it("dagskort (default/ukjent) viser dagskortets flate og ingen prosjektkort-elementer", () => {
    for (const modus of [undefined, "dagskort", "tull"]) {
      const html = rendre(modus);
      expect(html).toContain("timer.leggTilProsjekt");
      expect(html).toContain("timer.summering");
      expect(html).toContain("timer.detalj.sendTilLeder");
      expect(html).not.toContain("timer.prosjektkort.");
    }
  });

  it("dagskort-markup er lik uansett om modus mangler eller er dagskort", () => {
    expect(rendre("dagskort")).toBe(rendre(undefined));
  });

  it("prosjektkort viser samleside med kort, ramme og send dagen", () => {
    const html = rendre("prosjektkort");
    expect(html).toContain("timer.prosjektkort.overskrift{&quot;antall&quot;:2}");
    expect(html).toContain("2041 — Skole");
    expect(html).toContain("2050 — Barnehage");
    expect(html).toContain("timer.prosjektkort.ramme");
    expect(html).toContain("timer.prosjektkort.pauseBaeres{&quot;kort&quot;:&quot;2050 — Barnehage&quot;}");
    expect(html).toContain("timer.prosjektkort.sendDagen{&quot;timer&quot;:&quot;8&quot;}");
    expect(html).toContain("timer.prosjektkort.nyttKort");
    expect(html).not.toContain("timer.summering");
    expect(html).not.toContain("timer.leggTilProsjekt");
    expect(html).not.toContain("timer.detalj.sendTilLeder");
  });

  it("dagskortets Detaljer-seksjon er skjult i prosjektkort-modus", () => {
    expect(rendre("dagskort")).toContain("timer.detalj.detaljer");
    expect(rendre("prosjektkort")).not.toContain("timer.detalj.detaljer");
  });

  it("reise vises i bunnlinja bare når den er > 0", () => {
    expect(rendre("prosjektkort")).not.toContain("timer.prosjektkort.sumReise");
    const medReise = rendre("prosjektkort", {
      timer: [sheet.timer[0]!, { ...sheet.timer[1]!, erReise: true }],
    });
    expect(medReise).toContain("timer.prosjektkort.sumReise{&quot;timer&quot;:&quot;4&quot;}");
  });

  it("returnert sedel: knappen sier «Send på nytt» som i dagskortet", () => {
    const html = rendre("prosjektkort", { status: "returned" });
    expect(html).toContain("timer.detalj.sendPaaNytt");
    expect(html).not.toContain("timer.prosjektkort.sendDagen");
  });
});
