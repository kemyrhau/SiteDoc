// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * F13c-2 (Kenneth 2026-11-23): «kontrollplanen er for prosjektadmin. et vanlig medlem skal kun
 * kunne utføre en sjekkliste som allerede er i kontrollplanen».
 * Punktdialogen uten kanRedigere: ingen endringsknapper (frist, avhengighet, skyv, bytt mal,
 * plassering, slett), men utførings-handlingen (renderHandling = Start/koble/åpne) står.
 */

const { mutasjon } = vi.hoisted(() => ({ mutasjon: () => ({ mutate: () => {}, isPending: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    mal: {
      hentForProsjekt: { useQuery: () => ({ data: [] }) },
      kanRedigere: { useQuery: () => ({ data: false }) },
    },
    dokumentflyt: { hentForProsjekt: { useQuery: () => ({ data: [] }) } },
    kontrollplan: {
      oppdaterPunkt: { useMutation: mutasjon },
      slettPunkt: { useMutation: mutasjon },
      skyvOmrade: { useMutation: mutasjon },
      skyvKaskade: { useMutation: mutasjon },
      settPunktFlyt: { useMutation: mutasjon },
      settFlytForMal: { useMutation: mutasjon },
      settPunktPlassering: { useMutation: mutasjon },
      hentKaskadeBerort: { useQuery: () => ({ data: undefined }) },
      hentHistorikk: { useQuery: () => ({ data: [] }) },
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/kontekst/byggeplass-kontekst", () => ({
  useByggeplass: () => ({ startPosisjonsvelger: vi.fn(), settAktivTegning: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { RedigerPunktDialog } from "../RedigerPunktDialog";

const punkt = {
  id: "p-1",
  kontrollplanId: "kp-1",
  omradeId: "o-1",
  milepelId: null,
  sjekklisteMalId: "m-1",
  faggruppeId: "fg-1",
  fristUke: 12,
  fristAar: 2027,
  status: "planlagt",
  varselUkerFor: 2,
  avhengerAvId: null,
  dokumentflytId: null,
  drawingId: null,
  sjekklisteMal: { id: "m-1", name: "Membran", prefix: "SJK", kontrollomrade: null },
  faggruppe: { id: "fg-1", name: "Elektro", color: null },
  omrade: { id: "o-1", navn: "Bad 1", type: "rom" },
  sjekkliste: null,
  avhengerAv: null,
  drawing: null,
};

function vis(kanRedigere: boolean) {
  render(
    <RedigerPunktDialog
      punkt={punkt as never}
      allePunkter={[punkt] as never}
      projectId="prosjekt-1"
      onLukk={() => {}}
      onOppdatert={() => {}}
      renderHandling={() => <button type="button">START</button>}
      kanRedigere={kanRedigere}
    />,
  );
}

afterEach(cleanup);

describe("F13c-2 — punktdialogen for vanlig medlem", () => {
  it("🔴 vanlig medlem ser ingen endringsknapper, men kan starte sjekklisten", () => {
    vis(false);
    expect(screen.getByRole("button", { name: "START" })).toBeTruthy();
    for (const k of [
      "kontrollplan.slettPunkt",
      "kontrollplan.byttMal",
      "kontrollplan.redigerPunkt.skyvKaskade",
      "kontrollplan.plasserPaTegning",
      "handling.lagre",
    ]) {
      expect(screen.queryByText(k, { exact: false })).toBeNull();
    }
    expect(screen.queryByText("kontrollplan.skyvOmrade", { exact: false })).toBeNull();
    expect(screen.getByText("U12 2027")).toBeTruthy();
    expect(screen.getByText("kontrollplan.punktTittel")).toBeTruthy();
  });

  it("prosjektadmin har endringsknappene som før", () => {
    vis(true);
    expect(screen.getByRole("button", { name: "START" })).toBeTruthy();
    expect(screen.getByText("kontrollplan.slettPunkt")).toBeTruthy();
    expect(screen.getByText("kontrollplan.byttMal")).toBeTruthy();
    expect(screen.getByText("kontrollplan.plasserPaTegning")).toBeTruthy();
    expect(screen.getByText("kontrollplan.rediger")).toBeTruthy();
  });
});
