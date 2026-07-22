"use client";

// Kilde-drevet handlingsmeny (A-3a, 2026-07-17).
// Handlingssettet utledes fra `statusHandlinger.ts` (samme kilde som mobil),
// IKKE fra en lokal if-kjede. Primærhandlingen (`erPrimaer`) rendres som knapp;
// resten i nedtrekk. Handlinger brukeren ikke kan gjøre nå vises deaktivert med
// begrunnelse utledet fra kilden. Bekreftelse kreves kun for irreversible
// overganger (`closed`/`deleted`); alt annet er 1 klikk. Kommentar er en
// valgfri utvider, aldri et påkrevd steg.

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus } from "lucide-react";
import {
  hentStatusHandlinger,
  hentRolleFiltrertHandlinger,
  hentHandlingEierRoller,
  isValidStatusTransition,
  type StatusHandling,
  type DokumentflytRolle,
} from "@sitedoc/shared";
import { byggVideresendValg } from "@/lib/videresend-valg";
import type { DokumentflytData, FaggruppeData } from "@/lib/videresend-valg";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface FlytMedlem {
  id: string;
  rolle: string;
  steg: number;
  faggruppe: { id: string; name: string } | null;
  projectMember: { user: { id: string; name: string | null } } | null;
  group: { id: string; name: string } | null;
}

interface Mottaker {
  userId?: string;
  groupId?: string;
  dokumentflytId?: string;
}

interface DokumentHandlingsmenyProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string, mottaker?: Mottaker) => void;
  onSlett?: () => void;
  alleFaggrupper?: FaggruppeData[];
  dokumentflyter?: DokumentflytData[];
  templateId?: string | null;
  standardFaggruppeId?: string;
  minRolle?: DokumentflytRolle | null;
  /** Prosjektadmin / sitedoc_admin / firma-admin (fra hentMinFlytInfo.erAdmin) */
  erAdmin?: boolean;
  /** Dokumentflyt-medlemmer for posisjon-utledning */
  flytMedlemmer?: FlytMedlem[];
  /** Nåværende mottaker (bruker-ID) */
  recipientUserId?: string | null;
  /** Nåværende mottaker (gruppe-ID) */
  recipientGroupId?: string | null;
  /** Bestiller (oppretters bruker-ID) */
  bestillerUserId?: string;
  /** Tidspunkt da mottaker åpnet dokumentet */
  lestAvMottakerVed?: Date | string | null;
}

/* ------------------------------------------------------------------ */
/*  Flytposisjon-hjelpere                                              */
/* ------------------------------------------------------------------ */

interface Ledd {
  navn: string;
  gruppeIder: Set<string>;
  brukerIder: Set<string>;
  faggruppeIder: Set<string>;
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
      const faggruppe = medl.find((m) => m.faggruppe);
      const gruppe = medl.find((m) => m.group);
      const person = medl.find((m) => m.projectMember?.user?.name);

      const navn = faggruppe
        ? faggruppe.faggruppe!.name
        : gruppe
          ? gruppe.group!.name
          : person?.projectMember?.user?.name ?? "?";

      return {
        navn,
        steg,
        gruppeIder: new Set(medl.filter((m) => m.group).map((m) => m.group!.id)),
        brukerIder: new Set(medl.filter((m) => m.projectMember).map((m) => m.projectMember!.user.id)),
        faggruppeIder: new Set(medl.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id)),
      };
    });
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
/*  Meny-oppføring                                                     */
/* ------------------------------------------------------------------ */

type Plassering = "sekundær" | "send" | "overflow" | "deaktivert";

interface MenyOppforing {
  key: string;
  label: string;
  nyStatus: string;
  mottaker?: Mottaker;
  plassering: Plassering;
  begrunnelse?: string;
  erDestruktiv?: boolean;
}

/** Statusverdier som hører til admin/⋯-seksjonen når de IKKE er primærhandling */
const ADMIN_NY = new Set(["closed", "cancelled", "draft"]);

/** Primær-knappens fargeklasse basert på kildens `farge` */
const FARGE_KLASSE: Record<string, string> = {
  "bg-blue-600": "bg-sitedoc-primary hover:bg-blue-700",
  "bg-red-600": "bg-red-600 hover:bg-red-700",
  "bg-purple-600": "bg-purple-600 hover:bg-purple-700",
  "bg-green-600": "bg-green-600 hover:bg-green-700",
  "bg-amber-500": "bg-amber-500 hover:bg-amber-600",
  "bg-gray-500": "bg-gray-500 hover:bg-gray-600",
};

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                      */
/* ------------------------------------------------------------------ */

