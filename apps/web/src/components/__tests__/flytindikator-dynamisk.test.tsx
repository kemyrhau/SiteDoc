// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { initReactI18next, I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { nb } from "@sitedoc/shared";
import { FlytIndikator } from "../FlytIndikator";
import { byggLedd, finnAktivtIndex, filtrerNaboer, type FlytMedlem } from "@/lib/flyt-ledd";

const T = nb as Record<string, string>;

/**
 * Flyt-posisjon i headeren (Fase 4-konsolidering 2026-08-01). Bevis:
 *  1. `byggLedd` sekvenserer på `steg` (= posisjon) via delt `byggPosisjonsLedd`.
 *  2. Raden er DYNAMISK: N ledd → N bokser (inkl. 8+ ledд, med kollaps).
 *  3. `finnAktivtIndex` leser dokumentets `aktivPosisjon` (server-fakta).
 *  4. Ansvarsmerke (§ 2.6) vises som etikett — ikke rollenavnet.
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

function medlem(
  steg: number,
  rolle: string,
  navn: string,
  klassifisering: "kontroll" | "utfor" | "orienteres" = "utfor",
): FlytMedlem {
  return {
    id: `${steg}-${navn}`,
    rolle,
    steg,
    klassifisering,
    faggruppe: { id: `fg-${navn}`, name: navn },
    projectMember: null,
    group: null,
  };
}

const toLedds: FlytMedlem[] = [
  medlem(1, "bestiller", "Alfa", "kontroll"),
  medlem(2, "utforer", "Beta", "utfor"),
];
const fireLedds: FlytMedlem[] = [
  medlem(1, "registrator", "Alfa", "utfor"),
  medlem(2, "bestiller", "Beta", "kontroll"),
  medlem(3, "utforer", "Gamma", "utfor"),
  medlem(4, "godkjenner", "Delta", "kontroll"),
];
// 8-ledд-flyt (bruker-spørsmål 2026-08-01: «klarer vi 8 bokser?»).
const atteLedds: FlytMedlem[] = Array.from({ length: 8 }, (_, i) =>
  medlem(i + 1, i % 2 === 0 ? "utforer" : "bestiller", `L${i + 1}`, i % 2 === 0 ? "utfor" : "kontroll"),
);

describe("byggLedd sekvenserer på steg (posisjon)", () => {
  it("to steg → to ledd, posisjon populert", () => {
    expect(byggLedd(toLedds).map((l) => l.posisjon)).toEqual([1, 2]);
  });

  it("fire steg → fire ledd, sortert stigende", () => {
    expect(byggLedd(fireLedds).map((l) => l.posisjon)).toEqual([1, 2, 3, 4]);
  });

  it("ÅTTE steg → åtte ledd (dynamisk, ingen grense)", () => {
    const ledd = byggLedd(atteLedds);
    expect(ledd).toHaveLength(8);
    expect(ledd.map((l) => l.posisjon)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("medlemmer i vilkårlig rekkefølge sorteres på steg", () => {
    const rotet = [fireLedds[3]!, fireLedds[0]!, fireLedds[2]!, fireLedds[1]!];
    expect(byggLedd(rotet).map((l) => l.posisjon)).toEqual([1, 2, 3, 4]);
  });

  it("flere medlemmer på SAMME steg → ett ledd med alle i hover-lista", () => {
    const medl: FlytMedlem[] = [
      medlem(1, "utforer", "Tømrer"),
      {
        id: "1-ola",
        rolle: "utforer",
        steg: 1,
        klassifisering: "utfor",
        faggruppe: null,
        projectMember: { user: { id: "u1", name: "Ola" } },
        group: null,
      },
    ];
    const ledd = byggLedd(medl);
    expect(ledd).toHaveLength(1);
    expect(ledd[0]!.medlemmer.map((m) => m.navn)).toEqual(["Tømrer", "Ola"]);
  });

  it("leddet bærer ansvarsmerke-nøkkel avledet av rolle+klassifisering", () => {
    const ledd = byggLedd(fireLedds);
    expect(ledd[0]!.ansvarsmerkeKey).toBe("ansvarsmerke.registrerer");
    expect(ledd[1]!.ansvarsmerkeKey).toBe("ansvarsmerke.kontrollererAvvik");
    expect(ledd[2]!.ansvarsmerkeKey).toBe("ansvarsmerke.utforerArbeid");
    expect(ledd[3]!.ansvarsmerkeKey).toBe("ansvarsmerke.godkjennerOkonomi");
  });
});

describe("finnAktivtIndex leser aktivPosisjon (server-fakta)", () => {
  it("aktivPosisjon 2 → indeks 1 (leddet på posisjon 2)", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, 2)).toBe(1);
    expect(finnAktivtIndex(ledd, 4)).toBe(3);
  });

  it("null/manglende posisjon → -1", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, null)).toBe(-1);
    expect(finnAktivtIndex(ledd, undefined)).toBe(-1);
    expect(finnAktivtIndex(ledd, 99)).toBe(-1);
  });

  it("8-ledд: aktivPosisjon 6 → indeks 5; kollaps viser aktiv ± 1", () => {
    const ledd = byggLedd(atteLedds);
    const idx = finnAktivtIndex(ledd, 6);
    expect(idx).toBe(5);
    // Kollaps (filtrerNaboer) viser aktiv ± 1 = posisjon 5,6,7 → resten «+5».
    const synlige = filtrerNaboer(ledd, idx);
    expect(synlige.map((v) => v.ledd.posisjon)).toEqual([5, 6, 7]);
  });
});

describe("FlytIndikator rendrer dynamisk antall bokser", () => {
  function wrap(el: React.ReactNode) {
    return render(<I18nextProvider i18n={i18n}>{el}</I18nextProvider>);
  }

  it("2-ledds flyt viser 2 bokser (Alfa + Beta), ikke flere", () => {
    const { container } = wrap(<FlytIndikator medlemmer={toLedds} aktivPosisjon={1} />);
    const tekst = container.textContent ?? "";
    expect(tekst).toContain("Alfa");
    expect(tekst).toContain("Beta");
    expect(tekst).not.toContain("Gamma");
  });

  it("4-ledds flyt viser alle 4 bokser + ansvarsmerke-etikett (ikke rollenavn)", () => {
    const { container } = wrap(<FlytIndikator medlemmer={fireLedds} aktivPosisjon={4} visUtveier />);
    const tekst = container.textContent ?? "";
    for (const navn of ["Alfa", "Beta", "Gamma", "Delta"]) {
      expect(tekst).toContain(navn);
    }
    expect(tekst).toContain(T["ansvarsmerke.godkjennerOkonomi"]);
  });

  it("8-ledд kollapser i headeren (aktiv ± 1 + «+N»-pille), ikke 8 bokser på rad", () => {
    const { container } = wrap(<FlytIndikator medlemmer={atteLedds} aktivPosisjon={4} />);
    const bokser = container.querySelectorAll('[data-testid="flyt-ledd"]');
    // Kollaps default (>4 ledд): kun aktiv ± 1 = 3 bokser synlige + «+5».
    expect(bokser.length).toBe(3);
    expect(container.textContent ?? "").toContain("+5");
  });
});
