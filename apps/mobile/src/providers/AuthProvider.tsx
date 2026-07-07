import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import {
  hentSessionToken,
  hentBrukerData,
  lagreSessionToken,
  lagreBrukerData,
  loggUt as loggUtTjeneste,
  loggInnMedGoogleWeb,
  loggInnMedMicrosoft as microsoftFlyt,
  loggInnSomTestbruker as testbrukerFlyt,
} from "../services/auth";
import type { BrukerData } from "../services/auth";
import { trpc } from "../lib/trpc";
import { AUTH_CONFIG } from "../config/auth";
import { nullstillNyNavCache } from "../hooks/useNyNavigasjon";

interface AuthKontekst {
  bruker: BrukerData | null;
  erInnlogget: boolean;
  laster: boolean;
  loggInnMedGoogle: () => Promise<void>;
  loggInnMedMicrosoft: () => Promise<void>;
  haandterOAuthCallback: (provider: "google" | "microsoft", accessToken: string) => Promise<void>;
  loggInnSomTestbruker: (email?: string) => Promise<void>;
  loggUt: () => Promise<void>;
}

const AuthContext = createContext<AuthKontekst>({
  bruker: null,
  erInnlogget: false,
  laster: true,
  loggInnMedGoogle: async () => {},
  loggInnMedMicrosoft: async () => {},
  haandterOAuthCallback: async () => {},
  loggInnSomTestbruker: async () => {},
  loggUt: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bruker, setBruker] = useState<BrukerData | null>(null);
  const [laster, setLaster] = useState(true);

  const byttToken = trpc.mobilAuth.byttToken.useMutation();

  // Sjekk eksisterende token ved oppstart — verifiser mot server + forny sesjon
  useEffect(() => {
    async function sjekkToken() {
      try {
        const token = await hentSessionToken();
        if (token) {
          // Lett verifisering — fornyer også sesjonen med 30 nye dager.
          // AbortController gir 12s timeout: en hengende/tapt respons faller
          // til cachet bruker via ytre catch i stedet for evig spinner.
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12_000);
          let res: Response;
          try {
            res = await fetch(`${AUTH_CONFIG.apiUrl}/trpc/mobilAuth.verifiser`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }

          if (res.ok) {
            // Oppdater cached brukerdata fra server (kan ha endret navn/bilde)
            try {
              const json = await res.json();
              const serverBruker = json?.result?.data?.user;
              const nyttToken = json?.result?.data?.nyttToken;
              if (nyttToken) {
                await lagreSessionToken(nyttToken);
              }
              if (serverBruker) {
                await lagreBrukerData(serverBruker);
                setBruker(serverBruker);
              } else {
                const lagretBruker = await hentBrukerData();
                if (lagretBruker) setBruker(lagretBruker);
              }
            } catch {
              const lagretBruker = await hentBrukerData();
              if (lagretBruker) setBruker(lagretBruker);
            }
          } else {
            // Sesjonen er ugyldig/utløpt — rydd opp
            await loggUtTjeneste();
          }
        }
      } catch {
        // Nettverksfeil/timeout — bruk cached data (offline-støtte)
        const lagretBruker = await hentBrukerData();
        if (lagretBruker) {
          setBruker(lagretBruker);
        }
      } finally {
        setLaster(false);
      }
    }
    sjekkToken();
  }, []);

  const byttOgLagre = useCallback(
    async (provider: "google" | "microsoft", accessToken: string) => {
      const resultat = await byttToken.mutateAsync({
        provider,
        accessToken,
      });

      await lagreSessionToken(resultat.sessionToken);
      await lagreBrukerData(resultat.user);
      setBruker(resultat.user);
    },
    [byttToken],
  );

  const loggInnMedGoogle = useCallback(async () => {
    if (Platform.OS === "web") {
      // På web: redirect til Google OAuth (void, ingen return)
      loggInnMedGoogleWeb();
    }
    // På native: Google-innlogging håndteres via hook i logg-inn-skjermen
  }, []);

  const loggInnMedMicrosoft = useCallback(async () => {
    setLaster(true);
    try {
      const accessToken = await microsoftFlyt();
      if (accessToken) {
        await byttOgLagre("microsoft", accessToken);
      }
    } finally {
      setLaster(false);
    }
  }, [byttOgLagre]);

  const haandterOAuthCallback = useCallback(
    async (provider: "google" | "microsoft", accessToken: string) => {
      setLaster(true);
      try {
        await byttOgLagre(provider, accessToken);
      } finally {
        setLaster(false);
      }
    },
    [byttOgLagre],
  );

  const loggInnSomTestbruker = useCallback(async (email?: string) => {
    setLaster(true);
    try {
      const resultat = await testbrukerFlyt(email);
      setBruker(resultat.user);
    } finally {
      setLaster(false);
    }
  }, []);

  const loggUt = useCallback(async () => {
    await loggUtTjeneste();
    setBruker(null);
    // Nullstill nyNavigasjon-modul-cachen så flagget ikke henger igjen fra
    // forrige bruker i utloggingsvinduet (delt enhet). Rotårsak, ikke plaster.
    nullstillNyNavCache();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        bruker,
        erInnlogget: !!bruker,
        laster,
        loggInnMedGoogle,
        loggInnMedMicrosoft,
        haandterOAuthCallback,
        loggInnSomTestbruker,
        loggUt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
