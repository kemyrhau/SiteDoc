// @vitest-environment jsdom
/**
 * Ordre 2026-11-14 (11) B: kjøretid i «Avstander» vises som «1 t 35 min» over
 * én time og «45 min» under — via den delte `formaterKjoretid` og ekte nb-tekster.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import nb from "../../../../../../../packages/shared/src/i18n/nb.json";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((nb as Record<string, string>)[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) =>
        String(o?.[n] ?? ""),
      ),
    i18n: { language: "nb" },
  }),
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") return () => ({ data: h.data[key], isLoading: false });
        if (navn === "useMutation") return () => ({ mutate: () => {}, isPending: false });
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import { AvstanderFane } from "./AvstanderFane";

function rendre(enhet: "minutter" | "km", min: number[]) {
  h.data = {
    "oppmotested.hentAvstander": {
      enhet,
      oppmotesteder: [{ id: "o1", navn: "Kontor" }],
      byggeplasser: min.map((_, i) => ({
        id: `b${i}`,
        navn: `Plass ${i}`,
        nummer: null,
        harPunkt: true,
        prosjekt: { name: "Skole", projectNumber: "2041" },
      })),
      rader: min.map((m, i) => ({
        oppmotestedId: "o1",
        byggeplassId: `b${i}`,
        kjoretidMin: m,
        avstandM: 12000,
        kilde: "beregnet",
      })),
    },
  };
  return renderToStaticMarkup(<AvstanderFane orgId="org1" />);
}

describe("Avstander-fanen — kjøretid (B)", () => {
  it.each(["minutter", "km"] as const)("måles i %s: 95 → «1 t 35 min», 45 → «45 min», 120 → «2 t»", (enhet) => {
    const html = rendre(enhet, [95, 45, 120]);
    expect(html).toContain(">1 t 35 min<");
    expect(html).toContain(">45 min<");
    expect(html).toContain(">2 t<");
  });

  it("negativkontroll: rå minutter over én time vises aldri", () => {
    const html = rendre("minutter", [95]);
    expect(html).not.toContain("95 min");
    expect(html).not.toMatch(/>95</);
  });
});
