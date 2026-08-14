"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Play, ExternalLink, Link2, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { avledPunktFremdrift } from "@/lib/kontrollplanFremdrift";
import { KoblePunktDialog } from "./KoblePunktDialog";

interface PunktLite {
  id: string;
  sjekklisteMalId: string;
  status: string;
  sjekkliste: { id: string; status: string } | null;
  // L1.5: forhåndsvalgt flyt på punktet. Satt → Start bruker den direkte.
  dokumentflytId: string | null;
  dokumentflyt: { id: string; name: string } | null;
}

const fremdriftFarger: Record<string, string> = {
  planlagt: "bg-gray-100 text-gray-700",
  pagar: "bg-blue-100 text-blue-700",
  utfort: "bg-amber-100 text-amber-700",
  godkjent: "bg-green-100 text-green-700",
};

const fremdriftNokler: Record<string, string> = {
  planlagt: "kontrollplan.statusPlanlagt",
  pagar: "kontrollplan.statusPagar",
  utfort: "kontrollplan.statusUtfort",
  godkjent: "kontrollplan.statusGodkjent",
};

/**
 * Start/koble/åpne-handling for ett kontrollpunkt. Selvstendig: eier opprett-mutasjon
 * og navigasjon. Rendres både i lista og i RedigerPunktDialog, så matrisen slipper
 * knapper i cellene.
 *
 * L1.6: flyten bestemmes ved PLANOPPSETT (`punkt.dokumentflytId`), ikke ved Start. Start
 * er derfor én handling uten valg: er flyten satt → opprett direkte; er den null → den
 * handlingsbare feilmeldingen (admin setter flyten på punktet). Ingen flyt-velger her —
 * det ville flyttet plan-autorisasjonen til klikk-tidspunktet, som er nettopp det
 * fabel-vedtaket fjerner. «Start» går den VANLIGE veien (sjekkliste.opprett) med
 * kontrollplanPunktId satt, så opprettelse + kobling skjer atomisk på serveren.
 */
export function PunktStartHandling({
  punkt,
  projectId,
  byggeplassId,
  onEndret,
  kanSetteFlyt = false,
  onVelgFlyt,
}: {
  punkt: PunktLite;
  projectId: string;
  byggeplassId: string;
  onEndret: () => void;
  // L1.5/L1.6: kan innlogget bruker sette forhåndsvalgt flyt (admin)? Styrer om «Velg flyt
  // for punktet»-handlingen tilbys i feilmeldingen — ellers ville den gitt en ny feil.
  kanSetteFlyt?: boolean;
  onVelgFlyt?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [visKobleDialog, setVisKobleDialog] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  // L1.5: sant kun for «ingen flyt»-feilen → da tilbys de handlingsbare knappene.
  // Server-feil (opprett.onError) er ikke flyt-relatert og skal ikke vise dem.
  const [visFlytHjelp, setVisFlytHjelp] = useState(false);

  const opprett = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (sjekkliste: { id: string }) => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onEndret();
      router.push(`/dashbord/${projectId}/sjekklister/${sjekkliste.id}`);
    },
    onError: (err: { message: string }) => { setVisFlytHjelp(false); setFeil(err.message); },
  });

  function handleStart() {
    setFeil(null);
    setVisFlytHjelp(false);
    // L1.6: Start er én handling uten valg. Flyten må være satt på punktet ved
    // planoppsett (auto ved én kandidat, ellers av admin). Server binder bestiller/
    // utfører fra flyten og håndhever at klikkeren tilhører punktets faggruppe.
    if (punkt.dokumentflytId) {
      opprett.mutate({
        templateId: punkt.sjekklisteMalId,
        dokumentflytId: punkt.dokumentflytId,
        byggeplassId,
        kontrollplanPunktId: punkt.id,
      });
      return;
    }
    // Ingen flyt satt → eneste vei videre er å sette den på punktet (admin). Feilmeldingen
    // bærer handlingen; det finnes ikke lenger en velger som «løser» det ved Start.
    setFeil(t("kontrollplan.startIngenFlyt"));
    setVisFlytHjelp(true);
  }

  // Koblet punkt: statusmerke + lenke inn i sjekklisten
  if (punkt.sjekkliste) {
    const fremdrift = avledPunktFremdrift(punkt);
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${fremdriftFarger[fremdrift] ?? ""}`}>
          {t(fremdriftNokler[fremdrift] ?? fremdrift)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashbord/${projectId}/sjekklister/${punkt.sjekkliste!.id}`);
          }}
          className="flex items-center gap-1 text-xs text-sitedoc-secondary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {t("kontrollplan.aapneSjekkliste")}
        </button>
      </div>
    );
  }

  // Ukoblet punkt: Start + Koble eksisterende
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={opprett.isPending}
          className="flex items-center gap-1 px-2 py-1 bg-sitedoc-primary text-white text-xs rounded hover:bg-sitedoc-primary/90 transition disabled:opacity-50"
        >
          {opprett.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {t("kontrollplan.startPunkt")}
        </button>
        <button
          type="button"
          onClick={() => setVisKobleDialog(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          title={t("kontrollplan.kobleEksisterende")}
        >
          <Link2 className="h-3 w-3" />
        </button>
      </div>

      {feil && (
        <div className="mt-1 max-w-[240px]">
          <p className="flex items-start gap-1 text-[11px] text-sitedoc-error">
            <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            {feil}
          </p>
          {visFlytHjelp && (
            <div className="mt-1.5 flex flex-col gap-1">
              {/* Primær: den som kan sette flyt (admin) løser det på stedet. */}
              {kanSetteFlyt && onVelgFlyt && (
                <button
                  type="button"
                  onClick={onVelgFlyt}
                  className="self-start px-2 py-1 bg-sitedoc-primary text-white text-[11px] rounded hover:bg-sitedoc-primary/90 transition"
                >
                  {t("kontrollplan.velgFlytForPunkt")}
                </button>
              )}
              {/* Sekundær: den som mangler rettigheter kommer til oppsettet og kan peke på hva som mangler. */}
              <button
                type="button"
                onClick={() => router.push("/dashbord/oppsett/produksjon/dokumentflyt")}
                className="self-start flex items-center gap-1 text-[11px] text-sitedoc-secondary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t("kontrollplan.tilFlytOppsett")}
              </button>
            </div>
          )}
        </div>
      )}

      {visKobleDialog && (
        <KoblePunktDialog
          punktId={punkt.id}
          byggeplassId={byggeplassId}
          onLukk={() => setVisKobleDialog(false)}
          onKoblet={() => { setVisKobleDialog(false); onEndret(); }}
        />
      )}
    </div>
  );
}
