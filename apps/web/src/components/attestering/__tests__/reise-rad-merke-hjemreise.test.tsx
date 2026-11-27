// @vitest-environment jsdom
/**
 * Runde 4 timer (Kenneth 2026-11-26: «annet sted, foreslå hjemmreise men ikke bloker annen
 * registrering»): hjemreisen fra et «Annet sted» (retur) vises i attesteringens rutelinje som
 * «{sted} → {oppmøtested}» — ikke «{oppmøtested} → {sted}».
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TimerRad } from "../attestering-buckets";

const data: Record<string, unknown> = {
  "oppmotested.hentForFirma": [{ id: "kt", navn: "Kontor Tromsø" }],
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
  ({ id: "r1", erReise: true, reiseRetning: "retur", reiseKilde: "manuell", reiseOppmotestedId: "kt", byggeplassId: null, reiseKjoretidMin: null, reiseRegel: { annetSted: { sted: "Bergen" } }, ...over }) as TimerRad;

describe("Runde 4 — ReiseRadMerke for hjemreise fra «Annet sted»", () => {
  afterEach(cleanup);

  it("«Bergen → Kontor Tromsø»", () => {
    const { container } = render(<ReiseRadMerke rad={rad({})} />);
    expect(container.textContent).toContain("Bergen → Kontor Tromsø");
    expect(container.textContent).not.toContain("Kontor Tromsø → Bergen");
  });

  it("utreisen er uendret: «Kontor Tromsø → Bergen»", () => {
    const { container } = render(<ReiseRadMerke rad={rad({ reiseRetning: "ut" })} />);
    expect(container.textContent).toContain("Kontor Tromsø → Bergen");
  });

  it("vanlig retur fra byggeplass er uendret: «Blokk A → Kontor Tromsø»", () => {
    const { container } = render(<ReiseRadMerke rad={rad({ reiseRegel: {}, byggeplassId: "b1" })} />);
    expect(container.textContent).toContain("Blokk A → Kontor Tromsø");
  });
});
