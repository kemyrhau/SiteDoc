/**
 * Persistent WebView for 3D-visning.
 * Én WebView-instans deles mellom alle skjermer som trenger 3D (3d-visning, tegning-3d, live-view).
 * Modeller lastes kun ved prosjekt/bygningsbytte — ikke ved skjermnavigasjon.
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "../services/auth";
import { useProsjekt } from "./ProsjektKontekst";
import { useBygning } from "./BygningKontekst";
import { trpc } from "../lib/trpc";

const { width: SKJERMBREDDE, height: SKJERMHOYDE } = Dimensions.get("window");

interface IfcModell {
  id: string;
  name: string;
  fileUrl: string;
  updatedAt?: string;
}

interface Bounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

type MeldingsHandler = (msg: Record<string, unknown>) => void;

interface WebView3DApi {
  /** Aktiver WebView i gitte skjerm-bounds */
  aktiver: (bounds: Bounds) => void;
  /** Deaktiver WebView (skjul) */
  deaktiver: () => void;
  /** Send melding til WebView */
  postMelding: (msg: Record<string, unknown>) => void;
  /** Registrer meldingshandler — returnerer unsubscribe */
  registrerHandler: (handler: MeldingsHandler) => () => void;
  /** Er WebView klar? */
  erKlar: boolean;
  /** Er modeller lastet? */
  erLastet: boolean;
  /** Antall lastede modeller */
  lastet: number;
  /** Totalt antall modeller */
  totalt: number;
  /** IFC-modeller for gjeldende prosjekt/bygning */
  ifcModeller: IfcModell[];
  /** Feilmelding */
  feil: string | null;
  /** Er WebView aktiv (synlig)? */
  erAktiv: boolean;
}

const WebView3DContext = createContext<WebView3DApi | null>(null);

export function useWebView3D(): WebView3DApi {
  const ctx = useContext(WebView3DContext);
  if (!ctx) throw new Error("useWebView3D brukt utenfor WebView3DProvider");
  return ctx;
}

