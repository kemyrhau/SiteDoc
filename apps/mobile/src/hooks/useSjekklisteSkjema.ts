import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { trpc } from "../lib/trpc";
import { hentDatabase } from "../db/database";
import { sjekklisteFeltdata } from "../db/schema";
import { useNettverk } from "../providers/NettverkProvider";
import { useOpplastingsKo } from "../providers/OpplastingsKoProvider";

type LagreStatus = "idle" | "lagrer" | "lagret" | "feil";
type SynkStatus = "synkronisert" | "lokalt_lagret" | "synkroniserer";

export interface Vedlegg {
  id: string;
  type: "bilde" | "fil";
  url: string;
  filnavn: string;
  opprettet?: string;
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
  parentId: string | null;
}

const TOM_FELTVERDI: FeltVerdi = { verdi: null, kommentar: "", vedlegg: [] };

// Typer som ikke har utfyllbar verdi
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

// Typer som auto-fylles ved opprettelse av nytt dokument
const AUTO_FILL_TYPER = new Set(["date", "date_time"]);

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

function lesSQLiteFeltdata(sjekklisteId: string): Record<string, FeltVerdi> | null {
  try {
    const db = hentDatabase();
    if (!db) return null;
    const rader = db
      .select()
      .from(sjekklisteFeltdata)
      .where(eq(sjekklisteFeltdata.sjekklisteId, sjekklisteId))
      .all();
    if (rader.length === 0) return null;
    return JSON.parse(rader[0]!.feltVerdier) as Record<string, FeltVerdi>;
  } catch {
    return null;
  }
}

function erSQLiteSynkronisert(sjekklisteId: string): boolean {
  try {
    const db = hentDatabase();
    if (!db) return true;
    const rader = db
      .select({ erSynkronisert: sjekklisteFeltdata.erSynkronisert })
      .from(sjekklisteFeltdata)
      .where(eq(sjekklisteFeltdata.sjekklisteId, sjekklisteId))
      .all();
    if (rader.length === 0) return true;
    return rader[0]!.erSynkronisert;
  } catch {
    return true;
  }
}

