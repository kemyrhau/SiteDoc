// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { useState, useRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { StatusBadge } from "@sitedoc/ui";
import { kvitteringEtikett } from "@sitedoc/shared";
import { DokumentHandlingsmeny } from "../DokumentHandlingsmeny";

/**
 * Ende-til-ende-bevis (A-3b, cowork-krav 2026-07-21): «klikk en handling i UI →
 * badgen skal vise RIKTIG kvittering (ikke feil handlings kvittering)». Monterer den
 * FAKTISKE DokumentHandlingsmeny + StatusBadge sammen i en liten harness som speiler
 * page.tsx sitt handlingRef-mønster. Ekte klikk (fireEvent), ekte komponent-kode.
 *
 * Runde-2 (2026-08-02): «Send tilbake» (responded→in_progress) er FJERNET — bakover er
 * nå Besvar ← (fra received). Begrunnelse-flyt-beviset er derfor repointet til Besvar
 * (received→responded, krever begrunnelse, kvittering «Besvart ✓»). Godkjenn-kontrollen
 * (distinkt kvittering) beholdes.
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "handling.send": "Send",
          "handling.godkjenn": "Godkjenn",
          "handling.avvis": "Avvis",
          "handling.bekreft": "Bekreft",
          "statushandling.besvar": "Besvar",
          "statushandling.trekkTilbake": "Trekk tilbake",
          "statushandling.videresend": "Videresend",
          "statushandling.admin": "Admin",
          "statushandling.sendVidereTil": "Send videre til",
          "statushandling.flereHandlinger": "Flere handlinger",
          "statushandling.leggTilKommentar": "+ kommentar",
          "statushandling.valgfriKommentar": "Valgfri kommentar",
          "statushandling.begrunnelsePaakrevd": "Begrunnelse påkrevd",
          "statushandling.begrunnelsePlaceholder": "Skriv begrunnelse…",
          "statushandling.endrer": "Endrer...",
          "status.tilGodkjenning": "Til godkjenning",
          "status.mottatt": "Mottatt",
          "kvittering.sendt": "Sendt ✓",
          "kvittering.besvart": "Besvart ✓",
          "kvittering.godkjent": "Godkjent ✓",
        },
      },
    },
  });
});

afterEach(cleanup);

/** Speiler page.tsx: handlingRef fanger tekstNoekkel ved klikk, onSuccess leser den. */
function Harness({ status, minRolle }: { status: string; minRolle: "godkjenner" | "utforer" }) {
  const [kvittering, setKvittering] = useState<ReturnType<typeof kvitteringEtikett>>(null);
  const handlingRef = useRef<string | undefined>(undefined);

  // Simulerer trpc-mutasjonens onSuccess (samme logikk som i page.tsx).
  const simulertOnSuccess = () => {
    const k = handlingRef.current ? kvitteringEtikett(handlingRef.current) : null;
    setKvittering(k);
  };

  return (
    <div>
      <StatusBadge status={status} perspektiv={kvittering ?? { etikettKey: "status.tilGodkjenning", variant: "warning" }} />
      <DokumentHandlingsmeny
        status={status}
        erLaster={false}
        minRolle={minRolle}
        onEndreStatus={(_nyStatus, handlingNoekkel) => {
          handlingRef.current = handlingNoekkel;
          simulertOnSuccess();
        }}
      />
    </div>
  );
}

describe("Ende-til-ende: DokumentHandlingsmeny-klikk → StatusBadge-kvittering", () => {
  it("før klikk: badge viser perspektiv-tilstand «Til godkjenning»", () => {
    render(<I18nextProvider i18n={i18n}><Harness status="responded" minRolle="godkjenner" /></I18nextProvider>);
    expect(screen.getByText("Til godkjenning")).toBeTruthy();
  });

  it("åpne split-▾ → «Besvar» (received→responded) → begrunnelse påkrevd → badge viser «Besvart ✓», IKKE «Sendt ✓»", () => {
    // Runde-2: Besvar ligger bak primærens split-▾ (primær = Send). responded krever begrunnelse (P2):
    // bekreft-knappen er disabled til feltet er fylt.
    render(<I18nextProvider i18n={i18n}><Harness status="received" minRolle="utforer" /></I18nextProvider>);
    fireEvent.click(screen.getByTestId("handling-split-nedtrekk")); // åpne split-menyen
    fireEvent.click(screen.getByText("Besvar")); // menyvalg → åpner begrunnelse-dialog
    expect(screen.queryByText("Besvart ✓")).toBeNull(); // ikke utført ennå
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Trenger retting" } }); // fyll påkrevd begrunnelse
    fireEvent.click(screen.getByText("Besvar")); // bekreft → utfør
    expect(screen.getByText("Besvart ✓")).toBeTruthy();
    expect(screen.queryByText("Sendt ✓")).toBeNull();
  });

  it("kontroll: klikk «Godkjenn» (primær, ulik handling) → badge viser «Godkjent ✓», ikke «Besvart ✓»", () => {
    // Utvider bekreftelsen: verifiserer at forskjellige handlinger fortsatt gir
    // forskjellige kvitteringer gjennom den faktiske menyen.
    render(<I18nextProvider i18n={i18n}><Harness status="responded" minRolle="godkjenner" /></I18nextProvider>);
    fireEvent.click(screen.getByText("Godkjenn"));
    expect(screen.getByText("Godkjent ✓")).toBeTruthy();
    expect(screen.queryByText("Besvart ✓")).toBeNull();
  });
});
