import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { trpc } from "../lib/trpc";

export interface Vedlegg {
  id: string;
  type: "bilde" | "fil";
  url: string;
  filnavn: string;
}

export interface FeltVerdi {
  verdi: unknown;
  kommentar: string;
  vedlegg: Vedlegg[];
}

interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
}

const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

// Typer som ikke har utfyllbar verdi
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

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
  erLagrer: boolean;
  harEndringer: boolean;
  erRedigerbar: boolean;
}

const REDIGERBARE_STATUSER = new Set(["draft", "received", "in_progress"]);

export function useSjekklisteSkjema(sjekklisteId: string): UseSjekklisteSkjemaResultat {
  const [feltVerdier, settFeltVerdier] = useState<Record<string, FeltVerdi>>({});
  const [valideringsfeil, settValideringsfeil] = useState<Record<string, string>>({});
  const [harEndringer, settHarEndringer] = useState(false);
  const [erInitialisert, settErInitialisert] = useState(false);
  const lagreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Initialiser feltVerdier fra sjekklistens data-JSON
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

  // Oppdater én nøkkel i et felt og planlegg auto-lagring
  const oppdaterFelt = useCallback(
    (objektId: string, oppdatering: Partial<FeltVerdi>) => {
      settFeltVerdier((prev) => ({
        ...prev,
        [objektId]: {
          ...(prev[objektId] ?? TOM_FELTVERDI),
          ...oppdatering,
        },
      }));
      settHarEndringer(true);

      // Auto-lagring med 2s debounce
      if (lagreTimerRef.current) clearTimeout(lagreTimerRef.current);
      lagreTimerRef.current = setTimeout(() => {
        lagreIntern();
      }, 2000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sjekklisteId],
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
      settHarEndringer(true);
    },
    [],
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
      settHarEndringer(true);
    },
    [],
  );

  // Betinget synlighet (Fase 9)
  const erSynlig = useCallback(
    (objekt: RapportObjekt): boolean => {
      const parentId = objekt.config.conditionParentId;
      if (!parentId || typeof parentId !== "string") return true;

      const forelder = alleObjekter.find((o) => o.id === parentId);
      if (!forelder?.config.conditionActive) return true;

      const triggerVerdier = (forelder.config.conditionValues as string[]) ?? [];
      const forelderVerdi = hentFeltVerdi(parentId).verdi;

      if (typeof forelderVerdi === "string") return triggerVerdier.includes(forelderVerdi);
      if (Array.isArray(forelderVerdi)) return forelderVerdi.some((v) => triggerVerdier.includes(v));
      return false;
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

  // Lagre til server
  const oppdaterDataMutasjon = trpc.sjekkliste.oppdaterData.useMutation();

  const lagreIntern = useCallback(async () => {
    if (!sjekklisteId) return;
    try {
      await oppdaterDataMutasjon.mutateAsync({
        id: sjekklisteId,
        data: feltVerdier,
      });
      settHarEndringer(false);
    } catch {
      // Feil ved lagring — bruker beholder lokale endringer
    }
  }, [sjekklisteId, feltVerdier, oppdaterDataMutasjon]);

  const lagre = useCallback(async () => {
    if (lagreTimerRef.current) {
      clearTimeout(lagreTimerRef.current);
      lagreTimerRef.current = null;
    }
    await lagreIntern();
  }, [lagreIntern]);

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
    erLagrer: oppdaterDataMutasjon.isPending,
    harEndringer,
    erRedigerbar,
  };
}
