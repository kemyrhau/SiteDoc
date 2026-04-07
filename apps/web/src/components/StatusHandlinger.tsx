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
  /** Unik nøkkel: entrepriseId eller entrepriseId__dokumentflytId ved flere flyter */
  key: string;
  entrepriseId: string;
  entrepriseNavn: string;
  dokumentflytId: string;
  dokumentflytNavn: string;
  /** Visningsnavn i dropdown. Entreprisenavn alene hvis 1 flyt, med flytnavn i parentes hvis flere */
  visningsnavn: string;
  farge?: string | null;
  mottaker?: { userId?: string; groupId?: string };
}

export interface DokumentflytData {
  id: string;
  name: string;
  enterpriseId: string | null;
  roller: Array<{ rolle: string; label?: string | null }>;
  maler: Array<{ template: { id: string } }>;
  medlemmer: Array<{
    rolle: string;
    erHovedansvarlig: boolean;
    enterpriseId?: string | null;
    projectMemberId?: string | null;
    groupId?: string | null;
    hovedansvarligPerson?: { user: { id: string; name: string | null } } | null;
    projectMember?: { user: { id: string; name: string | null } } | null;
    group?: { id: string; name: string } | null;
  }>;
}

export interface EntrepriseData {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Bygg videresend-valg basert på entreprise + mal-match.
 * For hver entreprise, finn dokumentflyter som har:
 * 1. enterpriseId === entrepriseId
 * 2. dokumentets templateId i maler-listen
 * Utled mottaker fra utfører-rollen (fallback: bestiller → godkjenner).
 */
export function byggVideresendValg(
  alleEntrepriser: EntrepriseData[],
  dokumentflyter: DokumentflytData[],
  templateId: string | null | undefined,
): VideresendValg[] {
  const valg: VideresendValg[] = [];

  // Tell antall matchende flyter per entreprise for å avgjøre visningsnavn
  const flyterPerEntreprise = new Map<string, DokumentflytData[]>();

  for (const ent of alleEntrepriser) {
    const matchendeFlyter = dokumentflyter.filter((df) => {
      if (df.enterpriseId !== ent.id) return false;
      if (!templateId) return true; // Ingen mal → vis alle flyter for entreprisen
      return df.maler.some((m) => m.template.id === templateId);
    });
    if (matchendeFlyter.length > 0) {
      flyterPerEntreprise.set(ent.id, matchendeFlyter);
    }
  }

  for (const ent of alleEntrepriser) {
    const flyter = flyterPerEntreprise.get(ent.id);
    if (!flyter) continue;

    const flereFlyterForEntreprise = flyter.length > 1;

    for (const df of flyter) {
      // Utled mottaker: prioriter utfører → bestiller → godkjenner
      const mottaker = finnMottaker(df);

      const visningsnavn = flereFlyterForEntreprise
        ? `${ent.name} (${df.name})`
        : ent.name;

      valg.push({
        key: flereFlyterForEntreprise ? `${ent.id}__${df.id}` : ent.id,
        entrepriseId: ent.id,
        entrepriseNavn: ent.name,
        dokumentflytId: df.id,
        dokumentflytNavn: df.name,
        visningsnavn,
        farge: ent.color,
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
  /** Alle entrepriser i prosjektet */
  alleEntrepriser?: EntrepriseData[];
  /** Alle dokumentflyter i prosjektet (med maler og medlemmer) */
  dokumentflyter?: DokumentflytData[];
  /** Dokumentets mal-ID for å filtrere relevante dokumentflyter */
  templateId?: string | null;
  /** ID til standard-entreprise (utfører) */
  standardEntrepriseId?: string;
  /** Brukerens rolle i dokumentflyten (fra utledMinRolle) */
  minRolle?: DokumentflytRolle | null;
}

export function StatusHandlinger({ status, erLaster, onEndreStatus, onSlett, alleEntrepriser, dokumentflyter, templateId, standardEntrepriseId, minRolle }: StatusHandlingerProps) {
  const { t } = useTranslation();
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");
  const [valgtKey, setValgtKey] = useState("");

  // Rollefiltrerte handlinger — null/undefined rolle bruker ufiltrert (bakoverkompatibilitet for mobil)
  const handlinger = minRolle !== undefined
    ? hentRolleFiltrertHandlinger(status, minRolle)
    : hentStatusHandlinger(status);

  // Bygg videresend-valg med entreprise + mal-matching
  const videresendValg = useMemo(
    () => byggVideresendValg(alleEntrepriser ?? [], dokumentflyter ?? [], templateId),
    [alleEntrepriser, dokumentflyter, templateId],
  );

  // Standard-valg: finn key for standard-entreprise
  const standardKey = useMemo(() => {
    if (!standardEntrepriseId) return "";
    const match = videresendValg.find((v) => v.entrepriseId === standardEntrepriseId);
    return match?.key ?? "";
  }, [videresendValg, standardEntrepriseId]);

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
      } else if (standardEntrepriseId) {
        // Normal overgang: utled mottaker fra standard-entreprisens flyt
        const standard = videresendValg.find((v) => v.entrepriseId === standardEntrepriseId);
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

  const visEntrepriseVelger = bekreftHandling === "forwarded" && videresendValg.length > 1;

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
            autoFocus={!visEntrepriseVelger}
          />
        </div>
      )}
    </div>
  );
}
