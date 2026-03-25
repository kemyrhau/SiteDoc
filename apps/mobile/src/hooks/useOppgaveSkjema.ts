import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { trpc } from "../lib/trpc";
import { hentDatabase } from "../db/database";
import { oppgaveFeltdata } from "../db/schema";
import { useNettverk } from "../providers/NettverkProvider";
import { useOpplastingsKo } from "../providers/OpplastingsKoProvider";
import { useAuth } from "../providers/AuthProvider";
import type { Vedlegg, FeltVerdi } from "./useSjekklisteSkjema";

type LagreStatus = "idle" | "lagrer" | "lagret" | "feil";
type SynkStatus = "synkronisert" | "lokalt_lagret" | "synkroniserer";

interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
}

const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

// Typer som ikke har utfyllbar verdi
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

// Typer som kan auto-fylles
const AUTO_FILL_TYPER = new Set(["date", "date_time", "person", "company", "drawing_position"]);

export interface UseOppgaveSkjemaResultat {
  oppgave: {
    id: string;
    title: string;
    status: string;
    priority: string;
    description: string | null;
    number: number | null;
    template: {
      id: string;
      name: string;
      prefix: string | null;
      objects: RapportObjekt[];
    };
    creatorEnterprise: { id: string; name: string } | null;
    responderEnterprise: { id: string; name: string } | null;
    drawing?: { id: string; name: string; drawingNumber?: string | null } | null;
    checklist?: { id: string; number?: number | null; title: string; template?: { prefix?: string | null; name?: string | null } | null } | null;
  } | undefined;
  erLaster: boolean;
  hentFeltVerdi: (objektId: string) => FeltVerdi;
  settVerdi: (objektId: string, verdi: unknown) => void;
  settKommentar: (objektId: string, kommentar: string) => void;
  leggTilVedlegg: (objektId: string, vedlegg: Vedlegg) => void;
  fjernVedlegg: (objektId: string, vedleggId: string) => void;
  flyttVedlegg: (objektId: string, vedleggId: string, retning: "opp" | "ned") => void;
  erSynlig: (objekt: RapportObjekt) => boolean;
  valideringsfeil: Record<string, string>;
  valider: () => boolean;
  lagre: () => Promise<void>;
  erLagrer: boolean;
  harEndringer: boolean;
  erRedigerbar: boolean;
  lagreStatus: LagreStatus;
  synkStatus: SynkStatus;
}

const REDIGERBARE_STATUSER = new Set(["draft", "received", "in_progress"]);

// --- SQLite-hjelpere ---

function lesSQLiteFeltdata(oppgaveId: string): Record<string, FeltVerdi> | null {
  try {
    const db = hentDatabase();
    if (!db) return null;
    const rader = db
      .select()
      .from(oppgaveFeltdata)
      .where(eq(oppgaveFeltdata.oppgaveId, oppgaveId))
      .all();
    if (rader.length === 0) return null;
    return JSON.parse(rader[0]!.feltVerdier) as Record<string, FeltVerdi>;
  } catch {
    return null;
  }
}

function erSQLiteSynkronisert(oppgaveId: string): boolean {
  try {
    const db = hentDatabase();
    if (!db) return true;
    const rader = db
      .select({ erSynkronisert: oppgaveFeltdata.erSynkronisert })
      .from(oppgaveFeltdata)
      .where(eq(oppgaveFeltdata.oppgaveId, oppgaveId))
      .all();
    if (rader.length === 0) return true;
    return rader[0]!.erSynkronisert;
  } catch {
    return true;
  }
}

