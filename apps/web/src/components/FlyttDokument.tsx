"use client";

import { useState, useMemo } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { byggVideresendValg } from "./StatusHandlinger";
import type { DokumentflytData, EntrepriseData } from "./StatusHandlinger";

interface FlyttDokumentProps {
  /** Dokumentets nåværende status */
  status: string;
  /** Dokumentets template-ID */
  templateId?: string | null;
  /** Alle entrepriser i prosjektet */
  alleEntrepriser: EntrepriseData[];
  /** Alle dokumentflyter i prosjektet */
  dokumentflyter: DokumentflytData[];
  /** Nåværende utfører-entreprise (ekskluderes fra valg) */
  nåværendeEntrepriseId?: string;
  /** Om bruker er admin eller registrator */
  erAdminEllerRegistrator: boolean;
  /** Loading state */
  erLaster: boolean;
  /** Callback ved flytt */
  onFlytt: (nyDokumentflytId: string, mottaker?: { userId?: string; groupId?: string }) => void;
}

const TILLATT_STATUS = new Set(["draft", "sent", "received", "in_progress"]);

export function FlyttDokument({
  status,
  templateId,
  alleEntrepriser,
  dokumentflyter,
  nåværendeEntrepriseId,
  erAdminEllerRegistrator,
  erLaster,
  onFlytt,
}: FlyttDokumentProps) {
  const { t } = useTranslation();
  const [åpen, setÅpen] = useState(false);
  const [valgtKey, setValgtKey] = useState("");

  // Vis kun for admin/registrator og tillatte statuser
  if (!erAdminEllerRegistrator || !TILLATT_STATUS.has(status)) return null;

  // Bygg valg, ekskluder nåværende entreprise
  const valg = useMemo(() => {
    const alle = byggVideresendValg(alleEntrepriser, dokumentflyter, templateId);
    return alle.filter((v) => v.entrepriseId !== nåværendeEntrepriseId);
  }, [alleEntrepriser, dokumentflyter, templateId, nåværendeEntrepriseId]);

  if (valg.length === 0) return null;

  const håndterFlytt = () => {
    const valgt = valg.find((v) => v.key === valgtKey);
    if (!valgt) return;
    onFlytt(valgt.dokumentflytId, valgt.mottaker);
    setÅpen(false);
    setValgtKey("");
  };

  if (!åpen) {
    return (
      <button
        onClick={() => setÅpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <ArrowRightLeft className="h-4 w-4" />
        {t("flytt.knapp")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={valgtKey}
        onChange={(e) => setValgtKey(e.target.value)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">{t("flytt.velgDokumentflyt")}</option>
        {valg.map((v) => (
          <option key={v.key} value={v.key}>
            {v.visningsnavn}
          </option>
        ))}
      </select>
      <button
        onClick={håndterFlytt}
        disabled={!valgtKey || erLaster}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {erLaster ? t("flytt.flytter") : t("flytt.bekreft")}
      </button>
      <button
        onClick={() => { setÅpen(false); setValgtKey(""); }}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
      >
        {t("handling.avbryt")}
      </button>
    </div>
  );
}
