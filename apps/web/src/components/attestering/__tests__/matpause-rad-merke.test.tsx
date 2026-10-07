import { describe, it, expect, beforeAll } from "vitest";
import { renderToString } from "react-dom/server";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MatpauseRadMerke } from "../MatpauseRadMerke";
import type { TimerRad } from "../attestering-buckets";

/**
 * V20-W / TILLEGG 2 — attesteringsvisningen skal VISE at matpausen er trukket,
 * skrivebeskyttet. Kenneth 06.10: låst visning på web viste ikke pausen.
 *
 * Rød-først: før MatpauseRadMerke fantes, rendret attestant-raden ingenting om
 * matpausen. Denne testen feiler hvis bæreren (pauseMin > 0) ikke viser
 * «Matpause trukket (N min)», og hvis en ikke-bærer-rad viser noe (stille-tomhet:
 * ingen tom avkrysning uten kontekst på attestantflaten).
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: { translation: { "timer.matpause.trukket": "Matpause trukket ({{min}} min)" } },
    },
  });
});

function render(rad: Partial<TimerRad>): string {
  return renderToString(
    <I18nextProvider i18n={i18n}>
      <MatpauseRadMerke rad={rad as TimerRad} />
    </I18nextProvider>,
  );
}

describe("MatpauseRadMerke — skrivebeskyttet avkrysning i attesteringsvisning", () => {
  it("bæreren (pauseMin=30) viser «Matpause trukket (30 min)»", () => {
    const html = render({ pauseMin: 30 });
    expect(html).toContain("Matpause trukket (30 min)");
    expect(html).toContain("<svg"); // avkrysnings-ikonet (CheckSquare)
  });

  it("ikke-bærer (pauseMin=0) viser ingenting", () => {
    expect(render({ pauseMin: 0 })).toBe("");
  });

  it("manglende pauseMin (null/undefined) viser ingenting", () => {
    expect(render({ pauseMin: null })).toBe("");
    expect(render({})).toBe("");
  });

  it("ingen interaktive elementer (skrivebeskyttet — ingen input/button)", () => {
    const html = render({ pauseMin: 30 });
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });
});
