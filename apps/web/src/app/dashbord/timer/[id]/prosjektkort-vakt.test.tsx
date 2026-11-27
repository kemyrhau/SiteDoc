/**
 * Runde 3 timer vakt-test (2026-11-27): prosjektkort-visningen er uendret når dagskortet
 * får «+ Maskin» og «+ Vare». Markupen for dagen fra #7 i prosjektkort-modus er låst som
 * snapshot på develop `f73fc6ca`, før runde 3. Snapshotet skal ikke oppdateres i runde 3.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

// w2: dagssiden leser prosjektet fra toppen (useProsjekt) for «+ Registrer timer».
vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: null }),
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
import { dag7Data } from "./testdata-dag7";

function rendre(modus: string | undefined) {
  h.data = dag7Data(modus);
  return renderToStaticMarkup(<Side />);
}

describe("VAKTTEST 2026-11-27 (Kenneth: «ok» pkt 1–3 + «merge runde 3 nå», runde 3) — Runde 3 — vakt: prosjektkort-modus er uendret", () => {
  it("dagen fra #7 i prosjektkort-modus gir samme markup som før runde 3", () => {
    const html = rendre("prosjektkort");
    // Fornuftssjekk: snapshotet er av prosjektkortet med innhold, ikke en tom side.
    expect(html).toContain("timer.prosjektkort.");
    expect(html).toContain("Skole");
    expect(html).toMatchSnapshot();
  });
});
