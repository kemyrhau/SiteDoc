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
 * Flyt-posisjon i headeren (ordre 2026-07-26). Bevis:
 *  1. `byggLedd` sekvenserer på kanonisk ROLLE-RANG (ikke `steg`) og bærer rollen
 *     per ledd. KRITISK: ekte-lignende data har alle `steg=1` — rolle-gruppering
 *     gir likevel distinkte ledd (steg-gruppering kollapset dem til ett).
 *  2. Raden er DYNAMISK: en 2-ledds flyt rendrer 2 bokser, en 4-ledds rendrer 4 —
 *     aldri en hardkodet rolle-rekke. Siste-ledd viser deaktivert Send + utveier.
 *  3. `finnAktivtIndex` er rolle-bevisst: fallback lander på forventet rolle for
 *     statusen, ikke blindt på siste ledd.
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

describe("byggLedd sekvenserer på rolle-rang og bærer rolle", () => {
  it("to roller → to ledd, rolle populert per ledd", () => {
    const ledd = byggLedd(toLedds);
    expect(ledd).toHaveLength(2);
    expect(ledd[0]!.rolle).toBe("bestiller");
    expect(ledd[1]!.rolle).toBe("utforer");
  });

  it("fire roller → fire ledd", () => {
    expect(byggLedd(fireLedds)).toHaveLength(4);
  });

  it("REGRESJON: alle steg=1 (ekte data) → distinkte roller gir likevel flere ledd", () => {
    // Rotårsaken: steg-gruppering kollapset alle roller til ETT ledd fordi `steg`
    // ikke er populert (alle default 1). Rolle-gruppering må gi fire ledd her.
    const alleSteg1: FlytMedlem[] = [
      medlem(1, "registrator", "Reg"),
      medlem(1, "bestiller", "Best"),
      medlem(1, "utforer", "Utf"),
      medlem(1, "godkjenner", "Godkj"),
    ];
    const ledd = byggLedd(alleSteg1);
    expect(ledd).toHaveLength(4);
    expect(ledd.map((l) => l.rolle)).toEqual(["registrator", "bestiller", "utforer", "godkjenner"]);
  });

  it("roller i vilkårlig rekkefølge sorteres til kanonisk rang", () => {
    const rotet: FlytMedlem[] = [
      medlem(1, "godkjenner", "G"),
      medlem(1, "registrator", "R"),
      medlem(1, "utforer", "U"),
      medlem(1, "bestiller", "B"),
    ];
    expect(byggLedd(rotet).map((l) => l.rolle)).toEqual([
      "registrator",
      "bestiller",
      "utforer",
      "godkjenner",
    ]);
  });

  it("flere medlemmer i samme rolle → ett ledd med alle medlemmer i hover-lista", () => {
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
});

describe("finnAktivtIndex er rolle-bevisst", () => {
  it("sendt uten mottaker → utfører-ledden (forventet rolle for statusen)", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, "sent")).toBe(2); // utforer, ikke siste ledd
  });

  it("besvart uten mottaker → godkjenner-ledden (siste)", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, "responded")).toBe(3);
  });

  it("besvart i 2-rolle-flyt (ingen godkjenner) → faller til bestiller-ledden", () => {
    const ledd = byggLedd(toLedds); // bestiller, utforer
    expect(finnAktivtIndex(ledd, "responded")).toBe(0);
  });

  it("mottaker-identitet vinner over status-fallback", () => {
    const medl: FlytMedlem[] = [
      medlem(1, "bestiller", "Best"),
      {
        id: "1-utf",
        rolle: "utforer",
        steg: 1,
        faggruppe: null,
        projectMember: { user: { id: "u-utf", name: "Utfører" } },
        group: null,
      },
      medlem(1, "godkjenner", "Godkj"),
    ];
    const ledd = byggLedd(medl);
    // responded ville normalt gi godkjenner (idx 2), men recipient peker på utfører (idx 1).
    expect(finnAktivtIndex(ledd, "responded", "u-utf")).toBe(1);
  });

  it("godkjent/lukket → terminal (-1)", () => {
    const ledd = byggLedd(fireLedds);
    expect(finnAktivtIndex(ledd, "approved")).toBe(-1);
    expect(finnAktivtIndex(ledd, "closed")).toBe(-1);
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
