"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useProsjekt } from "./prosjekt-kontekst";
import { useFirma } from "./firma-kontekst";
import { trpc } from "@/lib/trpc";
import { velgStandardByggeplass, HELE_PROSJEKTET_VALG } from "@sitedoc/shared";

// Beholder samme localStorage-nøkkel for bakoverkompatibilitet
const BYGGEPLASS_STORAGE_KEY = "sitedoc-aktiv-bygning";
const TEGNING_STORAGE_KEY = "sitedoc-standard-tegning";
// Brukerminne (server, skrevet av mobil): sist brukte byggeplass pr. prosjekt.
const SERVER_NOKKEL_BYGGEPLASS = "sistBruktByggeplass";

/** Lagret verdi pr. prosjekt: byggeplass, eller (18) sentinel for eksplisitt «Hele prosjektet». */
type LagretByggeplass = AktivByggeplass | typeof HELE_PROSJEKTET_VALG;

interface AktivByggeplass {
  id: string;
  name: string;
  number: number | null;
}

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
  aktivByggeplass: AktivByggeplass | null;
  /** (18) True når brukeren selv har valgt «Hele prosjektet» (huskes pr. prosjekt). */
  erHeleProsjektet: boolean;
  /** Velg byggeplass (null = «Hele prosjektet»). `prosjektId` (18) lagrer valget på et
   *  annet prosjekt enn det aktive — velgeren bytter prosjekt og byggeplass i samme trykk. */
  velgByggeplass: (byggeplass: AktivByggeplass | null, prosjektId?: string) => void;
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

