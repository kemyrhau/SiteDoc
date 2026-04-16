"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Building2,
  X,
  User,
  Users,
  UserPlus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

export interface DokumentflytMedlemData {
  id: string;
  rolle: string;
  steg: number;
  erHovedansvarlig?: boolean;
  faggruppe: { id: string; name: string; color: string | null } | null;
  projectMember: {
    id: string;
    user: { id: string; name: string | null; email: string };
  } | null;
  group: { id: string; name: string } | null;
}

export interface DokumentflytMalData {
  template: { id: string; name: string; category: string };
}

export interface DokumentflytData {
  id: string;
  name: string;
  faggruppeId: string | null;
  medlemmer: DokumentflytMedlemData[];
  maler: DokumentflytMalData[];
}

export interface FaggruppeItem {
  id: string;
  name: string;
  color: string | null;
}

export interface ProsjektMedlemItem {
  id: string;
  user: { name: string | null; email: string };
}

/* ------------------------------------------------------------------ */
/*  LeggTilMedlemDropdown                                               */
/* ------------------------------------------------------------------ */

export function LeggTilMedlemDropdown({
  dokumentflytId,
  prosjektId,
  rolle,
  steg,
  faggrupper,
  medlemmer,
  grupper,
  eksisterende,
  onLagtTil,
  onInviterNy,
}: {
  dokumentflytId: string;
  prosjektId: string;
  rolle: string;
  steg: number;
  faggrupper: FaggruppeItem[];
  medlemmer: ProsjektMedlemItem[];
  grupper?: Array<{ id: string; name: string }>;
  eksisterende: DokumentflytMedlemData[];
  onLagtTil: () => void;
  onInviterNy?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const leggTilMutation = trpc.dokumentflyt.leggTilMedlem.useMutation({
    onSuccess: () => {
      onLagtTil();
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const eksisterendeFaggruppeIder = new Set(
    eksisterende.filter((m) => m.faggruppe).map((m) => m.faggruppe!.id),
  );
  const eksisterendeMedlemIder = new Set(
    eksisterende.filter((m) => m.projectMember).map((m) => m.projectMember!.id),
  );
  const eksisterendeGruppeIder = new Set(
    eksisterende.filter((m) => m.group).map((m) => m.group!.id),
  );

  const tilgjengeligeFaggrupper = faggrupper.filter((e) => !eksisterendeFaggruppeIder.has(e.id));
  const tilgjengeligeMedlemmer = medlemmer.filter((m) => !eksisterendeMedlemIder.has(m.id));
  const tilgjengeligeGrupper = (grupper ?? []).filter((g) => !eksisterendeGruppeIder.has(g.id));

  const typedRolle = rolle as "registrator" | "bestiller" | "utforer" | "godkjenner";

  function leggTilFaggruppe(faggruppeId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, faggruppeId, rolle: typedRolle, steg });
  }

  function leggTilPerson(projectMemberId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, projectMemberId, rolle: typedRolle, steg });
  }

  function leggTilGruppe(groupId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, groupId, rolle: typedRolle, steg });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title={t("handling.leggTil")}
      >
        <Plus className="h-3 w-3" />
        <span>{t("handling.leggTil")}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
          {tilgjengeligeFaggrupper.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontakter.faggrupper")}
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeFaggrupper.map((ent) => (
              <button
                key={ent.id}
                onClick={() => leggTilFaggruppe(ent.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {ent.name}
              </button>
            ))}
          </div>

          {tilgjengeligeGrupper.length > 0 && (
            <div className="border-b border-t border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontakter.grupper")}
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeGrupper.map((g) => (
              <button
                key={g.id}
                onClick={() => leggTilGruppe(g.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Users className="h-3.5 w-3.5 text-blue-500" />
                {g.name}
              </button>
            ))}
          </div>

          {tilgjengeligeMedlemmer.length > 0 && (
            <div className="border-b border-t border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontakter.personer")}
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeMedlemmer.map((m) => (
              <button
                key={m.id}
                onClick={() => leggTilPerson(m.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate">{m.user.name ?? m.user.email}</div>
                  {m.user.name && (
                    <div className="truncate text-[11px] text-gray-400">{m.user.email}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100">
            <button
              onClick={() => {
                setOpen(false);
                if (onInviterNy) onInviterNy();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-sitedoc-primary hover:bg-blue-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t("dokumentflyt.inviterNyPerson")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  InviterNyMedlemModal                                                */
/* ------------------------------------------------------------------ */

export function InviterNyMedlemModal({
  open,
  onClose,
  prosjektId,
  dokumentflytId,
  rolle,
  steg,
  onFerdig,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  dokumentflytId: string;
  rolle: string;
  steg: number;
  onFerdig: () => void;
}) {
  const { t } = useTranslation();
  const [epost, setEpost] = useState("");
  const [fornavn, setFornavn] = useState("");
  const [etternavn, setEtternavn] = useState("");
  const [telefon, setTelefon] = useState("");

  const leggTilMedlemMutation = trpc.medlem.leggTil.useMutation();
  const leggTilDfMedlemMutation = trpc.dokumentflyt.leggTilMedlem.useMutation();

  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setEpost("");
    setFornavn("");
    setEtternavn("");
    setTelefon("");
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const erSending = leggTilMedlemMutation.isPending || leggTilDfMedlemMutation.isPending;

  async function handleInviter(e: React.FormEvent) {
    e.preventDefault();
    if (!epost.trim() || !fornavn.trim() || !etternavn.trim()) return;

    try {
      const nyttMedlem = await leggTilMedlemMutation.mutateAsync({
        projectId: prosjektId,
        email: epost.trim(),
        firstName: fornavn.trim(),
        lastName: etternavn.trim(),
        phone: telefon.trim() || undefined,
        role: "member",
        faggruppeIds: [],
      });

      if (nyttMedlem) {
        await leggTilDfMedlemMutation.mutateAsync({
          dokumentflytId,
          projectId: prosjektId,
          projectMemberId: nyttMedlem.id,
          rolle: rolle as "registrator" | "bestiller" | "utforer" | "godkjenner",
          steg,
        });
      }

      onFerdig();
      onClose();
    } catch (_err) {
      // Feilen vises via mutation.error
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("dokumentflyt.inviterNyPerson")}>
      <form onSubmit={handleInviter} className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          {t("dokumentflyt.inviterBeskrivelse")}
        </p>

        <Input
          label={t("dokumentflyt.epostadresse")}
          type="email"
          placeholder="navn@firma.no"
          value={epost}
          onChange={(e) => setEpost(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("dokumentflyt.fornavn")}
            value={fornavn}
            onChange={(e) => setFornavn(e.target.value)}
            required
          />
          <Input
            label={t("dokumentflyt.etternavn")}
            value={etternavn}
            onChange={(e) => setEtternavn(e.target.value)}
            required
          />
        </div>

        <Input
          label={t("dokumentflyt.telefonValgfritt")}
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
        />

        {leggTilMedlemMutation.error && (
          <p className="text-sm text-red-600">
            {leggTilMedlemMutation.error.message}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            loading={erSending}
            disabled={!epost.trim() || !fornavn.trim() || !etternavn.trim()}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("dokumentflyt.inviterOgLeggTil")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
