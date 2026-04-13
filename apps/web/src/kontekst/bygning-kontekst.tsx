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

const BYGNING_STORAGE_KEY = "sitedoc-aktiv-bygning";
const TEGNING_STORAGE_KEY = "sitedoc-standard-tegning";

interface AktivBygning {
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

interface BygningKontekstType {
  aktivBygning: AktivBygning | null;
  velgBygning: (bygning: AktivBygning | null) => void;
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

const BygningKontekst = createContext<BygningKontekstType | null>(null);

export function BygningProvider({ children }: { children: ReactNode }) {
  const { prosjektId } = useProsjekt();
  const [aktivBygning, setAktivBygning] = useState<AktivBygning | null>(null);
  const [standardTegning, setStandardTegning] = useState<StandardTegning | null>(null);
  const [aktivTegning, setAktivTegning] = useState<AktivTegning | null>(null);
  const [posisjonsvelgerAktiv, setPosisjonsvelgerAktiv] = useState(false);
  const [posisjonsvelgerFeltId, setPosisjonsvelgerFeltId] = useState<string | null>(null);
  const posisjonsResultatRef = useRef<PosisjonsResultat | null>(null);

  // Les fra localStorage etter mount
  useEffect(() => {
    if (!prosjektId) {
      setAktivBygning(null);
      setStandardTegning(null);
      return;
    }

    try {
      const lagretBygning = localStorage.getItem(BYGNING_STORAGE_KEY);
      if (lagretBygning) {
        const parsed = JSON.parse(lagretBygning) as Record<string, AktivBygning>;
        if (parsed[prosjektId]) {
          setAktivBygning(parsed[prosjektId]);

          // Les standard-tegning for denne bygningen
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
          setAktivBygning(null);
          setStandardTegning(null);
        }
      }
    } catch {
      // Ignorer ugyldig localStorage-data
    }
  }, [prosjektId]);

  const velgBygning = useCallback(
    (bygning: AktivBygning | null) => {
      setAktivBygning(bygning);
      setStandardTegning(null);
      setAktivTegning(null);

      if (!prosjektId) return;

      try {
        const lagret = localStorage.getItem(BYGNING_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, AktivBygning>) : {};
        if (bygning) {
          parsed[prosjektId] = bygning;
        } else {
          delete parsed[prosjektId];
        }
        localStorage.setItem(BYGNING_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }

      // Les standard-tegning for ny bygning
      if (bygning) {
        try {
          const lagretTegning = localStorage.getItem(TEGNING_STORAGE_KEY);
          if (lagretTegning) {
            const parsedTegning = JSON.parse(lagretTegning) as Record<string, StandardTegning>;
            const t = parsedTegning[bygning.id];
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

      if (!aktivBygning) return;

      try {
        const lagret = localStorage.getItem(TEGNING_STORAGE_KEY);
        const parsed = lagret ? (JSON.parse(lagret) as Record<string, StandardTegning>) : {};
        if (tegning) {
          parsed[aktivBygning.id] = tegning;
        } else {
          delete parsed[aktivBygning.id];
        }
        localStorage.setItem(TEGNING_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignorer localStorage-feil
      }
    },
    [aktivBygning],
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
    <BygningKontekst.Provider
      value={{
        aktivBygning,
        velgBygning,
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
    </BygningKontekst.Provider>
  );
}

export function useBygning() {
  const ctx = useContext(BygningKontekst);
  if (!ctx) {
    throw new Error("useBygning må brukes innenfor BygningProvider");
  }
  return ctx;
}