const ByggeplassKontekst = createContext<ByggeplassKontekstType | null>(null);

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { prosjektId } = useProsjekt();
  const { valgtFirma } = useFirma();
  const [aktivByggeplass, setAktivByggeplass] = useState<AktivByggeplass | null>(null);
  const [erHeleProsjektet, setErHeleProsjektet] = useState(false);
  // (18) RETUR vilkår 1: prosjektet hvis lagrede valg er lest inn i state. A1 venter til
  // dette er nåværende prosjekt — ellers ser A1 forrige prosjekts byggeplass i samme commit
  // som prosjektbyttet, tolker den som ugyldig og overskriver brukerens valg.
  const [lestForProsjektId, setLestForProsjektId] = useState<string | null>(null);
  const [standardTegning, setStandardTegning] = useState<StandardTegning | null>(null);
  const [aktivTegning, setAktivTegning] = useState<AktivTegning | null>(null);
  const [posisjonsvelgerAktiv, setPosisjonsvelgerAktiv] = useState(false);
  const [posisjonsvelgerFeltId, setPosisjonsvelgerFeltId] = useState<string | null>(null);
  const posisjonsResultatRef = useRef<PosisjonsResultat | null>(null);

  // A1 (datakvalitet): byggeplass-lista bor i kilden — ikke i en UI-komponent —
  // så autovalg + gyldighets-guard kan skje deterministisk her. React-query
  // deduper mot KontekstChips identiske kall (samme path+input) → ingen
  // dobbelt-henting. Sortert på `number` fra serveren (deterministisk «første»).
  const byggeplassListe = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId ?? "" },
    { enabled: !!prosjektId },
  );
  // (18a) Sist brukte byggeplass fra brukerminnet (mobil skriver `sistBruktByggeplass` pr.
  // prosjekt). Alle egne rader uten projectId-input — ingen medlemskapssjekk, så
  // sitedoc_admin på et prosjekt hen ikke er medlem av får ingen feil.
  const brukerminne = trpc.brukerinnstilling.hent.useQuery(undefined, { staleTime: 60_000 });

  // Defensiv cleanup ved firma-bytte: clear byggeplass-state umiddelbart
  // slik at gammel byggeplass-etikett ikke henger igjen i topbar mens
  // ProsjektKontekst auto-resetter prosjektId. Uten dette så user en
  // byggeplass fra forrige firma selv etter at prosjekt-velgeren viste
  // «Velg prosjekt»-prompt.
  useEffect(() => {
    setAktivByggeplass(null);
    setErHeleProsjektet(false);
    setStandardTegning(null);
    setAktivTegning(null);
  }, [valgtFirma?.id]);

  // Les fra localStorage etter mount
  useEffect(() => {
    if (!prosjektId) {
      setAktivByggeplass(null);
      setErHeleProsjektet(false);
      setStandardTegning(null);
      setLestForProsjektId(null);
      return;
    }

    try {
      const lagretByggeplass = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
      if (lagretByggeplass) {
        const parsed = JSON.parse(lagretByggeplass) as Record<string, LagretByggeplass>;
        const lagret = parsed[prosjektId];
        if (lagret === HELE_PROSJEKTET_VALG) {
          setAktivByggeplass(null);
          setErHeleProsjektet(true);
          setStandardTegning(null);
        } else if (lagret) {
          setAktivByggeplass(lagret);
          setErHeleProsjektet(false);

          // Les standard-tegning for denne byggeplassen
          const lagretTegning = localStorage.getItem(TEGNING_STORAGE_KEY);
          if (lagretTegning) {
            const parsedTegning = JSON.parse(lagretTegning) as Record<string, StandardTegning>;
            const t = parsedTegning[lagret.id];
            if (t) {
              setStandardTegning(t);
              setAktivTegning(t);
            }
          }
        } else {
          setAktivByggeplass(null);
          setErHeleProsjektet(false);
          setStandardTegning(null);
        }
      } else {
        setAktivByggeplass(null);
        setErHeleProsjektet(false);
      }
    } catch {
      // Ignorer ugyldig localStorage-data
    }
    setLestForProsjektId(prosjektId);
  }, [prosjektId]);

  const velgByggeplass = useCallback(
    (byggeplass: AktivByggeplass | null, prosjektIdValg?: string) => {
      const pid = prosjektIdValg ?? prosjektId;
      if (!pid) return;

      // (18) «Hele prosjektet» lagres som sentinel — før ble nøkkelen slettet, og A1-
      // autovalget under valgte straks første byggeplass igjen (valget holdt ikke).
      try {
        const lagret = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, LagretByggeplass>) : {};
        parsed[pid] = byggeplass ?? HELE_PROSJEKTET_VALG;
        localStorage.setItem(BYGGEPLASS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }

      // Valg på et annet prosjekt: kun lagring. Prosjektbyttet leser verdien inn (effekten
      // over); å sette state nå ville gitt A1-guarden det gamle prosjektets liste.
      if (pid !== prosjektId) return;

      setAktivByggeplass(byggeplass);
      setErHeleProsjektet(!byggeplass);
      setStandardTegning(null);
      setAktivTegning(null);

      // Les standard-tegning for ny byggeplass
      if (byggeplass) {
        try {
          const lagretTegning = localStorage.getItem(TEGNING_STORAGE_KEY);
          if (lagretTegning) {
            const parsedTegning = JSON.parse(lagretTegning) as Record<string, StandardTegning>;
            const t = parsedTegning[byggeplass.id];
            if (t) {
              setStandardTegning(t);
              setAktivTegning(t);
            }
          }
        } catch {
          // Ignorer
        }
      }
    },
    [prosjektId],
  );

  // A1: autovalg + gyldighets-guard. Kjører når byggeplass-lista er lastet.
  // - Aktiv byggeplass som IKKE finnes i prosjektets liste (slettet/fremmed) →
  //   forkast og revelg (dekker stale localStorage-id + prosjektbytte-guarden).
  // - Eksplisitt «Hele prosjektet» (18) respekteres — ingen autovalg over det.
  // - Ingen gyldig byggeplass valgt + prosjektet har byggeplasser → standardvalg (18):
  //   (a) sist brukt fra brukerminnet → (c) første (GPS (b) finnes bare på mobil).
  //   `velgByggeplass` persisterer, akkurat som det gamle autovalget gjorde.
  const sistBrukt = (() => {
    const rad = brukerminne.data?.find(
      (r) => r.projectId === prosjektId && r.nokkel === SERVER_NOKKEL_BYGGEPLASS,
    );
    if (!rad) return null;
    try {
      return JSON.parse(rad.verdi) as string;
    } catch {
      return null;
    }
  })();
  const brukerminneKlart = !brukerminne.isLoading;
  useEffect(() => {
    if (!prosjektId) return;
    if (lestForProsjektId !== prosjektId) return; // lagret valg ikke lest inn ennå
    const liste = byggeplassListe.data;
    if (!liste) return; // vent på lista før valget røres (unngår stale-race)
    if (erHeleProsjektet && liste.length > 0) return; // brukerens eget valg
    const gyldig = !!aktivByggeplass && liste.some((b) => b.id === aktivByggeplass.id);
    if (gyldig) return; // respekter gyldig (persistert) valg — ingen override
    if (liste.length > 0) {
      if (!brukerminneKlart) return; // (a) kan endre valget — vent på brukerminnet
      const valg = velgStandardByggeplass({
        byggeplassIder: liste.map((b) => b.id),
        lagret: null,
        sistBrukt,
      });
      if (valg === HELE_PROSJEKTET_VALG) {
        velgByggeplass(null);
        return;
      }
      const b = liste.find((x) => x.id === valg) ?? liste[0]!;
      velgByggeplass({ id: b.id, name: b.name, number: b.number });
    } else if (aktivByggeplass) {
      // Prosjektet har ingen byggeplasser → fjern resten. (18) RETUR vilkår 3: nøkkelen
      // slettes, ingen sentinel — brukeren har ikke valgt «Hele prosjektet», og får
      // prosjektet byggeplasser senere, skal standardvalget gjelde.
      try {
        const lagret = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, LagretByggeplass>) : {};
        delete parsed[prosjektId];
        localStorage.setItem(BYGGEPLASS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }
      setAktivByggeplass(null);
      setErHeleProsjektet(false);
      setStandardTegning(null);
      setAktivTegning(null);
    }
  }, [
    lestForProsjektId,
    prosjektId,
    byggeplassListe.data,
    aktivByggeplass,
    erHeleProsjektet,
    velgByggeplass,
    sistBrukt,
    brukerminneKlart,
  ]);

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
        erHeleProsjektet,
        velgByggeplass,
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
