import { useState, useCallback, useRef, useEffect } from "react";
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
  Animated,
} from "react-native";
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeTouchEvent,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { X, MapPin, AlertTriangle, RefreshCw } from "lucide-react-native";

const LASTING_TIMEOUT_MS = 15_000;

export interface Markør {
  x: number;
  y: number;
  id: string;
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
  markører = [],
  gpsMarkør,
}: TegningsVisningProps) {
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState(false);
  const { width, height } = useWindowDimensions();
  const erPdfFil = erPdf(tegningUrl);
  const [bildeDimensjoner, setBildeDimensjoner] = useState({ width: 0, height: 0 });
  const bildeRef = useRef<View>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Håndter trykk på bildeområdet — kun enkelt-fingertrykk
  const håndterBildeTrykk = useCallback(
    (e: GestureResponderEvent) => {
      if (!onTrykk) return;

      const { locationX, locationY } = e.nativeEvent;
      const containerW = bildeDimensjoner.width || width;
      const containerH = bildeDimensjoner.height || height * 0.8;

      const posX = (locationX / containerW) * 100;
      const posY = (locationY / containerH) * 100;

      const klampX = Math.max(0, Math.min(100, posX));
      const klampY = Math.max(0, Math.min(100, posY));

      onTrykk(klampX, klampY);
    },
    [onTrykk, bildeDimensjoner, width, height],
  );

  // Sjekk om touch-event er en enkelt-finger tap (ikke pinch/drag)
  const erEnkeltTap = useCallback((e: GestureResponderEvent): boolean => {
    const nativeEvent = e.nativeEvent as NativeTouchEvent;
    // Avvis multi-touch (pinch-zoom)
    if (nativeEvent.touches && nativeEvent.touches.length > 1) {
      return false;
    }
    return true;
  }, []);

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

  // Render markører som absolutt posisjonerte pinner
  const renderMarkører = (containerW: number, containerH: number) => {
    return markører.map((m) => (
      <View
        key={m.id}
        style={{
          position: "absolute",
          left: (m.x / 100) * containerW - 12,
          top: (m.y / 100) * containerH - 24,
        }}
      >
        <MapPin size={24} color="#ef4444" fill="#ef4444" />
      </View>
    ));
  };

  // GPS-posisjon med Animated for å unngå re-render under zoom
  const gpsAnimX = useRef(new Animated.Value(-100)).current;
  const gpsAnimY = useRef(new Animated.Value(-100)).current;
  const gpsErSynlig = useRef(false);

  useEffect(() => {
    if (gpsMarkør && bildeDimensjoner.width > 0) {
      const cW = bildeDimensjoner.width || width;
      const cH = bildeDimensjoner.height || height * 0.8;
      gpsAnimX.setValue((gpsMarkør.x / 100) * cW - 10);
      gpsAnimY.setValue((gpsMarkør.y / 100) * cH - 10);
      gpsErSynlig.current = true;
    } else {
      gpsAnimX.setValue(-100);
      gpsAnimY.setValue(-100);
      gpsErSynlig.current = false;
    }
  }, [gpsMarkør, bildeDimensjoner, width, height, gpsAnimX, gpsAnimY]);

  const renderGpsMarkør = () => {
    return (
      <Animated.View
        style={{
          position: "absolute",
          left: gpsAnimX,
          top: gpsAnimY,
        }}
      >
        <View style={stiler.gpsPrikk}>
          <View style={stiler.gpsPrikkInner} />
        </View>
      </Animated.View>
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
                {renderGpsMarkør()}
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
                {renderGpsMarkør()}
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

          {/* ScrollView med zoom — uten Pressable inni */}
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: tegningUrl }}
              style={{ width, height: height * 0.8 }}
              resizeMode="contain"
              onLoadEnd={håndterLastetFerdig}
              onError={håndterFeil}
            />
          </ScrollView>

          {/* Markører og GPS-posisjon som eget overlegg — blokkerer ikke gestures */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {renderMarkører(
              bildeDimensjoner.width || width,
              bildeDimensjoner.height || height * 0.8,
            )}
            {renderGpsMarkør()}
          </View>

          {/* Trykk-overlegg — kun enkelt-fingertrykk plasserer markør */}
          {onTrykk && (
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={erEnkeltTap}
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
