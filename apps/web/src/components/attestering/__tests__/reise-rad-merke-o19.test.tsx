// @vitest-environment jsdom
/**
 * O19 (vedtak-timer-web.md § Reisevinduet pkt 23): attestanten ser at en reise er delt ved
 * midnatt — «fortsetter {dato}» på del 1, «fortsatt fra {dato}» på del 2. 24:00 er gyldig til-tid
 * i «Rett reisen» og linjevinduet, aldri fra-tid.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TimerRad } from "../attestering-buckets";

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, p: string | symbol) => {
        if (typeof p !== "string" || p === "then") return undefined;
        if (p === "useQuery") return () => ({ data: undefined });
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
import { tidRetting } from "../RegistreringPanel";

const rad = (over: Partial<TimerRad>): TimerRad =>
  ({ id: "r1", erReise: true, reiseRetning: "retur", reiseKilde: "manuell", byggeplassId: null, ...over }) as TimerRad;

describe("O19 pkt 23 — attestering", () => {
  afterEach(cleanup);

  it("del 1 → «fortsetter 24.11», del 2 → «fortsatt fra 22.11»", () => {
    const a = render(<ReiseRadMerke rad={rad({ reiseRegel: { midnatt: { delId: "x", del: 1 } } })} sedelDato="2026-11-23T00:00:00.000Z" />);
    expect(a.getByTestId("reise-midnatt-merke").textContent).toBe('timer.reise.fortsetter{"dato":"24.11"}');
    cleanup();
    const b = render(<ReiseRadMerke rad={rad({ reiseRegel: { midnatt: { delId: "x", del: 2 } } })} sedelDato={new Date("2026-11-23T00:00:00.000Z")} />);
    expect(b.getByTestId("reise-midnatt-merke").textContent).toBe('timer.reise.fortsattFra{"dato":"22.11"}');
  });

  it("negativkontroll: vanlig reise / uten sedelDato → intet merke", () => {
    const a = render(<ReiseRadMerke rad={rad({ reiseRegel: {} })} sedelDato="2026-11-23" />);
    expect(a.queryByTestId("reise-midnatt-merke")).toBeNull();
    cleanup();
    const b = render(<ReiseRadMerke rad={rad({ reiseRegel: { midnatt: { delId: "x", del: 1 } } })} />);
    expect(b.queryByTestId("reise-midnatt-merke")).toBeNull();
  });

  it("linjevinduet: 21:00–24:00 er gyldig; 24:00 som fra-tid er ugyldig", () => {
    const lagret = { fraTid: "21:00", tilTid: "23:00", pauseMin: 0, timer: 2 };
    expect(tidRetting(lagret as never, { fra: "21:00", til: "24:00", pause: "0" }, null).type).not.toBe("feil");
    expect(tidRetting(lagret as never, { fra: "24:00", til: "24:00", pause: "0" }, null).type).toBe("feil");
  });
});
