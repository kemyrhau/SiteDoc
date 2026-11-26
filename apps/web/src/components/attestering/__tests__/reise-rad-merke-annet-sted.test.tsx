// @vitest-environment jsdom
/**
 * Runde 2 timer («Annet sted», Kenneth 2026-11-26: «hva om jeg sendes til bergen på kurs»): en reise
 * til et sted arbeideren skrev, vises i attesteringens rutelinje som «{oppmøtested} → {sted}».
 * Uten stedet ville linja bare vist oppmøtestedet (ingen byggeplass).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TimerRad } from "../attestering-buckets";

const data: Record<string, unknown> = {
  "oppmotested.hentForFirma": [{ id: "kt", navn: "Tromsø" }],
  "bygning.hentForFirma": [{ id: "b1", name: "Blokk A" }],
};
vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, p: string | symbol) => {
        if (typeof p !== "string" || p === "then") return undefined;
        if (p === "useQuery") return () => ({ data: data[sti.join(".")] });
        return lag([...sti, p]);
      },
    });
  return { trpc: lag([]) };
});
vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ valgtFirma: { id: "org1" } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k) }),
}));

import { ReiseRadMerke } from "../ReiseRadMerke";

const rad = (over: Partial<TimerRad>): TimerRad =>
  ({ id: "r1", erReise: true, reiseRetning: "ut", reiseKilde: "manuell", reiseOppmotestedId: "kt", byggeplassId: null, reiseKjoretidMin: null, ...over }) as TimerRad;

describe("VAKTTEST 2026-11-26 (Kenneth: «alt fungerer såvidt jeg kan se», runde 2) — Runde 2 — ReiseRadMerke for «Annet sted»", () => {
  afterEach(cleanup);

  it("«Tromsø → Bergen» med stedet arbeideren skrev", () => {
    const { container } = render(<ReiseRadMerke rad={rad({ reiseRegel: { annetSted: { sted: "Bergen" } } })} />);
    expect(container.textContent).toContain("Tromsø → Bergen");
  });

  it("uten oppmøtested (O22): bare stedet", () => {
    const { container } = render(<ReiseRadMerke rad={rad({ reiseOppmotestedId: null, reiseRegel: { annetSted: { sted: "Bergen" } } })} />);
    expect(container.textContent).toContain("Bergen");
    expect(container.textContent).not.toContain("→");
  });
});
