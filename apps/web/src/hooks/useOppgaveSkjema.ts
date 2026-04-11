"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { FeltVerdi, Vedlegg, RapportObjekt } from "@/components/rapportobjekter/typer";
import { TOM_FELTVERDI } from "@/components/rapportobjekter/typer";
import { utledDokumentRettighet } from "@sitedoc/shared";
import type { DokumentRettighet, DokumentflytRolle } from "@sitedoc/shared";

type LagreStatus = "idle" | "lagrer" | "lagret" | "feil";

const DISPLAY_TYPER = new Set(["heading", "subtitle"]);
// Fallback for bakoverkompatibilitet (brukes når rettighetInput ikke er gitt)
const REDIGERBARE_STATUSER = new Set(["draft", "received", "in_progress"]);

/** Rettighetsinfo fra detaljsiden — valgfri for bakoverkompatibilitet */
export interface RettighetInput {
  erAdmin: boolean;
  minRolle: DokumentflytRolle | null | undefined;
  tillatelser: Set<string>;
  harBallen: boolean;
}

export interface UseOppgaveSkjemaResultat {
  oppgave: {
    id: string;
    title: string;
    status: string;
    description: string | null;
    priority: string;
    bestillerEnterpriseId: string;
    utforerEnterpriseId: string;
    template: {
      id: string;
      name: string;
      prefix: string | null;
      objects: RapportObjekt[];
    } | null;
    bestillerEnterprise: { id: string; name: string } | null;
    utforerEnterprise: { id: string; name: string } | null;
    number: number | null;
  } | undefined;
  erLaster: boolean;
  hentFeltVerdi: (objektId: string) => FeltVerdi;
  settVerdi: (objektId: string, verdi: unknown) => void;
  settKommentar: (objektId: string, kommentar: string) => void;
  leggTilVedlegg: (objektId: string, vedlegg: Vedlegg) => void;
  fjernVedlegg: (objektId: string, vedleggId: string) => void;
  erSynlig: (objekt: RapportObjekt) => boolean;
  /** Append-only: felt med eksisterende verdi er låst for verdi-endring */
  erFeltLåst: (objektId: string) => boolean;
  valideringsfeil: Record<string, string>;
  valider: () => boolean;
  lagre: () => Promise<void>;
  erRedigerbar: boolean;
  /** Detaljert rettighet: admin / redigerer / leser */
  rettighet: DokumentRettighet;
  lagreStatus: LagreStatus;
}

