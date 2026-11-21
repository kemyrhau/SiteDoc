// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * ORDRE 2026-11-21 — timeformat på dagssiden: linjene i prosjektkortet viste «4.00 t» (punktum,
 * to desimaler) mens kortoverskriften viste «4,0 t». Nå går all visning av timer/antall/mengde
 * gjennom `formaterTimer` (minst 1, høyst 2 desimaler, desimaltegn etter språket) og beløp
 * gjennom `formaterBelop`.
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation") return () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { data, trpc: lag([]) };
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

import { formaterBelop, formaterTimer } from "@/lib/tallformat";
import DagsseddelDetaljSide from "@/app/dashbord/timer/[id]/page";

afterEach(cleanup);

// Intl bruker hardt mellomrom (U+00A0) som tusenskille på norsk.
const NBSP = " ";

describe("formaterTimer", () => {
  it("minst 1, høyst 2 desimaler, desimalkomma på norsk", () => {
    expect(formaterTimer(0, "nb")).toBe("0,0");
    expect(formaterTimer(4, "nb")).toBe("4,0");
    expect(formaterTimer(4.5, "nb")).toBe("4,5");
    expect(formaterTimer(4.25, "nb")).toBe("4,25");
    expect(formaterTimer(1234.5, "nb")).toBe(`1${NBSP}234,5`);
  });

  it("desimaltegn etter språket; uten språk eller med ugyldig kode → nb", () => {
    expect(formaterTimer(4.5, "en")).toBe("4.5");
    expect(formaterTimer(4.5)).toBe("4,5");
    expect(formaterTimer(4.5, "!!")).toBe("4,5");
  });

  it("beløp har nøyaktig 2 desimaler", () => {
    expect(formaterBelop(250, "nb")).toBe("250,00");
    expect(formaterBelop(1234.5, "nb")).toBe(`1${NBSP}234,50`);
  });
});

describe("dagssiden — linjene i prosjektkortet", () => {
  it("timeraden viser «4,0 t» og maskinraden «4,5 t» — aldri «4.00»", () => {
    const dato = "2026-11-21T00:00:00.000Z";
    h.data["timer.dagsseddel.hentMedId"] = {
      id: "s1",
      userId: "u1",
      organizationId: "o1",
      dato,
      status: "draft",
      startAt: null,
      endAt: null,
      pauseMin: 0,
      beskrivelse: null,
      aktivitetId: null,
      aktivitet: null,
      attestertVed: null,
      lederKommentar: null,
      manglerMaskinforerbevis: false,
      timer: [
        {
          id: "t1",
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
          attestertStatus: null,
          erReise: false,
          kortId: "k1",
          createdAt: dato,
        },
      ],
      maskiner: [
        {
          id: "m1",
          projectId: "p1",
          externalCostObjectId: null,
          vehicleId: "v1",
          byggeplassId: null,
          fraTid: null,
          tilTid: null,
          timer: "4.5",
          mengde: null,
          enhet: null,
          attestertStatus: null,
          sheetTimerId: "t1",
          kortId: "k1",
          createdAt: dato,
        },
      ],
      tillegg: [],
      utlegg: [],
    };
    h.data["organisasjon.hentArbeidstidDefaults"] = {
      timerRegistreringsmodus: "prosjektkort",
      standardStartTid: "07:00",
      standardPauseMin: 30,
      standardPauseEtterTimer: 5.5,
    };
    h.data["prosjekt.hentForTimer"] = [{ id: "p1", name: "Boligfelt", internalProjectNumber: "1050" }];
    h.data["maskin.equipment.list"] = [{ id: "v1", merke: "Volvo", modell: "EC220", internNavn: null }];

    const { container } = render(<DagsseddelDetaljSide />);
    const tekst = container.textContent ?? "";
    const antall = (s: string) => tekst.split(s).length - 1;
    // Kortoverskriften viste komma også før; linjene (timerad + maskinrad) kommer i tillegg.
    expect(antall("4,0 timer.timerEnhet")).toBeGreaterThanOrEqual(2);
    expect(antall("4,5 timer.timerEnhet")).toBeGreaterThanOrEqual(2);
    expect(tekst).not.toMatch(/\d\.\d\d timer\.timerEnhet/);
  });
});
