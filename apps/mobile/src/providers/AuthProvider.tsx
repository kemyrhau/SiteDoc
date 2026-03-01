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
} from "../services/auth";
import type { BrukerData } from "../services/auth";
import { trpc } from "../lib/trpc";

interface AuthKontekst {
  bruker: BrukerData | null;
  erInnlogget: boolean;
  laster: boolean;
  loggInnMedGoogle: () => Promise<void>;
  loggInnMedMicrosoft: () => Promise<void>;
  haandterOAuthCallback: (provider: "google" | "microsoft", accessToken: string) => Promise<void>;
  loggUt: () => Promise<void>;
}

const AuthContext = createContext<AuthKontekst>({
  bruker: null,
  erInnlogget: false,
  laster: true,
  loggInnMedGoogle: async () => {},
  loggInnMedMicrosoft: async () => {},
  haandterOAuthCallback: async () => {},
  loggUt: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bruker, setBruker] = useState<BrukerData | null>(null);
  const [laster, setLaster] = useState(true);

  const byttToken = trpc.mobilAuth.byttToken.useMutation();

  // Sjekk eksisterende token ved oppstart
  useEffect(() => {
    async function sjekkToken() {
      try {
        const token = await hentSessionToken();
        if (token) {
          const lagretBruker = await hentBrukerData();
          if (lagretBruker) {
            setBruker(lagretBruker);
          }
        }
      } catch {
        // Ugyldig token — ignorer
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

  const loggUt = useCallback(async () => {
    await loggUtTjeneste();
    setBruker(null);
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
        loggUt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