function skrivTilSQLite(
  sjekklisteId: string,
  feltVerdier: Record<string, FeltVerdi>,
  synkronisert: boolean,
) {
  try {
    const db = hentDatabase();
    if (!db) return;
    const json = JSON.stringify(feltVerdier);
    const rader = db
      .select({ id: sjekklisteFeltdata.id })
      .from(sjekklisteFeltdata)
      .where(eq(sjekklisteFeltdata.sjekklisteId, sjekklisteId))
      .all();

    if (rader.length > 0) {
      db.update(sjekklisteFeltdata)
        .set({
          feltVerdier: json,
          erSynkronisert: synkronisert,
          sistEndretLokalt: Date.now(),
          ...(synkronisert ? { sistSynkronisert: Date.now() } : {}),
        })
        .where(eq(sjekklisteFeltdata.id, rader[0]!.id))
        .run();
    } else {
      db.insert(sjekklisteFeltdata)
        .values({
          id: randomUUID(),
          sjekklisteId,
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

export function useSjekklisteSkjema(sjekklisteId: string): UseSjekklisteSkjemaResultat {
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

  // tRPC utils for å invalidere query-cache etter lagring
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

  // Initialiser feltVerdier — SQLite først, så server
  useEffect(() => {
    if (!sjekkliste || erInitialisert) return;

    const eksisterendeData = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;

    // Prøv SQLite først (instant, <10ms)
    const sqliteData = lesSQLiteFeltdata(sjekklisteId);
    const sqliteSynkronisert = erSQLiteSynkronisert(sjekklisteId);

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
        // Auto-fill for nye sjekklister uten eksisterende data
        let autoVerdi: unknown = null;

        if (!harServerData && AUTO_FILL_TYPER.has(objekt.type)) {
          switch (objekt.type) {
            case "date":
              autoVerdi = new Date().toISOString().split("T")[0];
              break;
            case "date_time":
              autoVerdi = new Date().toISOString();
              break;
          }
        }

        initialisert[objekt.id] = { verdi: autoVerdi, kommentar: "", vedlegg: [] };
      }
    }

    settFeltVerdier(initialisert);
    settErInitialisert(true);

    // Lagre til SQLite (synkronisert med server-data, eller lokalt_lagret med auto-fill)
    const harAutoFylt = !harServerData && alleObjekter.some(
      (o) => !DISPLAY_TYPER.has(o.type) && AUTO_FILL_TYPER.has(o.type) && initialisert[o.id]?.verdi != null,
    );
    skrivTilSQLite(sjekklisteId, initialisert, !harAutoFylt);
    settSynkStatus(harAutoFylt ? "lokalt_lagret" : "synkronisert");
  }, [sjekkliste, alleObjekter, erInitialisert, sjekklisteId]);

  // Lytt på opplastingsfullføringer — oppdater vedlegg-URL i minnet
  useEffect(() => {
    const avregistrer = registrerCallback(
      (dokumentId, dokumentType, _objektId, vedleggId, serverUrl) => {
        if (dokumentType !== "sjekkliste" || dokumentId !== sjekklisteId) return;

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
  }, [sjekklisteId, registrerCallback]);

  const hentFeltVerdi = useCallback(
    (objektId: string): FeltVerdi => feltVerdier[objektId] ?? TOM_FELTVERDI,
    [feltVerdier],
  );

  // Lagre til server
  const oppdaterDataMutasjon = trpc.sjekkliste.oppdaterData.useMutation();

  const lagrerNaaRef = useRef(false);

  const lagreIntern = useCallback(async () => {
    if (!sjekklisteId) return;
    if (lagrerNaaRef.current) return; // Forhindre concurrent saves
    lagrerNaaRef.current = true;

    const data = feltVerdierRef.current;

    // 1. Skriv til SQLite umiddelbart (alltid suksess)
    skrivTilSQLite(sjekklisteId, data, false);
    settLagreStatus("lagret");

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => settLagreStatus("idle"), 2000);

    // 2. Prøv server-sync hvis online
    if (erPaaNettet) {
      settSynkStatus("synkroniserer");
      try {
        await oppdaterDataMutasjon.mutateAsync({
          id: sjekklisteId,
          data,
        });
        await utils.sjekkliste.hentMedId.invalidate({ id: sjekklisteId });
        settHarEndringer(false);

        // Marker som synkronisert i SQLite
        skrivTilSQLite(sjekklisteId, data, true);
        settSynkStatus("synkronisert");
      } catch (feil) {
        console.warn("[LAGRE] Server-lagring feilet:", feil);
        settSynkStatus("lokalt_lagret");
      }
    } else {
      settSynkStatus("lokalt_lagret");
    }

    lagrerNaaRef.current = false;
  }, [sjekklisteId, erPaaNettet, oppdaterDataMutasjon, utils]);

  // Refs for stabile funksjonsreferanser — bryter dependency-kaskaden
  // lagreIntern → planleggLagring → oppdaterFelt → settVerdi
  // Uten refs: oppdaterDataMutasjon bytter referanse ved isPending-toggle
  // → hele kjeden gjenskapes → effects med settVerdi re-trigges → loop
  const lagreInternRef = useRef(lagreIntern);
  lagreInternRef.current = lagreIntern;

  const planleggLagring = useCallback(() => {
    if (lagreTimerRef.current) clearTimeout(lagreTimerRef.current);
    lagreTimerRef.current = setTimeout(() => {
      lagreInternRef.current();
    }, 2000);
  }, []);

  const planleggLagringRef = useRef(planleggLagring);
  planleggLagringRef.current = planleggLagring;

  const lagre = useCallback(async () => {
    if (lagreTimerRef.current) {
      clearTimeout(lagreTimerRef.current);
      lagreTimerRef.current = null;
    }
    await lagreInternRef.current();
  }, []);

  // Synk til server når nett kommer tilbake
  useEffect(() => {
    if (erPaaNettet && erInitialisert && synkStatus === "lokalt_lagret") {
      lagreInternRef.current();
    }
  }, [erPaaNettet, erInitialisert, synkStatus]);

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

  const erstattVedlegg = useCallback(
    (objektId: string, vedleggId: string, nyUrl: string, nyttFilnavn: string) => {
      settFeltVerdier((prev) => {
        const nåværende = prev[objektId] ?? TOM_FELTVERDI;
        return {
          ...prev,
          [objektId]: {
            ...nåværende,
            vedlegg: nåværende.vedlegg.map((v) =>
              v.id === vedleggId ? { ...v, url: nyUrl, filnavn: nyttFilnavn } : v,
            ),
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

  // Betinget synlighet (rekursiv — sjekker hele foreldrekjeden, maks 10 nivåer)
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
    erstattVedlegg,
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
