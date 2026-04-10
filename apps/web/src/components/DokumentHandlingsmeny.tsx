"use client";

// TODO: Implementer samme kompakte handlingsmeny-mønster i mobilappen (React Native)
// Mobilappen bruker hentStatusHandlinger() direkte — bør migreres til
// posisjon-basert logikk med utledMinRolle() for konsistent rollebasert UI.

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { DokumentflytRolle } from "@sitedoc/shared";
import { byggVideresendValg } from "./StatusHandlinger";
import type { DokumentflytData, EntrepriseData, VideresendValg } from "./StatusHandlinger";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  enterprise: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

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
  /** Dokumentflyt-medlemmer for posisjon-utledning */
  flytMedlemmer?: FlytMedlem[];
  /** Nåværende mottaker (bruker-ID) */
  recipientUserId?: string | null;
  /** Nåværende mottaker (gruppe-ID) */
  recipientGroupId?: string | null;
  /** Bestiller (oppretters bruker-ID) */
  bestillerUserId?: string;
}

/* ------------------------------------------------------------------ */
/*  Flytposisjon-hjelpere                                              */
/* ------------------------------------------------------------------ */

interface Ledd {
  navn: string;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  entrepriseIder: Set<string>;
  steg: number;
}

function byggLedd(medlemmer: FlytMedlem[]): Ledd[] {
  const stegMap = new Map<number, FlytMedlem[]>();
  for (const m of medlemmer) {
    const liste = stegMap.get(m.steg) ?? [];
    liste.push(m);
    stegMap.set(m.steg, liste);
  }

  return [...stegMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([steg, medl]) => {
      const entreprise = medl.find((m) => m.enterprise);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = entreprise
        ? entreprise.enterprise!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      return {
        navn,
        steg,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        entrepriseIder: new Set(medl.filter((m) => m.enterprise).map((m) => m.enterprise!.id)),
      };
    });
}