export function useOppgaveSkjema(oppgaveId: string, rettighetInput?: RettighetInput): UseOppgaveSkjemaResultat {
  const [feltVerdier, settFeltVerdier] = useState<Record<string, FeltVerdi>>({});
  const [valideringsfeil, settValideringsfeil] = useState<Record<string, string>>({});
  const [erInitialisert, settErInitialisert] = useState(false);
  const [lagreStatus, settLagreStatus] = useState<LagreStatus>("idle");
  const lagreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feltVerdierRef = useRef(feltVerdier);
  feltVerdierRef.current = feltVerdier;

  // Append-only: felt som hadde verdier fra server er låst for verdi-endring
  const låsteFelterRef = useRef<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const slettBildeMutation = trpc.bilde.slettMedUrl.useMutation();

  const oppgaveQuery = trpc.oppgave.hentMedId.useQuery(
    { id: oppgaveId },
    { enabled: !!oppgaveId },
  );

  const oppgave = oppgaveQuery.data as UseOppgaveSkjemaResultat["oppgave"] & {
    data: Record<string, unknown> | null;
  } | undefined;

  const alleObjekter = useMemo(
    () => (oppgave?.template?.objects ?? []) as RapportObjekt[],
    [oppgave],
  );

  useEffect(() => {
    if (!oppgave || erInitialisert) return;

    const eksisterendeData = (oppgave.data ?? {}) as Record<string, Record<string, unknown>>;
    const initialisert: Record<string, FeltVerdi> = {};
    const låste = new Set<string>();

    for (const objekt of alleObjekter) {
      if (DISPLAY_TYPER.has(objekt.type)) continue;

      const lagret = eksisterendeData[objekt.id];
      if (lagret) {
        initialisert[objekt.id] = {
          verdi: lagret.verdi ?? null,
          kommentar: (lagret.kommentar as string) ?? "",
          vedlegg: (lagret.vedlegg as Vedlegg[]) ?? [],
        };

        // Append-only: lås felt som allerede har verdi (ikke tom/null)
        const v = lagret.verdi;
        if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
          låste.add(objekt.id);
        }
      } else {
        initialisert[objekt.id] = { ...TOM_FELTVERDI };
      }
    }

    låsteFelterRef.current = låste;
    settFeltVerdier(initialisert);
    settErInitialisert(true);
  }, [oppgave, alleObjekter, erInitialisert]);

  const hentFeltVerdi = useCallback(
    (objektId: string): FeltVerdi => feltVerdier[objektId] ?? TOM_FELTVERDI,
    [feltVerdier],
  );

  const oppdaterDataMutasjon = trpc.oppgave.oppdaterData.useMutation();

  const lagreIntern = useCallback(async () => {
    if (!oppgaveId) return;

    const data = feltVerdierRef.current;
    settLagreStatus("lagrer");

    try {
      await oppdaterDataMutasjon.mutateAsync({ id: oppgaveId, data });
      await utils.oppgave.hentMedId.invalidate({ id: oppgaveId });
      settLagreStatus("lagret");

      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 2000);
    } catch {
      settLagreStatus("feil");
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 3000);
    }
  }, [oppgaveId, oppdaterDataMutasjon, utils]);

  const planleggLagring = useCallback(() => {
    if (lagreTimerRef.current) clearTimeout(lagreTimerRef.current);
    lagreTimerRef.current = setTimeout(() => {
      lagreIntern();
    }, 2000);
  }, [lagreIntern]);

  const lagre = useCallback(async () => {
    if (lagreTimerRef.current) {
      clearTimeout(lagreTimerRef.current);
      lagreTimerRef.current = null;
    }
    await lagreIntern();
  }, [lagreIntern]);

  const oppdaterFelt = useCallback(
    (objektId: string, oppdatering: Partial<FeltVerdi>) => {
      settFeltVerdier((prev) => ({
        ...prev,
        [objektId]: {
          ...(prev[objektId] ?? TOM_FELTVERDI),
          ...oppdatering,
        },
      }));
      planleggLagring();
    },
    [planleggLagring],
  );

  // Append-only: sjekk om felt er låst for verdi-endring
  const erFeltLåst = useCallback(
    (objektId: string): boolean => låsteFelterRef.current.has(objektId),
    [],
  );

  const settVerdi = useCallback(
    (objektId: string, verdi: unknown) => {
      // Append-only: blokker endring av felt som allerede har verdi
      if (låsteFelterRef.current.has(objektId)) return;
      oppdaterFelt(objektId, { verdi });
    },
    [oppdaterFelt],
  );

  const settKommentar = useCallback(
    (objektId: string, kommentar: string) => oppdaterFelt(objektId, { kommentar }),
    [oppdaterFelt],
  );

  const leggTilVedlegg = useCallback(
    (objektId: string, vedlegg: Vedlegg) => {
      settFeltVerdier((prev) => {
        const nåværende = prev[objektId] ?? TOM_FELTVERDI;
        return {
          ...prev,
          [objektId]: {
            ...nåværende,
            vedlegg: [...nåværende.vedlegg, vedlegg],
          },
        };
      });
      planleggLagring();
    },
    [planleggLagring],
  );

  const fjernVedlegg = useCallback(
    (objektId: string, vedleggId: string) => {
      // Finn vedleggets URL før fjerning for å slette fra images-tabellen
      const vedleggListe = feltVerdierRef.current[objektId]?.vedlegg ?? [];
      const vedlegg = vedleggListe.find((v) => v.id === vedleggId);

      settFeltVerdier((prev) => {
        const nåværende = prev[objektId] ?? TOM_FELTVERDI;
        return {
          ...prev,
          [objektId]: {
            ...nåværende,
            vedlegg: nåværende.vedlegg.filter((v) => v.id !== vedleggId),
          },
        };
      });
      planleggLagring();

      // Slett fra images-tabellen i bakgrunnen
      if (vedlegg?.url && oppgave?.bestillerEnterpriseId) {
        const projectId = (oppgave as unknown as { template?: { projectId?: string } })?.template?.projectId;
        if (projectId) {
          slettBildeMutation.mutate({ fileUrl: vedlegg.url, projectId });
        }
      }
    },
    [planleggLagring, oppgave, slettBildeMutation],
  );

  // Betinget synlighet (rekursiv — sjekker hele foreldrekjeden, maks 10 nivåer)
  const erSynlig = useCallback(
    (objekt: RapportObjekt): boolean => {
      function sjekkSynlighet(obj: RapportObjekt, dybde: number): boolean {
        if (dybde > 10) return true; // Sikkerhetsvakt mot uendelig rekursjon

        const parentId = obj.parentId ?? (obj.config.conditionParentId as string | undefined);
        if (!parentId) return true;

        const forelder = alleObjekter.find((o) => o.id === parentId);
        if (!forelder) return true;

        if (!sjekkSynlighet(forelder, dybde + 1)) return false;
        if (forelder.type === "repeater") return true;
        if (!forelder.config.conditionActive) return true;

        const triggerVerdier = (forelder.config.conditionValues as string[]) ?? [];
        const forelderVerdi = hentFeltVerdi(parentId).verdi;

        if (typeof forelderVerdi === "string") return triggerVerdier.includes(forelderVerdi);
        if (Array.isArray(forelderVerdi)) return forelderVerdi.some((v) => triggerVerdier.includes(v));
        return false;
      }
      return sjekkSynlighet(objekt, 0);
    },
    [alleObjekter, hentFeltVerdi],
  );

  const valider = useCallback((): boolean => {
    const feil: Record<string, string> = {};

    for (const objekt of alleObjekter) {
      if (DISPLAY_TYPER.has(objekt.type)) continue;
      if (!erSynlig(objekt)) continue;
      if (!objekt.required) continue;

      const feltVerdi = hentFeltVerdi(objekt.id);
      const verdi = feltVerdi.verdi;

      if (verdi === null || verdi === undefined || verdi === "") {
        feil[objekt.id] = "Dette feltet er påkrevd";
      } else if (Array.isArray(verdi) && verdi.length === 0) {
        feil[objekt.id] = "Velg minst ett alternativ";
      }
    }

    settValideringsfeil(feil);
    return Object.keys(feil).length === 0;
  }, [alleObjekter, erSynlig, hentFeltVerdi]);

  // Rettighet: bruker ny funksjon hvis rettighetInput er gitt, ellers fallback til status-basert
  const rettighet: DokumentRettighet = useMemo(() => {
    if (!oppgave) return "leser";
    if (!rettighetInput) {
      // Fallback: gammel status-basert logikk (for bakoverkompatibilitet / mobil)
      return REDIGERBARE_STATUSER.has(oppgave.status) ? "redigerer" : "leser";
    }
    return utledDokumentRettighet({
      erAdmin: rettighetInput.erAdmin,
      minRolle: rettighetInput.minRolle,
      tillatelser: rettighetInput.tillatelser,
      status: oppgave.status,
      dokumentType: "oppgave",
      harBallen: rettighetInput.harBallen,
    });
  }, [oppgave, rettighetInput]);

  const erRedigerbar = rettighet !== "leser";

  return {
    oppgave: oppgave
      ? {
          id: oppgave.id,
          title: oppgave.title,
          status: oppgave.status,
          description: oppgave.description,
          priority: oppgave.priority,
          bestillerEnterpriseId: oppgave.bestillerEnterpriseId,
          utforerEnterpriseId: oppgave.utforerEnterpriseId,
          template: oppgave.template,
          bestillerEnterprise: oppgave.bestillerEnterprise,
          utforerEnterprise: oppgave.utforerEnterprise,
          number: oppgave.number,
        }
      : undefined,
    erLaster: oppgaveQuery.isLoading,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erSynlig,
    erFeltLåst,
    valideringsfeil,
    valider,
    lagre,
    erRedigerbar,
    rettighet,
    lagreStatus,
  };
}
