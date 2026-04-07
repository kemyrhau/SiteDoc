"use client";

// TODO: Implementer samme kompakte handlingsmeny-mønster i mobilappen (React Native)
// Mobilappen bruker hentStatusHandlinger() direkte — bør migreres til
// hentRolleFiltrertHandlinger() med utledMinRolle() for konsistent rollebasert UI.

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { hentRolleFiltrertHandlinger, hentStatusHandlinger } from "@sitedoc/shared";
import type { DokumentflytRolle } from "@sitedoc/shared";
import { byggVideresendValg } from "./StatusHandlinger";
import type { DokumentflytData, EntrepriseData } from "./StatusHandlinger";

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

interface DokumentHandlingsmenyProps {
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

export function DokumentHandlingsmeny({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  alleEntrepriser,
  dokumentflyter,
  templateId,
  standardEntrepriseId,
  minRolle,
}: DokumentHandlingsmenyProps) {
  const { t } = useTranslation();
  const [åpenMeny, setÅpenMeny] = useState(false);
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [valgtKey, setValgtKey] = useState("");
  const menyRef = useRef<HTMLDivElement>(null);

  // Lukk meny ved klikk utenfor
  useEffect(() => {
    if (!åpenMeny) return;
    const lukk = (e: MouseEvent) => {
      if (menyRef.current && !menyRef.current.contains(e.target as Node)) {
        setÅpenMeny(false);
      }
    };
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpenMeny]);

  // Rollefiltrerte handlinger
  const handlinger = minRolle !== undefined
    ? hentRolleFiltrertHandlinger(status, minRolle)
    : hentStatusHandlinger(status);

  const primaer = handlinger.find((h) => h.erPrimaer) ?? handlinger[0];
  const sekundaere = handlinger.filter((h) => h !== primaer);

  // Videresend-valg
  const videresendValg = useMemo(
    () => byggVideresendValg(alleEntrepriser ?? [], dokumentflyter ?? [], templateId),
    [alleEntrepriser, dokumentflyter, templateId],
  );

  const standardKey = useMemo(() => {
    if (!standardEntrepriseId) return "";
    return videresendValg.find((v) => v.entrepriseId === standardEntrepriseId)?.key ?? "";
  }, [videresendValg, standardEntrepriseId]);

  if (handlinger.length === 0) {
    // Vis kun rolle-badge uten knapper (lesevisning)
    if (minRolle === null) {
      return (
        <span className="text-xs text-gray-400 italic">
          {t("bunnbar.lesevisning")}
        </span>
      );
    }
    return null;
  }

  const utførHandling = (nyStatus: string) => {
    if (nyStatus === "deleted") {
      if (bekreftHandling === "deleted") {
        onSlett?.();
        setBekreftHandling(null);
      } else {
        setBekreftHandling("deleted");
        setÅpenMeny(false);
      }
      return;
    }

    if (bekreftHandling === nyStatus) {
      let mottaker: { userId?: string; groupId?: string; dokumentflytId?: string } | undefined;

      if (nyStatus === "forwarded") {
        const aktivKey = valgtKey || standardKey;
        const valgt = videresendValg.find((v) => v.key === aktivKey);
        mottaker = valgt?.mottaker ? { ...valgt.mottaker, dokumentflytId: valgt.dokumentflytId } : undefined;
        if (!mottaker) return;
      } else if (standardEntrepriseId) {
        const standard = videresendValg.find((v) => v.entrepriseId === standardEntrepriseId);
        mottaker = standard?.mottaker;
      }

      onEndreStatus(nyStatus, kommentar.trim() || undefined, mottaker);
      setBekreftHandling(null);
      setKommentar("");
      setValgtKey("");
      setÅpenMeny(false);
    } else {
      setBekreftHandling(nyStatus);
      setKommentar("");
      setValgtKey("");
      setÅpenMeny(false);
    }
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
    setValgtKey("");
  };

  const visEntrepriseVelger = bekreftHandling === "forwarded" && videresendValg.length > 1;

  return (
    <div className="flex items-center gap-2">
      {/* Rolle-badge */}
      {minRolle && (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLLE_FARGE[minRolle] ?? "bg-gray-100 text-gray-600"}`}>
          {t(ROLLE_I18N[minRolle] ?? minRolle)}
        </span>
      )}

      {/* Primærknapp + dropdown */}
      {!bekreftHandling && primaer && (
        <div className="relative" ref={menyRef}>
          <div className="flex">
            <button
              onClick={() => utførHandling(primaer.nyStatus)}
              disabled={erLaster}
              className="rounded-l-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {erLaster ? t("statushandling.endrer") : t(primaer.tekstNoekkel)}
            </button>
            {sekundaere.length > 0 && (
              <button
                onClick={() => setÅpenMeny(!åpenMeny)}
                disabled={erLaster}
                className="rounded-r-lg border-l border-blue-500 bg-sitedoc-primary px-1.5 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown-meny */}
          {åpenMeny && sekundaere.length > 0 && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {sekundaere.map((h) => (
                <button
                  key={h.nyStatus}
                  onClick={() => {
                    setÅpenMeny(false);
                    utførHandling(h.nyStatus);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t(h.tekstNoekkel)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bekreftelse-steg */}
      {bekreftHandling && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {t("statushandling.bekreftHandling", { handling: t(handlinger.find((h) => h.nyStatus === bekreftHandling)?.tekstNoekkel ?? "") })}
          </span>

          {visEntrepriseVelger && (
            <select
              value={valgtKey || standardKey}
              onChange={(e) => setValgtKey(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            >
              {videresendValg.map((v) => (
                <option key={v.key} value={v.key}>{v.visningsnavn}</option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") utførHandling(bekreftHandling); }}
            placeholder={t("statushandling.valgfriKommentar")}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-48"
            autoFocus
          />

          <button
            onClick={() => utførHandling(bekreftHandling)}
            disabled={erLaster}
            className="rounded-lg bg-sitedoc-primary px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
          </button>
          <button
            onClick={avbrytBekreft}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t("handling.avbryt")}
          </button>
        </div>
      )}
    </div>
  );
}
