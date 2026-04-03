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

interface MottakerValg {
  personer: Array<{ id: string; navn: string; grupper?: string }>;
  grupper: Array<{ id: string; navn: string }>;
}

interface StatusHandlingerProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: { userId?: string; groupId?: string }) => void;
  onSlett?: () => void;
  mottakerValg?: MottakerValg;
}

export function StatusHandlinger({ status, erLaster, onEndreStatus, onSlett, mottakerValg }: StatusHandlingerProps) {
  const { t } = useTranslation();
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [valgtMottaker, setValgtMottaker] = useState("");

  const handlinger = hentStatusHandlinger(status);

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
      // Parse mottaker fra valgt verdi
      let mottaker: { userId?: string; groupId?: string } | undefined;
      if (valgtMottaker) {
        if (valgtMottaker.startsWith("u:")) {
          mottaker = { userId: valgtMottaker.slice(2) };
        } else if (valgtMottaker.startsWith("g:")) {
          mottaker = { groupId: valgtMottaker.slice(2) };
        }
      }
      // Videresend krever mottaker
      if (nyStatus === "forwarded" && !mottaker) return;
      onEndreStatus(nyStatus, kommentar.trim() || undefined, mottaker);
      setBekreftHandling(null);
      setKommentar("");
      setValgtMottaker("");
    } else {
      setBekreftHandling(nyStatus);
      setKommentar("");
      setValgtMottaker("");
    }
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
    setValgtMottaker("");
  };

  const visMottakerVelger = (bekreftHandling === "sent" || bekreftHandling === "forwarded") && mottakerValg &&
    (mottakerValg.personer.length > 0 || mottakerValg.grupper.length > 0);

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
          {visMottakerVelger && (
            <select
              value={valgtMottaker}
              onChange={(e) => setValgtMottaker(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">{bekreftHandling === "forwarded" ? t("statushandling.velgMottaker") : t("statushandling.velgMottakerValgfritt")}</option>
              {mottakerValg!.grupper.length > 0 && (
                <optgroup label="Grupper">
                  {mottakerValg!.grupper.map((g) => (
                    <option key={`g:${g.id}`} value={`g:${g.id}`}>{g.navn}</option>
                  ))}
                </optgroup>
              )}
              {mottakerValg!.personer.length > 0 && (
                <optgroup label="Personer">
                  {mottakerValg!.personer.map((p) => (
                    <option key={`u:${p.id}`} value={`u:${p.id}`}>
                      {p.navn}{p.grupper ? ` · ${p.grupper}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
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
            autoFocus={!visMottakerVelger}
          />
        </div>
      )}
    </div>
  );
}