function skrivTilSQLite(
  oppgaveId: string,
  feltVerdier: Record<string, FeltVerdi>,
  synkronisert: boolean,
) {
  try {
    const db = hentDatabase();
    if (!db) return;
    const json = JSON.stringify(feltVerdier);
    const rader = db
      .select({ id: oppgaveFeltdata.id })
      .from(oppgaveFeltdata)
      .where(eq(oppgaveFeltdata.oppgaveId, oppgaveId))
      .all();

    if (rader.length > 0) {
      db.update(oppgaveFeltdata)
        .set({
          feltVerdier: json,
          erSynkronisert: synkronisert,
          sistEndretLokalt: Date.now(),
          ...(synkronisert ? { sistSynkronisert: Date.now() } : {}),
        })
        .where(eq(oppgaveFeltdata.id, rader[0]!.id))
        .run();
    } else {
      db.insert(oppgaveFeltdata)
        .values({
          id: randomUUID(),
          oppgaveId,
          feltVerdier: json,
          erSynkronisert: synkronisert,
          sistEndretLokalt: Date.now(),
          sistSynkronisert: synkronisert ? Date.now() : null,
        })
        .run();
    }
  } catch (feil) {
    console.warn("SQLite skriving feilet:", feil);
  }
}

export function useOppgaveSkjema(oppgaveId: string): UseOppgaveSkjemaResultat {
  const [feltVerdier, settFeltVerdier] = useState<Record<string, FeltVerdi>>({});
  const [valideringsfeil, settValideringsfeil] = useState<Record<string, string>>({});
  const [harEndringer, settHarEndringer] = useState(false);
  const [erInitialisert, settErInitialisert] = useState(false);
  const [lagreStatus, settLagreStatus] = useState<LagreStatus>("idle");
  const [synkStatus, settSynkStatus] = useState<SynkStatus>("synkronisert");
  const lagreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for å unngå stale closure i lagreIntern
  const feltVerdierRef = useRef(feltVerdier);
  feltVerdierRef.current = feltVerdier;

  const { erPaaNettet } = useNettverk();
  const { registrerCallback } = useOpplastingsKo();
  const { bruker } = useAuth();

  // tRPC utils for å invalidere query-cache etter lagring
  const utils = trpc.useUtils();

  // Hent oppgavedata
  const oppgaveQuery = trpc.oppgave.hentMedId.useQuery(
    { id: oppgaveId },
    { enabled: !!oppgaveId },
  );

  // Cast for å unngå TS2589
  const oppgave = oppgaveQuery.data as UseOppgaveSkjemaResultat["oppgave"] & {
    data: Record<string, unknown> | null;
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    creatorEnterpriseId?: string;
  } | undefined;

  const alleObjekter = useMemo(
    () => (oppgave?.template?.objects ?? []) as RapportObjekt[],
    [oppgave],
  );

  // Initialiser feltVerdier — SQLite først, så server, med auto-fill
  useEffect(() => {
    if (!oppgave || erInitialisert) return;

    const eksisterendeData = (oppgave.data ?? {}) as Record<string, Record<string, unknown>>;

    // Prøv SQLite først (instant, <10ms)
    const sqliteData = lesSQLiteFeltdata(oppgaveId);
    const sqliteSynkronisert = erSQLiteSynkronisert(oppgaveId);

    if (sqliteData && !sqliteSynkronisert) {
      // SQLite har usynkroniserte lokale endringer — bruk dem
      settFeltVerdier(sqliteData);
      settErInitialisert(true);
      settSynkStatus("lokalt_lagret");
      return;
    }

    // Bruk server-data (eller SQLite hvis synkronisert)
    const initialisert: Record<string, FeltVerdi> = {};
    const harServerData = Object.keys(eksisterendeData).length > 0;

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
        // Auto-fill for nye oppgaver uten eksisterende data
        let autoVerdi: unknown = null;

        if (!harServerData && AUTO_FILL_TYPER.has(objekt.type)) {
          switch (objekt.type) {
            case "date":
              autoVerdi = new Date().toISOString().split("T")[0];
              break;
            case "date_time":
              autoVerdi = new Date().toISOString();
              break;
            case "person":
              autoVerdi = bruker?.id ?? null;
              break;
            case "company":
              autoVerdi = oppgave.creatorEnterpriseId ?? null;
              break;
            case "drawing_position":
              if (oppgave.drawingId && oppgave.positionX != null && oppgave.positionY != null) {
                autoVerdi = {
                  drawingId: oppgave.drawingId,
                  positionX: oppgave.positionX,
                  positionY: oppgave.positionY,
                  drawingName: oppgave.drawing?.name ?? null,
                };
              }
              break;
          }
        }

        initialisert[objekt.id] = {
          verdi: autoVerdi,
          kommentar: "",
          vedlegg: [],
        };
      }
    }

    settFeltVerdier(initialisert);
    settErInitialisert(true);

    // Lagre til SQLite (synkronisert med server-data, eller lokalt_lagret med auto-fill)
    const harAutoFylt = !harServerData && alleObjekter.some(
      (o) => !DISPLAY_TYPER.has(o.type) && AUTO_FILL_TYPER.has(o.type) && initialisert[o.id]?.verdi != null,
    );
    skrivTilSQLite(oppgaveId, initialisert, !harAutoFylt);
    settSynkStatus(harAutoFylt ? "lokalt_lagret" : "synkronisert");
  }, [oppgave, alleObjekter, erInitialisert, oppgaveId, bruker?.id]);

  // Lytt på opplastingsfullføringer — oppdater vedlegg-URL i minnet
  useEffect(() => {
    const avregistrer = registrerCallback(
      (dokumentId, dokumentType, _objektId, vedleggId, serverUrl) => {
        if (dokumentType !== "oppgave" || dokumentId !== oppgaveId) return;

        settFeltVerdier((prev) => {
          const oppdatert = { ...prev };
          let endret = false;
          for (const feltId of Object.keys(oppdatert)) {
            const felt = oppdatert[feltId];
            if (!felt) continue;

            // Søk i toppnivå-vedlegg
            const vedleggIdx = felt.vedlegg.findIndex((v) => v.id === vedleggId);
            if (vedleggIdx >= 0) {
              oppdatert[feltId] = {
                ...felt,
                vedlegg: felt.vedlegg.map((v) =>
                  v.id === vedleggId ? { ...v, url: serverUrl } : v,
                ),
              };
              endret = true;
            }

            // Søk i repeater-data (nestet i verdi-arrayen)
            if (Array.isArray(felt.verdi)) {
              let repeaterEndret = false;
              const oppdatertRader = (felt.verdi as Record<string, { vedlegg?: Array<{ id: string; url: string }> }>[]).map((rad) => {
                const nyRad = { ...rad };
                for (const barnId of Object.keys(nyRad)) {
                  const barn = nyRad[barnId];
                  if (!barn?.vedlegg) continue;
                  const idx = barn.vedlegg.findIndex((v) => v.id === vedleggId);
                  if (idx >= 0) {
                    nyRad[barnId] = {
                      ...barn,
                      vedlegg: barn.vedlegg.map((v) =>
                        v.id === vedleggId ? { ...v, url: serverUrl } : v,
                      ),
                    };
                    repeaterEndret = true;
                  }
                }
                return nyRad;
              });
              if (repeaterEndret) {
                oppdatert[feltId] = { ...oppdatert[feltId]!, verdi: oppdatertRader };
                endret = true;
              }
            }
          }
          return endret ? oppdatert : prev;
        });
        // Trigger server-synk slik at oppdatert URL lagres i PostgreSQL
        planleggLagringRef.current?.();
      },
    );
    return avregistrer;
  }, [oppgaveId, registrerCallback]);

  const hentFeltVerdi = useCallback(
    (objektId: string): FeltVerdi => feltVerdier[objektId] ?? TOM_FELTVERDI,
    [feltVerdier],
  );

  // Lagre til server
  const oppdaterDataMutasjon = trpc.oppgave.oppdaterData.useMutation();

  const lagreIntern = useCallback(async () => {
    if (!oppgaveId) return;

    const data = feltVerdierRef.current;

    // 1. Skriv til SQLite umiddelbart (alltid suksess)
    skrivTilSQLite(oppgaveId, data, false);
    settLagreStatus("lagret");
    settSynkStatus("lokalt_lagret");

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 2000);

    // 2. Prøv server-sync hvis online
    if (erPaaNettet) {
      settSynkStatus("synkroniserer");
      try {
        await oppdaterDataMutasjon.mutateAsync({
          id: oppgaveId,
          data,
        });
        await utils.oppgave.hentMedId.invalidate({ id: oppgaveId });
        settHarEndringer(false);

        // Marker som synkronisert i SQLite
        skrivTilSQLite(oppgaveId, data, true);
        settSynkStatus("synkronisert");
      } catch {
        // Server feilet — data er trygg i SQLite
        settSynkStatus("lokalt_lagret");
      }
    }
  }, [oppgaveId, erPaaNettet, oppdaterDataMutasjon, utils]);

  const planleggLagring = useCallback(() => {
    if (lagreTimerRef.current) clearTimeout(lagreTimerRef.current);
    lagreTimerRef.current = setTimeout(() => {
      lagreIntern();
    }, 2000);
  }, [lagreIntern]);

  // Ref for opplastingskø-callback — unngår dependency-sirkel
  const planleggLagringRef = useRef(planleggLagring);
  planleggLagringRef.current = planleggLagring;

  const lagre = useCallback(async () => {
    if (lagreTimerRef.current) {
      clearTimeout(lagreTimerRef.current);
      lagreTimerRef.current = null;
    }
    await lagreIntern();
  }, [lagreIntern]);

  // Synk til server når nett kommer tilbake
  useEffect(() => {
    if (erPaaNettet && erInitialisert && synkStatus === "lokalt_lagret") {
      lagreIntern();
    }
  }, [erPaaNettet, erInitialisert, synkStatus, lagreIntern]);

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
      settHarEndringer(true);
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
      settHarEndringer(true);
      planleggLagring();
    },
    [planleggLagring],
  );

  const flyttVedlegg = useCallback(
    (objektId: string, vedleggId: string, retning: "opp" | "ned") => {
      settFeltVerdier((prev) => {
        const nåværende = prev[objektId] ?? TOM_FELTVERDI;
        const liste = [...nåværende.vedlegg];
        const idx = liste.findIndex((v) => v.id === vedleggId);
        if (idx < 0) return prev;
        const nyIdx = retning === "opp" ? idx - 1 : idx + 1;
        if (nyIdx < 0 || nyIdx >= liste.length) return prev;
        [liste[idx], liste[nyIdx]] = [liste[nyIdx], liste[idx]];
        return {
          ...prev,
          [objektId]: { ...nåværende, vedlegg: liste },
        };
      });
      settHarEndringer(true);
      planleggLagring();
    },
    [planleggLagring],
  );

  // Betinget synlighet (rekursiv — sjekker hele foreldrekjeden)
  const erSynlig = useCallback(
    (objekt: RapportObjekt): boolean => {
      // Bruk parentId fra DB-kolonne (ny) med fallback til config (gammel)
      const parentId = objekt.parentId ?? (objekt.config.conditionParentId as string | undefined);
      if (!parentId) return true;

      const forelder = alleObjekter.find((o) => o.id === parentId);
      if (!forelder) return true; // Sikkerhets-fallback

      // Sjekk at forelderen selv er synlig (rekursivt)
      if (!erSynlig(forelder)) return false;

      // Repeater-barn er alltid synlige (ingen betingelseslogikk)
      if (forelder.type === "repeater") return true;

      // Sjekk at forelderens betingelse er oppfylt
      if (!forelder.config.conditionActive) return true;

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

  const erRedigerbar = oppgave ? REDIGERBARE_STATUSER.has(oppgave.status) : false;

  return {
    oppgave: oppgave
      ? {
          id: oppgave.id,
          title: oppgave.title,
          status: oppgave.status,
          priority: oppgave.priority,
          description: oppgave.description,
          number: oppgave.number,
          template: oppgave.template,
          creatorEnterprise: oppgave.creatorEnterprise,
          responderEnterprise: oppgave.responderEnterprise,
          drawing: oppgave.drawing,
          checklist: oppgave.checklist,
        }
      : undefined,
    erLaster: oppgaveQuery.isLoading,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    flyttVedlegg,
    erSynlig,
    valideringsfeil,
    valider,
    lagre,
    erLagrer: oppdaterDataMutasjon.isPending,
    harEndringer,
    erRedigerbar,
    lagreStatus,
    synkStatus,
  };
}
