"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hentStatusHandlinger } from "@sitedoc/shared";

const FARGE_MAP: Record<string, { bg: string; hover: string }> = {
  "bg-blue-600": { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
  "bg-red-600": { bg: "bg-red-600", hover: "hover:bg-red-700" },
  "bg-amber-500": { bg: "bg-amber-500", hover: "hover:bg-amber-600" },
  "bg-purple-600": { bg: "bg-purple-600", hover: "hover:bg-purple-700" },
  "bg-green-600": { bg: "bg-green-600", hover: "hover:bg-green-700" },
  "bg-gray-500": { bg: "bg-gray-500", hover: "hover:bg-gray-600" },
};

export interface EntrepriseValg {
  id: string;
  navn: string;
  farge?: string | null;
  /** Forhåndsutledet mottaker fra dokumentflyt */
  mottaker?: { userId?: string; groupId?: string };
}

interface StatusHandlingerProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: { userId?: string; groupId?: string }) => void;
  onSlett?: () => void;
  /** Alle entrepriser med forhåndsutledet mottaker */
  entrepriseValg?: EntrepriseValg[];
  /** ID til standard-entreprise (svarer/responder) */
  standardEntrepriseId?: string;
  /** Brukerens egne entreprise-IDer (for videresend-filtrering) */
  mineEntrepriseIder?: string[];
  /** Om bruker er registrator (create_checklists/create_tasks) — styrer tilgang til Lukk fra avvist */
  erRegistrator?: boolean;
}

export function StatusHandlinger({ status, erLaster, onEndreStatus, onSlett, entrepriseValg, standardEntrepriseId, mineEntrepriseIder, erRegistrator }: StatusHandlingerProps) {
  const { t } = useTranslation();
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [valgtEntreprise, setValgtEntreprise] = useState("");

  const alleHandlinger = hentStatusHandlinger(status);
  // Lukk fra avvist: kun for registratorer
  const handlinger = alleHandlinger.filter((h) => {
    if (status === "rejected" && h.nyStatus === "closed" && !erRegistrator) return false;
    return true;
  });

  if (handlinger.length === 0) return null;

  const håndterKlikk = (nyStatus: string) => {
    if (nyStatus === "deleted") {
      if (bekreftHandling === "deleted") {
        onSlett?.();
        setBekreftHandling(null);
      } else {
        setBekreftHandling("deleted");
        setKommentar("");
      }
      return;
    }
    if (bekreftHandling === nyStatus) {
      let mottaker: { userId?: string; groupId?: string } | undefined;

      if (nyStatus === "forwarded") {
        // Videresend: bruk valgt entreprise (eller standard)
        const valgtId = valgtEntreprise || standardEntrepriseId;
        if (valgtId && entrepriseValg) {
          const valgt = entrepriseValg.find((e) => e.id === valgtId);
          mottaker = valgt?.mottaker;
        }
        if (!mottaker) return;
      } else if (standardEntrepriseId && entrepriseValg) {
        // Normal overgang: auto-utled mottaker fra standard-entreprise (dokumentflyt)
        const standard = entrepriseValg.find((e) => e.id === standardEntrepriseId);
        mottaker = standard?.mottaker;
      }

      onEndreStatus(nyStatus, kommentar.trim() || undefined, mottaker);
      setBekreftHandling(null);
      setKommentar("");
      setValgtEntreprise("");
    } else {
      setBekreftHandling(nyStatus);
      setKommentar("");
      setValgtEntreprise("");
    }
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
    setValgtEntreprise("");
  };

  // Entreprise-velger kun ved videresend OG bruker har flere entrepriser
  const videresendEntrepriser = mineEntrepriseIder
    ? entrepriseValg?.filter((e) => mineEntrepriseIder.includes(e.id))
    : entrepriseValg; // Ikke lastet ennå / admin → vis alle
  const visEntrepriseVelger = bekreftHandling === "forwarded"
    && videresendEntrepriser && videresendEntrepriser.length > 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {handlinger.map((h) => {
          const farger = FARGE_MAP[h.farge] ?? { bg: "bg-gray-600", hover: "hover:bg-gray-700" };
          const erValgt = bekreftHandling === h.nyStatus;

          return (
            <button
              key={h.nyStatus}
              onClick={() => håndterKlikk(h.nyStatus)}
              disabled={erLaster}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                erValgt ? "ring-2 ring-offset-1 ring-gray-400" : ""
              } ${farger.bg} ${farger.hover}`}
            >
              {erLaster ? t("statushandling.endrer") : erValgt ? t("statushandling.bekreftHandling", { handling: t(h.tekstNoekkel) }) : t(h.tekstNoekkel)}
            </button>
          );
        })}
        {bekreftHandling && (
          <button
            onClick={avbrytBekreft}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t("handling.avbryt")}
          </button>
        )}
      </div>
      {bekreftHandling && (
        <div className="flex max-w-lg flex-col gap-2">
          {visEntrepriseVelger && (
            <select
              value={valgtEntreprise || standardEntrepriseId || ""}
              onChange={(e) => setValgtEntreprise(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {videresendEntrepriser!.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.navn}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") håndterKlikk(bekreftHandling);
            }}
            placeholder={t("statushandling.valgfriKommentar")}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            autoFocus={!visEntrepriseVelger}
          />
        </div>
      )}
    </div>
  );
}
