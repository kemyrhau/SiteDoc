"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TFunction } from "i18next";
import type { ReportObjectType, TemplateZone } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import type { MalObjekt } from "./DraggbartFelt";

/**
 * Datalaget under MalBygger, parameterisert på NIVÅ (ordre malbygger-tre-nivaa, Krav 1).
 *
 * MalBygger-skjermbildet er identisk på alle nivåer; det eneste som skiller dem er hvilken
 * tRPC-router objekt-CRUD-en går mot. Denne hooken kapsler det: prosjektnivå → `trpc.mal.*`
 * (uendret oppførsel — referansen), firmanivå → `trpc.firmamal.*` (OrganizationTemplate).
 *
 * Hvorfor begge routerne instansieres: React-hooks kan ikke kalles betinget, så begge sett
 * `useMutation` opprettes og det aktive velges. En mutasjon er inert til `.mutate` — den
 * ubrukte koster ingenting (ingen nettverk). onSuccess/onError bakes her (som før, ikke
 * per-kall) så en nektet lagring/drag ALDRI blir stum (CLAUDE.md § endringsvern).
 *
 * PSI-oversettelse og firmamal-promotering (MalBygger :179-231) er IKKE her: de gir kun
 * mening på prosjektnivå og gates allerede av `psiModus`/`mal.projectId`. Kun det som
 * faktisk er nivå-felles (objekt-treet + fastefelt-metadata) parameteriseres.
 */

export type MalNivaa = "prosjekt" | "firma";

// Rå objekt-rad slik den kommer fra hentMedId / firmamal.hent (config er ukjent JSON).
export interface MalObjektRad {
  id: string;
  type: string;
  label: string;
  required: boolean;
  sortOrder: number;
  config: unknown;
  parentId: string | null;
}

export function tilMalObjekt(obj: MalObjektRad): MalObjekt {
  return {
    id: obj.id,
    type: obj.type,
    label: obj.label,
    required: obj.required,
    sortOrder: obj.sortOrder,
    config:
      typeof obj.config === "object" && obj.config !== null
        ? (obj.config as Record<string, unknown>)
        : {},
    parentId: obj.parentId ?? null,
  };
}

// Minimal mutasjons-form MalBygger trenger: utløser + ventestatus. Callbacks er bakt inn.
interface Muterbar<I> {
  mutate: (input: I) => void;
  isPending: boolean;
}

export interface LeggTilObjektInput {
  templateId: string;
  type: ReportObjectType;
  label: string;
  config: Record<string, unknown>;
  sortOrder: number;
  required: boolean;
  parentId: string | null;
}

export interface OppdaterObjektInput {
  id: string;
  label?: string;
  required?: boolean;
  config?: Record<string, unknown>;
  parentId?: string | null;
}

export interface OppdaterRekkefolgeInput {
  objekter: Array<{
    id: string;
    sortOrder: number;
    zone?: TemplateZone;
    parentId?: string | null;
  }>;
}

export interface OppdaterMalInput {
  id: string;
  name?: string;
  subjects?: string[];
  showSubject?: boolean;
  showLocation?: boolean;
  showPriority?: boolean;
}

export interface MalDatakilde {
  leggTilObjekt: Muterbar<LeggTilObjektInput>;
  slettObjekt: Muterbar<{ id: string }>;
  oppdaterRekkefolge: Muterbar<OppdaterRekkefolgeInput>;
  oppdaterObjekt: Muterbar<OppdaterObjektInput>;
  oppdaterMal: Muterbar<OppdaterMalInput>;
  /** Hent objekt-treet på nytt fra riktig router og skyv inn i lokal state. */
  refetch: () => Promise<void>;
}

interface DatakildeParams {
  nivaa: MalNivaa;
  malId: string;
  setObjekter: Dispatch<SetStateAction<MalObjekt[]>>;
  /** Rydd valgt-markering når det slettede objektet var valgt. */
  onSlettFullfort: (slettetId: string) => void;
  visFeil: (tittel: string, melding: string) => void;
  t: TFunction;
}