export function DokumentHandlingsmeny({
  status,
  erLaster,
  onEndreStatus,
  onSlett,
  alleFaggrupper,
  dokumentflyter,
  templateId,
  standardFaggruppeId,
  minRolle,
  erAdmin,
  flytMedlemmer,
  recipientUserId,
  recipientGroupId,
  bestillerUserId,
  lestAvMottakerVed,
}: DokumentHandlingsmenyProps) {
  const { t } = useTranslation();
  const [åpenMeny, setÅpenMeny] = useState(false);
  const [bekreft, setBekreft] = useState<{ nyStatus: string; mottaker?: Mottaker; label: string } | null>(null);
  const [visKommentar, setVisKommentar] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const menyRef = useRef<HTMLDivElement>(null);

  // Lukk nedtrekk ved klikk utenfor
  useEffect(() => {
    if (!åpenMeny) return;
    const lukk = (e: MouseEvent) => {
      if (menyRef.current && !menyRef.current.contains(e.target as Node)) setÅpenMeny(false);
    };
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpenMeny]);

  const videresendValg = useMemo(
    () => byggVideresendValg(alleFaggrupper ?? [], dokumentflyter ?? [], templateId),
    [alleFaggrupper, dokumentflyter, templateId],
  );

  const ledd = useMemo(() => byggLedd(flytMedlemmer ?? []), [flytMedlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId),
    [ledd, status, recipientUserId, recipientGroupId, bestillerUserId],
  );
  const harFlyt = ledd.length > 0;
  const erSisteBoks = harFlyt && aktivtIndex === ledd.length - 1;

  // Kilde: aktive handlinger + hele universet (for deaktiverte).
  // Uten dokumentflyt finnes ingen rollestruktur — serveren bypasser `verifiserFlytRolle`
  // for dokumenter uten `dokumentflytId`, så klienten tilbyr da hele (statusmaskin-lovlige) settet.
  const alle = useMemo(() => hentStatusHandlinger(status), [status]);
  const aktive = useMemo(
    () => (harFlyt ? hentRolleFiltrertHandlinger(status, minRolle ?? null, erAdmin ?? false) : alle),
    [harFlyt, status, minRolle, erAdmin, alle],
  );

  // Standard-mottaker (utfører-faggruppen) for «besvar»-overgangen
  const mottakerForStandard = (): Mottaker | undefined => {
    const std = standardFaggruppeId
      ? videresendValg.find((v) => v.faggruppeId === standardFaggruppeId)
      : undefined;
    return std?.mottaker ? { ...std.mottaker, dokumentflytId: std.dokumentflytId } : undefined;
  };

  /* --- Begrunnelse for en deaktivert handling (utledet fra kilden) --- */
  const begrunnelseFor = (h: StatusHandling): string => {
    if (status === "closed") return t("statushandling.laast.lukket");
    const erMeta = h.nyStatus === "forwarded" || h.nyStatus === "deleted";
    if (!erMeta && !isValidStatusTransition(status, h.nyStatus)) return t("statushandling.laast.ugyldig");
    const eiere = hentHandlingEierRoller(status, h.nyStatus);
    if (eiere.length === 0) return t("statushandling.laast.admin");
    const r = eiere[0];
    return t(
      r === "bestiller"
        ? "statushandling.laast.avsender"
        : r === "utforer"
          ? "statushandling.laast.utforer"
          : "statushandling.laast.godkjenner",
    );
  };

  /* ------------------------------------------------------------------ */
  /*  Bygg oppføringer fra kilden                                        */
  /* ------------------------------------------------------------------ */

  const primærHandling = aktive.find((h) => h.erPrimaer) ?? null;

  // Recipient-oppføringer (draft-send eller videresend) fra videresendValg
  const recipientOppforinger = (nyStatus: string, prefix: string): MenyOppforing[] =>
    videresendValg.map((v) => ({
      key: `${prefix}-${v.key}`,
      label: v.visningsnavn,
      nyStatus,
      mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined,
      plassering: "send" as const,
    }));

  // Send-seksjon: draft → send til faggruppe; ellers → videresend (forwarded)
  const draftSend = status === "draft" && primærHandling?.nyStatus === "sent";
  const harForwarded = aktive.some((h) => h.nyStatus === "forwarded");
  const sendOppforinger: MenyOppforing[] = draftSend
    ? recipientOppforinger("sent", "send")
    : harForwarded
      ? recipientOppforinger("forwarded", "fwd")
      : [];

  // Sekundær-knapper: aktive (minus primær), ikke forwarded, ikke admin-status
  const sekundærKnapper: MenyOppforing[] = aktive
    .filter((h) => h !== primærHandling && h.nyStatus !== "forwarded" && !ADMIN_NY.has(h.nyStatus))
    .map((h) => ({
      key: `sek-${h.nyStatus}`,
      label: t(h.tekstNoekkel),
      nyStatus: h.nyStatus,
      plassering: "sekundær" as const,
      erDestruktiv: h.nyStatus === "deleted" || h.nyStatus === "rejected",
    }));

  // Overflow (⋯): aktive admin-status som IKKE er primær (lukk/trekk tilbake/gjenåpne når sekundær)
  const overflowOppforinger: MenyOppforing[] = aktive
    .filter((h) => h !== primærHandling && ADMIN_NY.has(h.nyStatus) && h.nyStatus !== "forwarded")
    .map((h) => ({
      key: `adm-${h.nyStatus}`,
      label: t(h.tekstNoekkel),
      nyStatus: h.nyStatus,
      plassering: "overflow" as const,
      erDestruktiv: h.nyStatus === "cancelled",
    }));

  // Deaktiverte: finnes i universet, men ikke tilgjengelig for denne rollen/statusen
  const aktiveNy = new Set(aktive.map((h) => h.nyStatus));
  const deaktiverteOppforinger: MenyOppforing[] = alle
    .filter((h) => !aktiveNy.has(h.nyStatus))
    .map((h) => ({
      key: `deakt-${h.nyStatus}`,
      label: t(h.tekstNoekkel),
      nyStatus: h.nyStatus,
      plassering: "deaktivert" as const,
      begrunnelse: begrunnelseFor(h),
    }));

  const dropdownHarInnhold =
    sendOppforinger.length > 0 || overflowOppforinger.length > 0 || deaktiverteOppforinger.length > 0;

  /* ------------------------------------------------------------------ */
  /*  Handlinger                                                         */
  /* ------------------------------------------------------------------ */

  const trengerBekreft = (nyStatus: string) => nyStatus === "closed" || nyStatus === "deleted";

  const utfor = (nyStatus: string, mottaker?: Mottaker) => {
    if (nyStatus === "deleted") {
      onSlett?.();
    } else {
      onEndreStatus(nyStatus, kommentar.trim() || undefined, mottaker);
    }
    setBekreft(null);
    setKommentar("");
    setVisKommentar(false);
    setÅpenMeny(false);
  };

  const klikk = (o: { nyStatus: string; mottaker?: Mottaker; label: string }) => {
    setÅpenMeny(false);
    if (trengerBekreft(o.nyStatus)) {
      setBekreft({ nyStatus: o.nyStatus, mottaker: o.mottaker, label: o.label });
      return;
    }
    utfor(o.nyStatus, o.mottaker);
  };

  // Primærknapp-klikk: draft-send med flere mottakere → åpne nedtrekk; ellers utfør
  const klikkPrimær = () => {
    if (!primærHandling) return;
    if (draftSend) {
      const v = videresendValg[0];
      if (videresendValg.length === 1 && v) {
        utfor("sent", v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined);
      } else if (videresendValg.length === 0) {
        utfor("sent"); // ingen flyt → server utleder
      } else {
        setÅpenMeny((å) => !å);
      }
      return;
    }
    const mottaker = primærHandling.nyStatus === "responded" ? (erSisteBoks ? undefined : mottakerForStandard()) : undefined;
    klikk({ nyStatus: primærHandling.nyStatus, mottaker, label: t(primærHandling.tekstNoekkel) });
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  // Lesevisning — bruker uten rolle i en flyt
  if (minRolle === null && harFlyt) {
    return <span className="text-xs text-gray-400 italic">{t("bunnbar.lesevisning")}</span>;
  }

  // Ingenting å vise (f.eks. terminal `closed` uten deaktiverte)
  if (!primærHandling && sekundærKnapper.length === 0 && !dropdownHarInnhold) {
    return null;
  }

  // Bekreftelse-modus (kun closed/deleted)
  if (bekreft) {
    const erTrekkTilbake = bekreft.nyStatus === "cancelled";
    const mottakerHarLest = erTrekkTilbake && lestAvMottakerVed != null;
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
        {mottakerHarLest && (
          <span className="text-xs text-amber-600 font-medium shrink-0">{t("statushandling.mottakerHarLest")}</span>
        )}
        <span className="text-sm text-gray-500 shrink-0">
          {t("statushandling.bekreftHandling", { handling: bekreft.label })}
        </span>
        <input
          type="text"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") utfor(bekreft.nyStatus, bekreft.mottaker); }}
          placeholder={t("statushandling.valgfriKommentar")}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-full sm:w-48"
          autoFocus
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => utfor(bekreft.nyStatus, bekreft.mottaker)}
            disabled={erLaster}
            className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {erLaster ? t("statushandling.endrer") : t("handling.bekreft")}
          </button>
          <button
            onClick={() => { setBekreft(null); setKommentar(""); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t("handling.avbryt")}
          </button>
        </div>
      </div>
    );
  }

  const primærFarge = primærHandling ? FARGE_KLASSE[primærHandling.farge] ?? "bg-sitedoc-primary hover:bg-blue-700" : "";

  return (
    <div className="flex flex-wrap items-center gap-2" ref={menyRef}>
      {/* Primærhandling som knapp (+ split-▾ ved draft-send med flere mottakere) */}
      {primærHandling && (
        <div className="relative flex">
          <button
            onClick={klikkPrimær}
            disabled={erLaster}
            className={`px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              draftSend && videresendValg.length > 1 ? "rounded-l-lg" : "rounded-lg"
            } ${primærFarge}`}
          >
            {erLaster ? t("statushandling.endrer") : t(primærHandling.tekstNoekkel)}
          </button>
          {draftSend && videresendValg.length > 1 && (
            <button
              onClick={() => setÅpenMeny((å) => !å)}
              disabled={erLaster}
              className={`rounded-r-lg border-l border-blue-500 px-1.5 py-1.5 text-white disabled:opacity-50 ${primærFarge}`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Sekundær-knapper */}
      {sekundærKnapper.map((o) => (
        <button
          key={o.key}
          onClick={() => klikk(o)}
          disabled={erLaster}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            o.erDestruktiv
              ? "border-red-300 text-red-600 hover:bg-red-50"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}

      {/* Nedtrekk: send-mottakere + admin + deaktiverte */}
      {dropdownHarInnhold && !(draftSend && videresendValg.length > 1) && (
        <div className="relative">
          <button
            onClick={() => setÅpenMeny((å) => !å)}
            disabled={erLaster}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {harForwarded && !draftSend ? t("handling.send") : t("statushandling.admin")}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {åpenMeny && dropdownHarInnhold && (
        <DropdownMeny
          send={sendOppforinger}
          overflow={overflowOppforinger}
          deaktivert={deaktiverteOppforinger}
          onVelg={klikk}
          adminLabel={t("statushandling.admin")}
        />
      )}

      {/* Kommentar-utvider — alltid tilgjengelig, aldri påkrevd */}
      {(primærHandling || sekundærKnapper.length > 0) && (
        visKommentar ? (
          <input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder={t("statushandling.valgfriKommentar")}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-40"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setVisKommentar(true)}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            <Plus className="h-3 w-3" />
            {t("statushandling.leggTilKommentar")}
          </button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nedtrekk                                                            */
/* ------------------------------------------------------------------ */

function DropdownMeny({
  send,
  overflow,
  deaktivert,
  onVelg,
  adminLabel,
}: {
  send: MenyOppforing[];
  overflow: MenyOppforing[];
  deaktivert: MenyOppforing[];
  onVelg: (o: MenyOppforing) => void;
  adminLabel: string;
}) {
  return (
    <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
      {send.map((o) => (
        <button
          key={o.key}
          onClick={() => onVelg(o)}
          className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
        >
          {o.label}
        </button>
      ))}

      {overflow.length > 0 && (
        <>
          {send.length > 0 && <div className="my-1 border-t border-gray-100" />}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{adminLabel}</div>
          {overflow.map((o) => (
            <button
              key={o.key}
              onClick={() => onVelg(o)}
              className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                o.erDestruktiv ? "text-red-600" : "text-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </>
      )}

      {deaktivert.length > 0 && (
        <>
          {(send.length > 0 || overflow.length > 0) && <div className="my-1 border-t border-gray-100" />}
          {deaktivert.map((o) => (
            <div
              key={o.key}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-gray-300"
              title={o.begrunnelse}
            >
              <span className="line-through">{o.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{o.begrunnelse}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
