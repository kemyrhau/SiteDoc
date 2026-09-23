import { describe, it, expect, beforeAll } from "vitest";
import { renderToString } from "react-dom/server";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { EmneVelger } from "../EmneVelger";

/**
 * Rød-først (ordre opprett-uten-modal, § 7): emnefeltet skal VISES når det er tomt,
 * også i lesemodus for andre — som en tydelig, rammet «Ingen emne»-merkelapp med
 * etikett, ikke blek grå kursiv uten kontekst (EmneVelger.tsx før-tilstand).
 * Verifiserer faktisk render.
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "emneVelger.etikett": "EMNE",
          "emneVelger.ingenEmne": "Ingen emne",
          "emneVelger.leggTil": "Legg til emne",
          "emneVelger.plassholder": "Skriv emne",
          "emneVelger.fjern": "Fjern",
          "handling.lagre": "Lagre",
          "handling.avbryt": "Avbryt",
          "handling.endre": "Endre",
        },
      },
    },
  });
});

function render(el: React.ReactElement): string {
  return renderToString(<I18nextProvider i18n={i18n}>{el}</I18nextProvider>);
}

describe("EmneVelger — tomt emne er synlig", () => {
  it("tomt + lesemodus: viser «Ingen emne» med etikett, som rammet merkelapp (ikke bar kursiv)", () => {
    const html = render(
      <EmneVelger emne={null} forslag={[]} leseModus onLagre={() => {}} />,
    );
    // Feltet er synlig når det er tomt: både etiketten og «Ingen emne»-teksten.
    expect(html).toContain("EMNE");
    expect(html).toContain("Ingen emne");
    // Rammet merkelapp-tilstand (rounded-full-chip), ikke den gamle bare `italic`-teksten.
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("italic");
  });

  it("tomt + redigerbar: viser «Legg til emne»-knappen (feltet er synlig, ikke skjult)", () => {
    const html = render(
      <EmneVelger emne={null} forslag={[]} onLagre={() => {}} />,
    );
    expect(html).toContain("EMNE");
    expect(html).toContain("Legg til emne");
  });
});
