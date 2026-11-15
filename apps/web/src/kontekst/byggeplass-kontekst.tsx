"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useProsjekt } from "./prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { velgFilterByggeplass } from "@sitedoc/shared";

// Beholder samme localStorage-nøkkel for bakoverkompatibilitet
const BYGGEPLASS_STORAGE_KEY = "sitedoc-aktiv-bygning";
const TEGNING_STORAGE_KEY = "sitedoc-standard-tegning";
// Brukerminne (server, delt med mobil): sist valgte byggeplass pr. prosjekt. Verdien er
// fortsatt en ren id (eldre mobilversjoner leser den slik); `oppdatert` er valgets tid.
const SERVER_NOKKEL_BYGGEPLASS = "sistBruktByggeplass";

interface AktivByggeplass {
  id: string;
  name: string;
  number: number | null;
}

/** (22) Lagret manuelt valg pr. prosjekt. `tid` (ms) mangler i eldre oppføringer → 0.
 *  Gamle «Hele prosjektet»-oppføringer (streng-sentinel) leses som «intet valg». */
type LagretValg = AktivByggeplass & { tid?: number };

interface StandardTegning {
  id: string;
  name: string;
}

interface AktivTegning {
  id: string;
  name: string;
}

export interface PosisjonsResultat {
  drawingId: string;
  drawingName: string;
  positionX: number;
  positionY: number;
}

interface ByggeplassKontekstType {
  /** (22) Byggeplassen filteret står på: ny innsjekk → sist valgte → null («Velg byggeplass»).
   *  Aldri «første», aldri «Hele prosjektet». */
  aktivByggeplass: AktivByggeplass | null;
  /** (22) Prosjektet har minst én byggeplass (false også mens lista laster). */
  harByggeplasser: boolean;
  /** (22) Byggeplass-lista er lastet for aktivt prosjekt. */
  byggeplasserLastet: boolean;
  /** Velg byggeplass (huskes pr. bruker og prosjekt). `prosjektId` (18) lagrer valget på et
   *  annet prosjekt enn det aktive — velgeren bytter prosjekt og byggeplass i samme trykk. */
  velgByggeplass: (byggeplass: AktivByggeplass, prosjektId?: string) => void;
  /** (20) Byggeplass for nye dokumenter: kun brukerens eget (lagrede) valg, ellers null —
   *  aldri et avledet valg (innsjekk). Velgeren viser fortsatt `aktivByggeplass`. */
  opprettByggeplass: AktivByggeplass | null;
  /** (20) Standard-tegning for nye dokumenter — kun når `opprettByggeplass` er satt. */
  opprettTegning: StandardTegning | null;
  standardTegning: StandardTegning | null;
  settStandardTegning: (tegning: StandardTegning | null) => void;
  aktivTegning: AktivTegning | null;
  settAktivTegning: (tegning: AktivTegning | null) => void;
  // Posisjonsvelger: felt ber om posisjon → tegningssiden svarer → felt henter resultatet
  startPosisjonsvelger: (feltId: string) => void;
  avbrytPosisjonsvelger: () => void;
  fullførPosisjonsvelger: (resultat: PosisjonsResultat) => void;
  posisjonsvelgerAktiv: boolean;
  posisjonsvelgerFeltId: string | null;
  hentOgTømPosisjonsResultat: (feltId: string) => PosisjonsResultat | null;
}

/**
 * Ren beslutning for URL-basert re-hydrering av posisjonsvelgeren (funn 2026-08-22).
 * URL-parameteren `posisjonsvelger=<feltId>` er sannhetskilden på tegningsruten; provider-
 * staten er ren in-memory og dør ved full last. Ved mount avgjør denne hva som skal skje:
 *   · param satt + provider tom → "start" (gjenopprett velger-modus etter full last)
 *   · ingen param + provider aktiv → "avbryt" (rydd stale modus arvet fra en dokument-flyt)
 *   · ellers → "ingen" (klient-nav der staten alt er korrekt)
 */
export function velgerRehydreringsHandling(
  param: string | null,
  aktiv: boolean,
): "start" | "avbryt" | "ingen" {
  if (param && !aktiv) return "start";
  if (!param && aktiv) return "avbryt";
  return "ingen";
}

function lesLagretValg(prosjektId: string): LagretValg | null {
  try {
    const raa = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
    if (!raa) return null;
    const v = (JSON.parse(raa) as Record<string, unknown>)[prosjektId];
    if (v && typeof v === "object" && typeof (v as LagretValg).id === "string") return v as LagretValg;
  } catch {
    // Ignorer ugyldig localStorage-data
  }
  return null;
}

function lesStandardTegning(byggeplassId: string): StandardTegning | null {
  try {
    const raa = localStorage.getItem(TEGNING_STORAGE_KEY);
    if (!raa) return null;
    return (JSON.parse(raa) as Record<string, StandardTegning>)[byggeplassId] ?? null;
  } catch {
    return null;
  }
}

