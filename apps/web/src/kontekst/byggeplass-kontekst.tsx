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

// Beholder samme localStorage-nøkkel for bakoverkompatibilitet
const BYGGEPLASS_STORAGE_KEY = "sitedoc-aktiv-bygning";
const TEGNING_STORAGE_KEY = "sitedoc-standard-tegning";

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
  velgByggeplass: (byggeplass: AktivByggeplass | null) => void;
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

const ByggeplassKontekst = createContext<ByggeplassKontekstType | null>(null);

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { prosjektId } = useProsjekt();
  const [aktivByggeplass, setAktivByggeplass] = useState<AktivByggeplass | null>(null);
  const [standardTegning, setStandardTegning] = useState<StandardTegning | null>(null);
  const [aktivTegning, setAktivTegning] = useState<AktivTegning | null>(null);
  const [posisjonsvelgerAktiv, setPosisjonsvelgerAktiv] = useState(false);
  const [posisjonsvelgerFeltId, setPosisjonsvelgerFeltId] = useState<string | null>(null);
  const posisjonsResultatRef = useRef<PosisjonsResultat | null>(null);

  // Les fra localStorage etter mount
  useEffect(() => {
    if (!prosjektId) {
      setAktivByggeplass(null);
      setStandardTegning(null);
      return;
    }

    try {
      const lagretByggeplass = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
      if (lagretByggeplass) {
        const parsed = JSON.parse(lagretByggeplass) as Record<string, AktivByggeplass>;
        if (parsed[prosjektId]) {
          setAktivByggeplass(parsed[prosjektId]);

          // Les standard-tegning for denne byggeplassen
          const lagretTegning = localStorage.getItem(TEGNING_STORAGE_KEY);
          if (lagretTegning) {
            const parsedTegning = JSON.parse(lagretTegning) as Record<string, StandardTegning>;
            const t = parsedTegning[parsed[prosjektId].id];
            if (t) {
              setStandardTegning(t);
              setAktivTegning(t);
            }
          }
        } else {
          setAktivByggeplass(null);
          setStandardTegning(null);
        }
      }
    } catch {
      // Ignorer ugyldig localStorage-data
    }
  }, [prosjektId]);

  const velgByggeplass = useCallback(
    (byggeplass: AktivByggeplass | null) => {
      setAktivByggeplass(byggeplass);
      setStandardTegning(null);
      setAktivTegning(null);

      if (!prosjektId) return;

      try {
        const lagret = localStorage.getItem(BYGGEPLASS_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, AktivByggeplass>) : {};
        if (byggeplass) {
          parsed[prosjektId] = byggeplass;
        } else {
          delete parsed[prosjektId];
        }
        localStorage.setItem(BYGGEPLASS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }

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
