import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";
import type { EgenskapsFelt, RegisterVerdenLagInfo, TegningVerktoy } from "@sitedoc/shared";
import { hentWebUrl } from "../config/auth";

// RETUR leveranse 2 (Kontrollør, punkt 2): et NATIVT WebView-last-problem (offline
// nett-drop midt i last, DNS-feil, http-feilstatus) kommer ALDRI som en "feil"-
// postMessage fra siden selv — JS-en der har aldri fått kjøre. Uten en tidsgrense
// henger `{!klarWeb && !sideFeil}`-spinneren i det uendelige (samme felle som
// ble flagget på web i RETUR 4). Samme budsjett som den andre nett-race-n i
// lokasjoner.tsx (10 s) — generøs nok for normal 4G, kort nok til å ikke late
// som alt er greit når linjen faktisk er nede.
const LASTE_TIDSGRENSE_MS = 10000;

/**
 * Mobil leveranse 2 (arbeidstegning-f1, "SVAR mobil leveranse 1 d5f90b1a" i
 * relay/inbox-orkestrator.md): "motor-last i appen uten lupe/måling" — ren
 * last+vis (pan/zoom fra dxf-viewers egne kontroller). Delt mellom
 * `(tabs)/lokasjoner.tsx` (ekte visning) og `dxf-webgl-debug.tsx` (røyktest-
 * skjermen fra leveranse 1), så WebView-oppkoblingen ikke dupliseres.
 *
 * Leveranse 3+4 ("POST: mobil leveranse 3+4, lupe og måling i dxf-viewer"):
 * måling (Linjal/Polylinje/Areal/Snap) + lupe er bygget INN I `DxfViewerTegning`
 * (web-komponenten, se dens filheader) — denne komponenten er bare en tynn
 * postMessage-bro videre til web-siden (`settMaleVerktoy` m.fl. på refen).
 * Markør-trykk/GPS-overlegg er FORTSATT ikke med (egen leveranse, skjules bak
 * `!brukDxfViewerMobil` i `lokasjoner.tsx`).
 *
 * Rendrer `DxfViewerTegning` (ekte web-komponent) via den auth-frie
 * `/dxf-viewer-smoketest`-siden, samme postMessage-mønster som `IfcViewer.tsx`
 * bruker for `/mobil-viewer`.
 *
 * Mobilplanen (F1+F2, "mobilplanen er godkjent i sin helhet", 2026-10-17): siden
 * er nå en REN data-bro når den kjører i denne WebView-en (skrur av sine egne
 * flytende paneler, se filheaderen i `dxf-viewer-smoketest/page.tsx`) — RN bygger
 * native paneler (`TegningEgenskapsArk`/`TegningLagPanel` i `lokasjoner.tsx`)
 * drevet av de nye `objektValgt`/`laginventarKlar`-meldingene videresendt her, og
 * `settLagSynlig` på refen poster lag av/på tilbake samme vei.
 */

export interface DxfViewerTegningMobilProps {
  dxfUrl: string;
  registerWorldUrl: string;
  rotasjonOverstyrt: number | null;
  /** Kalt når web-siden rapporterer fps på forespørsel (se `beOmStatus` på ref). */
  onMetrics?: (metrics: { fps: { median: number; lavest: number }; prøver: number }) => void;
  /** RETUR leveranse 2 (Kontrollør, punkt 2): kalt ved NATIV WebView-last-feil
   * (onError/onHttpError) eller tidsgrense uten "klar" — kalleren faller da til
   * SVG-veien. Komponenten viser samtidig sin egen feil-overlegg (sideFeil under),
   * så debug-skjermen (som ikke har en SVG-vei å falle til) fortsatt viser feilen. */
  onLastFeil?: () => void;
  /** Leveranse 3+4: kalt når måleverktøyet blir tilgjengelig/utilgjengelig ($INSUNITS lest). */
  onMaleKlarEndring?: (kanMale: boolean) => void;
  /** F1: kalt ved trykk på objekt utenfor målemodus (null = ingen/avmarkert). */
  onObjektValgt?: (felt: EgenskapsFelt[] | null) => void;
  /** F2: kalt når registeret er lastet og laginventaret er klart (null = ingen tegning). */
  onLaginventarKlar?: (laginventar: RegisterVerdenLagInfo[] | null) => void;
}

