// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

/**
 * Videresend synlig konsekvens (ramme 2+3, 2026-09-16) — DB-fri verifikasjon av den
 * FAKTISKE VideresendMottakervelger (ekte kode, fireEvent, ingen browser). Beviser:
 *   1. «I denne flyten» viser flate personer, ball-holder merket; klikk = DIREKTE videresend
 *      innen egen flyt (dokumentflytId = aktivDokumentflytId, ingen påkrevd kommentar).
 *   2. «Andre flyter» er SKJULT når kanByttFlyt=false (server-gaten kanByttFlyt).
 *   3. «Andre flyter» vises når kanByttFlyt=true, med ⇄-konsekvenslinje som navngir målflyten.
 *   4. Valg under «Andre flyter» → bekreftelsessteg: konsekvensboks + PÅKREVD kommentar +
 *      knapp som NAVNGIR målflyten (aldri «Bekreft»). Uten kommentar er knappen disabled.
 */

// Modal → enkel wrapper (unngår jsdom <dialog>.showModal). Rendrer barn når open.
vi.mock("@sitedoc/ui", () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { VideresendMottakervelger } from "../VideresendMottakervelger";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    parseMissingKeyHandler: (key) => key,
    resources: {
      nb: {
        translation: {
          "handling.avbryt": "Avbryt",
          "statushandling.velgPerson": "Velg person",
          "videresend.modalTittel": "Videresend dokument",
          "videresend.seksjonEgenFlyt": "I denne flyten",
          "videresend.seksjonAndreFlyter": "Andre flyter",
          "videresend.harBallen": "har ballen",
          "videresend.antallPersoner": "{{antall}} personer",
          "videresend.konsekvensLinje": "Flytter dokumentet til flyten «{{flyt}}»",
          "videresend.valgfriKommentarEgen": "Kommentar til mottaker (valgfri)",
          "videresend.bekreftTittel": "Flytt og videresend?",
          "videresend.konsekvensForlaterGaar": "Dokumentet forlater flyten {{fra}} og går inn i {{til}}.",
          "videresend.konsekvensBall": "Ballen går til {{mottaker}} (hovedansvarlig utfører). Status endres ikke.",
          "videresend.konsekvensBallUtenNavn": "Ballen går til den hovedansvarlige i mottaker-flyten. Status endres ikke.",
          "videresend.konsekvensMottakerSer": "Mottakeren ser hvem som sendte, og kommentaren under.",
          "videresend.kommentarPaakrevd": "Kommentar til mottaker",
          "videresend.kommentarPlaceholder": "Skriv hvorfor …",
          "videresend.kommentarPaakrevdHjelp": "Påkrevd ved flyt-bytte",
          "videresend.flyttKnapp": "Flytt til {{flyt}}",
          "videresend.rolle.utforer": "utfører",
          "videresend.rolle.bestiller": "bestiller",
        },
      },
    },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

const egenFlytMedlemmer = [
  { key: "u:ola", navn: "Ola Bakken", rolle: "utforer", mottaker: { userId: "ola" } },
  { key: "u:kari", navn: "Kari Holm", rolle: "bestiller", mottaker: { userId: "kari" } },
];

const andreFlyter = [
  {
    key: "fgE",
    faggruppeId: "fgE",
    faggruppeNavn: "Elektro",
    dokumentflytId: "dfE",
    dokumentflytNavn: "Elektro — sluttkontroll",
    visningsnavn: "Elektro",
    farge: "#0ea5e9",
    mottaker: { userId: "per" },
    medlemmer: [{ key: "u:per", navn: "Per Eng", rolle: "utforer", mottaker: { userId: "per" } }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

function rendr(props: Partial<React.ComponentProps<typeof VideresendMottakervelger>> = {}) {
  const onVideresend = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <VideresendMottakervelger
        åpen
        onLukk={() => {}}
        egenFlytNavn="Tømrer — montasje"
        aktivDokumentflytId="dfT"
        ballHolderNavn="Ola Bakken"
        egenFlytMedlemmer={egenFlytMedlemmer}
        recipientUserId="ola"
        andreFlyter={andreFlyter}
        kanByttFlyt={false}
        onVideresend={onVideresend}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onVideresend };
}

describe("VideresendMottakervelger — to seksjoner + bekreftelse ved flyt-bytte", () => {
  it("«I denne flyten»: flate personer, ball-holder merket, direkte videresend uten påkrevd kommentar", () => {
    const { onVideresend } = rendr();
    expect(screen.getByText("Ola Bakken")).toBeTruthy();
    expect(screen.getByText("Kari Holm")).toBeTruthy();
    // Ball-holder (ola) merket
    expect(screen.getByText("har ballen")).toBeTruthy();
    // Klikk på egen-flyt-person → direkte videresend innen egen flyt
    fireEvent.click(screen.getByTestId("videresend-egen-u:kari"));
    expect(onVideresend).toHaveBeenCalledTimes(1);
    expect(onVideresend).toHaveBeenCalledWith(
      { userId: "kari", dokumentflytId: "dfT" },
      undefined,
    );
  });

  it("«Andre flyter» er SKJULT når kanByttFlyt=false", () => {
    rendr({ kanByttFlyt: false });
    expect(screen.queryByText("Andre flyter")).toBeNull();
    expect(screen.queryByTestId("videresend-andre-fgE")).toBeNull();
  });

  it("«Andre flyter» vises når kanByttFlyt=true, med konsekvenslinje som navngir målflyten", () => {
    rendr({ kanByttFlyt: true });
    expect(screen.getByText("Andre flyter")).toBeTruthy();
    expect(screen.getByText("Flytter dokumentet til flyten «Elektro — sluttkontroll»")).toBeTruthy();
  });

  it("flyt-bytte → bekreftelsessteg: konsekvensboks, påkrevd kommentar, knapp navngir målflyten", () => {
    const { onVideresend } = rendr({ kanByttFlyt: true });
    fireEvent.click(screen.getByTestId("videresend-andre-fgE"));
    // Konsekvensboks
    expect(
      screen.getByText("Dokumentet forlater flyten Tømrer — montasje og går inn i Elektro — sluttkontroll."),
    ).toBeTruthy();
    expect(screen.getByText("Ballen går til Per Eng (hovedansvarlig utfører). Status endres ikke.")).toBeTruthy();
    // Knappen navngir målflyten — ALDRI «Bekreft»
    const knapp = screen.getByText("Flytt til Elektro — sluttkontroll") as HTMLButtonElement;
    expect(knapp).toBeTruthy();
    // Uten kommentar: disabled, klikk fyrer ikke
    expect(knapp.disabled).toBe(true);
    fireEvent.click(knapp);
    expect(onVideresend).not.toHaveBeenCalled();
    // Med kommentar: knappen aktiv, videresend fyrer med dokumentflytId = målflyten
    fireEvent.change(screen.getByPlaceholderText("Skriv hvorfor …"), {
      target: { value: "Tømrer venter på sluttkontroll." },
    });
    expect((screen.getByText("Flytt til Elektro — sluttkontroll") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText("Flytt til Elektro — sluttkontroll"));
    expect(onVideresend).toHaveBeenCalledWith(
      { userId: "per", dokumentflytId: "dfE" },
      "Tømrer venter på sluttkontroll.",
    );
  });
});
