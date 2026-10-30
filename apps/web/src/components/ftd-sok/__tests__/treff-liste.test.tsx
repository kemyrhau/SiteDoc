// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * SØK-2 Treffliste A (dokumentsok-visning-spec § 1): serveren gir inntil 5 rader pr. dokument i første søk
 * og `antallIDok` = totalt. Hodet viser «5 av 12 treff» og «Vis N flere» henter neste porsjon (20) til alt
 * vises — da forsvinner knappen og hodet viser «N treff».
 * Rød før: `antallIDok` ble ignorert; hodet viste «5 treff» og det fantes ingen knapp.
 */

vi.mock("@/components/SignertLenke", () => ({ useSignertLenkeApner: () => () => undefined }));

import { TreffListe, VIS_FLERE_PORSJON } from "../treff-liste";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    resources: {
      nb: {
        translation: {
          "ftdSok.antallTreffIDok": "{{treff}} treff i {{dok}} dokumenter",
          "ftdSok.antallTreffDok": "{{antall}} treff",
          "ftdSok.antallTreffAv": "{{vist}} av {{antall}} treff",
          "ftdSok.visFlere": "Vis {{antall}} flere",
          "ftdSok.side": "side {{side}}",
          "ftdSok.chunk": "avsnitt {{nr}}",
          "ftdSok.metodeTekst": "Tekst",
          "handling.vis": "Vis",
        },
      },
    },
  });
});
afterEach(cleanup);

const basis = {
  documentId: "d1",
  filename: "kontrakt.pdf",
  fileUrl: null,
  docType: "pdf",
  folderId: null,
  sectionTitle: null,
  metode: "tekst" as const,
};

function rader(n: number, antallIDok: number, documentId = "d1") {
  return Array.from({ length: n }, (_, i) => ({
    ...basis,
    documentId,
    id: `${documentId}-${i}`,
    chunkText: `Dagmulkt nr. ${i}.`,
    chunkIndex: i,
    pageNumber: i + 1,
    antallIDok,
  }));
}

describe("SØK-2 Treffliste A — «N av M treff» + «Vis N flere»", () => {
  it("5 vist av 12: hodet viser «5 av 12 treff», knappen «Vis 7 flere» kaller onVisFlere(documentId, 5)", () => {
    const onVisFlere = vi.fn();
    const { container } = render(
      <TreffListe søkeord="dagmulkt" valgtId={null} onVelgTreff={() => undefined} treff={rader(5, 12)} onVisFlere={onVisFlere} />,
    );
    const spenn = Array.from(container.querySelectorAll("span")).map((e) => e.textContent);
    expect(spenn).toContain("5 av 12 treff");
    expect(spenn).not.toContain("5 treff");
    const knapp = container.querySelector<HTMLButtonElement>('[data-vis-flere="d1"]')!;
    expect(knapp.textContent).toContain("Vis 7 flere");
    fireEvent.click(knapp);
    expect(onVisFlere).toHaveBeenCalledWith("d1", 5);
  });

  it("5 vist av 40: knappen tilbyr porsjonen (20), ikke alle 35; etter 25 vist: «Vis 15 flere»", () => {
    expect(VIS_FLERE_PORSJON).toBe(20);
    const a = render(
      <TreffListe søkeord="dagmulkt" valgtId={null} onVelgTreff={() => undefined} treff={rader(5, 40)} onVisFlere={() => undefined} />,
    );
    expect(a.container.querySelector('[data-vis-flere="d1"]')!.textContent).toContain("Vis 20 flere");
    cleanup();
    const b = render(
      <TreffListe søkeord="dagmulkt" valgtId={null} onVelgTreff={() => undefined} treff={rader(25, 40)} onVisFlere={() => undefined} />,
    );
    expect(b.container.textContent).toContain("25 av 40 treff");
    expect(b.container.querySelector('[data-vis-flere="d1"]')!.textContent).toContain("Vis 15 flere");
  });

  it("alt vist (antallIDok ≤ vist): ingen knapp, hodet viser «12 treff»", () => {
    const { container } = render(
      <TreffListe søkeord="dagmulkt" valgtId={null} onVelgTreff={() => undefined} treff={rader(12, 12)} onVisFlere={() => undefined} />,
    );
    expect(container.querySelector("[data-vis-flere]")).toBeNull();
    expect(container.textContent).toContain("12 treff");
    expect(container.textContent).not.toContain(" av 12 treff");
  });

  it("uten antallIDok (eldre API-svar): som før — «3 treff», ingen knapp", () => {
    const treff = rader(3, 3).map(({ antallIDok: _a, ...r }) => r);
    const { container } = render(
      <TreffListe søkeord="dagmulkt" valgtId={null} onVelgTreff={() => undefined} treff={treff} onVisFlere={() => undefined} />,
    );
    expect(container.querySelector("[data-vis-flere]")).toBeNull();
    expect(container.textContent).toContain("3 treff");
  });

  it("laster for dokumentet: knappen er deaktivert; andre dokumenters knapper aktive", () => {
    const treff = [...rader(5, 9, "d1"), ...rader(5, 8, "d2")];
    const { container } = render(
      <TreffListe
        søkeord="dagmulkt"
        valgtId={null}
        onVelgTreff={() => undefined}
        treff={treff}
        onVisFlere={() => undefined}
        lasterFlereFor="d1"
      />,
    );
    expect(container.querySelector<HTMLButtonElement>('[data-vis-flere="d1"]')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-vis-flere="d2"]')!.disabled).toBe(false);
  });
});
