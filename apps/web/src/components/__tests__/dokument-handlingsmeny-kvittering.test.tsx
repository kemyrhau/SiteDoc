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
 * Ende-til-ende-bevis (A-3b, cowork-krav 2026-07-21): «klikk «Send tilbake» i UI
 * → badgen skal vise «Sendt tilbake ✓», ikke «Sendt ✓»». Monterer den FAKTISKE
 * DokumentHandlingsmeny + StatusBadge sammen i en liten harness som speiler
 * page.tsx sitt handlingRef-mønster (samme kobling som produksjonssidene bruker,
 * ikke en forenklet stand-in). Ekte klikk (fireEvent), ekte komponent-kode —
 * ingen browser, ingen automatisering av Kenneths egen Chrome (jf. hendelsen
 * 2026-07-21 der chrome-devtools-mcp/playwright-mcp viste seg koblet til hans
 * faktiske nettleser, ikke en isolert instans).
 */
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nb",
    fallbackLng: "nb",
    resources: {
      nb: {
        translation: {
          "handling.godkjenn": "Godkjenn",
          // F3: «Send tilbake» er nå responded→in_progress (sendTilbakeUtforer) — den eneste
          // tilbakesendingen. Gammel in_progress→sent «Send tilbake» er blitt «Send på nytt».
          "statushandling.sendTilbakeUtforer": "Send tilbake",
          "statushandling.videresend": "Videresend",
          "statushandling.admin": "Admin",
          "statushandling.leggTilKommentar": "+ kommentar",
          "statushandling.endrer": "Endrer...",
          "status.tilGodkjenning": "Til godkjenning",
          "kvittering.sendt": "Sendt ✓",
          "kvittering.sendtTilbake": "Sendt tilbake ✓",
          "kvittering.godkjent": "Godkjent ✓",
        },
      },
    },
  });
});

afterEach(cleanup);

/** Speiler page.tsx: handlingRef fanger tekstNoekkel ved klikk, onSuccess leser den. */
function Harness() {
  const [kvittering, setKvittering] = useState<ReturnType<typeof kvitteringEtikett>>(null);
  const handlingRef = useRef<string | undefined>(undefined);

  // Simulerer trpc-mutasjonens onSuccess (samme logikk som i page.tsx).
  const simulertOnSuccess = () => {
    const k = handlingRef.current ? kvitteringEtikett(handlingRef.current) : null;
    setKvittering(k);
  };

  return (
    <div>
      <StatusBadge status="responded" perspektiv={kvittering ?? { etikettKey: "status.tilGodkjenning", variant: "warning" }} />
      <DokumentHandlingsmeny
        status="responded"
        erLaster={false}
        minRolle="godkjenner"
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
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    expect(screen.getByText("Til godkjenning")).toBeTruthy();
  });

  it("åpne split-▾ → «Send tilbake» (F3: responded→in_progress) → begrunnelse påkrevd → badge viser «Sendt tilbake ✓», IKKE «Sendt ✓»", () => {
    // P3: «Send tilbake» er ikke lenger en flat knapp — den ligger bak primærens split-▾.
    // in_progress krever begrunnelse (P2): bekreft-knappen er disabled til feltet er fylt.
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    fireEvent.click(screen.getByTestId("handling-split-nedtrekk")); // åpne split-menyen
    fireEvent.click(screen.getByText("Send tilbake")); // menyvalg → åpner begrunnelse-dialog
    expect(screen.queryByText("Sendt tilbake ✓")).toBeNull(); // ikke utført ennå
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Trenger retting" } }); // fyll påkrevd begrunnelse
    fireEvent.click(screen.getByText("Send tilbake")); // bekreft → utfør
    expect(screen.getByText("Sendt tilbake ✓")).toBeTruthy();
    expect(screen.queryByText("Sendt ✓")).toBeNull();
  });

  it("kontroll: klikk «Godkjenn» (primær, ulik handling) → badge viser «Godkjent ✓», ikke «Sendt tilbake ✓»", () => {
    // Utvider bekreftelsen: verifiserer at forskjellige handlinger fortsatt gir
    // forskjellige kvitteringer gjennom den faktiske menyen, ikke bare "sendTilbake".
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    fireEvent.click(screen.getByText("Godkjenn"));
    expect(screen.getByText("Godkjent ✓")).toBeTruthy();
    expect(screen.queryByText("Sendt tilbake ✓")).toBeNull();
  });
});