export function useMalDatakilde(params: DatakildeParams): MalDatakilde {
  const { nivaa, malId, setObjekter, onSlettFullfort, visFeil, t } = params;
  const erFirma = nivaa === "firma";
  const utils = trpc.useUtils();

  const refetch = useCallback(async () => {
    const oppdatert = erFirma
      ? await utils.firmamal.hent.fetch({ id: malId })
      : await utils.mal.hentMedId.fetch({ id: malId });
    if (oppdatert) {
      setObjekter((oppdatert.objects as MalObjektRad[]).map(tilMalObjekt));
    }
  }, [erFirma, malId, utils, setObjekter]);

  const invaliderMal = useCallback(() => {
    if (erFirma) {
      utils.firmamal.hent.invalidate({ id: malId });
      utils.firmamal.list.invalidate();
    } else {
      utils.mal.hentMedId.invalidate({ id: malId });
      utils.mal.hentForProsjekt.invalidate();
    }
  }, [erFirma, malId, utils]);

  // Callbacks er nivå-agnostiske (refetch/setObjekter/visFeil kjenner selv nivået).
  const refetchCb = { onSuccess: () => void refetch() };
  const slettCb = {
    onSuccess: (_data: unknown, variabler: { id: string }) => {
      setObjekter((prev) => prev.filter((o) => o.id !== variabler.id));
      onSlettFullfort(variabler.id);
    },
    onError: (feil: { message?: string }) => {
      visFeil(t("malbygger.slettFeiletTittel"), feil.message ?? t("malbygger.slettFeiletTittel"));
      void refetch();
    },
  };
  const endringVernCb = {
    onSuccess: () => void refetch(),
    onError: (feil: { message?: string }) => {
      visFeil(t("malbygger.endringSperretTittel"), feil.message ?? t("malbygger.endringSperretTittel"));
      void refetch();
    },
  };
  const rekkefolgeCb = {
    onError: (feil: { message?: string }) => {
      visFeil(t("malbygger.endringSperretTittel"), feil.message ?? t("malbygger.endringSperretTittel"));
      void refetch();
    },
  };
  const oppdaterMalCb = { onSuccess: () => invaliderMal() };

  // Begge routerne — det aktive nivået velges under. Ubrukt mutasjon er inert.
  const leggTilP = trpc.mal.leggTilObjekt.useMutation(refetchCb);
  const leggTilF = trpc.firmamal.leggTilObjekt.useMutation(refetchCb);
  const slettP = trpc.mal.slettObjekt.useMutation(slettCb);
  const slettF = trpc.firmamal.slettObjekt.useMutation(slettCb);
  const rekkefolgeP = trpc.mal.oppdaterRekkefølge.useMutation(rekkefolgeCb);
  const rekkefolgeF = trpc.firmamal.oppdaterRekkefolge.useMutation(rekkefolgeCb);
  const oppdaterObjektP = trpc.mal.oppdaterObjekt.useMutation(endringVernCb);
  const oppdaterObjektF = trpc.firmamal.oppdaterObjekt.useMutation(endringVernCb);
  const oppdaterMalP = trpc.mal.oppdaterMal.useMutation(oppdaterMalCb);
  const oppdaterMalF = trpc.firmamal.oppdater.useMutation(oppdaterMalCb);

  return {
    leggTilObjekt: (erFirma ? leggTilF : leggTilP) as unknown as Muterbar<LeggTilObjektInput>,
    slettObjekt: (erFirma ? slettF : slettP) as unknown as Muterbar<{ id: string }>,
    oppdaterRekkefolge: (erFirma ? rekkefolgeF : rekkefolgeP) as unknown as Muterbar<OppdaterRekkefolgeInput>,
    oppdaterObjekt: (erFirma ? oppdaterObjektF : oppdaterObjektP) as unknown as Muterbar<OppdaterObjektInput>,
    oppdaterMal: (erFirma ? oppdaterMalF : oppdaterMalP) as unknown as Muterbar<OppdaterMalInput>,
    refetch,
  };
}
