// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { DokumentHandlingsmeny } from "../DokumentHandlingsmeny";

/**
 * P1-restfiks (2026-08-03): på SISTE ball-ledд (`nesteLedd=null`) har «Send» intet mål og skal
 * ALDRI vises — verken som aktiv handling ELLER som deaktivert «Send · KUN ADMINISTRATOR». Det siste
 * var lekkasjen Kenneth fant (KB2-017 ledд 4): `deaktiverteOppforinger` leste det rå status-universet.
 * Denne testen monterer den EKTE menyen på siste ledд og bekrefter at «Send» er borte begge steder.
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "handling.send": "Send",
          "handling.godkjenn": "Godkjenn",
          "statushandling.besvar": "Besvar",
          "statushandling.trekkTilbake": "Trekk tilbake",
          "statushandling.videresend": "Videresend",
          "statushandling.admin": "Admin",
          "statushandling.sendVidereTil": "Send videre til",
          "statushandling.flereHandlinger": "Flere handlinger",
          "statushandling.leggTilKommentar": "+ kommentar",
          "flyt.godkjennOgFullfor": "Godkjenn og fullfør",
          "flyt.besvarTil": "Besvar til {{navn}}",
        },
      },
    },
  });
});

afterEach(cleanup);

// 2-ledds flyt, dokumentet på SISTE ledд (aktivPosisjon=2) → nesteLedd=null.
const flytMedlemmer = [
  { id: "m1", rolle: "utforer", steg: 1, faggruppe: null, projectMember: { user: { id: "u1", name: "A Utfører" } }, group: null },
  { id: "m2", rolle: "godkjenner", steg: 2, faggruppe: null, projectMember: { user: { id: "u2", name: "B Godkjenner" } }, group: null },
];

function meny() {
  return render(
    <I18nextProvider i18n={i18n}>
      <DokumentHandlingsmeny
        status="received"
        aktivPosisjon={2}
        retningsrett={{ kanSende: true, kanBesvare: true, kanVideresende: false, kanTerminere: true }}
        harBallen={true}
        erMedlemAvFlyt={true}
        erLaster={false}
        minRolle="godkjenner"
        onEndreStatus={() => {}}
        flytMedlemmer={flytMedlemmer}
      />
    </I18nextProvider>,
  );
}

describe("P1-restfiks: «Send» borte på siste ledд (aktiv OG deaktivert)", () => {
  it("primær er «Godkjenn og fullfør», ikke «Send»", () => {
    meny();
    expect(screen.getByText("Godkjenn og fullfør")).toBeTruthy();
    expect(screen.queryByTestId("handling-sent")).toBeNull();
  });

  it("etter åpnet split-▾: verken aktiv «Send»-rad ELLER deaktivert «Send»-oppføring", () => {
    meny();
    fireEvent.click(screen.getByTestId("handling-split-nedtrekk"));
    // Ingen sent-handling (aktiv rad har data-testid `handling-sent`).
    expect(screen.queryByTestId("handling-sent")).toBeNull();
    // Ingen deaktivert «Send»-oppføring (den leste rått universe før fiksen). Portalet meny → søk body.
    const sendTreff = screen.queryAllByText("Send");
    expect(sendTreff).toHaveLength(0);
  });
});
