"use client";

import { useTranslation } from "react-i18next";
import { StatusBadge } from "@sitedoc/ui";
import { StatusHandlinger } from "./StatusHandlinger";
import type { DokumentflytData, EntrepriseData } from "./StatusHandlinger";
import type { DokumentflytRolle } from "@sitedoc/shared";

const ROLLE_I18N: Record<string, string> = {
  registrator: "kontakter.registrator",
  bestiller: "kontakter.bestiller",
  utforer: "kontakter.utforer",
  godkjenner: "kontakter.godkjenner",
};

const ROLLE_FARGE: Record<string, string> = {
  registrator: "bg-slate-100 text-slate-700",
  bestiller: "bg-blue-100 text-blue-700",
  utforer: "bg-amber-100 text-amber-700",
  godkjenner: "bg-emerald-100 text-emerald-700",
};

interface DokumentBunnbarProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: { userId?: string; groupId?: string; dokumentflytId?: string }) => void;
  onSlett?: () => void;
  alleEntrepriser?: EntrepriseData[];
  dokumentflyter?: DokumentflytData[];
  templateId?: string | null;
  standardEntrepriseId?: string;
  minRolle?: DokumentflytRolle | null;
}

export function DokumentBunnbar({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  alleEntrepriser,
  dokumentflyter,
  templateId,
  standardEntrepriseId,
  minRolle,
}: DokumentBunnbarProps) {
  const { t } = useTranslation();

  // Terminale statuser uten handlinger — ikke vis bunnbaren
  const erTerminal = ["closed", "cancelled"].includes(status) && minRolle !== "registrator";

  if (erTerminal && minRolle !== undefined) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.06)] print-skjul">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        {/* Venstre: Status + rolle */}
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={status} />
          {minRolle && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLLE_FARGE[minRolle] ?? "bg-gray-100 text-gray-600"}`}>
              {t(ROLLE_I18N[minRolle] ?? minRolle)}
            </span>
          )}
          {minRolle === null && (
            <span className="text-xs text-gray-400 italic">
              {t("bunnbar.lesevisning")}
            </span>
          )}
        </div>

        {/* Høyre: Handlingsknapper */}
        <div className="flex-1 flex justify-end">
          <StatusHandlinger
            status={status}
            erLaster={erLaster}
            onEndreStatus={onEndreStatus}
            onSlett={onSlett}
            alleEntrepriser={alleEntrepriser}
            dokumentflyter={dokumentflyter}
            templateId={templateId}
            standardEntrepriseId={standardEntrepriseId}
            minRolle={minRolle}
          />
        </div>
      </div>
    </div>
  );
}