/** Finn index for brukerens posisjon i flyten basert på flytinfo */
function finnBrukerBoksIndex(
  ledd: Ledd[],
  brukerEntrepriseIder: string[],
  brukerGruppeIder: string[],
  brukerUserId?: string,
): number {
  // Prøv direkte person-match
  if (brukerUserId) {
    const idx = ledd.findIndex((l) => l.brukerIder.has(brukerUserId));
    if (idx !== -1) return idx;
  }
  // Prøv gruppe-match
  for (const gid of brukerGruppeIder) {
    const idx = ledd.findIndex((l) => l.gruppeIder.has(gid));
    if (idx !== -1) return idx;
  }
  // Prøv entreprise-match
  for (const eid of brukerEntrepriseIder) {
    const idx = ledd.findIndex((l) => l.entrepriseIder.has(eid));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Finn aktiv boks (hvor dokumentet er nå) */
function finnAktivtIndex(
  ledd: Ledd[],
  status: string,
  recipientUserId?: string | null,
  recipientGroupId?: string | null,
  bestillerUserId?: string,
): number {
  if (status === "draft" || status === "cancelled") {
    if (bestillerUserId) {
      const idx = ledd.findIndex((l) => l.brukerIder.has(bestillerUserId));
      if (idx !== -1) return idx;
    }
    return 0;
  }
  if (status === "closed" || status === "approved") return -1;

  if (recipientGroupId) {
    const idx = ledd.findIndex((l) => l.gruppeIder.has(recipientGroupId));
    if (idx !== -1) return idx;
  }
  if (recipientUserId) {
    const idx = ledd.findIndex((l) => l.brukerIder.has(recipientUserId));
    if (idx !== -1) return idx;
  }
  return ledd.length > 1 ? ledd.length - 1 : -1;
}

/* ------------------------------------------------------------------ */
/*  Dropdown-element                                                    */
/* ------------------------------------------------------------------ */

interface MenyElement {
  key: string;
  label: string;
  nyStatus: string;
  mottaker?: { userId?: string; groupId?: string; dokumentflytId?: string };
  erSeparator?: boolean;
  erAdmin?: boolean;
  erDestruktiv?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                      */
/* ------------------------------------------------------------------ */

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
  flytMedlemmer,
  recipientUserId,
  recipientGroupId,
  bestillerUserId,
}: DokumentHandlingsmenyProps) {
  const { t } = useTranslation();
  const [åpenMeny, setÅpenMeny] = useState(false);
  const [bekreftHandling, setBekreftHandling] = useState<{ nyStatus: string; mottaker?: { userId?: string; groupId?: string; dokumentflytId?: string }; label?: string } | null>(null);
  const [kommentar, setKommentar] = useState("");
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

  // Videresend-valg fra byggVideresendValg
  const videresendValg = useMemo(
    () => byggVideresendValg(alleEntrepriser ?? [], dokumentflyter ?? [], templateId),
    [alleEntrepriser, dokumentflyter, templateId],
  );

  // Bygg flytledd
  const ledd = useMemo(() => byggLedd(flytMedlemmer ?? []), [flytMedlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId),
    [ledd, status, recipientUserId, recipientGroupId, bestillerUserId],
  );
  const erAdmin = minRolle === "registrator";
  const erSisteBoks = ledd.length > 0 && aktivtIndex === ledd.length - 1;
  const erFørsteBoks = aktivtIndex === 0;
  const harFlyt = ledd.length > 0;

  // Lesevisning
  if (minRolle === null && harFlyt) {
    return (
      <span className="text-xs text-gray-400 italic">
        {t("bunnbar.lesevisning")}
      </span>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Bygg meny-elementer basert på status og posisjon                   */
  /* ------------------------------------------------------------------ */

  const byggSendDropdown = (): MenyElement[] => {
    const elementer: MenyElement[] = [];

    if (status === "draft") {
      // Kladd: vis alle entrepriser som mottaker
      for (const v of videresendValg) {
        elementer.push({
          key: v.key,
          label: v.visningsnavn,
          nyStatus: "sent",
          mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
        });
      }
      return elementer;
    }

    if (["received", "in_progress", "rejected"].includes(status)) {
      if (erSisteBoks) {
        // Siste boks — "Svar avsender" + andre entrepriser
        elementer.push({
          key: "svar-avsender",
          label: t("statushandling.svarAvsender"),
          nyStatus: "responded",
        });
        if (videresendValg.length > 0) {
          elementer.push({ key: "sep-videresend", label: "", nyStatus: "", erSeparator: true });
          for (const v of videresendValg) {
            elementer.push({
              key: `fwd-${v.key}`,
              label: v.visningsnavn,
              nyStatus: "forwarded",
              mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
            });
          }
        }
      } else {
        // Første/midtre boks — besvar (send til bestiller) + "Send tilbake" + videresend
        // Primærmottaker: standardEntreprise (utfører/bestiller)
        const primærValg = standardEntrepriseId
          ? videresendValg.find((v) => v.entrepriseId === standardEntrepriseId)
          : undefined;

        if (primærValg) {
          elementer.push({
            key: "besvar",
            label: primærValg.visningsnavn,
            nyStatus: "responded",
            mottaker: primærValg.mottaker ? { ...primærValg.mottaker, dokumentflytId: primærValg.dokumentflytId } : undefined,
          });
        }

        // Send tilbake — kun hvis ikke første boks
        if (!erFørsteBoks && status === "in_progress") {
          elementer.push({ key: "sep-tilbake", label: "", nyStatus: "", erSeparator: true });
          elementer.push({
            key: "send-tilbake",
            label: t("statushandling.sendTilbake"),
            nyStatus: "sent",
          });
        }

        // Videresend til andre entrepriser
        const andreValg = videresendValg.filter((v) => !primærValg || v.key !== primærValg.key);
        if (andreValg.length > 0) {
          elementer.push({ key: "sep-videresend", label: "", nyStatus: "", erSeparator: true });
          for (const v of andreValg) {
            elementer.push({
              key: `fwd-${v.key}`,
              label: v.visningsnavn,
              nyStatus: "forwarded",
              mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
            });
          }
        }
      }
    }

    if (status === "responded") {
      // Godkjenner-posisjon — "Svar avsender" + videresend
      elementer.push({
        key: "svar-avsender",
        label: t("statushandling.svarAvsender"),
        nyStatus: "rejected",
      });
      if (videresendValg.length > 0) {
        elementer.push({ key: "sep-videresend", label: "", nyStatus: "", erSeparator: true });
        for (const v of videresendValg) {
          elementer.push({
            key: `fwd-${v.key}`,
            label: v.visningsnavn,
            nyStatus: "forwarded",
            mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
          });
        }
      }
    }

    if (status === "approved" || status === "closed") {
      for (const v of videresendValg) {
        elementer.push({
          key: `fwd-${v.key}`,
          label: v.visningsnavn,
          nyStatus: "forwarded",
          mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
        });
      }
    }

    // Admin-seksjon: ekstra valg for registrator/admin
    if (erAdmin && !["draft", "cancelled"].includes(status)) {
      const adminValg: MenyElement[] = [];

      // Kan sende til alle flytbokser
      for (const l of ledd) {
        // Hopp over bokser som allerede er i standard-listen
        const alleredeVist = elementer.some((e) =>
          !e.erSeparator && !e.erAdmin && e.mottaker && [...l.entrepriseIder].some((eid) => {
            const v = videresendValg.find((vv) => vv.entrepriseId === eid);
            return v && e.key.includes(v.key);
          }),
        );
        if (alleredeVist) continue;

        // Finn mottaker for denne boksen
        const entrepriseId = [...l.entrepriseIder][0];
        const matchValg = videresendValg.find((v) => v.entrepriseId === entrepriseId);
        if (matchValg) {
          adminValg.push({
            key: `admin-${matchValg.key}`,
            label: matchValg.visningsnavn,
            nyStatus: "forwarded",
            mottaker: matchValg.mottaker ? { ...matchValg.mottaker, dokumentflytId: matchValg.dokumentflytId } : undefined,
            erAdmin: true,
          });
        }
      }

      // Manuelle statusendringer
      const statusOverganger: Array<{ status: string; label: string }> = [];
      if (!["approved"].includes(status)) statusOverganger.push({ status: "approved", label: t("handling.godkjenn") });
      if (!["closed"].includes(status)) statusOverganger.push({ status: "closed", label: t("handling.lukk") });
      if (!["cancelled"].includes(status)) statusOverganger.push({ status: "cancelled", label: t("statushandling.trekkTilbake") });
      if (!["draft"].includes(status)) statusOverganger.push({ status: "draft", label: t("statushandling.gjenapne") });

      if (adminValg.length > 0 || statusOverganger.length > 0) {
        elementer.push({ key: "sep-admin", label: "", nyStatus: "", erSeparator: true });
        elementer.push({ key: "admin-header", label: t("statushandling.admin"), nyStatus: "", erSeparator: true, erAdmin: true });

        for (const a of adminValg) elementer.push(a);

        if (statusOverganger.length > 0 && adminValg.length > 0) {
          elementer.push({ key: "sep-admin-status", label: "", nyStatus: "", erSeparator: true });
        }
        for (const s of statusOverganger) {
          elementer.push({
            key: `admin-status-${s.status}`,
            label: s.label,
            nyStatus: s.status,
            erAdmin: true,
            erDestruktiv: s.status === "cancelled",
          });
        }
      }
    }

    return elementer;
  };

  const sendElementer = useMemo(byggSendDropdown, [
    status, erSisteBoks, erFørsteBoks, erAdmin, videresendValg,
    standardEntrepriseId, ledd, t,
  ]);

  /* ------------------------------------------------------------------ */
  /*  Handlinger                                                         */
  /* ------------------------------------------------------------------ */

  const utførHandling = (nyStatus: string, mottaker?: { userId?: string; groupId?: string; dokumentflytId?: string }) => {
    if (nyStatus === "deleted") {
      if (bekreftHandling?.nyStatus === "deleted") {
        onSlett?.();
        setBekreftHandling(null);
      } else {
        setBekreftHandling({ nyStatus: "deleted", label: t("handling.slett") });
        setÅpenMeny(false);
      }
      return;
    }

    if (bekreftHandling?.nyStatus === nyStatus) {
      onEndreStatus(nyStatus, kommentar.trim() || undefined, bekreftHandling.mottaker ?? mottaker);
      setBekreftHandling(null);
      setKommentar("");
      setÅpenMeny(false);
    } else {
      setBekreftHandling({ nyStatus, mottaker, label: "" });
      setKommentar("");
      setÅpenMeny(false);
    }
  };

  const velgMenyElement = (element: MenyElement) => {
    setÅpenMeny(false);
    setBekreftHandling({ nyStatus: element.nyStatus, mottaker: element.mottaker, label: element.label });
    setKommentar("");
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  // Terminal-statuser uten handlinger
  if (["closed"].includes(status) && sendElementer.length === 0 && !erAdmin) {
    return null;
  }

  // Bekreftelse-modus
  if (bekreftHandling) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          {t("statushandling.bekreftHandling", { handling: bekreftHandling.label || bekreftHandling.nyStatus })}
        </span>

        <input
          type="text"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") utførHandling(bekreftHandling.nyStatus, bekreftHandling.mottaker); }}
          placeholder={t("statushandling.valgfriKommentar")}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-48"
          autoFocus
        />

        <button
          onClick={() => utførHandling(bekreftHandling.nyStatus, bekreftHandling.mottaker)}
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
    );
  }

  /* ---- Knapper ---- */

  // Kladd: Send ▾ + Slett
  if (status === "draft") {
    const harFlereMottakere = sendElementer.length > 1;
    const enesteMottaker = sendElementer.length === 1 ? sendElementer[0] : undefined;

    return (
      <div className="flex items-center gap-2" ref={menyRef}>
        <div className="relative">
          <div className="flex">
            <button
              onClick={() => {
                if (enesteMottaker) {
                  velgMenyElement(enesteMottaker);
                } else if (!harFlereMottakere) {
                  // Ingen flyt — send direkte
                  setBekreftHandling({ nyStatus: "sent", label: t("handling.send") });
                } else {
                  setÅpenMeny(!åpenMeny);
                }
              }}
              disabled={erLaster}
              className="rounded-l-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {erLaster ? t("statushandling.endrer") : t("handling.send")}
            </button>
            {harFlereMottakere && (
              <button
                onClick={() => setÅpenMeny(!åpenMeny)}
                disabled={erLaster}
                className="rounded-r-lg border-l border-blue-500 bg-sitedoc-primary px-1.5 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
            {!harFlereMottakere && (
              <span /> // Avrunding
            )}
          </div>
          {åpenMeny && <DropdownMeny elementer={sendElementer} onVelg={velgMenyElement} />}
        </div>
        {onSlett && (
          <button
            onClick={() => setBekreftHandling({ nyStatus: "deleted", label: t("handling.slett") })}
            disabled={erLaster}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("handling.slett")}
          </button>
        )}
      </div>
    );
  }

  // Sendt: Trekk tilbake-knapp for avsender
  if (status === "sent") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBekreftHandling({ nyStatus: "cancelled", label: t("statushandling.trekkTilbake") })}
          disabled={erLaster}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {erLaster ? t("statushandling.endrer") : t("statushandling.trekkTilbake")}
        </button>
      </div>
    );
  }

  // Avbrutt: Gjenåpne + Slett
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBekreftHandling({ nyStatus: "draft", label: t("statushandling.gjenapne") })}
          disabled={erLaster}
          className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t("statushandling.gjenapne")}
        </button>
        {onSlett && (
          <button
            onClick={() => setBekreftHandling({ nyStatus: "deleted", label: t("handling.slett") })}
            disabled={erLaster}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("handling.slett")}
          </button>
        )}
      </div>
    );
  }

  // Responded (godkjenner-posisjon / siste boks): Godkjenn + Avvis + Send ▾
  if (status === "responded") {
    return (
      <div className="flex items-center gap-2" ref={menyRef}>
        <button
          onClick={() => setBekreftHandling({ nyStatus: "approved", label: t("handling.godkjenn") })}
          disabled={erLaster}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {t("handling.godkjenn")}
        </button>
        <button
          onClick={() => setBekreftHandling({ nyStatus: "rejected", label: t("handling.avvis") })}
          disabled={erLaster}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {t("handling.avvis")}
        </button>
        {sendElementer.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setÅpenMeny(!åpenMeny)}
              disabled={erLaster}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("handling.send")}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {åpenMeny && <DropdownMeny elementer={sendElementer} onVelg={velgMenyElement} />}
          </div>
        )}
      </div>
    );
  }

  // Received / In_progress / Rejected: Send ▾ (+ Avbryt for admin)
  if (["received", "in_progress", "rejected"].includes(status)) {
    const harFlereMottakere = sendElementer.filter((e) => !e.erSeparator).length > 1;
    const enesteMottaker = sendElementer.filter((e) => !e.erSeparator).length === 1
      ? sendElementer.find((e) => !e.erSeparator)
      : undefined;

    return (
      <div className="flex items-center gap-2" ref={menyRef}>
        <div className="relative">
          <div className="flex">
            <button
              onClick={() => {
                if (enesteMottaker && !erAdmin) {
                  velgMenyElement(enesteMottaker);
                } else {
                  setÅpenMeny(!åpenMeny);
                }
              }}
              disabled={erLaster}
              className={`${harFlereMottakere || erAdmin ? "rounded-l-lg" : "rounded-lg"} bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50`}
            >
              {erLaster ? t("statushandling.endrer") : t("handling.send")}
            </button>
            {(harFlereMottakere || erAdmin) && (
              <button
                onClick={() => setÅpenMeny(!åpenMeny)}
                disabled={erLaster}
                className="rounded-r-lg border-l border-blue-500 bg-sitedoc-primary px-1.5 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
          {åpenMeny && <DropdownMeny elementer={sendElementer} onVelg={velgMenyElement} />}
        </div>
      </div>
    );
  }

  // Approved / Closed: Lukk + Videresend
  if (["approved", "closed"].includes(status)) {
    return (
      <div className="flex items-center gap-2" ref={menyRef}>
        {status === "approved" && (
          <button
            onClick={() => setBekreftHandling({ nyStatus: "closed", label: t("handling.lukk") })}
            disabled={erLaster}
            className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("handling.lukk")}
          </button>
        )}
        {sendElementer.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setÅpenMeny(!åpenMeny)}
              disabled={erLaster}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("statushandling.videresend")}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {åpenMeny && <DropdownMeny elementer={sendElementer} onVelg={velgMenyElement} />}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Dropdown-meny                                                       */
/* ------------------------------------------------------------------ */

function DropdownMeny({
  elementer,
  onVelg,
}: {
  elementer: MenyElement[];
  onVelg: (element: MenyElement) => void;
}) {
  return (
    <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
      {elementer.map((e) => {
        if (e.erSeparator && e.erAdmin) {
          // Admin header
          return (
            <div key={e.key} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {e.label}
            </div>
          );
        }
        if (e.erSeparator) {
          return <div key={e.key} className="my-1 border-t border-gray-100" />;
        }
        return (
          <button
            key={e.key}
            onClick={() => onVelg(e)}
            className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 ${
              e.erDestruktiv ? "text-red-600" : e.erAdmin ? "text-gray-500" : "text-gray-700"
            }`}
          >
            {e.label}
          </button>
        );
      })}
    </div>
  );
}
