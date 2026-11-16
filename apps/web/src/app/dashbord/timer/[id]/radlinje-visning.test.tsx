/**
 * V22: timeraden viser «Prosjekt · Byggeplass» i liten skrift under raden
 * (web-paritet med mobil). Byggeplassnavnet står ikke lenger i tittellinja.
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

const byggeplasser = [
  { id: "bp1", projectId: "p1", name: "Lab 16" },
  { id: "bp2", projectId: "p1", name: "Lab 17" },
];

function rendre(rader: Array<{ id: string; byggeplassId: string | null }>, sedelBp: string | null) {
  h.data = {
    "timer.dagsseddel.hentMedId": {
      ...sheet,
      byggeplassId: sedelBp,
      timer: sheet.timer
        .filter((r) => rader.some((x) => x.id === r.id))
        .map((r) => ({ ...r, byggeplassId: rader.find((x) => x.id === r.id)!.byggeplassId })),
    },
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Barnehage", internalProjectNumber: "2050" },
    ],
    "organisasjon.hentArbeidstidDefaults": {},
    "vareforbruk.hentMineForDato": [],
    "bygning.hentForFirma": byggeplasser,
    "timer.lonnsart.list": [{ id: "l1", navn: "Prosjekttimer" }],
  };
  return renderToStaticMarkup(<Side />);
}

// Tittellinja = <p class="text-sm font-medium text-gray-900">…</p> i raden.
function titler(html: string): string[] {
  return [...html.matchAll(/<p class="text-sm font-medium text-gray-900">(.*?)<\/p>/g)].map(
    (m) => m[1]!,
  );
}

describe("V22 — prosjekt · byggeplass på timeraden", () => {
  beforeEach(() => {
    h.data = {};
  });

  it("🔴 egen byggeplass: «Skole · Lab 17», ikke nedtonet", () => {
    const html = rendre([{ id: "r1", byggeplassId: "bp2" }], "bp1");
    expect(html).toContain('Skole · <span class="text-gray-600">Lab 17</span>');
  });

  it("🔴 arvet byggeplass: nedtonet med «(fra dagskortet)»", () => {
    const html = rendre([{ id: "r1", byggeplassId: null }], "bp1");
    expect(html).toContain(
      'Skole · <span class="text-gray-400">Lab 16 (timer.byggeplass.fraDagskort)</span>',
    );
  });

  it("🔴 ingen byggeplass: «Ingen byggeplass», også når dagskortets er på annet prosjekt", () => {
    expect(rendre([{ id: "r1", byggeplassId: null }], null)).toContain(
      'Skole · <span class="text-gray-400">timer.byggeplass.ingenValgt</span>',
    );
    expect(rendre([{ id: "r2", byggeplassId: null }], "bp1")).toContain(
      'Barnehage · <span class="text-gray-400">timer.byggeplass.ingenValgt</span>',
    );
  });

  it("🔴 vakt: tittellinja inneholder ikke byggeplassnavnet (ordre 10s « · navn» er flyttet)", () => {
    const html = rendre([{ id: "r1", byggeplassId: "bp2" }], "bp1");
    const t = titler(html);
    expect(t).toContain("Prosjekttimer");
    for (const tittel of t) {
      expect(tittel).not.toContain("Lab 1");
    }
  });

  it("redigerbar sedel: linja er en knapp (åpner rad-dialogen)", () => {
    const html = rendre([{ id: "r1", byggeplassId: "bp2" }], null);
    expect(html).toMatch(/<button type="button" class="mt-0\.5 block text-left text-xs text-gray-500[^"]*">Skole · /);
  });
});
