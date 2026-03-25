/**
 * Persistent WebView for 3D-visning — enkel tilnærming.
 *
 * WebView rendres full-screen i _layout.tsx, alltid montert.
 * Synlighet kontrolleres med opacity + pointerEvents.
 * Skjermer som trenger 3D setter synlig=true ved mount.
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
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "../services/auth";
import { useProsjekt } from "./ProsjektKontekst";
import { useBygning } from "./BygningKontekst";
import { trpc } from "../lib/trpc";

const FRAG_MAPPE = `${FileSystem.documentDirectory}sitedoc-fragments/`;

interface IfcModell {
  id: string;
  name: string;
  fileUrl: string;
  updatedAt?: string;
}

type MeldingsHandler = (msg: Record<string, unknown>) => void;

interface WebView3DApi {
  /** Vis WebView */
  vis: () => void;
  /** Skjul WebView */
  skjul: () => void;
  /** Er WebView synlig? */
  erSynlig: boolean;
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
  /** IFC-modeller */
  ifcModeller: IfcModell[];
  /** Feilmelding */
  feil: string | null;
}

const WebView3DContext = createContext<WebView3DApi | null>(null);

export function useWebView3D(): WebView3DApi {
  const ctx = useContext(WebView3DContext);
  if (!ctx) throw new Error("useWebView3D brukt utenfor WebView3DProvider");
  return ctx;
}

/** Generer fragment-filsti fra URL */
function fragSti(url: string): string {
  const deler = url.split("/");
  const filnavn = (deler[deler.length - 1] ?? "modell").replace(".ifc", ".frag");
  return `${FRAG_MAPPE}${filnavn}`;
}

export function WebView3DProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const handlersRef = useRef<Set<MeldingsHandler>>(new Set());
  const lastedeModellerRef = useRef<string>("");

  const [erKlar, setErKlar] = useState(false);
  const [lastet, setLastet] = useState(0);
  const [totalt, setTotalt] = useState(0);
  const [feil, setFeil] = useState<string | null>(null);
  const [synlig, setSynlig] = useState(false);

  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();

  // Hent tegninger
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

  // Last modeller når WebView er klar OG synlig
  useEffect(() => {
    if (!erKlar || !synlig || ifcModeller.length === 0) return;

    const nøkkel = ifcModeller.map((m) => m.fileUrl).sort().join("|");
    if (nøkkel === lastedeModellerRef.current) return;

    let avbrutt = false;

    async function sendModeller() {
      const token = await hentSessionToken();
      const baseUrl = AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "");
      const modelUrls = ifcModeller.map((m) => {
        const url = m.fileUrl.startsWith("/api") ? m.fileUrl : `/api${m.fileUrl}`;
        return `${baseUrl}${url}`;
      });

      // Les cachede fragmenter
      const cachedFragments: Record<string, string> = {};
      try {
        const mappeInfo = await FileSystem.getInfoAsync(FRAG_MAPPE);
        if (mappeInfo.exists) {
          for (const fullUrl of modelUrls) {
            const sti = fragSti(fullUrl);
            const info = await FileSystem.getInfoAsync(sti);
            if (info.exists) {
              const b64 = await FileSystem.readAsStringAsync(sti, { encoding: FileSystem.EncodingType.Base64 });
              cachedFragments[fullUrl] = b64;
            }
          }
        }
      } catch { /* */ }

      if (avbrutt) return;

      setLastet(0);
      setTotalt(ifcModeller.length);
      setFeil(null);

      const harCache = Object.keys(cachedFragments).length > 0;
      console.log(`[WebView3D] ${modelUrls.length} modeller, ${Object.keys(cachedFragments).length} fra cache`);

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "lastModeller",
          urls: modelUrls,
          token,
          ...(harCache ? { cachedFragments } : {}),
        }),
      );

      lastedeModellerRef.current = nøkkel;
    }

    sendModeller();
    return () => { avbrutt = true; };
  }, [erKlar, synlig, ifcModeller]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset ved prosjekt/bygningsbytte
  useEffect(() => {
    lastedeModellerRef.current = "";
    setLastet(0);
    setTotalt(0);
    setFeil(null);
  }, [valgtProsjektId, valgtBygningId]);

  // Lagre fragment-cache
  const lagreFragment = useCallback(async (url: string, b64Data: string) => {
    try {
      const mappeInfo = await FileSystem.getInfoAsync(FRAG_MAPPE);
      if (!mappeInfo.exists) {
        await FileSystem.makeDirectoryAsync(FRAG_MAPPE, { intermediates: true });
      }
      await FileSystem.writeAsStringAsync(fragSti(url), b64Data, { encoding: FileSystem.EncodingType.Base64 });
    } catch { /* */ }
  }, []);

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
        case "cacheFragment":
          if (msg.url && msg.data) {
            lagreFragment(msg.url as string, msg.data as string);
          }
          break;
      }
      for (const handler of handlersRef.current) {
        handler(msg);
      }
    } catch { /* */ }
  }, [lagreFragment]);

  const vis = useCallback(() => setSynlig(true), []);
  const skjul = useCallback(() => setSynlig(false), []);

  const postMelding = useCallback((msg: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  const registrerHandler = useCallback((handler: MeldingsHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const api: WebView3DApi = {
    vis, skjul, erSynlig: synlig,
    postMelding, registrerHandler,
    erKlar, erLastet, lastet, totalt,
    ifcModeller, feil,
  };

  const viewerUrl = `${AUTH_CONFIG.apiUrl.replace("/trpc", "").replace("api.", "")}/mobil-viewer`;

  return (
    <WebView3DContext.Provider value={api}>
      {children}
      {/* Persistent WebView — full-screen, synlighet via opacity */}
      <View
        style={[styles.webViewContainer, !synlig && styles.skjult]}
        pointerEvents={synlig ? "auto" : "none"}
      >
        <WebView
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          onContentProcessDidTerminate={() => {
            setErKlar(false);
            lastedeModellerRef.current = "";
            setFeil("3D-visningen krasjet. Prøv igjen.");
          }}
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  skjult: {
    opacity: 0,
  },
  webview: {
    flex: 1,
  },
});
