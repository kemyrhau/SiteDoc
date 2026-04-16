"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { hentRolleFiltrertHandlinger, hentStatusHandlinger } from "@sitedoc/shared";
import type { DokumentflytRolle } from "@sitedoc/shared";

const FARGE_MAP: Record<string, { bg: string; hover: string }> = {
  "bg-blue-600": { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
  "bg-red-600": { bg: "bg-red-600", hover: "hover:bg-red-700" },
  "bg-amber-500": { bg: "bg-amber-500", hover: "hover:bg-amber-600" },
  "bg-purple-600": { bg: "bg-purple-600", hover: "hover:bg-purple-700" },
  "bg-green-600": { bg: "bg-green-600", hover: "hover:bg-green-700" },
  "bg-gray-500": { bg: "bg-gray-500", hover: "hover:bg-gray-600" },
};

export interface VideresendValg {
  /** Unik nøkkel: faggruppeId eller faggruppeId__dokumentflytId ved flere flyter */
  key: string;
  faggruppeId: string;
  faggruppeNavn: string;
  dokumentflytId: string;
  dokumentflytNavn: string;
  /** Visningsnavn i dropdown. Faggruppenavn alene hvis 1 flyt, med flytnavn i parentes hvis flere */
  visningsnavn: string;
  farge?: string | null;
  mottaker?: { userId?: string; groupId?: string };
}

export interface DokumentflytData {
  id: string;
  name: string;
  faggruppeId: string | null;
  roller: Array<{ rolle: string; label?: string | null }>;
  maler: Array<{ template: { id: string } }>;
  medlemmer: Array<{
    rolle: string;
    erHovedansvarlig: boolean;
    faggruppeId?: string | null;
    projectMemberId?: string | null;
    groupId?: string | null;
    hovedansvarligPerson?: { user: { id: string; name: string | null } } | null;
    projectMember?: { user: { id: string; name: string | null } } | null;
    group?: { id: string; name: string } | null;
  }>;
}

export interface FaggruppeData {
  id: string;
  name: string;
  color: string | null;
}

/** @deprecated Bruk FaggruppeData */
export type EntrepriseData = FaggruppeData;

/**
 * Bygg videresend-valg basert på faggruppe + mal-match.
 * For hver faggruppe, finn dokumentflyter som har:
 * 1. faggruppeId === faggruppeId
 * 2. dokumentets templateId i maler-listen
 * Utled mottaker fra utfører-rollen (fallback: bestiller → godkjenner).
 */
export function byggVideresendValg(
  alleFaggrupper: FaggruppeData[],
  dokumentflyter: DokumentflytData[],
  templateId: string | null | undefined,
): VideresendValg[] {
  const valg: VideresendValg[] = [];

  // Tell antall matchende flyter per faggruppe for å avgjøre visningsnavn
  const flyterPerFaggruppe = new Map<string, DokumentflytData[]>();

  for (const fg of alleFaggrupper) {
    const matchendeFlyter = dokumentflyter.filter((df) => {
      if (df.faggruppeId !== fg.id) return false;
      if (!templateId) return true; // Ingen mal → vis alle flyter for faggruppen
      return df.maler.some((m) => m.template.id === templateId);
    });
    if (matchendeFlyter.length > 0) {
      flyterPerFaggruppe.set(fg.id, matchendeFlyter);
    }
  }

  for (const fg of alleFaggrupper) {
    const flyter = flyterPerFaggruppe.get(fg.id);
    if (!flyter) continue;

    const flereFlyterForFaggruppe = flyter.length > 1;

    for (const df of flyter) {
      // Utled mottaker: prioriter utfører → bestiller → godkjenner
      const mottaker = finnMottaker(df);

      const visningsnavn = flereFlyterForFaggruppe
        ? `${fg.name} (${df.name})`
        : fg.name;

      valg.push({
        key: flereFlyterForFaggruppe ? `${fg.id}__${df.id}` : fg.id,
        faggruppeId: fg.id,
        faggruppeNavn: fg.name,
        dokumentflytId: df.id,
        dokumentflytNavn: df.name,
        visningsnavn,
        farge: fg.color,
        mottaker,
      });
    }
  }

  return valg;
}

/** Finn mottaker fra dokumentflyt: utfører → bestiller → godkjenner */
function finnMottaker(df: DokumentflytData): { userId?: string; groupId?: string } | undefined {
  for (const rollePrioritet of ["utforer", "bestiller", "godkjenner"]) {
    const medlemmerMedRolle = df.medlemmer.filter((m) => m.rolle === rollePrioritet);
    if (medlemmerMedRolle.length === 0) continue;

    // Foretrekk hovedansvarlig
    const hovedansvarlig = medlemmerMedRolle.find((m) => m.erHovedansvarlig);
    const valgt = hovedansvarlig ?? medlemmerMedRolle[0];

    if (valgt?.group) return { groupId: valgt.group.id };
    if (valgt?.hovedansvarligPerson?.user) return { userId: valgt.hovedansvarligPerson.user.id };
    if (valgt?.projectMember?.user) return { userId: valgt.projectMember.user.id };
  }
  return undefined;
}

interface StatusHandlingerProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: { userId?: string; groupId?: string; dokumentflytId?: string }) => void;
  onSlett?: () => void;
  /** Alle faggrupper i prosjektet */
  alleFaggrupper?: FaggruppeData[];
  /** Alle dokumentflyter i prosjektet (med maler og medlemmer) */
  dokumentflyter?: DokumentflytData[];
  /** Dokumentets mal-ID for å filtrere relevante dokumentflyter */
  templateId?: string | null;
  /** ID til standard-faggruppe (utfører) */
  standardFaggruppeId?: string;
  /** Brukerens rolle i dokumentflyten (fra utledMinRolle) */
  minRolle?: DokumentflytRolle | null;
}

