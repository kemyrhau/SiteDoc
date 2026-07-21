import { describe, it, expect, beforeAll } from "vitest";
import { renderToString } from "react-dom/server";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { StatusBadge } from "@sitedoc/ui";

/**
 * Regresjonsvakt (A-3b): «Lest»-grenen (kontekst-frøet) må fyre FØR perspektiv-
 * grenen. Da badge-konsumet (Valg B) la til `perspektiv`-propen, kunne en tidlig
 * return på perspektiv ellers skygge for `sent + lestAvMottakerVed → «Lest»` —
 * avsenderens eneste tilbakemelding mellom «Sendt» og et faktisk svar.
 *
 * Verifiserer FAKTISK render-utfall (renderToString, node) — ikke bare kompilering.
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "status.lest": "Lest",
          "status.tilBehandling": "Til behandling",
          "status.sendt": "Sendt",
        },
      },
    },
  });
});

function render(el: React.ReactElement): string {
  return renderToString(<I18nextProvider i18n={i18n}>{el}</I18nextProvider>);
}

const perspektiv = { etikettKey: "status.tilBehandling", variant: "warning" as const };

describe("StatusBadge — lest-grenen tar presedens over perspektiv", () => {
  it("sent + lestAvMottakerVed satt → «Lest» (selv med perspektiv-prop)", () => {
    const html = render(
      <StatusBadge status="sent" lestAvMottakerVed={new Date("2026-07-20T09:30:00Z")} perspektiv={perspektiv} />,
    );
    expect(html).toContain("Lest");
    expect(html).not.toContain("Til behandling");
  });

  it("received + perspektiv, ingen lest → perspektiv-etikett", () => {
    const html = render(<StatusBadge status="received" perspektiv={perspektiv} />);
    expect(html).toContain("Til behandling");
    expect(html).not.toContain("Lest");
  });

  it("sent uten lestAvMottakerVed → perspektiv-etikett (lest-grenen fyrer ikke)", () => {
    const html = render(
      <StatusBadge status="sent" perspektiv={{ etikettKey: "status.sendt", variant: "primary" }} />,
    );
    expect(html).toContain("Sendt");
    expect(html).not.toContain("Lest");
  });
});