const ByggeplassKontekst = createContext<ByggeplassKontekstType | null>(null);

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { prosjektId } = useProsjekt();
  // (22) Manuelt valg (localStorage) for aktivt prosjekt. `lestForProsjektId` (18) hindrer at
  // forrige prosjekts valg brukes i samme commit som prosjektbyttet.
  const [lagretValg, setLagretValg] = useState<LagretValg | null>(null);
  const [lestForProsjektId, setLestForProsjektId] = useState<string | null>(null);
  const [standardTegning, setStandardTegning] = useState<StandardTegning | null>(null);
  const [aktivTegning, setAktivTegning] = useState<AktivTegning | null>(null);
  const [posisjonsvelgerAktiv, setPosisjonsvelgerAktiv] = useState(false);
  const [posisjonsvelgerFeltId, setPosisjonsvelgerFeltId] = useState<string | null>(null);
  const posisjonsResultatRef = useRef<PosisjonsResultat | null>(null);

  // Byggeplass-lista bor i kilden — gyldighet avgjøres her. React-query deduper mot
  // KontekstChips identiske kall (samme path+input).
  const byggeplassListe = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId ?? "" },
    { enabled: !!prosjektId },
  );
  // Brukerminne (server): sist valgte byggeplass pr. prosjekt — skrevet av web og mobil.
  // Alle egne rader uten projectId-input — ingen medlemskapssjekk.
  const brukerminne = trpc.brukerinnstilling.hent.useQuery(undefined, { staleTime: 60_000 });
  const settBrukerminne = trpc.brukerinnstilling.sett.useMutation();
  const utils = trpc.useUtils();
  // (22) Innsjekk (PSI) — kun når PSI-modulen er aktiv på prosjektet (minStatus kaster ellers).
  const moduler = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId ?? "" },
    { enabled: !!prosjektId },
  );
  const psiAktiv = !!(moduler.data as { moduleSlug: string; status: string }[] | undefined)?.some(
    (m) => m.moduleSlug === "psi" && m.status === "aktiv",
  );
  const minStatus = trpc.mannskap.minStatus.useQuery(
    { projectId: prosjektId ?? "" },
    { enabled: !!prosjektId && psiAktiv, retry: false, staleTime: 60_000 },
  );

  // Les lagret valg ved prosjektbytte. (22) Erstatter firma-reset-effekten: den kjørte når
  // `valgtFirma` gikk fra null til lastet og nullstilte valget ETTER at denne hadde lest det
  // (valget «huskes ikke» etter last). Valget er nå nøklet på prosjekt og gyldighetssjekket
  // mot prosjektets liste, så et firmabytte kan ikke vise forrige firmas byggeplass.
  useEffect(() => {
    setLagretValg(prosjektId ? lesLagretValg(prosjektId) : null);
    setLestForProsjektId(prosjektId ?? null);
  }, [prosjektId]);

  const liste = byggeplassListe.data;
  const byggeplasserLastet = !!prosjektId && !!liste;
  const harByggeplasser = (liste?.length ?? 0) > 0;
  const lestNaa = !!prosjektId && lestForProsjektId === prosjektId;

  // Sist valgte: nyeste av localStorage (denne nettleseren) og brukerminnet (andre enheter).
  const manuelt = useMemo(() => {
    if (!prosjektId || !lestNaa) return null;
    const lokal = lagretValg ? { id: lagretValg.id, tid: lagretValg.tid ?? 0 } : null;
    const rad = brukerminne.data?.find(
      (r) => r.projectId === prosjektId && r.nokkel === SERVER_NOKKEL_BYGGEPLASS,
    );
    let server: { id: string; tid: number } | null = null;
    if (rad) {
      try {
        const id = JSON.parse(rad.verdi) as unknown;
        const tid = new Date(rad.oppdatert as unknown as string).getTime();
        if (typeof id === "string") server = { id, tid: Number.isFinite(tid) ? tid : 0 };
      } catch {
        // Ignorer
      }
    }
    if (!lokal) return server;
    if (!server) return lokal;
    return server.tid > lokal.tid ? server : lokal;
  }, [prosjektId, lestNaa, lagretValg, brukerminne.data]);

  const innsjekk = useMemo(() => {
    const s = psiAktiv ? minStatus.data : null;
    if (!s) return null;
    return { id: s.byggeplassId ?? null, tid: new Date(s.innsjekkTid as unknown as string).getTime() };
  }, [psiAktiv, minStatus.data]);

  const aktivByggeplass = useMemo<AktivByggeplass | null>(() => {
    if (!prosjektId || !lestNaa) return null;
    if (!liste) {
      // Lista laster: vis lagret valg (har navn) så velgeren ikke blinker «Velg byggeplass».
      return lagretValg ? { id: lagretValg.id, name: lagretValg.name, number: lagretValg.number } : null;
    }
    const id = velgFilterByggeplass({
      byggeplassIder: liste.map((b) => b.id),
      innsjekk,
      gps: null, // GPS finnes bare på mobil
      manuelt,
    });
    const b = id ? liste.find((x) => x.id === id) : undefined;
    return b ? { id: b.id, name: b.name, number: b.number } : null;
  }, [prosjektId, lestNaa, liste, lagretValg, innsjekk, manuelt]);

  // Standard-tegning følger valgt byggeplass.
  const aktivId = aktivByggeplass?.id ?? null;
  useEffect(() => {
    const t = aktivId ? lesStandardTegning(aktivId) : null;
    setStandardTegning(t);
    setAktivTegning(t);
  }, [aktivId]);

  const velgByggeplass = useCallback(
    (byggeplass: AktivByggeplass, prosjektIdValg?: string) => {
      const pid = prosjektIdValg ?? prosjektId;
      if (!pid) return;
      const valg: LagretValg = { ...byggeplass, tid: Date.now() };
      try {
        const raa = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
        const parsed = raa ? (JSON.parse(raa) as Record<string, unknown>) : {};
        parsed[pid] = valg;
        localStorage.setItem(BYGGEPLASS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }
      // Brukerminnet (server): valget følger brukeren til andre enheter. Fire-and-forget.
      settBrukerminne.mutate(
        { nokkel: SERVER_NOKKEL_BYGGEPLASS, verdi: JSON.stringify(byggeplass.id), projectId: pid },
        { onSuccess: () => void utils.brukerinnstilling.hent.invalidate() },
      );
      // Valg på et annet prosjekt: kun lagring — prosjektbyttet leser verdien inn.
      if (pid === prosjektId) setLagretValg(valg);
    },
    // settBrukerminne/utils er stabile nok; mutate-referansen endres ikke mellom render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prosjektId],
  );

  // (20) Byggeplass for nye dokumenter: brukerens eget (lagrede) valg, ellers ingen. Uendret
  // regel; (22) innsjekk styrer filteret, men følger ikke med nye dokumenter.
  const opprettByggeplass = useMemo(() => {
    if (!aktivByggeplass || !manuelt) return null;
    return manuelt.id === aktivByggeplass.id ? aktivByggeplass : null;
  }, [aktivByggeplass, manuelt]);
  const opprettTegning = opprettByggeplass ? standardTegning : null;

  const settStandardTegning = useCallback(
    (tegning: StandardTegning | null) => {
      setStandardTegning(tegning);

      if (!aktivByggeplass) return;

      try {
        const lagret = localStorage.getItem(TEGNING_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, StandardTegning>) : {};
        if (tegning) {
          parsed[aktivByggeplass.id] = tegning;
        } else {
          delete parsed[aktivByggeplass.id];
        }
        localStorage.setItem(TEGNING_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }
    },
    [aktivByggeplass],
  );

  const settAktivTegningCallback = useCallback(
    (tegning: AktivTegning | null) => {
      setAktivTegning(tegning);
    },
    [],
  );

  const startPosisjonsvelger = useCallback((feltId: string) => {
    setPosisjonsvelgerFeltId(feltId);
    posisjonsResultatRef.current = null;
    setPosisjonsvelgerAktiv(true);
  }, []);

  const avbrytPosisjonsvelger = useCallback(() => {
    setPosisjonsvelgerFeltId(null);
    posisjonsResultatRef.current = null;
    setPosisjonsvelgerAktiv(false);
  }, []);

  const fullførPosisjonsvelger = useCallback((resultat: PosisjonsResultat) => {
    posisjonsResultatRef.current = resultat;
    setPosisjonsvelgerAktiv(false);
  }, []);

  const hentOgTømPosisjonsResultat = useCallback((feltId: string): PosisjonsResultat | null => {
    if (posisjonsvelgerFeltId !== feltId) return null;
    const resultat = posisjonsResultatRef.current;
    if (resultat) {
      posisjonsResultatRef.current = null;
      setPosisjonsvelgerFeltId(null);
    }
    return resultat;
  }, [posisjonsvelgerFeltId]);

  return (
    <ByggeplassKontekst.Provider
      value={{
        aktivByggeplass,
        harByggeplasser,
        byggeplasserLastet,
        velgByggeplass,
        opprettByggeplass,
        opprettTegning,
        standardTegning,
        settStandardTegning,
        aktivTegning,
        settAktivTegning: settAktivTegningCallback,
        startPosisjonsvelger,
        avbrytPosisjonsvelger,
        fullførPosisjonsvelger,
        posisjonsvelgerAktiv,
        posisjonsvelgerFeltId,
        hentOgTømPosisjonsResultat,
      }}
    >
      {children}
    </ByggeplassKontekst.Provider>
  );
}

/** @deprecated Bruk useByggeplass() i stedet */
export function useBygning() {
  return useByggeplass();
}

export function useByggeplass() {
  const ctx = useContext(ByggeplassKontekst);
  if (!ctx) {
    throw new Error("useByggeplass må brukes innenfor ByggeplassProvider");
  }
  return ctx;
}
