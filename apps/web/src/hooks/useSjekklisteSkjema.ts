"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { FeltVerdi, Vedlegg, RapportObjekt } from "@/components/rapportobjekter/typer";
import { TOM_FELTVERDI } from "@/components/rapportobjekter/typer";

type LagreStatus = "idle" | "lagrer" | "lagret" | "feil";

// Display-only typer som ikke har utfyllbar verdi
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

const REDIGERBARE_STATUSER = new Set(["draft", "received", "in_progress"]);

export interface UseSjekklisteSkjemaResultat {
  sjekkliste: {
    id: string;
    title: string;
    status: string;
    template: {
      id: string;
      name: string;
      prefix: string | null;
      objects: RapportObjekt[];
    };
    creatorEnterprise: { id: string; name: string } | null;
    responderEnterprise: { id: string; name: string } | null;
  } | undefined;
  erLaster: boolean;
  hentFeltVerdi: (objektId: string) => FeltVerdi;
  settVerdi: (objektId: string, verdi: unknown) => void;
  settKommentar: (objektId: string, kommentar: string) => void;
  leggTilVedlegg: (objektId: string, vedlegg: Vedlegg) => void;
  fjernVedlegg: (objektId: string, vedleggId: string) => void;
  erSynlig: (objekt: RapportObjekt) => boolean;
  valideringsfeil: Record<string, string>;
  valider: () => boolean;
  lagre: () => Promise<void>;
  erRedigerbar: boolean;
  lagreStatus: LagreStatus;
}

export function useSjekklisteSkjema(sjekklisteId: string): UseSjekklisteSkjemaResultat {
  const [feltVerdier, settFeltVerdier] = useState<Record<string, FeltVerdi>>({});
  const [valideringsfeil, settValideringsfeil] = useState<Record<string, string>>({});
  const [erInitialisert, settErInitialisert] = useState(false);
  const [lagreStatus, settLagreStatus] = useState<LagreStatus>("idle");
  const lagreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for å unngå stale closure i lagreIntern
  const feltVerdierRef = useRef(feltVerdier);
  feltVerdierRef.current = feltVerdier;

  const utils = trpc.useUtils();

  // Hent sjekklistedata
  const sjekklisteQuery = trpc.sjekkliste.hentMedId.useQuery(
    { id: sjekklisteId },
    { enabled: !!sjekklisteId },
  );

  // Cast for å unngå TS2589
  const sjekkliste = sjekklisteQuery.data as UseSjekklisteSkjemaResultat["sjekkliste"] & {
    data: Record<string, unknown> | null;
  } | undefined;

  const alleObjekter = useMemo(
    () => (sjekkliste?.template?.objects ?? []) as RapportObjekt[],
    [sjekkliste],
  );

  // Initialiser feltVerdier fra server-data
  useEffect(() => {
    if (!sjekkliste || erInitialisert) return;

    const eksisterendeData = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;
    const initialisert: Record<string, FeltVerdi> = {};

    for (const objekt of alleObjekter) {
      if (DISPLAY_TYPER.has(objekt.type)) continue;

      const lagret = eksisterendeData[objekt.id];
      if (lagret) {
        initialisert[objekt.id] = {
          verdi: lagret.verdi ?? null,
          kommentar: (lagret.kommentar as string) ?? "",
          vedlegg: (lagret.vedlegg as Vedlegg[]) ?? [],
        };
      } else {
        initialisert[objekt.id] = { ...TOM_FELTVERDI };
      }
    }

    settFeltVerdier(initialisert);
    settErInitialisert(true);
  }, [sjekkliste, alleObjekter, erInitialisert]);

  const hentFeltVerdi = useCallback(
    (objektId: string): FeltVerdi => feltVerdier[objektId] ?? TOM_FELTVERDI,
    [feltVerdier],
  );

  // Lagre til server
  const oppdaterDataMutasjon = trpc.sjekkliste.oppdaterData.useMutation();

  const lagreIntern = useCallback(async () => {
    if (!sjekklisteId) return;

    const data = feltVerdierRef.current;
    settLagreStatus("lagrer");

    try {
      await oppdaterDataMutasjon.mutateAsync({
        id: sjekklisteId,
        data,
      });
      await utils.sjekkliste.hentMedId.invalidate({ id: sjekklisteId });
      settLagreStatus("lagret");

      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 2000);
    } catch {
      settLagreStatus("feil");
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 3000);
    }
  }, [sjekklisteId, oppdaterDataMutasjon, utils]);

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

  // Oppdater ett felt og planlegg auto-lagring
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

  const settVerdi = useCallback(
    (objektId: string, verdi: unknown) => oppdaterFelt(objektId, { verdi }),
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
    },
    [planleggLagring],
  );

  // Rekursiv betinget synlighet (sjekker hele foreldrekjeden, maks 10 nivåer)
  const erSynlig = useCallback(
    (objekt: RapportObjekt): boolean => {
      function sjekkSynlighet(obj: RapportObjekt, dybde: number): boolean {
        if (dybde > 10) return true; // Sikkerhetsvakt mot uendelig rekursjon

        // Bruk parentId fra DB-kolonne (ny) med fallback til config (gammel)
        const parentId = obj.parentId ?? (obj.config.conditionParentId as string | undefined);
        if (!parentId) return true;

        const forelder = alleObjekter.find((o) => o.id === parentId);
        if (!forelder) return true; // Sikkerhets-fallback

        // Sjekk at forelderen selv er synlig (rekursivt)
        if (!sjekkSynlighet(forelder, dybde + 1)) return false;

        // Repeater-barn er alltid synlige (ingen betingelseslogikk)
        if (forelder.type === "repeater") return true;

        // Sjekk at forelderens betingelse er oppfylt
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

  // Validering
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

  const erRedigerbar = sjekkliste ? REDIGERBARE_STATUSER.has(sjekkliste.status) : false;

  return {
    sjekkliste: sjekkliste
      ? {
          id: sjekkliste.id,
          title: sjekkliste.title,
          status: sjekkliste.status,
          template: sjekkliste.template,
          creatorEnterprise: sjekkliste.creatorEnterprise,
          responderEnterprise: sjekkliste.responderEnterprise,
        }
      : undefined,
    erLaster: sjekklisteQuery.isLoading,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erSynlig,
    valideringsfeil,
    valider,
    lagre,
    erRedigerbar,
    lagreStatus,
  };
}
