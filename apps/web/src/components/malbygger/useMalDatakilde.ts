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

export type MalNivaa = "prosjekt" | "firma" | "sitedoc";

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

// TS2589-vakt (CLAUDE.md § Kodestil): en ternær `erFirma ? firmaMut : prosjektMut` tvinger
// TS til å beregne UNIONEN av DYPE tRPC-mutasjonstyper FØR castet virker — det sprenger
// dybdegrensen på en KALD bygg (Docker; inkrementell `tsbuildinfo` skjulte det lokalt). Med
// tre nivåer er en tre-veis ternær samme felle, bare verre. Løsning (ordre malbygger-sitedoc-
// niva): et oppslagsobjekt der HVER gren er `unknown` på funksjonsgrensen — de dype typene
// erstattes FØR de kan forenes, og castet gir den smale typen. Ingen `any`, ingen union.
function velgMutasjon<I>(nivaa: MalNivaa, valg: Record<MalNivaa, unknown>): Muterbar<I> {
  return valg[nivaa] as Muterbar<I>;
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
  const utils = trpc.useUtils();

  const refetch = useCallback(async () => {
    // Samme TS2589-vakt som velgMutasjon: hver fetch castes til `Promise<unknown>` FØR den
    // returneres, ellers forenes dype query-resultat-typer og dybdegrensen sprenger (kald bygg).
    // if/else-kjede (ikke ternær) så ingen union av grenene beregnes.
    let hentet: Promise<unknown>;
    if (nivaa === "firma") hentet = utils.firmamal.hent.fetch({ id: malId }) as Promise<unknown>;
    else if (nivaa === "sitedoc") hentet = utils.bibliotek.hent.fetch({ id: malId }) as Promise<unknown>;
    else hentet = utils.mal.hentMedId.fetch({ id: malId }) as Promise<unknown>;
    const oppdatert = await hentet;
    if (oppdatert) {
      const rader = (oppdatert as { objects: MalObjektRad[] }).objects;
      setObjekter(rader.map(tilMalObjekt));
    }
  }, [nivaa, malId, utils, setObjekter]);

  const invaliderMal = useCallback(() => {
    if (nivaa === "firma") {
      utils.firmamal.hent.invalidate({ id: malId });
      utils.firmamal.list.invalidate();
    } else if (nivaa === "sitedoc") {
      utils.bibliotek.hent.invalidate({ id: malId });
      utils.bibliotek.hentStandarder.invalidate();
    } else {
      utils.mal.hentMedId.invalidate({ id: malId });
      utils.mal.hentForProsjekt.invalidate();
    }
  }, [nivaa, malId, utils]);

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
  // Sitedoc-nivå (vei C del 2): objekt-CRUD mot BibliotekMalObjekt via bibliotek.*.
  const leggTilB = trpc.bibliotek.leggTilObjekt.useMutation(refetchCb);
  const slettB = trpc.bibliotek.slettObjekt.useMutation(slettCb);
  const rekkefolgeB = trpc.bibliotek.oppdaterRekkefolge.useMutation(rekkefolgeCb);
  const oppdaterObjektB = trpc.bibliotek.oppdaterObjekt.useMutation(endringVernCb);
  const oppdaterMalB = trpc.bibliotek.oppdater.useMutation(oppdaterMalCb);

  return {
    leggTilObjekt: velgMutasjon<LeggTilObjektInput>(nivaa, { prosjekt: leggTilP, firma: leggTilF, sitedoc: leggTilB }),
    slettObjekt: velgMutasjon<{ id: string }>(nivaa, { prosjekt: slettP, firma: slettF, sitedoc: slettB }),
    oppdaterRekkefolge: velgMutasjon<OppdaterRekkefolgeInput>(nivaa, { prosjekt: rekkefolgeP, firma: rekkefolgeF, sitedoc: rekkefolgeB }),
    oppdaterObjekt: velgMutasjon<OppdaterObjektInput>(nivaa, { prosjekt: oppdaterObjektP, firma: oppdaterObjektF, sitedoc: oppdaterObjektB }),
    oppdaterMal: velgMutasjon<OppdaterMalInput>(nivaa, { prosjekt: oppdaterMalP, firma: oppdaterMalF, sitedoc: oppdaterMalB }),
    refetch,
  };
}
