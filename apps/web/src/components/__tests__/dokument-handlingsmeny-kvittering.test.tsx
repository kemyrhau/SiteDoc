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
          "statushandling.besvar": "Besvar",
          "statushandling.sendTilbake": "Send tilbake",
          "statushandling.videresend": "Videresend",
          "handling.avvis": "Avvis",
          "statushandling.admin": "Admin",
          "statushandling.leggTilKommentar": "+ kommentar",
          "statushandling.endrer": "Endrer...",
          "status.underArbeid": "Under arbeid",
          "kvittering.sendt": "Sendt ✓",
          "kvittering.sendtTilbake": "Sendt tilbake ✓",
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
      <StatusBadge status="in_progress" perspektiv={kvittering ?? { etikettKey: "status.underArbeid", variant: "warning" }} />
      <DokumentHandlingsmeny
        status="in_progress"
        erLaster={false}
        minRolle="utforer"
        onEndreStatus={(_nyStatus, handlingNoekkel) => {
          handlingRef.current = handlingNoekkel;
          simulertOnSuccess();
        }}
      />
    </div>
  );
}

describe("Ende-til-ende: DokumentHandlingsmeny-klikk → StatusBadge-kvittering", () => {
  it("før klikk: badge viser perspektiv-tilstand «Under arbeid»", () => {
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    expect(screen.getByText("Under arbeid")).toBeTruthy();
  });

  it("klikk «Send tilbake» → nudge → bekreft → badge viser «Sendt tilbake ✓», IKKE «Sendt ✓»", () => {
    // Del 2.5: «Send tilbake» ber om begrunnelse (nudge) før den utføres. Første klikk
    // åpner nudge-prompten (menyen erstattes av bekreft-visningen), bekreft-knappen
    // bærer handlingslabelen «Send tilbake» → andre klikk utfører → kvittering vises.
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    fireEvent.click(screen.getByText("Send tilbake")); // åpner nudge
    expect(screen.queryByText("Sendt tilbake ✓")).toBeNull(); // ikke utført ennå
    fireEvent.click(screen.getByText("Send tilbake")); // bekreft i nudge → utfør
    expect(screen.getByText("Sendt tilbake ✓")).toBeTruthy();
    expect(screen.queryByText("Sendt ✓")).toBeNull();
  });

  it("kontroll: klikk «Besvar» (primær, ulik handling) → badge viser «Besvart ✓», ikke «Sendt tilbake ✓»", () => {
    // Utvider bekreftelsen: verifiserer at forskjellige handlinger fortsatt gir
    // forskjellige kvitteringer gjennom den faktiske menyen, ikke bare "sendTilbake".
    i18n.addResource("nb", "translation", "kvittering.besvart", "Besvart ✓");
    render(<I18nextProvider i18n={i18n}><Harness /></I18nextProvider>);
    fireEvent.click(screen.getByText("Besvar"));
    expect(screen.getByText("Besvart ✓")).toBeTruthy();
    expect(screen.queryByText("Sendt tilbake ✓")).toBeNull();
  });
});
