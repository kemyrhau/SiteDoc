// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * A4 RETUR vilkår 4 (plan § 4.17 del B, «Ett regnestykke»): banneret i attesteringsdetaljen
 * leser ukas regnestykke (`uke` fra `hentForAttestering`) — samme merker som ukelinja, og
 * bare når uka er komplett (B53 A). Før: `avvikRetning` (ført mot beregnet overtid), også
 * midt i uka.
 */

const h = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get(_m, p: string | symbol) {
        if (typeof p !== "string" || p === "then") return undefined;
        const navn = sti.join(".");
        if (p === "useQuery") return () => ({ data: data[navn], isLoading: false });
        if (p === "useMutation") return () => ({ mutate: () => {}, isPending: false });
        if (p === "useUtils") return () => lag([]);
        if (p === "invalidate") return () => Promise.resolve();
        return lag([...sti, p]);
      },
    });
  return { data, trpc: lag([]) };
});

vi.mock("@/lib/trpc", () => ({ trpc: h.trpc }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));
vi.mock("@/components/attestering/AttesteringTabell", async (orig) => ({
  ...(await orig<typeof import("@/components/attestering/AttesteringTabell")>()),
  AttesteringTabell: () => null,
}));
vi.mock("@/components/attestering/useAttesteringModell", () => ({ useAttesteringModell: () => [] }));
vi.mock("@/components/timer/ForslagValgSeksjon", () => ({ ForslagValgSeksjon: () => null }));
vi.mock("@/components/timer/AttesteringDetalj_Edit", () => ({ AttesteringDetaljEdit: () => null }));
vi.mock("@/components/timer/StatusBadge", () => ({ StatusBadge: () => null }));

import { beregnUkeregnestykke, beregnUkeOvertidsgrunnlag } from "@sitedoc/shared";
import { UkeBanner } from "@/components/attestering/AttesteringTabell";
import { AttesteringDetalj } from "@/components/timer/AttesteringDetalj";
import type { AttUke } from "@/components/attestering/ukelinje";

afterEach(cleanup);

const rad = (timer: number, over: { ot?: boolean; fravaer?: boolean } = {}) => ({
  timer, overtidsnivaa: over.ot ? 50 : null, erReise: false, erFravaer: over.fravaer === true,
});
const DATOER = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
/** Planens eksempeluke; `antall` < 5 = uka så langt (midt i uka). */
function dager(antall = 5) {
  const alle = [
    [rad(7.5)], [rad(7.5), rad(2.5, { ot: true })], [rad(7.5, { fravaer: true })], [rad(6.5)], [rad(5)],
  ];
  return DATOER.slice(0, antall).map((dato, i) => ({ dato, dagsnorm: 7.5, rader: alle[i]! }));
}
function uke(antall = 5): AttUke {
  const komplett = antall === 5;
  return { ukestart: DATOER[0]!, regnestykke: beregnUkeregnestykke(dager(antall), 37.5), komplett, manglerDager: DATOER.slice(antall) };
}
const KAN_TREKKES = 'timer.attestering.tabell.uke.kanTrekkes{"timer":"1,0","overtid":"2,5"}';

describe("UkeBanner", () => {
  it("komplett eksempeluke: «1,0 t av 2,5 t overtid kan trekkes» og «Under ukenorm 1,0 t»", () => {
    const { container } = render(<UkeBanner uke={uke()} />);
    const b = container.querySelector("[data-ukebanner]");
    expect(b?.textContent).toContain(KAN_TREKKES);
    expect(b?.textContent).toContain('timer.attestering.tabell.uke.underNorm{"timer":"1,0"}');
  });
  it("midt i uka: ingen banner", () => {
    expect(render(<UkeBanner uke={uke(2)} />).container.querySelector("[data-ukebanner]")).toBeNull();
  });
});

describe("Detaljsiden følger ukeregnestykket", () => {
  function visDetalj(antall: number) {
    h.data["timer.dagsseddel.hentForAttestering"] = {
      id: "s2", organizationId: "org1", userId: "u1", dato: DATOER[1], status: "sent", timer: [], tillegg: [], maskiner: [],
      ansatt: { id: "u1", name: "Kari Nordmann", email: "k@x" }, prosjekt: null, redigerTillatt: true, egneTimer: false,
      varer: [], utlegg: [], dagsnorm: 7.5, fravaerNormtakBrudd: null, ukeAvvikRadIder: [],
      // Det gamle grunnlaget («ført overtid under norm») — banneret skal ikke lenger lese det.
      ukeOvertidsgrunnlag: beregnUkeOvertidsgrunnlag(dager(antall), 37.5),
      uke: uke(antall),
    };
    return render(<AttesteringDetalj sheetId="s2" tilbakeUrl="/dashbord/attestering" />).container;
  }
  it("midt i uka (mandag + tirsdag sendt): ingen banner", () => {
    const c = visDetalj(2);
    expect(c.textContent).not.toContain("timer.attestering.varsel");
    expect(c.querySelector("[data-ukebanner]")).toBeNull();
  });
  it("komplett eksempeluke: banneret sier det ukelinja sier", () => {
    const c = visDetalj(5);
    expect(c.querySelector("[data-ukebanner]")?.textContent).toContain(KAN_TREKKES);
    expect(c.textContent).not.toContain("timer.attestering.varsel.under");
  });
});
