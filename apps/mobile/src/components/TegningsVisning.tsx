import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeTouchEvent,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { X, AlertTriangle, RefreshCw } from "lucide-react-native";

const LASTING_TIMEOUT_MS = 15_000;

export interface Markør {
  x: number;
  y: number;
  id: string;
  label?: string;
  farge?: string;
}

export interface GpsMarkør {
  x: number;
  y: number;
}

interface TegningsVisningProps {
  tegningUrl: string;
  tegningNavn: string;
  onLukk: () => void;
  onTrykk?: (posX: number, posY: number) => void;
  onMarkørTrykk?: (id: string) => void;
  markører?: Markør[];
  gpsMarkør?: GpsMarkør | null;
}

function erPdf(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

export function TegningsVisning({
  tegningUrl,
  tegningNavn,
  onLukk,
  onTrykk,
  onMarkørTrykk,
  markører = [],
  gpsMarkør,
}: TegningsVisningProps) {
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const { width, height } = useWindowDimensions();
  const erPdfFil = erPdf(tegningUrl);
  const [bildeDimensjoner, setBildeDimensjoner] = useState({ width: 0, height: 0 });
  const [naturligBilde, setNaturligBilde] = useState<{ w: number; h: number } | null>(null);
  const bildeRef = useRef<View>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bildedimensjoner basert på naturlig aspektforhold — fyller bredden, ingen letterboxing
  const bildeSt = useMemo(() => {
    if (naturligBilde && naturligBilde.w > 0 && naturligBilde.h > 0) {
      const ratio = naturligBilde.h / naturligBilde.w;
      return { width, height: width * ratio };
    }
    return { width, height: height * 0.8 };
  }, [naturligBilde, width, height]);

  // Hent naturlig bildedimensjon for korrekt markør-posisjonering
  useEffect(() => {
    if (!erPdfFil && tegningUrl) {
      Image.getSize(
        tegningUrl,
        (w, h) => setNaturligBilde({ w, h }),
        () => setNaturligBilde(null),
      );
    }
  }, [tegningUrl, erPdfFil]);

  // Reset tilstand ved endring av URL
  useEffect(() => {
    setLaster(true);
    setFeil(false);
  }, [tegningUrl]);

  // Timeout: vis feil dersom lasting tar over 15 sekunder
  useEffect(() => {
    if (laster && !feil) {
      timeoutRef.current = setTimeout(() => {
        if (laster) {
          setLaster(false);
          setFeil(true);
        }
      }, LASTING_TIMEOUT_MS);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [laster, feil]);

  const håndterLastetFerdig = useCallback(() => {
    setLaster(false);
    setFeil(false);
  }, []);

  const håndterFeil = useCallback(() => {
    setLaster(false);
    setFeil(true);
  }, []);

  const prøvIgjen = useCallback(() => {
    setLaster(true);
    setFeil(false);
  }, []);

  const håndterBildeLayout = useCallback((e: LayoutChangeEvent) => {
    setBildeDimensjoner({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }, []);

  // Drag-deteksjon: lagre startposisjon og sjekk om fingeren flyttet seg
  const trykkStartRef = useRef<{ x: number; y: number; tid: number } | null>(null);
  const harDrattRef = useRef(false);
  const TRYKK_TERSKEL = 10; // piksler — mer enn dette = drag, ikke tap

  const håndterTrykkStart = useCallback((e: GestureResponderEvent): boolean => {
    const nativeEvent = e.nativeEvent as NativeTouchEvent;
    if (nativeEvent.touches && nativeEvent.touches.length > 1) return false;
    trykkStartRef.current = {
      x: nativeEvent.pageX,
      y: nativeEvent.pageY,
      tid: Date.now(),
    };
    harDrattRef.current = false;
    return true;
  }, []);

  const håndterBevegelse = useCallback((e: GestureResponderEvent) => {
    if (harDrattRef.current || !trykkStartRef.current) return;
    const { pageX, pageY } = e.nativeEvent;
    const dx = Math.abs(pageX - trykkStartRef.current.x);
    const dy = Math.abs(pageY - trykkStartRef.current.y);
    if (dx > TRYKK_TERSKEL || dy > TRYKK_TERSKEL) {
      harDrattRef.current = true;
    }
  }, []);

  // Håndter trykk på bildeområdet — kun ekte tap (ikke drag/zoom)
  const håndterBildeTrykk = useCallback(
    (e: GestureResponderEvent) => {
      if (!onTrykk || harDrattRef.current) return;
      // Avvis lange trykk (> 500ms)
      if (trykkStartRef.current && Date.now() - trykkStartRef.current.tid > 500) return;

      const { locationX, locationY } = e.nativeEvent;

      const posX = (locationX / bildeSt.width) * 100;
      const posY = (locationY / bildeSt.height) * 100;

      const klampX = Math.max(0, Math.min(100, posX));
      const klampY = Math.max(0, Math.min(100, posY));

      onTrykk(klampX, klampY);
    },
    [onTrykk, bildeSt],
  );

  // Håndter trykk fra PDF WebView via postMessage
  const håndterWebViewMelding = useCallback(
    (e: WebViewMessageEvent) => {
      if (!onTrykk) return;
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "trykk" && typeof data.x === "number" && typeof data.y === "number") {
          onTrykk(data.x, data.y);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onTrykk],
  );

  // JavaScript som injiseres i WebView for å fange klikk
  const injisertJs = `
    (function() {
      document.addEventListener('click', function(e) {
        var x = (e.clientX / window.innerWidth) * 100;
        var y = (e.clientY / window.innerHeight) * 100;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'trykk', x: x, y: y }));
      });
    })();
    true;
  `;

  // Render markører som absolutt posisjonerte prikker (klikkbare)
  const renderMarkører = (bildeW: number, bildeH: number) => {
    return markører.map((m) => {
      const farge = m.farge || "#ef4444";
      return (
        <Pressable
          key={m.id}
          onPress={() => onMarkørTrykk?.(m.id)}
          hitSlop={12}
          style={{
            position: "absolute",
            left: (m.x / 100) * bildeW - 8,
            top: (m.y / 100) * bildeH - 8,
            alignItems: "center",
          }}
        >
          <View style={[stiler.markørPrikk, { backgroundColor: farge, borderColor: farge === "#10b981" ? "#ffffff" : "#ffffff" }]} />
          {m.label && (
            <Text style={stiler.markørLabel}>{m.label}</Text>
          )}
        </Pressable>
      );
    });
  };

  // GPS-posisjon som blå prikk — rendres kun når gpsMarkør har verdi
  const renderGpsMarkør = (bildeW: number, bildeH: number) => {
    if (!gpsMarkør) return null;
    return (
      <View
        style={{
          position: "absolute",
          left: (gpsMarkør.x / 100) * bildeW - 10,
          top: (gpsMarkør.y / 100) * bildeH - 10,
        }}
      >
        <View style={stiler.gpsPrikk}>
          <View style={stiler.gpsPrikkInner} />
        </View>
      </View>
    );
  };

  // Feilvisning med "Prøv igjen"-knapp
  const renderFeilVisning = () => (
    <View style={stiler.feilContainer}>
      <AlertTriangle size={48} color="#f59e0b" />
      <Text style={stiler.feilTekst}>
        Kunne ikke laste tegningen
      </Text>
      <Text style={stiler.feilBeskrivelse}>
        Sjekk nettverkstilkoblingen og prøv igjen
      </Text>
      <Pressable onPress={prøvIgjen} style={stiler.prøvIgjenKnapp}>
        <RefreshCw size={16} color="#ffffff" />
        <Text style={stiler.prøvIgjenTekst}>Prøv igjen</Text>
      </Pressable>
    </View>
  );

  // Lasting-indikator
  const renderLasting = () => (
    <View style={stiler.lastingContainer}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={stiler.lastingTekst}>
        Laster tegning…
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      {/* Header med tegningsnavn og lukk-knapp */}
      <View className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between bg-black/60 px-4 py-3">
        <Pressable
          onPress={onLukk}
          hitSlop={12}
          className="rounded-full bg-white/20 p-2"
        >
          <X size={20} color="#ffffff" />
        </Pressable>
        <Text
          className="flex-1 px-3 text-center text-sm font-medium text-white"
          numberOfLines={1}
        >
          {tegningNavn}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Feilvisning */}
      {feil ? (
        <View style={{ flex: 1, paddingTop: 48 }}>
          {renderFeilVisning()}
        </View>
      ) : erPdfFil ? (
        /* PDF-visning */
        <View style={{ flex: 1, paddingTop: 48 }}>
          {laster && renderLasting()}
          {Platform.OS === "web" ? (
            <View style={{ flex: 1, position: "relative" }}>
              <iframe
                src={tegningUrl}
                style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
                onLoad={håndterLastetFerdig}
              />
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {renderMarkører(width, height * 0.8)}
                {renderGpsMarkør(width, height * 0.8)}
              </View>
              {onTrykk && (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={(e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    const posX = (locationX / width) * 100;
                    const posY = (locationY / (height * 0.8)) * 100;
                    onTrykk(
                      Math.max(0, Math.min(100, posX)),
                      Math.max(0, Math.min(100, posY)),
                    );
                  }}
                />
              )}
            </View>
          ) : (
            <View style={{ flex: 1, position: "relative" }}>
              <WebView
                source={{ uri: tegningUrl }}
                style={{ flex: 1 }}
                startInLoadingState
                renderLoading={() => <View />}
                onLoadEnd={håndterLastetFerdig}
                onError={håndterFeil}
                injectedJavaScript={onTrykk ? injisertJs : undefined}
                onMessage={håndterWebViewMelding}
                allowsInlineMediaPlayback
              />
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {renderMarkører(width, height * 0.8)}
                {renderGpsMarkør(width, height * 0.8)}
              </View>
            </View>
          )}
        </View>
      ) : (
        /* Bildevisning — gesture-systemene er separert */
        <View
          ref={bildeRef}
          onLayout={håndterBildeLayout}
          style={{ flex: 1, position: "relative" }}
        >
          {laster && renderLasting()}

          {/* ScrollView med zoom */}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {/* Bilde + markører i SAMME container — ingen kompensering nødvendig */}
            <View style={{ width: bildeSt.width, height: bildeSt.height, position: "relative" }}>
              <Image
                source={{ uri: tegningUrl }}
                style={{ width: bildeSt.width, height: bildeSt.height }}
                onLoadEnd={håndterLastetFerdig}
                onError={håndterFeil}
              />
              <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {renderMarkører(bildeSt.width, bildeSt.height)}
                {renderGpsMarkør(bildeSt.width, bildeSt.height)}
              </View>
            </View>
          </ScrollView>

          {/* Trykk-overlegg — kun ekte tap (ikke drag/zoom) plasserer markør */}
          {onTrykk && (
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={håndterTrykkStart}
              onResponderMove={håndterBevegelse}
              onResponderRelease={håndterBildeTrykk}
            />
          )}
        </View>
      )}
    </View>
  );
}

const stiler = StyleSheet.create({
  feilContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  feilTekst: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  feilBeskrivelse: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  prøvIgjenKnapp: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e40af",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  prøvIgjenTekst: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  lastingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  lastingTekst: {
    color: "#d1d5db",
    fontSize: 14,
    marginTop: 12,
  },
  markørPrikk: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  markørLabel: {
    color: "#1f2937",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    overflow: "hidden",
  },
  gpsPrikk: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  gpsPrikkInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