export function WebView3DProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const handlersRef = useRef<Set<MeldingsHandler>>(new Set());

  const [webViewNøkkel, setWebViewNøkkel] = useState(0);
  const [erKlar, setErKlar] = useState(false);
  const [lastet, setLastet] = useState(0);
  const [totalt, setTotalt] = useState(0);
  const [feil, setFeil] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const [bounds, setBounds] = useState<Bounds>({ top: 0, left: 0, width: SKJERMBREDDE, height: SKJERMHOYDE });

  // Spor hvilke modeller som er lastet for å unngå re-lasting
  const lastedeModellerRef = useRef<string>("");
  // Krasjbegrensning — maks 1 automatisk retry
  const krasjTellerRef = useRef(0);

  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();

  // Hent tegninger for prosjekt/bygning
  const tegningQuery = (trpc.tegning.hentForProsjekt as unknown as {
    useQuery: (input: { projectId: string; buildingId?: string }, opts: { enabled: boolean }) => { data: unknown; isLoading: boolean };
  }).useQuery(
    { projectId: valgtProsjektId!, ...(valgtBygningId ? { buildingId: valgtBygningId } : {}) },
    { enabled: !!valgtProsjektId },
  );

  const ifcModeller: IfcModell[] = useMemo(() =>
    ((tegningQuery.data ?? []) as Array<{
      id: string; name: string; fileUrl: string; fileType?: string; updatedAt?: string;
    }>)
      .filter((t) => t.fileUrl && t.fileType?.toLowerCase() === "ifc")
      .map((t) => ({ id: t.id, name: t.name, fileUrl: t.fileUrl, updatedAt: t.updatedAt })),
    [tegningQuery.data],
  );

  const erLastet = lastet >= ifcModeller.length && ifcModeller.length > 0;

  // Last modeller når WebView er klar, aktiv (synlig) og modeller finnes
  useEffect(() => {
    if (!erKlar || !aktiv || ifcModeller.length === 0) return;

    // Lag nøkkel for å sjekke om modellene har endret seg
    const nøkkel = ifcModeller.map((m) => m.fileUrl).sort().join("|");
    if (nøkkel === lastedeModellerRef.current) return; // Allerede lastet

    (async () => {
      const token = await hentSessionToken();
      const baseUrl = AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "");
      const urls = ifcModeller.map((m) => {
        const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
        return `${baseUrl}${url}`;
      });

      setLastet(0);
      setTotalt(ifcModeller.length);
      setFeil(null);

      webViewRef.current?.postMessage(
        JSON.stringify({ type: "lastModeller", urls, token }),
      );

      lastedeModellerRef.current = nøkkel;
    })();
  }, [erKlar, aktiv, ifcModeller]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset ved prosjekt/bygningsbytte
  useEffect(() => {
    lastedeModellerRef.current = "";
    krasjTellerRef.current = 0;
    setLastet(0);
    setTotalt(0);
    setFeil(null);
  }, [valgtProsjektId, valgtBygningId]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      switch (msg.type) {
        case "klar":
          setErKlar(true);
          break;
        case "modellLastet":
          setLastet((msg.index as number) + 1);
          setTotalt(msg.totalt as number);
          break;
        case "alleLastet":
          setLastet(msg.antall as number);
          break;
        case "feil":
          setFeil(msg.melding as string);
          break;
      }
      // Videresend til alle registrerte handlers
      for (const handler of handlersRef.current) {
        handler(msg);
      }
    } catch { /* Ignorer ugyldig JSON */ }
  }, []);

  const aktiver = useCallback((nyeBounds: Bounds) => {
    setBounds(nyeBounds);
    setAktiv(true);
  }, []);

  const deaktiver = useCallback(() => {
    setAktiv(false);
  }, []);

  // Håndter WebView-krasj (iOS: minne-press, Android: render-prosess drept)
  const handleKrasj = useCallback(() => {
    krasjTellerRef.current += 1;
    console.warn(`[WebView3D] WebView krasjet (forsøk ${krasjTellerRef.current})`);

    if (krasjTellerRef.current > 1) {
      // Ikke prøv igjen — vis feilmelding
      setFeil("3D-visningen krasjet gjentatte ganger. Prøv å velge en enkelt bygning med færre modeller.");
      setErKlar(false);
      return;
    }

    // Første krasj — prøv én gang til
    setErKlar(false);
    setLastet(0);
    setTotalt(0);
    lastedeModellerRef.current = "";
    setWebViewNøkkel((prev) => prev + 1);
  }, []);

  const postMelding = useCallback((msg: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  const registrerHandler = useCallback((handler: MeldingsHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const api: WebView3DApi = {
    aktiver,
    deaktiver,
    postMelding,
    registrerHandler,
    erKlar,
    erLastet,
    lastet,
    totalt,
    ifcModeller,
    feil,
    erAktiv: aktiv,
  };

  const viewerUrl = `${AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "")}/mobil-viewer`;

  return (
    <WebView3DContext.Provider value={api}>
      {children}
      {/* Persistent WebView — alltid rendret, posisjonert av konsumerende skjerm */}
      <View
        style={[
          styles.webViewContainer,
          aktiv
            ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height }
            : styles.skjult,
        ]}
        pointerEvents={aktiv ? "auto" : "none"}
      >
        <WebView
          key={webViewNøkkel}
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          onContentProcessDidTerminate={handleKrasj}
          onRenderProcessGone={handleKrasj}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
        />
      </View>
    </WebView3DContext.Provider>
  );
}

const styles = StyleSheet.create({
  webViewContainer: {
    position: "absolute",
    zIndex: 1000,
    overflow: "hidden",
  },
  skjult: {
    // Plasser utenfor skjermen for å holde WebGL-kontekst levende
    top: -SKJERMHOYDE,
    left: 0,
    width: SKJERMBREDDE,
    height: SKJERMHOYDE,
    opacity: 0,
  },
  webview: {
    flex: 1,
  },
});
