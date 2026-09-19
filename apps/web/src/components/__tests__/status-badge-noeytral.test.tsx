import { describe, it, expect, beforeAll } from "vitest";
import { renderToString } from "react-dom/server";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { StatusBadge } from "@sitedoc/ui";

/**
 * Paritetsvakt (designnotat-statusfarger-paritet § 8): web-`StatusBadge` uten
 * perspektiv-prop (lister/filtre/tidslinjer) skal utlede dokumentstatusene fra det
 * nøytrale oppslaget. Rød mot forrige tilstand: `in_progress` viste «Mottatt»
 * (Runde-2) og `responded` var GUL (warning). Nå: `in_progress` = «Under arbeid»
 * blå, `responded` = blå for alle. Verifiserer FAKTISK render (variant-klasse + tekst).
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "status.utkast": "Utkast",
          "status.sendt": "Sendt",
          "status.mottatt": "Mottatt",
          "status.underArbeid": "Under arbeid",
          "status.besvart": "Besvart",
          "status.godkjent": "Godkjent",
          "status.avvist": "Avvist",
          "status.lukket": "Lukket",
          "status.avbrutt": "Avbrutt",
        },
      },
    },
  });
});

function render(el: React.ReactElement): string {
  return renderToString(<I18nextProvider i18n={i18n}>{el}</I18nextProvider>);
}

// Badge-variant → bakgrunnsklasse (packages/ui/src/badge.tsx).
const BG: Record<string, string> = {
  default: "bg-gray-100",
  primary: "bg-blue-100",
  success: "bg-green-100",
  warning: "bg-yellow-100",
  danger: "bg-red-100",
};

// Nøytral fasit: status → [tekst, variant].
const FASIT: Array<[string, string, string]> = [
  ["draft", "Utkast", "default"],
  ["sent", "Sendt", "primary"],
  ["received", "Mottatt", "primary"],
  ["in_progress", "Under arbeid", "primary"],
  ["responded", "Besvart", "primary"],
  ["approved", "Godkjent", "success"],
  ["dismissed", "Avvist", "danger"],
  ["rejected", "Avvist", "danger"], // legacy (F3)
  ["closed", "Lukket", "default"],
  ["cancelled", "Avbrutt", "danger"],
];

describe("StatusBadge — nøytral utledning (uten perspektiv)", () => {
  it.each(FASIT)("%s → «%s» med variant %s", (status, tekst, variant) => {
    const html = render(<StatusBadge status={status} />);
    expect(html).toContain(tekst);
    expect(html).toContain(BG[variant]);
  });

  it("responded er IKKE gul (warning) i lista — blå", () => {
    const html = render(<StatusBadge status="responded" />);
    expect(html).toContain("bg-blue-100");
    expect(html).not.toContain("bg-yellow-100");
  });

  it("in_progress viser «Under arbeid», ikke «Mottatt»", () => {
    const html = render(<StatusBadge status="in_progress" />);
    expect(html).toContain("Under arbeid");
    expect(html).not.toContain(">Mottatt<");
  });
});
