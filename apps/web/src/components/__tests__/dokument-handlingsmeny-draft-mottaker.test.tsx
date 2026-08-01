// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { DokumentHandlingsmeny } from "../DokumentHandlingsmeny";

/**
 * DB-fri repro/verifikasjon (meny-fiks 2026-08-01, cowork GO #1).
 *
 * Bakgrunn: split-▾ på et FLYT-BUNDET utkast viste `draftMottakerOppforinger` —
 * P3-mottakervelgeren som lister prosjektets faggrupper/flyter («Boligfelt B12»/
 * «Boligfelt» i testdataen, IKKE byggeplass-velgeren). I posisjonsmodellen ruter
 * server `beregnRuting` alltid `sent` via `nesteLedd` (aktivPosisjon) og IGNORERER
 * klient-mottaker → velgeren er både obsolet og villedende der.
 *
 * Fiks: `draftSend = ... && !harFlyt`. Denne testen monterer den FAKTISKE
 * DokumentHandlingsmeny (ekte kode, fireEvent — ingen browser) og beviser:
 *   1. flyt-bundet utkast → INGEN mottakervelger, primær = «Send til N · X →».
 *   2. flyt-løst utkast → velgeren BESTÅR (binder flyten, fortsatt legitim).
 */

const RECIPIENT_A = "Boligfelt B12"; // fg1-navn = draftMottaker-rad (skal forsvinne på flyt-utkast)
const RECIPIENT_B = "Boligfelt"; // fg2-navn (= også ledд 2s navn → primær-målet)

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    // Returner nøkkelen for ukjente strenger (parseMissingKeyHandler) → ryddige assertions.
    parseMissingKeyHandler: (key) => key,
    resources: {
      nb: {
        translation: {
          "handling.send": "Send",
          "handling.slett": "Slett",
          "flyt.sendTil": "Send til {{navn}}",
          "flyt.godkjennOgFullfor": "Godkjenn og fullfør",
          "statushandling.sendVidereTil": "Send videre til",
          "statushandling.flereHandlinger": "Flere handlinger",
          "statushandling.leggTilKommentar": "+ kommentar",
        },
      },
    },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

// To faggrupper med hver sin matchende flyt → videresendValg.length === 2.
const alleFaggrupper = [
  { id: "fg1", name: RECIPIENT_A, color: null },
  { id: "fg2", name: RECIPIENT_B, color: null },
];
const dokumentflyter = [
  {
    id: "df1",
    name: "F1",
    faggruppeId: "fg1",
    maler: [{ template: { id: "tmpl1" } }],
    medlemmer: [{ rolle: "utforer", projectMember: { user: { id: "u1", name: "Ola" } } }],
  },
  {
    id: "df2",
    name: "F2",
    faggruppeId: "fg2",
    maler: [{ template: { id: "tmpl1" } }],
    medlemmer: [{ rolle: "utforer", projectMember: { user: { id: "u2", name: "Kari" } } }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

// Flyt-bundet: 2 ledд (posisjon 1 «Boligfelt B12» → posisjon 2 «Boligfelt»).
const flytMedlemmer = [
  { steg: 1, rolle: "registrator", klassifisering: "utfor", faggruppe: { id: "fg1", name: RECIPIENT_A } },
  { steg: 2, rolle: "utforer", klassifisering: "kontroll", erHovedansvarlig: true, faggruppe: { id: "fg2", name: RECIPIENT_B } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const kanSende = { kanSende: true, kanBesvare: false, kanVideresende: false, kanTerminere: false };

describe("Utkast-mottakervelger i split-▾: undertrykt for flyt-bundet, beholdt for flyt-løst", () => {
  it("FLYT-BUNDET utkast → ingen mottakervelger; primær = «Send til 2 · Boligfelt →»", () => {
    const onEndreStatus = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <DokumentHandlingsmeny
          status="draft"
          aktivPosisjon={1}
          retningsrett={kanSende}
          harBallen={true}
          erLaster={false}
          minRolle="registrator"
          adminNiva={null}
          flytMedlemmer={flytMedlemmer}
          alleFaggrupper={alleFaggrupper}
          dokumentflyter={dokumentflyter}
          templateId="tmpl1"
          onEndreStatus={onEndreStatus}
        />
      </I18nextProvider>,
    );

    // Primær er posisjon-rutet: «Send til 2 · Boligfelt» (nesteLedд), IKKE bare «Send».
    expect(screen.getByText("Send til 2 · Boligfelt")).toBeTruthy();

    // Mottakervelger-raden «Boligfelt B12» (ledд 1 / fg1) skal ALDRI dukke opp — verken
    // direkte eller etter et primærklikk (posisjon-Send åpner ingen velger).
    fireEvent.click(screen.getByText("Send til 2 · Boligfelt"));
    expect(screen.queryByText(RECIPIENT_A)).toBeNull();

    // Send dispatches som «sent» UTEN manuell mottaker → server ruter via nesteLedд.
    expect(onEndreStatus).toHaveBeenCalledTimes(1);
    const [nyStatus, , , mottaker] = onEndreStatus.mock.calls[0]!;
    expect(nyStatus).toBe("sent");
    expect(mottaker).toBeUndefined();

    // Ikke-admin flyt-utkast: Slett er admin-gatet (posisjonsfilter) → ▾ forsvinner helt
    // (kun primær). Dokumentert affordance-endring (fabel-FYI, se rapport).
    expect(screen.queryByTestId("handling-split-nedtrekk")).toBeNull();
  });

  it("ADMIN flyt-bundet utkast → ▾ viser «Slett» (ikke mottakervelger)", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DokumentHandlingsmeny
          status="draft"
          aktivPosisjon={1}
          retningsrett={kanSende}
          harBallen={true}
          erLaster={false}
          minRolle="registrator"
          adminNiva="prosjekt"
          flytMedlemmer={flytMedlemmer}
          alleFaggrupper={alleFaggrupper}
          dokumentflyter={dokumentflyter}
          templateId="tmpl1"
          onEndreStatus={vi.fn()}
        />
      </I18nextProvider>,
    );

    // Admin har split-▾ (Slett i universet). Åpne den → «Slett», IKKE velger-radene.
    fireEvent.click(screen.getByTestId("handling-split-nedtrekk"));
    expect(screen.getByText("Slett")).toBeTruthy();
    expect(screen.queryByText(RECIPIENT_A)).toBeNull();
  });

  it("FLYT-LØST utkast → mottakervelgeren BESTÅR (binder flyten)", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DokumentHandlingsmeny
          status="draft"
          retningsrett={kanSende}
          harBallen={true}
          erLaster={false}
          minRolle="registrator"
          adminNiva={null}
          flytMedlemmer={[]}
          alleFaggrupper={alleFaggrupper}
          dokumentflyter={dokumentflyter}
          templateId="tmpl1"
          onEndreStatus={vi.fn()}
        />
      </I18nextProvider>,
    );

    // Uten flyt: primær er den generiske «Send», og et primærklikk åpner velgeren
    // (>1 mottaker) → begge faggruppe-radene vises. Manuell mottaker er fortsatt riktig.
    fireEvent.click(screen.getByText("Send"));
    expect(screen.getByText(RECIPIENT_A)).toBeTruthy();
    expect(screen.getByText(RECIPIENT_B)).toBeTruthy();
  });
});
