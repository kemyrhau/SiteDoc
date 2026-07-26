// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import { nb } from "@sitedoc/shared";
import { FlytIndikator } from "../FlytIndikator";
import { byggLedd, finnAktivtIndex, type FlytMedlem } from "@/lib/flyt-ledd";

const T = nb as Record<string, string>;

/**
 * Flyt-posisjon i headeren (ordre 2026-07-26). To bevis:
 *  1. `byggLedd` grupperer dynamisk på `steg` og bærer rollen per ledd.
 *  2. Raden er DYNAMISK: en 2-ledds flyt rendrer 2 bokser, en 4-ledds rendrer 4 —
 *     aldri en hardkodet rolle-rekke. Siste-ledd viser deaktivert Send + utveier.
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

/** Bygg et flyt-medlem med faggruppe-basert ledd. */
function medlem(steg: number, rolle: string, navn: string): FlytMedlem {
  return {
    id: `${steg}-${navn}`,
    rolle,
    steg,
    faggruppe: { id: `fg-${navn}`, name: navn },
    projectMember: null,
    group: null,
  };
}

const toLedds: FlytMedlem[] = [medlem(1, "bestiller", "Alfa"), medlem(2, "utforer", "Beta")];
const fireLedds: FlytMedlem[] = [
  medlem(1, "registrator", "Alfa"),
  medlem(2, "bestiller", "Beta"),
  medlem(3, "utforer", "Gamma"),
  medlem(4, "godkjenner", "Delta"),
];

describe("byggLedd grupperer dynamisk og bærer rolle", () => {
  it("to steg → to ledd, rolle populert per ledd", () => {
    const ledd = byggLedd(toLedds);
    expect(ledd).toHaveLength(2);
    expect(ledd[0]!.rolle).toBe("bestiller");
    expect(ledd[1]!.rolle).toBe("utforer");
  });

  it("fire steg → fire ledd", () => {
    expect(byggLedd(fireLedds)).toHaveLength(4);
  });

  it("flere medlemmer på samme steg → ett ledd med alle medlemmer i hover-lista", () => {
    const medl: FlytMedlem[] = [
      medlem(1, "utforer", "Tømrer"),
      {
        id: "1-ola",
        rolle: "utforer",
        steg: 1,
        faggruppe: null,
        projectMember: { user: { id: "u1", name: "Ola" } },
        group: null,
      },
    ];
    const ledd = byggLedd(medl);
    expect(ledd).toHaveLength(1);
    expect(ledd[0]!.medlemmer.map((m) => m.navn)).toEqual(["Tømrer", "Ola"]);
  });

  it("finnAktivtIndex: siste ledd når ingen mottaker er satt (sendt)", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, "sent")).toBe(3);
  });
});

describe("FlytIndikator rendrer dynamisk antall bokser", () => {
  it("2-ledds flyt viser 2 bokser (Alfa + Beta), ikke flere", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <FlytIndikator medlemmer={toLedds} status="sent" />
      </I18nextProvider>,
    );
    const tekst = container.textContent ?? "";
    expect(tekst).toContain("Alfa");
    expect(tekst).toContain("Beta");
    expect(tekst).not.toContain("Gamma");
  });

  it("4-ledds flyt viser alle 4 bokser + siste-ledd deaktivert Send og utveier", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <FlytIndikator medlemmer={fireLedds} status="responded" recipientGroupId={null} recipientUserId={null} visUtveier />
      </I18nextProvider>,
    );
    const tekst = container.textContent ?? "";
    for (const navn of ["Alfa", "Beta", "Gamma", "Delta"]) {
      expect(tekst).toContain(navn);
    }
    // Siste ledd (aktiv = Delta): deaktivert Send + utveier-fotnote med reelle exits.
    expect(tekst).toContain(T["handling.send"]);
    expect(tekst).toContain(T["flytindikator.utveier"]);
    // responded → utveier inkluderer Godkjenn + Send tilbake, men IKKE fram-sending.
    expect(tekst).toContain(T["handling.godkjenn"]);
  });

  it("uten visUtveier (liste-modus) vises verken deaktivert Send eller utveier-fotnote", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <FlytIndikator medlemmer={fireLedds} status="responded" recipientGroupId={null} recipientUserId={null} />
      </I18nextProvider>,
    );
    expect(container.textContent ?? "").not.toContain(T["flytindikator.utveier"]);
  });
});