export interface DxfViewerTegningMobilRef {
  /** Be web-siden rapportere nåværende fps-måling (kun brukt av røyktest-skjermen). */
  beOmStatus: () => void;
  /** Leveranse 3+4 — måleverktøyet, videresendt til web-siden via postMessage (se
   * `dxf-viewer-smoketest/page.tsx`-filheaderen for protokollen). */
  settMaleVerktoy: (v: TegningVerktoy) => void;
  settMaleOrtho: (på: boolean) => void;
  settMaleSnap: (på: boolean) => void;
  fullfoerMaling: () => void;
  gjenopptaMaling: () => void;
  slettAktivMaling: () => void;
  slettAlleMaalinger: () => void;
  /** F2: slå et DXF-lag av/på (dxf-viewers `ShowLayer`, via web-siden). */
  settLagSynlig: (navn: string, synlig: boolean) => void;
}

export const DxfViewerTegningMobil = forwardRef<DxfViewerTegningMobilRef, DxfViewerTegningMobilProps>(
  function DxfViewerTegningMobil(
    { dxfUrl, registerWorldUrl, rotasjonOverstyrt, onMetrics, onLastFeil, onMaleKlarEndring, onObjektValgt, onLaginventarKlar },
    ref,
  ) {
    const webViewRef = useRef<WebView>(null);
    const [klarWeb, setKlarWeb] = useState(false);
    const [sendt, setSendt] = useState(false);
    // Katastrofal feil i selve WebView-siden (window.onerror) — IKKE web-komponentens
    // egen last-feil (den har sin egen "Prøv igjen"-knapp inni WebView-en allerede).
    const [sideFeil, setSideFeil] = useState<string | null>(null);
    const tidsgrenseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // NATIV last-feil (offline-drop, DNS, http-status) ELLER tidsgrense uten
    // "klar" — se filheaderen. Setter sideFeil (synlig i debug-skjermen) OG
    // melder oppover (lokasjoner.tsx faller til SVG-veien).
    const håndterNativLastFeil = useCallback(
      (melding: string) => {
        if (tidsgrenseRef.current) {
          clearTimeout(tidsgrenseRef.current);
          tidsgrenseRef.current = null;
        }
        setSideFeil(melding);
        onLastFeil?.();
      },
      [onLastFeil],
    );

    const handleWebViewError = useCallback(
      (e: WebViewErrorEvent) => {
        håndterNativLastFeil(`Kunne ikke laste tegningsvisningen (${e.nativeEvent.description || e.nativeEvent.code})`);
      },
      [håndterNativLastFeil],
    );

    const handleHttpError = useCallback(
      (e: WebViewHttpErrorEvent) => {
        håndterNativLastFeil(`Kunne ikke laste tegningsvisningen (HTTP ${e.nativeEvent.statusCode})`);
      },
      [håndterNativLastFeil],
    );

    // Tidsgrense: siden kan laste OK native (ingen onError/onHttpError) men
    // aldri nå "klar" (f.eks. nett falt midt i selve dxf/register-nedlastingen
    // INNI WebView-en — det kommer normalt som en "feil"-postMessage derfra,
    // men en reell hang der JS-en selv henger skal ikke gi evig spinner heller).
    useEffect(() => {
      if (klarWeb || sideFeil) return;
      tidsgrenseRef.current = setTimeout(() => {
        håndterNativLastFeil("Tegningsvisningen svarte ikke i tide");
      }, LASTE_TIDSGRENSE_MS);
      return () => {
        if (tidsgrenseRef.current) {
          clearTimeout(tidsgrenseRef.current);
          tidsgrenseRef.current = null;
        }
      };
      // dxfUrl/registerWorldUrl: ny tegning skal starte tidsgrensen på nytt.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [klarWeb, sideFeil, dxfUrl, registerWorldUrl, håndterNativLastFeil]);

    const sendStart = useCallback(() => {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "start", dxfUrl, registerWorldUrl, rotasjonOverstyrt }),
      );
      setSendt(true);
    }, [dxfUrl, registerWorldUrl, rotasjonOverstyrt]);

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        // RETUR leveranse 3+4 (Kontrollør, punkt 3): `event.nativeEvent.url` er URL-en
        // til rammen som postet meldingen — avvis alt som ikke kommer fra siden vi selv
        // lastet (f.eks. en injisert underramme). Tom streng (noen Android-WebView-
        // versjoner ved tidlig last) godtas, siden den ikke er en annen origin.
        if (event.nativeEvent.url && !event.nativeEvent.url.startsWith(hentWebUrl())) return;
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === "klar") {
            setKlarWeb(true);
          } else if (msg.type === "metrics") {
            onMetrics?.(msg);
          } else if (msg.type === "feil") {
            setSideFeil(msg.melding);
          } else if (msg.type === "maleKlar") {
            onMaleKlarEndring?.(!!msg.kanMale);
          } else if (msg.type === "objektValgt") {
            onObjektValgt?.(msg.felt ?? null);
          } else if (msg.type === "laginventarKlar") {
            onLaginventarKlar?.(msg.laginventar ?? null);
          }
        } catch {
          /* Ignorer ugyldig JSON */
        }
      },
      [onMetrics, onMaleKlarEndring, onObjektValgt, onLaginventarKlar],
    );

    useEffect(() => {
      if (klarWeb && !sendt) sendStart();
    }, [klarWeb, sendt, sendStart]);

    // Ny tegning (annen dxfUrl) mens komponenten står: send ny start-melding.
    useEffect(() => {
      setSendt(false);
      setSideFeil(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dxfUrl, registerWorldUrl]);

    useImperativeHandle(ref, () => ({
      beOmStatus: () => webViewRef.current?.postMessage(JSON.stringify({ type: "rapporter" })),
      settMaleVerktoy: (v) => webViewRef.current?.postMessage(JSON.stringify({ type: "maleVerktoy", verktoy: v })),
      settMaleOrtho: (på) => webViewRef.current?.postMessage(JSON.stringify({ type: "maleOrtho", på })),
      settMaleSnap: (på) => webViewRef.current?.postMessage(JSON.stringify({ type: "maleSnap", på })),
      fullfoerMaling: () => webViewRef.current?.postMessage(JSON.stringify({ type: "maleFullfoer" })),
      gjenopptaMaling: () => webViewRef.current?.postMessage(JSON.stringify({ type: "maleGjenoppta" })),
      slettAktivMaling: () => webViewRef.current?.postMessage(JSON.stringify({ type: "maleSlettAktiv" })),
      slettAlleMaalinger: () => webViewRef.current?.postMessage(JSON.stringify({ type: "maleSlettAlle" })),
      settLagSynlig: (navn, synlig) =>
        webViewRef.current?.postMessage(JSON.stringify({ type: "settLagSynlig", navn, synlig })),
    }));

    const lastPaaNytt = useCallback(() => {
      setSideFeil(null);
      setKlarWeb(false);
      setSendt(false);
      webViewRef.current?.reload();
    }, []);

    return (
      <View style={styles.content}>
        <WebView
          ref={webViewRef}
          source={{ uri: `${hentWebUrl()}/dxf-viewer-smoketest` }}
          style={styles.webview}
          onMessage={handleMessage}
          onError={handleWebViewError}
          onHttpError={handleHttpError}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
        />

        {!klarWeb && !sideFeil && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        )}

        {sideFeil && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>{sideFeil}</Text>
            <TouchableOpacity onPress={lastPaaNytt} style={styles.retryBtn}>
              <Text style={styles.retryTekst}>Prøv igjen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  content: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243,244,246,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  overlayText: { fontSize: 14, color: "#374151", fontWeight: "500", textAlign: "center" },
  retryBtn: { marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 },
  retryTekst: { color: "#dc2626", fontSize: 13, fontWeight: "500" },
});
