/**
 * w3a vakt-test (Kenneths regel: dagskortet er isolert — endringer i prosjektkortet skal aldri
 * påvirke dagskortet). Dagskort-markupen for dagen fra #7 er låst som snapshot på develop
 * `b9f9ebe6`, før kortet pr. jobb ble bygget. Snapshotet skal aldri oppdateres i w3a.
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
import { fjernRunde3 } from "./fjern-runde3";

function rendre(modus: string | undefined) {
  h.data = dag7Data(modus);
  return renderToStaticMarkup(<Side />);
}

describe("w3a — vakt: dagskort-modus er uendret", () => {
  it("dagen fra #7 i dagskort-modus gir samme markup som før w3a", () => {
    // Runde 3 timer (variant A, 2026-11-27): «+ Maskin»/«+ Vare» og vare-blokken (`data-runde3`)
    // fjernes før sammenligningen — snapshotet står urørt, resten av dagskortet er byte-likt.
    const html = fjernRunde3(rendre("dagskort"));
    // Fornuftssjekk: snapshotet er av dagskortet med innhold, ikke en tom side.
    expect(html).toContain("timer.detalj.sendTilLeder");
    expect(html).toContain("Skole");
    expect(html).toContain("TILL-001");
    expect(html).not.toContain("timer.prosjektkort.");
    expect(html).toMatchSnapshot();
  });

  it("modus som mangler gir dagskortet, likt", () => {
    expect(rendre(undefined)).toBe(rendre("dagskort"));
  });
});