export function StatusHandlinger({ status, erLaster, onEndreStatus, onSlett, alleFaggrupper, dokumentflyter, templateId, standardFaggruppeId, minRolle }: StatusHandlingerProps) {
  const { t } = useTranslation();
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [valgtKey, setValgtKey] = useState("");

  // Rollefiltrerte handlinger — null/undefined rolle bruker ufiltrert (bakoverkompatibilitet for mobil)
  const handlinger = minRolle !== undefined
    ? hentRolleFiltrertHandlinger(status, minRolle)
    : hentStatusHandlinger(status);

  // Bygg videresend-valg med faggruppe + mal-matching
  const videresendValg = useMemo(
    () => byggVideresendValg(alleFaggrupper ?? [], dokumentflyter ?? [], templateId),
    [alleFaggrupper, dokumentflyter, templateId],
  );

  // Standard-valg: finn key for standard-faggruppe
  const standardKey = useMemo(() => {
    if (!standardFaggruppeId) return "";
    const match = videresendValg.find((v) => v.faggruppeId === standardFaggruppeId);
    return match?.key ?? "";
  }, [videresendValg, standardFaggruppeId]);

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
      let mottaker: { userId?: string; groupId?: string; dokumentflytId?: string } | undefined;

      if (nyStatus === "forwarded") {
        const aktivKey = valgtKey || standardKey;
        const valgt = videresendValg.find((v) => v.key === aktivKey);
        mottaker = valgt?.mottaker ? { ...valgt.mottaker, dokumentflytId: valgt.dokumentflytId } : undefined;
        if (!mottaker) return;
      } else if (standardFaggruppeId) {
        // Normal overgang: utled mottaker fra standard-faggruppens flyt
        const standard = videresendValg.find((v) => v.faggruppeId === standardFaggruppeId);
        mottaker = standard?.mottaker;
      }

      onEndreStatus(nyStatus, kommentar.trim() || undefined, mottaker);
      setBekreftHandling(null);
      setKommentar("");
      setValgtKey("");
    } else {
      setBekreftHandling(nyStatus);
      setKommentar("");
      setValgtKey("");
    }
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
    setValgtKey("");
  };

  const visFaggruppeVelger = bekreftHandling === "forwarded" && videresendValg.length > 1;

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
          {visFaggruppeVelger && (
            <select
              value={valgtKey || standardKey}
              onChange={(e) => setValgtKey(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {videresendValg.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.visningsnavn}
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
            autoFocus={!visFaggruppeVelger}
          />
        </div>
      )}
    </div>
  );
}
