"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Play, ExternalLink, Link2, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { MalFlytStatus } from "@/lib/malFlytStatus";
import { avledPunktFremdrift } from "@/lib/kontrollplanFremdrift";
import { KoblePunktDialog } from "./KoblePunktDialog";

interface PunktLite {
  id: string;
  sjekklisteMalId: string;
  status: string;
  sjekkliste: { id: string; status: string } | null;
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
 * Start/koble/åpne-handling for ett kontrollpunkt. Selvstendig: eier opprett-mutasjon,
 * flyt-valg (én flyt → 1 klikk, flere → velger, ingen → forklarende feil) og navigasjon.
 * Rendres både i lista og i RedigerPunktDialog, så matrisen slipper knapper i cellene.
 *
 * «Start» går den VANLIGE veien (sjekkliste.opprett) med kontrollplanPunktId satt, så
 * opprettelse + kobling skjer atomisk i én transaksjon på serveren.
 */
export function PunktStartHandling({
  punkt,
  projectId,
  byggeplassId,
  flytStatus,
  onEndret,
}: {
  punkt: PunktLite;
  projectId: string;
  byggeplassId: string;
  flytStatus: MalFlytStatus | undefined;
  onEndret: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [visFlytVelger, setVisFlytVelger] = useState(false);
  const [visKobleDialog, setVisKobleDialog] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (sjekkliste: { id: string }) => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onEndret();
      router.push(`/dashbord/${projectId}/sjekklister/${sjekkliste.id}`);
    },
    onError: (err: { message: string }) => setFeil(err.message),
  });

  function startMedFlyt(flytId: string, bestillerFaggruppeId: string, utforerFaggruppeId: string) {
    setFeil(null);
    setVisFlytVelger(false);
    opprett.mutate({
      templateId: punkt.sjekklisteMalId,
      bestillerFaggruppeId,
      utforerFaggruppeId,
      dokumentflytId: flytId,
      byggeplassId,
      kontrollplanPunktId: punkt.id,
    });
  }

  function handleStart() {
    setFeil(null);
    if (!flytStatus || flytStatus.type === "ingen") {
      setFeil(t("kontrollplan.startIngenFlyt"));
      return;
    }
    if (flytStatus.type === "en") {
      const k = flytStatus.kandidat;
      startMedFlyt(k.flytId, k.bestillerFaggruppeId, k.utforerFaggruppeId);
      return;
    }
    // flere → la brukeren velge
    setVisFlytVelger(true);
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
        <p className="mt-1 flex items-start gap-1 text-[11px] text-sitedoc-error max-w-[240px]">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          {feil}
        </p>
      )}

      {/* Flyt-velger når malen ligger i flere flyter */}
      {visFlytVelger && flytStatus?.type === "flere" && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[220px]">
          <p className="px-3 py-1.5 text-[11px] text-gray-500 border-b">{t("kontrollplan.startVelgFlyt")}</p>
          {flytStatus.kandidater.map((k) => (
            <button
              key={k.flytId}
              type="button"
              onClick={() => startMedFlyt(k.flytId, k.bestillerFaggruppeId, k.utforerFaggruppeId)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              <span className="font-medium">{k.flytNavn}</span>
              <span className="block text-[11px] text-gray-400">{k.oppretterNavn} → {k.utforerNavn}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVisFlytVelger(false)}
            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-gray-50 border-t"
          >
            {t("handling.avbryt")}
          </button>
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
