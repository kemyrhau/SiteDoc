// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useTranslation, I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import { nb } from "@sitedoc/shared";
import { Tooltip } from "@sitedoc/ui";
import {
  MATRISE_RADER,
  matriseTittel,
  flythjelpTekst,
  type MatriseRad,
} from "@/lib/flytmatrise-def";
import { DokumentHandlingsmeny } from "../DokumentHandlingsmeny";

/**
 * Mikrotekst-wiring flyt-flater (ordre 2026-07-25). To bevis:
 *  1. Flate 1: en matrise-rad rendrer forventet delt brødtekst (flythjelp.*) med
 *     fallback-benevnelsen utfylt — ingen `{{mottaker}}` lekker til skjerm.
 *  2. Flate 2: «Besvar»-knappens hover navngir AVSENDEREN (ledd[aktivtIndex-1]),
 *     ikke mottakerForStandard() — server ruter besvar tilbake til forrige avsender.
 * Bruker den EKTE nb-fasiten (packages/shared) + de faktiske komponentene/hjelperne.
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: { nb: { translation: nb as Record<string, string> } },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/*  Flate 1 — matrise-hover                                            */
/* ------------------------------------------------------------------ */

function MatriseRadHover({ rad }: { rad: MatriseRad }) {
  const { t } = useTranslation();
  return (
    <Tooltip
      tittel={matriseTittel(rad, t)}
      tekst={flythjelpTekst(rad.flythjelpNoekkel, rad.fallbackNoekkel ? t(rad.fallbackNoekkel) : undefined, t)}
      side="right"
    >
      <span>{t(rad.labelNoekkel)}</span>
    </Tooltip>
  );
}

describe("Flate 1: matrise-hover leser delt flythjelp-kilde", () => {
  it("received→responded (besvar) rendrer tittel «Besvar → Besvart» + brødtekst med fallback-benevnelse", () => {
    const rad = MATRISE_RADER.find((r) => r.fra === "received" && r.til === "responded")!;
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <MatriseRadHover rad={rad} />
      </I18nextProvider>,
    );
    const tekst = container.textContent ?? "";
    // Tittel = Handling → Ny status (delt mønster).
    expect(tekst).toContain("Besvar → Besvart");
    // Brødtekst med {{mottaker}} fylt av den relasjonelle fallback-benevnelsen.
    expect(tekst).toContain("fra deg til den som sendte det til deg, som vurderer svaret");
    // Ingen uoppløst placeholder på skjerm.
    expect(tekst).not.toContain("{{");
  });

  it("draft→sent (send) tittel «Send → Sendt» + fallback «neste mottaker i flyten»", () => {
    const rad = MATRISE_RADER.find((r) => r.fra === "draft" && r.til === "sent")!;
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <MatriseRadHover rad={rad} />
      </I18nextProvider>,
    );
    const tekst = container.textContent ?? "";
    expect(tekst).toContain("Send → Sendt");
    expect(tekst).toContain("fra deg til neste mottaker i flyten");
    expect(tekst).not.toContain("{{");
  });
});

/* ------------------------------------------------------------------ */
/*  Flate 2 — «Besvar»-knappens hover navngir avsenderen              */
/* ------------------------------------------------------------------ */

describe("Flate 2: «Besvar»-hover bruker ledd[aktivtIndex-1] (avsender), ikke mottakerForStandard", () => {
  // Tre ledd: avsender (Kari) → utfører (Ola, nåværende boks) → godkjenner (Per).
  // status=in_progress, recipient=Ola ⇒ aktivtIndex=1, erSisteBoks=false ⇒ variant «besvar»,
  // {{mottaker}} = ledd[0].navn = «Kari Byggherre».
  const flytMedlemmer = [
    { id: "m0", rolle: "bestiller", steg: 1, faggruppe: null, projectMember: { user: { id: "u-kari", name: "Kari Byggherre" } }, group: null },
    { id: "m1", rolle: "utforer", steg: 2, faggruppe: null, projectMember: { user: { id: "u-ola", name: "Ola Tømrer" } }, group: null },
    { id: "m2", rolle: "godkjenner", steg: 3, faggruppe: null, projectMember: { user: { id: "u-per", name: "Per Godkjenner" } }, group: null },
  ];

  it("hover-brødteksten navngir avsenderen «Kari Byggherre»", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DokumentHandlingsmeny
          status="in_progress"
          aktivPosisjon={2}
          retningsrett={{ kanSende: true, kanBesvare: true, kanVideresende: false, kanTerminere: false }}
          harBallen={true}
          erAvsender={false}
          erMedlemAvFlyt={false}
          erLaster={false}
          minRolle="utforer"
          onEndreStatus={() => {}}
          flytMedlemmer={flytMedlemmer}
          recipientUserId="u-ola"
        />
      </I18nextProvider>,
    );
    const tekst = container.textContent ?? "";
    // Avsenderen (forrige ledd) er navngitt i besvar-brødteksten.
    expect(tekst).toContain("fra deg til Kari Byggherre, som vurderer svaret");
    // Ikke siste-ledd-varianten, og ingen placeholder-lekkasje.
    expect(tekst).not.toContain("{{");
  });
});
