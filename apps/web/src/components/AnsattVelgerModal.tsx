"use client";

/**
 * AnsattVelgerModal — velg firmaets ansatte (og hele avdelinger) inn i et prosjekt
 * eller en dokumentflyt-rolle (ansattvelger-runden 2026-08-28).
 *
 * Gjenbrukt av to flater: prosjektmedlemmer (oppsett/brukere) og flyt-roller
 * (LeggTilMedlemDropdown). Modalen samler et sett userId-er og kaller `onBekreft`
 * — forelderen kobler til riktig batch-mutasjon og invalidering.
 *
 * Kun AKTIVE, brukbare ansatte er valgbare: datakilden (`hentLedigeFirmaBrukere`)
 * bruker den delte kandidatregelen (services/ansatt.ts), så en deaktivert person
 * dukker aldri opp her. Å legge til noen ER å gi tilgang → bekreftelsen sier hvor
 * mange (mikrotekst-standard), særlig ved avdelingsvalg.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Modal, Button, Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { Building2, User, UserPlus } from "lucide-react";

/** Rolle-nøkkel → i18n-tittel for merket «allerede i flyten». */
const ROLLE_TITTEL_NOEKKEL: Record<string, string> = {
  registrator: "dokumentflyt.registrator",
  bestiller: "dokumentflyt.bestiller",
  utforer: "dokumentflyt.utforer",
  godkjenner: "dokumentflyt.godkjenner",
};

export function AnsattVelgerModal({
  open,
  onClose,
  projectId,
  dokumentflytId,
  tittel,
  bekreftLabel,
  onBekreft,
  isPending,
  feilmelding,
  onInviterNy,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /**
   * Flyt-modus (Kenneth-vedtak 2026-08-28): når satt, listes ALLE aktive ansatte og de
   * som alt står i en rolle i denne flyten MERKES i stedet for å skjules. Uten den:
   * prosjektmedlem-flaten, som lister kun ikke-medlemmer (uendret).
   */
  dokumentflytId?: string;
  /** Modal-tittel (flatespesifikk, f.eks. «Legg til i prosjektet» / «… i rollen»). */
  tittel: string;
  /** Etikett på bekreft-knappen (uten tall — tallet legges på av modalen). */
  bekreftLabel: string;
  onBekreft: (userIds: string[]) => void;
  isPending: boolean;
  feilmelding?: string | null;
  /** Valgfri «Inviter ny person»-utgang (beholdes ved siden av velgeren). */
  onInviterNy?: () => void;
}) {
  const { t } = useTranslation();
  const [valgte, setValgte] = useState<Set<string>>(new Set());

  // Prosjektmedlem-flate: kun ikke-medlemmer. Flyt-flate: alle aktive, merket per rolle.
  const ledigeQuery = trpc.medlem.hentLedigeFirmaBrukere.useQuery(
    { projectId },
    { enabled: open && !dokumentflytId },
  );
  const flytQuery = trpc.dokumentflyt.hentFirmaBrukereForFlyt.useQuery(
    { projectId, dokumentflytId: dokumentflytId ?? "" },
    { enabled: open && !!dokumentflytId },
  );
  const ansatteQuery = dokumentflytId ? flytQuery : ledigeQuery;
  const avdelingerQuery = trpc.medlem.hentAvdelingerForProsjekt.useQuery(
    { projectId },
    { enabled: open },
  );

  const ansatte = useMemo(() => ansatteQuery.data ?? [], [ansatteQuery.data]);
  const ledigeIder = useMemo(() => new Set(ansatte.map((a) => a.id)), [ansatte]);

  // Nullstill valg når modalen åpnes.
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open !== forrigeOpen) {
    setForrigeOpen(open);
    if (open) setValgte(new Set());
  }

  // Avdelingens VALGBARE medlemmer = dens aktive medlemmer som ennå ikke er
  // prosjektmedlem (snitt med ledige-lista). Tomme avdelinger skjules.
  const avdelinger = useMemo(
    () =>
      (avdelingerQuery.data ?? [])
        .map((a) => ({
          id: a.id,
          navn: a.navn,
          valgbareIder: a.brukerIder.filter((id) => ledigeIder.has(id)),
        }))
        .filter((a) => a.valgbareIder.length > 0),
    [avdelingerQuery.data, ledigeIder],
  );

  const avdelingNavnById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of avdelingerQuery.data ?? []) m.set(a.id, a.navn);
    return m;
  }, [avdelingerQuery.data]);

  function togglePerson(userId: string) {
    setValgte((prev) => {
      const neste = new Set(prev);
      if (neste.has(userId)) neste.delete(userId);
      else neste.add(userId);
      return neste;
    });
  }

  function toggleAvdeling(valgbareIder: string[], alleValgt: boolean) {
    setValgte((prev) => {
      const neste = new Set(prev);
      for (const id of valgbareIder) {
        if (alleValgt) neste.delete(id);
        else neste.add(id);
      }
      return neste;
    });
  }

  const antall = valgte.size;
  const laster = ansatteQuery.isLoading || avdelingerQuery.isLoading;

  return (
    <Modal open={open} onClose={onClose} title={tittel}>
      <div className="flex flex-col gap-3">
        {laster ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : ansatte.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">
            {t("ansattvelger.ingenLedige")}
          </p>
        ) : (
          <>
            {/* Avdelinger — huk av hele avdelingen */}
            {avdelinger.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {t("ansattvelger.avdelinger")}
                </span>
                {avdelinger.map((a) => {
                  const alleValgt = a.valgbareIder.every((id) => valgte.has(id));
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={alleValgt}
                        onChange={() => toggleAvdeling(a.valgbareIder, alleValgt)}
                      />
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium text-gray-700">{a.navn}</span>
                      <span className="text-xs text-gray-400">
                        {t("ansattvelger.antallAnsatte", { antall: a.valgbareIder.length })}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Ansatte — flat liste, huk av enkeltvis */}
            <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {t("ansattvelger.ansatte")}
              </span>
              <div className="max-h-64 overflow-y-auto">
                {ansatte.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={valgte.has(b.id)}
                      onChange={() => togglePerson(b.id)}
                    />
                    <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-gray-800">{b.name ?? b.email}</span>
                        {((b as { flytRoller?: string[] }).flytRoller ?? []).map((r) => (
                          <span
                            key={r}
                            className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700"
                          >
                            {t(ROLLE_TITTEL_NOEKKEL[r] ?? r)}
                          </span>
                        ))}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">
                        {b.name ? b.email : null}
                        {b.avdelingId && avdelingNavnById.has(b.avdelingId)
                          ? `${b.name ? " · " : ""}${avdelingNavnById.get(b.avdelingId)}`
                          : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {onInviterNy && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onInviterNy();
            }}
            className="flex items-center gap-2 self-start text-sm text-sitedoc-primary hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("ansattvelger.inviterNyPerson")}
          </button>
        )}

        {feilmelding && <p className="text-sm text-sitedoc-error">{feilmelding}</p>}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">
            {antall > 0
              ? t("ansattvelger.girTilgangTil", { antall })
              : t("ansattvelger.ingenValgt")}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t("handling.avbryt")}
            </Button>
            <Button
              type="button"
              onClick={() => onBekreft([...valgte])}
              loading={isPending}
              disabled={antall === 0 || isPending}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              {bekreftLabel}
              {antall > 0 ? ` (${antall})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
